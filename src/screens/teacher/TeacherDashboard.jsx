import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, LogOut, BookOpen, Users, Plus, X,
  Check, ChevronRight, Layers, Calendar, Wrench, AlertCircle, Trash2
} from 'lucide-react'

const TeacherDashboard = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [teacherType, setTeacherType] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [teacherSubjects, setTeacherSubjects] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [sections, setSections] = useState([])
  const [periods, setPeriods] = useState([])
  const [stats, setStats] = useState({ subjects: 0, classrooms: 0, students: 0 })
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('overview')

  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showClassroomModal, setShowClassroomModal] = useState(false)
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [fetchError, setFetchError] = useState(null)

  const [subjectForm, setSubjectForm] = useState({ name: '' })
  const [classroomForm, setClassroomForm] = useState({
    subjectId: '',
    sectionId: '',
    newSectionName: '',
    periodId: '',
    useNewSection: false,
  })

  const showSuccessMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      if (profile.created_by && !teacherType) {
        const { data: creatorData } = await supabase
          .from('users')
          .select('role')
          .eq('id', profile.created_by)
          .single()
        setTeacherType(creatorData?.role === 'coordinator_academic' ? 'academic' : 'workshop')
      }

      const [tsRes, sectionRes, periodRes] = await Promise.all([
        supabase.from('teacher_subjects').select('id, subject_id, subjects(*)').eq('teacher_id', profile.id),
        supabase.from('sections').select('*').eq('institution_id', profile.institution_id).order('name'),
        supabase.from('academic_periods').select('*').eq('institution_id', profile.institution_id).order('name')
      ])

      if (tsRes.error) throw tsRes.error

      const tsData = tsRes.data || []
      setTeacherSubjects(tsData)
      setSubjects(tsData.map(ts => ({ ...ts.subjects, ts_id: ts.id })))
      setSections(sectionRes.data || [])
      setPeriods(periodRes.data || [])

      const tsIds = tsData.map(ts => ts.id)
      let classroomData = []
      let studentCount = 0

      if (tsIds.length > 0) {
        const { data: cData, error: cError } = await supabase
          .from('classrooms')
          .select(`
            *,
            teacher_subjects(id, subjects(name, type)),
            sections(name),
            academic_periods(name, is_active)
          `)
          .in('teacher_subject_id', tsIds)
          .order('created_at', { ascending: false })

        if (cError) throw cError
        classroomData = cData || []

        if (classroomData.length > 0) {
          const { count } = await supabase
            .from('classroom_students')
            .select('*', { count: 'exact', head: true })
            .in('classroom_id', classroomData.map(c => c.id))
          studentCount = count || 0
        }
      }

      setClassrooms(classroomData)
      setStats({
        subjects: tsData.length,
        classrooms: classroomData.length,
        students: studentCount,
      })

    } catch (err) {
      console.error(err)
      setFetchError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }, [profile.id, profile.institution_id, profile.created_by, teacherType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddSubject = async () => {
    if (!subjectForm.name.trim()) {
      setFormError('Escribe el nombre de la materia.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { data: newSubject, error: subjectError } = await supabase
        .from('subjects')
        .insert({
          institution_id: profile.institution_id,
          name: subjectForm.name.trim(),
          type: 'workshop',
        })
        .select()
        .single()

      if (subjectError) throw subjectError

      const { error: tsError } = await supabase
        .from('teacher_subjects')
        .insert({
          teacher_id: profile.id,
          subject_id: newSubject.id,
          assigned_by: profile.id,
        })

      if (tsError) throw tsError

      showSuccessMsg('Materia agregada exitosamente.')
      setShowSubjectModal(false)
      setSubjectForm({ name: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleCreateClassroom = async () => {
    const { subjectId, sectionId, newSectionName, periodId, useNewSection } = classroomForm

    if (!subjectId || !periodId) {
      setFormError('Selecciona materia y período.')
      return
    }
    if (!useNewSection && !sectionId) {
      setFormError('Selecciona una sección existente o crea una nueva.')
      return
    }
    if (useNewSection && !newSectionName.trim()) {
      setFormError('Escribe el nombre de la nueva sección.')
      return
    }

    setFormLoading(true)
    setFormError('')

    try {
      let finalSectionId = sectionId

      if (useNewSection) {
        const { data: newSection, error: sectionError } = await supabase
          .from('sections')
          .insert({
            institution_id: profile.institution_id,
            name: newSectionName.trim(),
            created_by: profile.id,
          })
          .select()
          .single()

        if (sectionError) {
          if (sectionError.code === '23505') {
            const { data: existing } = await supabase
              .from('sections')
              .select('id')
              .eq('institution_id', profile.institution_id)
              .eq('name', newSectionName.trim())
              .single()
            finalSectionId = existing.id
          } else {
            throw sectionError
          }
        } else {
          finalSectionId = newSection.id
        }
      }

      const ts = teacherSubjects.find(ts => ts.subject_id === subjectId)
      if (!ts) throw new Error('No se encontró la relación profesor-materia.')

      const { error: classroomError } = await supabase
        .from('classrooms')
        .insert({
          teacher_subject_id: ts.id,
          section_id: finalSectionId,
          period_id: periodId,
        })

      if (classroomError) {
        if (classroomError.code === '23505') {
          throw new Error('Ya existe un aula con esa materia, sección y período.')
        }
        throw classroomError
      }

      showSuccessMsg('Aula creada exitosamente.')
      setShowClassroomModal(false)
      setClassroomForm({ subjectId: '', sectionId: '', newSectionName: '', periodId: '', useNewSection: false })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteClassroom = async (classroomId) => {
    if (!window.confirm('¿Seguro que quieres eliminar este aula? Se borrarán todas sus actividades y notas.')) return
    try {
      // Primero borrar las notas de las actividades del aula
      const { data: acts } = await supabase
        .from('activities')
        .select('id')
        .eq('classroom_id', classroomId)

      if (acts && acts.length > 0) {
        await supabase
          .from('activity_grades')
          .delete()
          .in('activity_id', acts.map(a => a.id))
      }

      // Borrar actividades
      await supabase.from('activities').delete().eq('classroom_id', classroomId)

      // Borrar estudiantes del aula
      await supabase.from('classroom_students').delete().eq('classroom_id', classroomId)

      // Borrar recuperaciones
      await supabase.from('recoveries').delete().eq('classroom_id', classroomId)

      // Borrar el aula
      await supabase.from('classrooms').delete().eq('id', classroomId)

      showSuccessMsg('Aula eliminada correctamente.')
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const isWorkshop = teacherType === 'workshop'

  return (
    <div style={styles.page}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}>
            <GraduationCap size={22} color="#fff" />
          </div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>

        <nav style={styles.nav}>
          <div
            style={{ ...styles.navItem, ...(activeView === 'overview' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('overview')}
          >
            <BookOpen size={18} />
            <span>Mis materias</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'classrooms' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('classrooms')}
          >
            <Layers size={18} />
            <span>Mis aulas</span>
          </div>
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>
                {isWorkshop ? 'Profesor de Taller' : 'Profesor Académico'}
              </p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>

        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>
              {activeView === 'overview' ? 'Mis Materias' : 'Mis Aulas'}
            </h1>
            <p style={styles.pageSubtitle}>Bienvenido, {profile?.full_name}</p>
          </div>
          <div style={styles.buttonGroup}>
            {isWorkshop && (
              <button
                onClick={() => { setShowSubjectModal(true); setFormError('') }}
                style={styles.secondaryButton}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Nueva materia
              </button>
            )}
            <button
              onClick={() => { setShowClassroomModal(true); setFormError('') }}
              style={styles.primaryButton}
            >
              <Plus size={16} style={{ marginRight: '6px' }} />
              Nuevo aula
            </button>
          </div>
        </div>

        {fetchError && (
          <div style={{ ...styles.errorBox, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {fetchError}
          </div>
        )}

        {/* Stats */}
        <div style={styles.statsGrid}>
          {[
            { label: isWorkshop ? 'Materias' : 'Materia', value: stats.subjects, icon: <BookOpen size={20} />, color: '#6C63FF', bg: '#EEF2FF' },
            { label: 'Aulas', value: stats.classrooms, icon: <Layers size={20} />, color: '#10B981', bg: '#ECFDF5' },
            { label: 'Estudiantes', value: stats.students, icon: <Users size={20} />, color: '#F97316', bg: '#FFF7ED' },
          ].map(stat => (
            <div key={stat.label} style={styles.statCard}>
              <div style={{ ...styles.statIcon, backgroundColor: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <p style={styles.statValue}>{stat.value}</p>
                <p style={styles.statLabel}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />
            {success}
          </div>
        )}

        {/* Vista: Mis Materias */}
        {activeView === 'overview' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {isWorkshop ? 'Materias de taller' : 'Materia académica'}
            </h2>

            {loading ? (
              <p style={styles.emptyText}>Cargando...</p>
            ) : subjects.length === 0 ? (
              <div style={styles.emptyState}>
                <BookOpen size={36} color="#CBD5E1" />
                <p style={styles.emptyText}>
                  {isWorkshop
                    ? 'No tienes materias aún. Agrega tu primera materia de taller.'
                    : 'Aún no tienes materia asignada. Contacta a tu coordinador.'}
                </p>
              </div>
            ) : (
              <div style={styles.subjectGrid}>
                {subjects.map(subject => (
                  <div key={subject.id} style={styles.subjectCard}>
                    <div style={{
                      ...styles.subjectIconBox,
                      backgroundColor: isWorkshop ? '#FFF7ED' : '#EEF2FF',
                    }}>
                      {isWorkshop
                        ? <Wrench size={18} color="#F97316" />
                        : <BookOpen size={18} color="#6C63FF" />}
                    </div>
                    <div>
                      <p style={styles.subjectName}>{subject.name}</p>
                      <p style={styles.subjectType}>
                        {isWorkshop ? 'Taller' : 'Académica'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vista: Mis Aulas */}
        {activeView === 'classrooms' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Aulas activas</h2>

            {loading ? (
              <p style={styles.emptyText}>Cargando...</p>
            ) : classrooms.length === 0 ? (
              <div style={styles.emptyState}>
                <Layers size={36} color="#CBD5E1" />
                <p style={styles.emptyText}>No tienes aulas creadas aún.</p>
                <p style={styles.emptySubtext}>Crea una con el botón de arriba.</p>
              </div>
            ) : (
              <div style={styles.classroomGrid}>
                {classrooms.map(classroom => (
                  <div key={classroom.id} style={styles.classroomCard}>
                    <div style={styles.classroomTopRow}>
                      <div style={styles.periodBadge}>
                        <Calendar size={13} color="#6C63FF" />
                        <span>{classroom.academic_periods?.name}</span>
                      </div>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: classroom.is_active ? '#ECFDF5' : '#F1F5F9',
                        color: classroom.is_active ? '#10B981' : '#94A3B8',
                      }}>
                        {classroom.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <h3 style={styles.classroomSection}>{classroom.sections?.name}</h3>
                    <p style={styles.classroomSubjectName}>
                      {classroom.teacher_subjects?.subjects?.name}
                    </p>

                    <div style={styles.classroomFooter}>
                      <span style={styles.classroomType}>
                        {classroom.teacher_subjects?.subjects?.type === 'workshop' ? '🔧 Taller' : '📚 Académica'}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleDeleteClassroom(classroom.id)}
                          style={styles.deleteClassroomBtn}
                          title="Eliminar aula"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                          style={styles.classroomBtn}
                        >
                          Abrir <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Nueva materia (solo taller) */}
      {showSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva materia de taller</h2>
              <button onClick={() => setShowSubjectModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la materia</label>
                <input
                  style={styles.input}
                  placeholder="Ej: Electricidad Industrial"
                  value={subjectForm.name}
                  onChange={e => { setSubjectForm({ name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button
                onClick={handleAddSubject}
                disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}
              >
                {formLoading ? 'Agregando...' : 'Agregar materia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear aula */}
      {showClassroomModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Crear aula</h2>
              <button onClick={() => setShowClassroomModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Materia</label>
                {subjects.length === 0 ? (
                  <p style={styles.warningText}>
                    {isWorkshop ? 'Primero agrega una materia de taller.' : 'Aún no tienes materia asignada.'}
                  </p>
                ) : (
                  <select
                    style={styles.input}
                    value={classroomForm.subjectId}
                    onChange={e => setClassroomForm(p => ({ ...p, subjectId: e.target.value }))}
                  >
                    <option value="">Selecciona una materia</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Período</label>
                <select
                  style={styles.input}
                  value={classroomForm.periodId}
                  onChange={e => setClassroomForm(p => ({ ...p, periodId: e.target.value }))}
                >
                  <option value="">Selecciona un período</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Sección</label>
                <div style={styles.toggleRow}>
                  <button
                    onClick={() => setClassroomForm(p => ({ ...p, useNewSection: false }))}
                    style={{
                      ...styles.toggleBtn,
                      background: !classroomForm.useNewSection ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#F8FAFC',
                      color: !classroomForm.useNewSection ? '#fff' : '#64748B',
                      border: !classroomForm.useNewSection ? 'none' : '1.5px solid #E2E8F0',
                    }}
                  >
                    Existente
                  </button>
                  <button
                    onClick={() => setClassroomForm(p => ({ ...p, useNewSection: true }))}
                    style={{
                      ...styles.toggleBtn,
                      background: classroomForm.useNewSection ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#F8FAFC',
                      color: classroomForm.useNewSection ? '#fff' : '#64748B',
                      border: classroomForm.useNewSection ? 'none' : '1.5px solid #E2E8F0',
                    }}
                  >
                    Crear nueva
                  </button>
                </div>

                {!classroomForm.useNewSection ? (
                  sections.length === 0 ? (
                    <p style={{ ...styles.warningText, marginTop: '8px' }}>
                      No hay secciones aún. Selecciona "Crear nueva".
                    </p>
                  ) : (
                    <select
                      style={{ ...styles.input, marginTop: '8px' }}
                      value={classroomForm.sectionId}
                      onChange={e => setClassroomForm(p => ({ ...p, sectionId: e.target.value }))}
                    >
                      <option value="">Selecciona una sección</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )
                ) : (
                  <input
                    style={{ ...styles.input, marginTop: '8px' }}
                    placeholder="Ej: 5to A"
                    value={classroomForm.newSectionName}
                    onChange={e => setClassroomForm(p => ({ ...p, newSectionName: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                )}
              </div>

              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowClassroomModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button
                onClick={handleCreateClassroom}
                disabled={formLoading || subjects.length === 0}
                style={{ ...styles.primaryButton, opacity: (formLoading || subjects.length === 0) ? 0.7 : 1 }}
              >
                {formLoading ? 'Creando...' : 'Crear aula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Inter', sans-serif" },
  sidebar: { width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 20px', borderBottom: '1px solid #E2E8F0' },
  sidebarIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { fontSize: '18px', fontWeight: '700', color: '#1E293B' },
  nav: { padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', color: '#64748B', cursor: 'pointer' },
  navItemActive: { backgroundColor: '#EEF2FF', color: '#6C63FF', fontWeight: '600' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  buttonGroup: { display: 'flex', gap: '12px' },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108,99,255,0.3)' },
  secondaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 2px' },
  statLabel: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' },
  emptyText: { color: '#94A3B8', fontSize: '14px', margin: 0, textAlign: 'center' },
  emptySubtext: { fontSize: '13px', color: '#CBD5E1', margin: 0 },
  subjectGrid: { display: 'flex', flexWrap: 'wrap', gap: '12px' },
  subjectCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA', minWidth: '200px' },
  subjectIconBox: { width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subjectName: { fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 2px' },
  subjectType: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  classroomGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  classroomCard: { border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' },
  classroomTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  periodBadge: { display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#EEF2FF', fontSize: '12px', fontWeight: '600', color: '#6C63FF' },
  statusBadge: { fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' },
  classroomSection: { fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '4px 0 0' },
  classroomSubjectName: { fontSize: '13px', color: '#64748B', margin: 0 },
  classroomFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' },
  classroomType: { fontSize: '12px', color: '#94A3B8' },
  classroomBtn: { display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  deleteClassroomBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer', flexShrink: 0 },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: '#ffffff', borderRadius: '20px', width: '90%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px', borderRadius: '8px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F1F5F9' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC' },
  toggleRow: { display: 'flex', gap: '10px' },
  toggleBtn: { flex: 1, padding: '9px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  warningText: { fontSize: '13px', color: '#F97316', margin: 0, padding: '10px 14px', backgroundColor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}

export default TeacherDashboard