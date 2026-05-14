/**
 * useProctoring hook
 * - Opens webcam
 * - Sends frames to backend via WebSocket every N ms
 * - Tracks tab visibility (tab-switch detection)
 * - Returns: videoRef, status, alerts, proctoringScore, gaze
 */
import { useEffect, useRef, useState, useCallback } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL ||
  (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host

const FRAME_INTERVAL_MS = 2000  // send frame every 2 seconds
const JPEG_QUALITY      = 0.6   // lower = faster, less bandwidth

export function useProctoring(sessionId, enabled = true) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(document.createElement('canvas'))
  const wsRef       = useRef(null)
  const intervalRef = useRef(null)
  const tabSwitch   = useRef(false)

  const [status, setStatus]           = useState('idle')  // idle|connecting|connected|error
  const [alerts, setAlerts]           = useState([])
  const [proctoringScore, setScore]   = useState(100)
  const [gaze, setGaze]               = useState('center')
  const [faceCount, setFaceCount]     = useState(0)
  const [wsError, setWsError]         = useState(null)

  // Tab visibility detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) tabSwitch.current = true
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Capture frame from video → base64 JPEG
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    const canvas = canvasRef.current
    canvas.width  = 320   // downsample for speed
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 320, 240)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  }, [])

  // Send frame via WebSocket
  const sendFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const frame = captureFrame()
    if (!frame) return

    wsRef.current.send(JSON.stringify({
      type: 'frame',
      data: frame,
      tab_switch: tabSwitch.current,
    }))
    tabSwitch.current = false  // reset after sending
  }, [captureFrame])

  useEffect(() => {
    if (!sessionId || !enabled) return

    let stream = null

    const startProctoring = async () => {
      // Start webcam
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        setStatus('error')
        setWsError('Camera access denied: ' + err.message)
        return
      }

      // Connect WebSocket
      const token = localStorage.getItem('token')
      const wsUrl = `${WS_BASE}/api/v1/proctor/ws/${sessionId}?token=${token}`
      setStatus('connecting')

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        setWsError(null)
        // Start sending frames on interval
        intervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS)
      }

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          if (data.error) {
            setWsError(data.error)
            return
          }
          if (data.face_count !== undefined) setFaceCount(data.face_count)
          if (data.gaze) setGaze(data.gaze)
          if (data.proctoring_score !== undefined) setScore(data.proctoring_score)
          if (data.alerts?.length) {
            setAlerts(prev => [...data.alerts.map(a => ({
              ...a,
              timestamp: new Date().toISOString()
            })), ...prev].slice(0, 50))  // keep last 50
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onerror = () => {
        setStatus('error')
        setWsError('WebSocket connection error')
      }

      ws.onclose = () => {
        setStatus('idle')
        clearInterval(intervalRef.current)
      }
    }

    startProctoring()

    return () => {
      clearInterval(intervalRef.current)
      wsRef.current?.close()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [sessionId, enabled, sendFrame])

  // Ping keepalive every 30s
  useEffect(() => {
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
    return () => clearInterval(ping)
  }, [])

  return { videoRef, status, alerts, proctoringScore, gaze, faceCount, wsError }
}
