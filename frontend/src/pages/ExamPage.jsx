import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProctoring } from '../hooks/useProctoring'
import api from '../utils/api'
import {
  AlertTriangle, CheckCircle, Camera, Eye, Users, Wifi, WifiOff,
  Clock, Send, ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

// Alert badge
const AlertBadge = ({ type }) => {
  const map = {
    no_face:         { label: 'No Face',         cls: 'badge-high' },
    multiple_faces:  { label: 'Multiple Faces',   cls: 'badge-critical' },
    looking_away:    { label: 'Looking Away',     cls: 'badge-medium' },
    tab_switch:      { label: 'Tab Switch',       cls: 'badge-high' },
    suspicious_movement: { label: 'Movement',     cls: 'badge-low' },
  }
  const cfg = map[type] || { label: type, cls: 'badge-low' }
  return <span className={cfg.cls}>{cfg.label}</span>
}

// Gaze indicator
const GazeIndicator = ({ gaze, faceCount }) => {
  const gazeColor = gaze === 'center' ? 'text-green-400' : 'text-red-400'
  const faceColor = faceCount === 1 ? 'text-green-400' : faceCount === 0 ? 'text-red-400' : 'text-yellow-400'
  return (
    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
      <span className={`flex items-center gap-1 ${faceColor}`}>
        <Users className="w-3 h-3" />
        {faceCount} face{faceCount !== 1 ? 's' : ''}
      </span>
      <span className={`flex items-center gap-1 ${gazeColor}`}>
        <Eye className="w-3 h-3" />
        {gaze}
      </span>
    </div>
  )
}

export default function ExamPage() {
  const { examId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [exam, setExam]       = useState(null)
  const [sessionId, setSId]   = useState(null)
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTime]   = useState(0)
  const [submitting, setSubmit] = useState(false)
  const [confirmed, setConf]  = useState(false)  // camera permission confirmed

  // Start session + load exam
  useEffect(() => {
    const init = async () => {
      try {
        const [examRes, sessionRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.post(`/exams/${examId}/start`),
        ])
        setExam(examRes.data)
        setSId(sessionRes.data.session_id)
        setTime(examRes.data.duration_minutes * 60)
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to start exam')
        navigate('/dashboard')
      }
    }
    init()
  }, [examId])

  // Countdown timer
  useEffect(() => {
    if (!timeLeft) return
    const t = setInterval(() => {
      setTime(p => {
        if (p <= 1) { clearInterval(t); handleSubmit(); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [timeLeft > 0])

  // Proctoring hook - only active after camera confirmed
  const { videoRef, status, alerts, proctoringScore, gaze, faceCount, wsError } =
    useProctoring(sessionId, confirmed)

  // Alert toast on new alert
  const prevAlerts = useRef(0)
  useEffect(() => {
    if (alerts.length > prevAlerts.current) {
      const latest = alerts[0]
      toast.error(`⚠️ ${latest.message}`, { duration: 3000 })
      prevAlerts.current = alerts.length
    }
  }, [alerts])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmit(true)
    try {
      await api.post(`/exams/${examId}/submit`, { answers })
      toast.success('Exam submitted!')
      navigate('/dashboard')
    } catch (err) {
      toast.error('Submission failed')
      setSubmit(false)
    }
  }

  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (!confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <Camera className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-3">Camera Permission Required</h2>
          <p className="text-gray-400 text-sm mb-6">
            This exam requires webcam access for AI proctoring. Ensure you're in a well-lit,
            quiet room. Your video is analyzed locally — only alert events are saved.
          </p>
          <ul className="text-left text-sm text-gray-300 space-y-2 mb-6">
            <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />Face must be visible at all times</li>
            <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />Only one person allowed in frame</li>
            <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />Do not switch browser tabs</li>
            <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />Do not use phone or external devices</li>
          </ul>
          <button className="btn-primary w-full py-3" onClick={() => setConf(true)}>
            I Understand — Start Exam
          </button>
        </div>
      </div>
    )
  }

  if (!exam) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading exam...</div>
  }

  const questions = exam.questions || []
  const q = questions[current]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">{exam.title}</h1>
        <div className="flex items-center gap-4">
          {/* Connection status */}
          {status === 'connected'
            ? <Wifi className="w-4 h-4 text-green-400" />
            : <WifiOff className="w-4 h-4 text-red-400" />
          }
          {/* Score */}
          <span className="text-sm">
            Proctoring: <span className={proctoringScore > 70 ? 'text-green-400' : proctoringScore > 40 ? 'text-yellow-400' : 'text-red-400'}>
              {proctoringScore}/100
            </span>
          </span>
          {/* Timer */}
          <span className={`font-mono text-lg ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
            <Clock className="w-4 h-4 inline mr-1" />{fmtTime(timeLeft)}
          </span>
          <button className="btn-danger text-sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question panel */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {q ? (
            <>
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">
                  Question {current + 1} of {questions.length}
                  <span className="ml-2 text-primary">{q.marks} marks</span>
                </p>
                <h3 className="text-xl font-medium">{q.text}</h3>
              </div>

              {/* MCQ */}
              {q.type === 'mcq' && (
                <div className="space-y-3">
                  {q.options?.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        answers[q.id] === opt
                          ? 'border-primary bg-primary/20 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Text */}
              {q.type === 'text' && (
                <textarea
                  className="input h-48 resize-y"
                  placeholder="Type your answer here..."
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button
                  className="flex items-center gap-2 text-gray-400 hover:text-white disabled:opacity-30"
                  onClick={() => setCurrent(p => p - 1)}
                  disabled={current === 0}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                {/* Question pills */}
                <div className="flex gap-1 flex-wrap justify-center">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      className={`w-7 h-7 text-xs rounded ${
                        i === current ? 'bg-primary text-white'
                        : answers[questions[i].id] ? 'bg-green-700 text-white'
                        : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  className="flex items-center gap-2 text-gray-400 hover:text-white disabled:opacity-30"
                  onClick={() => setCurrent(p => p + 1)}
                  disabled={current === questions.length - 1}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-center py-20">No questions found</div>
          )}
        </div>

        {/* Right panel: webcam + alerts */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col">
          {/* Webcam */}
          <div className="p-4">
            <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> Proctoring Camera
            </p>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{aspectRatio:'4/3'}}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {status !== 'connected' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-xs text-gray-400">
                  {status === 'connecting' ? 'Connecting...' : wsError || 'Camera offline'}
                </div>
              )}
              <GazeIndicator gaze={gaze} faceCount={faceCount} />
            </div>
            {wsError && <p className="text-red-400 text-xs mt-1">{wsError}</p>}
          </div>

          {/* Alert log */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <p className="text-xs font-medium text-gray-400 mb-2">
              Alert Log ({alerts.length})
            </p>
            {alerts.length === 0 ? (
              <p className="text-xs text-gray-600">No alerts — keep it up!</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="bg-gray-800 rounded p-2 text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                      <AlertBadge type={a.type} />
                    </div>
                    <p className="text-gray-400 mt-1">{a.message}</p>
                    <p className="text-gray-600 mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
