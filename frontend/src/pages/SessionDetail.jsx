import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { ArrowLeft, AlertTriangle, User, BookOpen, Clock } from 'lucide-react'
import { format } from 'date-fns'

const severityBadge = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get(`/admin/sessions/${sessionId}/detail`).then(r => setData(r.data))
  }, [sessionId])

  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>

  const scoreColor = data.proctoring_score >= 80 ? 'text-green-400'
    : data.proctoring_score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <User className="w-5 h-5 text-primary mb-3" />
          <p className="font-semibold">{data.student.name}</p>
          <p className="text-gray-400 text-sm">{data.student.email}</p>
          <p className="text-gray-500 text-xs mt-1">ID: {data.student.student_id || 'N/A'}</p>
        </div>
        <div className="card">
          <BookOpen className="w-5 h-5 text-primary mb-3" />
          <p className="font-semibold">{data.exam.title}</p>
          <p className="text-gray-400 text-sm">Session #{data.session_id}</p>
          <span className={`text-xs font-medium ${
            data.status === 'flagged' ? 'text-red-400' : data.status === 'completed' ? 'text-green-400' : 'text-gray-400'
          }`}>{data.status}</span>
        </div>
        <div className="card">
          <Clock className="w-5 h-5 text-primary mb-3" />
          <p className="text-sm text-gray-400">Proctoring Score</p>
          <p className={`text-3xl font-bold ${scoreColor}`}>{data.proctoring_score}</p>
          <p className="text-gray-400 text-sm">{data.alert_count} alerts</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Alert Timeline ({data.alerts.length})
        </h3>

        {data.alerts.length === 0 ? (
          <p className="text-gray-500 text-sm">No alerts — clean session</p>
        ) : (
          <div className="space-y-3">
            {data.alerts.map(a => (
              <div key={a.id} className="flex items-start gap-4 border-b border-gray-800 pb-3">
                <div className="text-xs text-gray-500 whitespace-nowrap mt-0.5 w-20">
                  {format(new Date(a.timestamp), 'HH:mm:ss')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={severityBadge[a.severity] || 'badge-low'}>{a.severity}</span>
                    <span className="text-xs text-gray-300 font-medium">{a.type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-500">conf: {(a.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-gray-400">{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
