import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  Shield, Users, BookOpen, AlertTriangle, Activity, LogOut,
  Flag, ChevronRight, Plus, X, Loader
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

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="font-semibold text-lg">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
)

function AddStudentModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: '', email: '', student_id: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password) { toast.error('Name, email, and password required'); return }
    setLoading(true)
    try {
      await api.post('/admin/students', form)
      toast.success('Student added!')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add student')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Add New Student" onClose={onClose}>
      <form onSubmit={handle} className="space-y-4">
        {[
          { key: 'full_name', label: 'Full Name *', placeholder: 'Jane Smith', type: 'text' },
          { key: 'email', label: 'Email *', placeholder: 'jane@example.com', type: 'email' },
          { key: 'student_id', label: 'Student ID', placeholder: 'STU002', type: 'text' },
          { key: 'password', label: 'Password *', placeholder: 'Min 6 characters', type: 'password' },
        ].map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="text-sm text-gray-400 mb-1 block">{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader className="w-4 h-4 animate-spin" />} Add Student
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddExamModal({ onClose, onSuccess }) {
  const now = new Date()
  const fmt = d => d.toISOString().slice(0, 16)
  const twoH = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const [form, setForm] = useState({ title: '', description: '', duration_minutes: 60, start_time: fmt(now), end_time: fmt(twoH), max_alerts: 5 })
  const [questions, setQuestions] = useState([{ id: 1, text: '', type: 'text', marks: 10 }])
  const [loading, setLoading] = useState(false)

  const addQ = () => setQuestions(q => [...q, { id: q.length + 1, text: '', type: 'text', marks: 10 }])
  const removeQ = idx => setQuestions(q => q.filter((_, i) => i !== idx))
  const updQ = (idx, field, val) => setQuestions(q => q.map((item, i) => i === idx ? { ...item, [field]: val } : item))

  const handle = async (e) => {
    e.preventDefault()
    if (!form.title) { toast.error('Title is required'); return }
    setLoading(true)
    try {
      await api.post('/exams/', {
        ...form,
        duration_minutes: Number(form.duration_minutes),
        max_alerts: Number(form.max_alerts),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        questions: questions.filter(q => q.text.trim()),
      })
      toast.success('Exam created!')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create exam')
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Create New Exam" onClose={onClose}>
      <form onSubmit={handle} className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Exam Title *</label>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            placeholder="Midterm Computer Science" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Description</label>
          <textarea rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            placeholder="Optional..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Duration (min)</label>
            <input type="number" min={5} max={480} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Max Alerts</label>
            <input type="number" min={1} max={50} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              value={form.max_alerts} onChange={e => setForm(f => ({ ...f, max_alerts: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Start Time *</label>
          <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">End Time *</label>
          <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Questions</label>
            <button type="button" onClick={addQ} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Question
            </button>
          </div>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Q{idx + 1}</span>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQ(idx)} className="text-gray-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="Question text..." value={q.text}
                  onChange={e => updQ(idx, 'text', e.target.value)} />
                <div className="flex gap-2">
                  <select className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" value={q.type}
                    onChange={e => updQ(idx, 'type', e.target.value)}>
                    <option value="text">Text Answer</option>
                    <option value="mcq">MCQ</option>
                  </select>
                  <input type="number" min={1} max={100} placeholder="Marks"
                    className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                    value={q.marks} onChange={e => updQ(idx, 'marks', Number(e.target.value))} />
                </div>
                {q.type === 'mcq' && (
                  <input className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs"
                    placeholder="Options comma-separated: A,B,C,D"
                    value={q.options ? q.options.join(',') : ''}
                    onChange={e => updQ(idx, 'options', e.target.value.split(','))} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader className="w-4 h-4 animate-spin" />} Create Exam
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]       = useState(null)
  const [sessions, setSessions] = useState([])
  const [tab, setTab]           = useState('overview')
  const [students, setStudents] = useState([])
  const [exams, setExams]       = useState([])
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showAddExam, setShowAddExam]       = useState(false)

  const loadStats    = () => api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => toast.error('Stats error'))
  const loadSessions = () => api.get('/admin/sessions').then(r => setSessions(r.data)).catch(() => {})
  const loadStudents = () => api.get('/admin/students').then(r => setStudents(r.data)).catch(() => toast.error('Failed to load students'))
  const loadExams    = () => api.get('/exams/').then(r => setExams(r.data)).catch(() => toast.error('Failed to load exams'))

  useEffect(() => { loadStats(); loadSessions() }, [])
  useEffect(() => {
    if (tab === 'students') loadStudents()
    if (tab === 'exams')    loadExams()
  }, [tab])

  const alertChartData = stats
    ? Object.entries(stats.alert_breakdown).map(([type, count]) => ({ type: type.replace('_', ' '), count }))
    : []

  const sessionStatusData = sessions.length
    ? ['started','completed','flagged','terminated']
        .map(s => ({ name: s, value: sessions.filter(x => x.status === s).length }))
        .filter(x => x.value > 0)
    : []

  const severityColor = s => s >= 80 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

  const toggleStudent = async (id) => {
    try {
      const res = await api.patch(`/admin/students/${id}/toggle`)
      setStudents(s => s.map(st => st.id === id ? { ...st, is_active: res.data.is_active } : st))
    } catch { toast.error('Failed to toggle student') }
  }

  return (
    <div className="min-h-screen">
      {showAddStudent && <AddStudentModal onClose={() => setShowAddStudent(false)} onSuccess={() => { loadStudents(); loadStats() }} />}
      {showAddExam    && <AddExamModal    onClose={() => setShowAddExam(false)}    onSuccess={() => { loadExams();    loadStats() }} />}

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

      <div className="bg-gray-900 border-b border-gray-800 px-6">
        {['overview','sessions','students','exams'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
            }`}>{t}</button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {tab === 'overview' && stats && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users}         label="Students"        value={stats.total_students}   color="text-blue-400" />
              <StatCard icon={BookOpen}      label="Exams"           value={stats.total_exams}      color="text-primary" />
              <StatCard icon={Activity}      label="Active Sessions" value={stats.active_sessions}  color="text-green-400" />
              <StatCard icon={AlertTriangle} label="Total Alerts"    value={stats.total_alerts}     color="text-yellow-400" />
              <StatCard icon={Flag}          label="Flagged"         value={stats.flagged_sessions} color="text-red-400" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddExam(true)} className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Add Exam
              </button>
              <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600">
                <Plus className="w-4 h-4" /> Add Student
              </button>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold mb-4">Alerts by Type</h3>
                {alertChartData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={alertChartData}>
                      <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-500 text-sm py-16 text-center">No alerts yet</p>}
              </div>
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
                ) : <p className="text-gray-500 text-sm py-16 text-center">No session data yet</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'sessions' && (
          <div>
            <h3 className="font-semibold text-lg mb-4">All Exam Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    {['Student','Exam','Status','Alerts','Score','Detail'].map(h => (
                      <th key={h} className="pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sessions.map(s => (
                    <tr key={s.session_id} className="hover:bg-gray-800/30">
                      <td className="py-3 pr-4"><p className="font-medium">{s.student_name}</p><p className="text-gray-500 text-xs">{s.student_number}</p></td>
                      <td className="py-3 pr-4 text-gray-300">{s.exam_title}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium ${s.status === 'flagged' ? 'text-red-400' : s.status === 'completed' ? 'text-green-400' : 'text-gray-400'}`}>{s.status}</span>
                      </td>
                      <td className="py-3 pr-4"><span className={s.alert_count > 0 ? 'text-yellow-400' : 'text-gray-400'}>{s.alert_count}</span></td>
                      <td className="py-3 pr-4"><span className={severityColor(s.proctoring_score)}>{s.proctoring_score}</span></td>
                      <td className="py-3">
                        <button onClick={() => navigate(`/admin/session/${s.session_id}`)} className="text-primary hover:text-primary-dark">
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

        {tab === 'students' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Registered Students</h3>
              <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Add Student
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(s => (
                <div key={s.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-gray-400 text-sm">{s.email}</p>
                      {s.student_id && <p className="text-gray-500 text-xs mt-1">ID: {s.student_id}</p>}
                    </div>
                    <button onClick={() => toggleStudent(s.id)}
                      className={`text-xs px-2 py-1 rounded ${s.is_active ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400' : 'bg-red-900/30 text-red-400 hover:bg-green-900/30 hover:text-green-400'}`}>
                      {s.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>
              ))}
              {students.length === 0 && <p className="text-gray-500 col-span-3">No students found</p>}
            </div>
          </div>
        )}

        {tab === 'exams' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">All Exams</h3>
              <button onClick={() => setShowAddExam(true)} className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Add Exam
              </button>
            </div>
            <div className="space-y-3">
              {exams.map(exam => {
                const now = new Date(), start = new Date(exam.start_time), end = new Date(exam.end_time)
                const isLive = now >= start && now <= end
                return (
                  <div key={exam.id} className="card flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium">{exam.title}</h4>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLive ? 'bg-green-900/30 text-green-400' : now < start ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>
                          {isLive ? 'Live' : now < start ? 'Upcoming' : 'Ended'}
                        </span>
                      </div>
                      {exam.description && <p className="text-gray-400 text-sm mb-2">{exam.description}</p>}
                      <div className="flex gap-5 text-xs text-gray-500">
                        <span>{exam.duration_minutes} min</span>
                        <span>{exam.question_count} questions</span>
                        <span>Start: {new Date(exam.start_time).toLocaleString()}</span>
                        <span>End: {new Date(exam.end_time).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {exams.length === 0 && <div className="text-center text-gray-500 py-12">No exams yet. Click "Add Exam" to create one.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
