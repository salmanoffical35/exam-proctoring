import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  Shield, Users, BookOpen, AlertTriangle, Activity, LogOut,
  Eye, Flag, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6']

const StatCard = ({ icon: Icon, label, value, color = 'text-primary' }) => (
  <div className="card flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  </div>
)

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]     = useState(null)
  const [sessions, setSessions] = useState([])
  const [tab, setTab]         = useState('overview')  // overview | sessions | students
  const [students, setStudents] = useState([])

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => toast.error('Stats error'))
    api.get('/admin/sessions').then(r => setSessions(r.data)).catch(() => {})
  }, [])

  const loadStudents = () => {
    api.get('/admin/students').then(r => setStudents(r.data))
  }

  const alertChartData = stats
    ? Object.entries(stats.alert_breakdown).map(([type, count]) => ({ type: type.replace('_', ' '), count }))
    : []

  const sessionStatusData = sessions.length
    ? ['started','completed','flagged','terminated'].map(s => ({
        name: s,
        value: sessions.filter(x => x.status === s).length
      })).filter(x => x.value > 0)
    : []

  const severityColor = (score) =>
    score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-primary w-6 h-6" />
          <span className="font-bold text-lg">Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.full_name}</span>
          <button onClick={() => { logout(); navigate('/login') }} className="text-gray-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-6">
        {['overview','sessions','students'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'students') loadStudents() }}
            className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users}         label="Students"        value={stats.total_students}   color="text-blue-400" />
              <StatCard icon={BookOpen}      label="Exams"           value={stats.total_exams}      color="text-primary" />
              <StatCard icon={Activity}      label="Active Sessions" value={stats.active_sessions}  color="text-green-400" />
              <StatCard icon={AlertTriangle} label="Total Alerts"    value={stats.total_alerts}     color="text-yellow-400" />
              <StatCard icon={Flag}          label="Flagged"         value={stats.flagged_sessions} color="text-red-400" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Alert type bar chart */}
              <div className="card">
                <h3 className="font-semibold mb-4">Alerts by Type</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={alertChartData}>
                    <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Session status pie */}
              <div className="card">
                <h3 className="font-semibold mb-4">Session Status</h3>
                {sessionStatusData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sessionStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {sessionStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-500 text-sm">No session data yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS */}
        {tab === 'sessions' && (
          <div>
            <h3 className="font-semibold text-lg mb-4">All Exam Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="pb-3 pr-4">Student</th>
                    <th className="pb-3 pr-4">Exam</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Alerts</th>
                    <th className="pb-3 pr-4">Score</th>
                    <th className="pb-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sessions.map(s => (
                    <tr key={s.session_id} className="hover:bg-gray-800/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{s.student_name}</p>
                        <p className="text-gray-500 text-xs">{s.student_number}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{s.exam_title}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium ${
                          s.status === 'flagged' ? 'text-red-400'
                          : s.status === 'completed' ? 'text-green-400'
                          : 'text-gray-400'
                        }`}>{s.status}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={s.alert_count > 0 ? 'text-yellow-400' : 'text-gray-400'}>
                          {s.alert_count}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={severityColor(s.proctoring_score)}>{s.proctoring_score}</span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => navigate(`/admin/session/${s.session_id}`)}
                          className="text-primary hover:text-primary-dark"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sessions.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">No sessions yet</p>}
            </div>
          </div>
        )}

        {/* STUDENTS */}
        {tab === 'students' && (
          <div>
            <h3 className="font-semibold text-lg mb-4">Registered Students</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(s => (
                <div key={s.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-gray-400 text-sm">{s.email}</p>
                      {s.student_id && <p className="text-gray-500 text-xs mt-1">ID: {s.student_id}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${s.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {s.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
              {students.length === 0 && <p className="text-gray-500 col-span-3">No students found</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
