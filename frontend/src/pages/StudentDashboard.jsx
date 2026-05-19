import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { BookOpen, Clock, Calendar, LogOut, AlertTriangle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadExams = useCallback(() => {
    setLoading(true)
    setError(false)
    api.get('/exams/')
      .then(r => { setExams(r.data); setError(false) })
      .catch(err => {
        toast.error(err.response?.data?.detail || 'Failed to load exams')
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadExams() }, [loadExams])

  const getExamStatus = (exam) => {
    const now = new Date(), start = new Date(exam.start_time), end = new Date(exam.end_time)
    if (now < start) return { label: 'Upcoming', color: 'text-yellow-400' }
    if (now > end)   return { label: 'Ended',    color: 'text-gray-500' }
    return { label: 'Live Now', color: 'text-green-400' }
  }

  const canStart = (exam) => {
    const now = new Date()
    return now >= new Date(exam.start_time) && now <= new Date(exam.end_time)
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="text-primary w-6 h-6" />
          <span className="font-bold text-lg">AI Proctor</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.full_name}</span>
          <button onClick={() => { logout(); navigate('/login') }} className="text-gray-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">My Exams</h2>
          <button onClick={loadExams} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-gray-400 mb-8">Welcome, {user?.full_name} ({user?.student_id || user?.email})</p>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading exams...</div>
        ) : error ? (
          <div className="card text-center py-16 space-y-4">
            <p className="text-gray-400">Could not load exams. Server may be starting up.</p>
            <button onClick={loadExams} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        ) : exams.length === 0 ? (
          <div className="card text-center text-gray-400 py-20">No exams available. Check back later.</div>
        ) : (
          <div className="space-y-4">
            {exams.map(exam => {
              const status = getExamStatus(exam)
              const active = canStart(exam)
              return (
                <div key={exam.id} className="card flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{exam.title}</h3>
                      <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                    </div>
                    {exam.description && <p className="text-gray-400 text-sm mb-3">{exam.description}</p>}
                    <div className="flex items-center gap-5 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{exam.duration_minutes} min</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{exam.question_count} questions</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(exam.start_time), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                  <button disabled={!active} onClick={() => navigate(`/exam/${exam.id}`)}
                    className={active ? 'btn-primary whitespace-nowrap' : 'btn-primary opacity-30 cursor-not-allowed whitespace-nowrap'}>
                    {active ? 'Start Exam' : 'Not Available'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 card bg-yellow-900/10 border-yellow-800/30">
          <div className="flex gap-3">
            <AlertTriangle className="text-yellow-400 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-400 mb-1">Proctoring Notice</p>
              <p>Your webcam will be active during the exam. Ensure you are alone in a well-lit room. The AI system monitors for: multiple faces, looking away, and tab switching. Violations will be logged and reported to your instructor.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
