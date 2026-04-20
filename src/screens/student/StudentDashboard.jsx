import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, LogOut, BookOpen, Wrench,
  ChevronRight, Check, AlertCircle, Users,
  Plus, Trash2
} from 'lucide-react'

const StudentDashboard = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('subjects')

  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, passing: 0, failing: 0 })

  const [tutors, setTutors] = useState([])
  const [tutorsLoading, setTutorsLoading] = useState(false)
  const [showAddTutor, setShowAddTutor] = useState(false)
  const [tutorForm, setTutorForm] = useState({ fullName: '', email: '', password: '' })
  const [tutorFormLoading, setTutorFormLoading] = useState(false)
  const [tutorError, setTutorError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchClassrooms() }, [])
  useEffect(() => { if (activeTab === 'tutors') fetchTutors() }, [activeTab])

  const showSuccessMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const fetchClassrooms = async () => {
    setLoading(true)
    try {
      const { data: csData, error: csError } = await supabase
        .from('classroom_students')
        .select('classroom_id')
        .eq('student_id', profile.id)

      if (csError) { console.error('Error classroom_students:', csError); setLoading(false); return }
      if (!csData || csData.length === 0) {
        setClassrooms([])
        setStats({ total: 0, passing: 0, failing: 0 })
        setLoading(false)
        return
      }

      const classroomIds = csData.map(cs => cs.classroom_id)

      const { data: classroomData, error: classroomError } = await supabase
        .from('classrooms')
        .select(`id, teacher_subjects(subjects(id, name, type), users!teacher_subjects_teacher_id_fkey(full_name)), sections(name), academic_periods(name)`)
        .in('id', classroomIds)

      if (classroomError) { console.error('Error classrooms:', classroomError); setLoading(false); return }
      if (!classroomData || classroomData.length === 0) {
        setClassrooms([])
        setLoading(false)
        return
      }

      const classroomsWithProgress = await Promise.all(
        classroomData.map(async (classroom) => {
          const { data: activities } = await supabase
            .from('activities')
            .select('id, max_score')
            .eq('classroom_id', classroom.id)

          const activityIds = activities?.map(a => a.id) || []

          let percentage = 0
          if (activityIds.length > 0) {
            const { data: grades } = await supabase
              .from('activity_grades')
              .select('activity_id, score')
              .eq('student_id', profile.id)
              .in('activity_id', activityIds)

            const gradeMap = {}
            grades?.forEach(g => { gradeMap[g.activity_id] = g.score })

            const totalMax = activities.reduce((s, a) => s + (a.max_score || 0), 0)
            const totalScore = activities.reduce((s, a) => s + (gradeMap[a.id] || 0), 0)
            percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
          }

          return {
            id: classroom.id,
            subjectName: classroom.teacher_subjects?.subjects?.name || 'Sin nombre',
            subjectType: classroom.teacher_subjects?.subjects?.type || 'academic',
            sectionName: classroom.sections?.name || '',
            periodName: classroom.academic_periods?.name || '',
            teacherName: classroom.teacher_subjects?.users?.full_name || '',
            percentage,
            activitiesCount: activities?.length || 0,
          }
        })
      )

      const passing = classroomsWithProgress.filter(c => c.percentage >= 70).length
      setStats({ total: classroomsWithProgress.length, passing, failing: classroomsWithProgress.length - passing })
      setClassrooms(classroomsWithProgress)
    } catch (err) {
      console.error('fetchClassrooms error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTutors = async () => {
    setTutorsLoading(true)
    try {
      const { data } = await supabase
        .from('student_tutors')
        .select('*, users!student_tutors_tutor_id_fkey(id, full_name, email)')
        .eq('student_id', profile.id)
      setTutors(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setTutorsLoading(false)
    }
  }

  const handleAddTutor = async () => {
    if (!tutorForm.fullName || !tutorForm.email || !tutorForm.password) {
      setTutorError('Todos los campos son obligatorios.')
      return
    }
    if (tutorForm.password.length < 6) {
      setTutorError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setTutorFormLoading(true)
    setTutorError('')
    try {
      const res = await fetch('http://localhost:3001/api/create-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: tutorForm.email.trim(),
          full_name: tutorForm.fullName.trim(),
          password: tutorForm.password,
          institution_id: profile.institution_id,
          created_by: profile.id,
          student_id: profile.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ocurrió un error.')
      showSuccessMsg('Tutor agregado exitosamente.')
      setShowAddTutor(false)
      setTutorForm({ fullName: '', email: '', password: '' })
      fetchTutors()
    } catch (err) {
      setTutorError(err.message || 'Ocurrió un error.')
    } finally {
      setTutorFormLoading(false)
    }
  }

  const handleRemoveTutor = async (tutorId) => {
    try {
      const res = await fetch('http://localhost:3001/api/delete-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorId, studentId: profile.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showSuccessMsg('Tutor eliminado.')
      fetchTutors()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}><GraduationCap size={22} color="#fff" /></div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>
        <nav style={styles.nav}>
          <div
            style={{ ...styles.navItem, ...(activeTab === 'subjects' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('subjects')}>
            <BookOpen size={18} /><span>Mis materias</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeTab === 'tutors' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('tutors')}>
            <Users size={18} /><span>Mis tutores</span>
          </div>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{profile?.full_name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>Estudiante</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>
              {activeTab === 'subjects' ? 'Mis Materias' : 'Mis Tutores'}
            </h1>
            <p style={styles.pageSubtitle}>Bienvenido, {profile?.full_name}</p>
          </div>
          {activeTab === 'tutors' && (
            <button
              onClick={() => { setShowAddTutor(!showAddTutor); setTutorError('') }}
              style={styles.primaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} />Agregar tutor
            </button>
          )}
        </div>

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />{success}
          </div>
        )}

        {activeTab === 'subjects' && (
          <>
            <div style={styles.statsGrid}>
              {[
                { label: 'Materias', value: stats.total, icon: <BookOpen size={20} />, color: '#6C63FF', bg: '#EEF2FF' },
                { label: 'Aprobando', value: stats.passing, icon: <Check size={20} />, color: '#10B981', bg: '#ECFDF5' },
                { label: 'En riesgo', value: stats.failing, icon: <AlertCircle size={20} />, color: '#EF4444', bg: '#FEF2F2' },
              ].map(stat => (
                <div key={stat.label} style={styles.statCard}>
                  <div style={{ ...styles.statIcon, backgroundColor: stat.bg, color: stat.color }}>{stat.icon}</div>
                  <div>
                    <p style={styles.statValue}>{stat.value}</p>
                    <p style={styles.statLabel}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Todas mis materias</h2>
              {loading ? (
                <p style={styles.emptyText}>Cargando...</p>
              ) : classrooms.length === 0 ? (
                <div style={styles.emptyState}>
                  <BookOpen size={40} color="#CBD5E1" />
                  <p style={styles.emptyText}>Aún no estás inscrito en ninguna materia.</p>
                </div>
              ) : (
                <div style={styles.subjectGrid}>
                  {classrooms.map(classroom => (
                    <div
                      key={classroom.id}
                      style={styles.subjectCard}
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}>
                      <div style={styles.subjectCardTop}>
                        <div style={{
                          ...styles.subjectIconBox,
                          backgroundColor: classroom.subjectType === 'workshop' ? '#FFF7ED' : '#EEF2FF',
                        }}>
                          {classroom.subjectType === 'workshop'
                            ? <Wrench size={20} color="#F97316" />
                            : <BookOpen size={20} color="#6C63FF" />}
                        </div>
                        <span style={{
                          ...styles.typeBadge,
                          backgroundColor: classroom.subjectType === 'workshop' ? '#FFF7ED' : '#EEF2FF',
                          color: classroom.subjectType === 'workshop' ? '#F97316' : '#6C63FF',
                        }}>
                          {classroom.subjectType === 'workshop' ? 'Taller' : 'Académica'}
                        </span>
                      </div>
                      <h3 style={styles.subjectName}>{classroom.subjectName}</h3>
                      <p style={styles.subjectMeta}>
                        {classroom.sectionName}
                        {classroom.periodName && ` · ${classroom.periodName}`}
                      </p>
                      {classroom.teacherName && (
                        <p style={styles.teacherName}>Prof. {classroom.teacherName}</p>
                      )}
                      <div style={styles.progressWrapper}>
                        <div style={styles.progressBar}>
                          <div style={{
                            ...styles.progressFill,
                            width: `${classroom.percentage}%`,
                            backgroundColor: classroom.percentage >= 70 ? '#10B981' : classroom.percentage >= 50 ? '#F97316' : '#EF4444',
                          }} />
                        </div>
                        <span style={{
                          ...styles.progressLabel,
                          color: classroom.percentage >= 70 ? '#10B981' : classroom.percentage >= 50 ? '#F97316' : '#EF4444',
                        }}>
                          {classroom.percentage}%
                        </span>
                      </div>
                      <div style={styles.subjectCardFooter}>
                        <span style={styles.activitiesCount}>{classroom.activitiesCount} actividad(es)</span>
                        <div style={styles.viewBtn}>Ver detalle <ChevronRight size={14} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'tutors' && (
          <div style={styles.section}>
            {showAddTutor && (
              <div style={styles.addTutorBox}>
                <h3 style={styles.addTutorTitle}>Agregar tutor / padre</h3>
                <p style={styles.addTutorHint}>
                  Tu tutor podrá iniciar sesión con estas credenciales y ver el progreso de tus materias.
                </p>
                <div style={styles.formGrid}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Nombre completo</label>
                    <input style={styles.input} placeholder="Ej: María García"
                      value={tutorForm.fullName}
                      onChange={e => { setTutorForm(p => ({ ...p, fullName: e.target.value })); setTutorError('') }}
                      onFocus={e => e.target.style.borderColor = '#6C63FF'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Correo electrónico</label>
                    <input style={styles.input} type="email" placeholder="correo@email.com"
                      value={tutorForm.email}
                      onChange={e => { setTutorForm(p => ({ ...p, email: e.target.value })); setTutorError('') }}
                      onFocus={e => e.target.style.borderColor = '#6C63FF'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Contraseña</label>
                    <input style={styles.input} type="password" placeholder="Mínimo 6 caracteres"
                      value={tutorForm.password}
                      onChange={e => { setTutorForm(p => ({ ...p, password: e.target.value })); setTutorError('') }}
                      onFocus={e => e.target.style.borderColor = '#6C63FF'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  </div>
                </div>
                {tutorError && <div style={styles.errorBox}>{tutorError}</div>}
                <div style={styles.addTutorBtns}>
                  <button
                    onClick={() => {
                      setShowAddTutor(false)
                      setTutorForm({ fullName: '', email: '', password: '' })
                      setTutorError('')
                    }}
                    style={styles.cancelBtn}>
                    Cancelar
                  </button>
                  <button onClick={handleAddTutor} disabled={tutorFormLoading}
                    style={{ ...styles.primaryButton, opacity: tutorFormLoading ? 0.7 : 1 }}>
                    {tutorFormLoading ? 'Agregando...' : 'Agregar tutor'}
                  </button>
                </div>
              </div>
            )}

            <h2 style={styles.sectionTitle}>Tutores con acceso a mis notas</h2>

            {tutorsLoading ? (
              <p style={styles.emptyText}>Cargando...</p>
            ) : tutors.length === 0 ? (
              <div style={styles.emptyState}>
                <Users size={40} color="#CBD5E1" />
                <p style={styles.emptyText}>No tienes tutores agregados aún.</p>
                <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0 }}>
                  Agrega a tus padres o tutores para que puedan ver tu progreso.
                </p>
              </div>
            ) : (
              <div style={styles.tutorList}>
                {tutors.map(t => {
                  const tutor = t.users
                  return (
                    <div key={t.id} style={styles.tutorCard}>
                      <div style={styles.tutorInfo}>
                        <div style={styles.tutorAvatar}>
                          {tutor?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={styles.tutorName}>{tutor?.full_name}</p>
                          <p style={styles.tutorEmail}>{tutor?.email}</p>
                        </div>
                      </div>
                      <div style={styles.tutorActions}>
                        <span style={styles.tutorBadge}>Acceso activo</span>
                        <button onClick={() => handleRemoveTutor(tutor?.id)} style={styles.deleteBtn}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Inter', 'Segoe UI', sans-serif" },
  sidebar: { width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 20px', borderBottom: '1px solid #E2E8F0' },
  sidebarIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { fontSize: '18px', fontWeight: '700', color: '#1E293B', letterSpacing: '-0.5px' },
  nav: { padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', color: '#64748B', cursor: 'pointer' },
  navActive: { backgroundColor: '#EEF2FF', color: '#6C63FF', fontWeight: '600' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 2px' },
  statLabel: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0, textAlign: 'center' },
  subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  subjectCard: { border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', backgroundColor: '#FAFAFA', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' },
  subjectCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  subjectIconBox: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  typeBadge: { fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px' },
  subjectName: { fontSize: '16px', fontWeight: '700', color: '#1E293B', margin: 0 },
  subjectMeta: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  teacherName: { fontSize: '12px', color: '#64748B', margin: 0 },
  progressWrapper: { display: 'flex', alignItems: 'center', gap: '10px' },
  progressBar: { flex: 1, height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' },
  progressLabel: { fontSize: '13px', fontWeight: '700', minWidth: '36px', textAlign: 'right' },
  subjectCardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  activitiesCount: { fontSize: '12px', color: '#94A3B8' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600', color: '#6C63FF' },
  addTutorBox: { backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  addTutorTitle: { fontSize: '15px', fontWeight: '600', color: '#1E293B', margin: 0 },
  addTutorHint: { fontSize: '13px', color: '#64748B', margin: 0 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' },
  addTutorBtns: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  tutorList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  tutorCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' },
  tutorInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  tutorAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: '600', flexShrink: 0 },
  tutorName: { fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 2px' },
  tutorEmail: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  tutorActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  tutorBadge: { fontSize: '12px', fontWeight: '600', color: '#10B981', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '20px' },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
}

export default StudentDashboard