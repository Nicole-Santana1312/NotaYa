import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, LogOut, ArrowLeft, Users, BookOpen,
  Plus, X, Check, Trash2, Wrench, Save, FileText,
  Download, MessageSquare, Clock
} from 'lucide-react'

const ClassroomView = () => {
  const { classroomId } = useParams()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [classroom, setClassroom] = useState(null)
  const [isWorkshop, setIsWorkshop] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('students')
  const [activePeriod, setActivePeriod] = useState('P1')
  const [success, setSuccess] = useState('')
  const [formError, setFormError] = useState('')

  // Estudiantes
  const [students, setStudents] = useState([])
  const [showAddStudents, setShowAddStudents] = useState(false)
  const [studentRows, setStudentRows] = useState([{ fullName: '', email: '' }])
  const [addingStudents, setAddingStudents] = useState(false)

  // Actividades
  const [activities, setActivities] = useState([])
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [activityForm, setActivityForm] = useState({
    name: '', type: 'exam', max_score: '', due_date: '', description: '', learning_outcome_id: ''
  })
  const [formLoading, setFormLoading] = useState(false)

  // RAs (taller)
  const [learningOutcomes, setLearningOutcomes] = useState([])
  const [showRAModal, setShowRAModal] = useState(false)
  const [raForm, setRaForm] = useState({ code: '', description: '', weight: '' })
  const [selectedRA, setSelectedRA] = useState(null)

  // Notas
  const [grades, setGrades] = useState({})
  const [savingGrades, setSavingGrades] = useState(false)

  // Entregas
  const [submissions, setSubmissions] = useState([])
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [gradeInput, setGradeInput] = useState('')
  const [gradeComment, setGradeComment] = useState('')
  const [gradingLoading, setGradingLoading] = useState(false)

  const periods = ['P1', 'P2', 'P3', 'P4']

  useEffect(() => { fetchClassroom() }, [classroomId])

  const fetchClassroom = async () => {
    setLoading(true)
    try {
      const { data: cr } = await supabase
        .from('classrooms')
        .select(`*, teacher_subjects(id, subjects(id, name, type)), sections(name), academic_periods(id, name, is_active)`)
        .eq('id', classroomId)
        .single()

      setClassroom(cr)
      const workshop = cr?.teacher_subjects?.subjects?.type === 'workshop'
      setIsWorkshop(workshop)

      await fetchStudents(cr.section_id)
      await fetchActivities(cr)
      if (workshop) await fetchLearningOutcomes(cr?.teacher_subjects?.subjects?.id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async (sectionId) => {
    const sid = sectionId || classroom?.section_id
    if (!sid) return
    const { data } = await supabase
      .from('section_students')
      .select('*, users(id, full_name, email)')
      .eq('section_id', sid)
      .order('enrolled_at')
    setStudents(data || [])
  }

  const fetchActivities = async (cr) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at')
    setActivities(data || [])
    if (data?.length > 0) await fetchGrades(data)
  }

  const fetchGrades = async (acts) => {
    const actIds = acts.map(a => a.id)
    const { data } = await supabase
      .from('activity_grades')
      .select('*')
      .in('activity_id', actIds)

    const gradeMap = {}
    data?.forEach(g => {
      if (!gradeMap[g.activity_id]) gradeMap[g.activity_id] = {}
      gradeMap[g.activity_id][g.student_id] = g.score
    })
    setGrades(gradeMap)
  }

  const fetchLearningOutcomes = async (subjectId) => {
    if (!subjectId) return
    const { data } = await supabase
      .from('learning_outcomes')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at')
    setLearningOutcomes(data || [])
  }

  const fetchSubmissions = async (activityId) => {
    const { data } = await supabase
      .from('submissions')
      .select('*, users(id, full_name, email)')
      .eq('activity_id', activityId)
      .order('submitted_at', { ascending: false })
    setSubmissions(data || [])
  }

  const showSuccessMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ── ESTUDIANTES ──────────────────────────────────────────

  const addStudentRow = () => setStudentRows(p => [...p, { fullName: '', email: '' }])
  const removeStudentRow = (i) => setStudentRows(p => p.filter((_, idx) => idx !== i))
  const updateStudentRow = (i, field, value) => {
    setStudentRows(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  const handleAddStudents = async () => {
    const valid = studentRows.filter(r => r.fullName.trim() && r.email.trim())
    if (valid.length === 0) { setFormError('Agrega al menos un estudiante.'); return }
    setAddingStudents(true)
    setFormError('')
    try {
      // Obtener section_id del aula una sola vez
      const { data: cr } = await supabase
        .from('classrooms')
        .select('section_id')
        .eq('id', classroomId)
        .single()

      for (const row of valid) {
        const res = await fetch('http://localhost:3001/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: row.email.trim(),
            password: '123456',
            full_name: row.fullName.trim(),
            role: 'student',
            institution_id: profile.institution_id,
            created_by: profile.id,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`${row.email}: ${data.error}`)

        // Inscribir en la sección, no en el aula
        const { error: insertError } = await supabase
          .from('section_students')
          .insert({ section_id: cr.section_id, student_id: data.userId })

        if (insertError && insertError.code !== '23505') throw insertError
      }

      showSuccessMsg(`${valid.length} estudiante(s) agregado(s).`)
      setShowAddStudents(false)
      setStudentRows([{ fullName: '', email: '' }])
      fetchStudents(cr.section_id)
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setAddingStudents(false)
    }
  }

  const handleRemoveStudent = async (ssId) => {
    await supabase.from('section_students').delete().eq('id', ssId)
    fetchStudents()
  }

  // ── ACTIVIDADES ──────────────────────────────────────────

  const getActivitiesForView = () => {
    if (isWorkshop) {
      if (!selectedRA) return []
      return activities.filter(a => a.learning_outcome_id === selectedRA)
    }
    const periodMap = { P1: 0, P2: 1, P3: 2, P4: 3 }
    return activities.filter(a => a.period_index === periodMap[activePeriod])
  }

  const handleCreateActivity = async () => {
    if (!activityForm.name || !activityForm.max_score) { setFormError('Nombre y valor son obligatorios.'); return }
    if (isWorkshop && !activityForm.learning_outcome_id) { setFormError('Selecciona un RA.'); return }
    setFormLoading(true)
    setFormError('')
    try {
      const periodMap = { P1: 0, P2: 1, P3: 2, P4: 3 }
      const { data: act, error } = await supabase
        .from('activities')
        .insert({
          classroom_id: classroomId,
          learning_outcome_id: isWorkshop ? activityForm.learning_outcome_id : null,
          name: activityForm.name,
          type: activityForm.type,
          max_score: parseFloat(activityForm.max_score),
          due_date: activityForm.due_date || null,
          description: activityForm.description || null,
          period_index: isWorkshop ? null : periodMap[activePeriod],
        })
        .select()
        .single()

      if (error) throw error

      // Crear registros de nota pendiente para cada estudiante
      if (students.length > 0) {
        await supabase.from('activity_grades').insert(
          students.map(s => ({
            activity_id: act.id,
            student_id: s.users.id,
            score: null,
            status: 'pending',
          }))
        )
      }

      showSuccessMsg('Actividad creada.')
      setShowActivityModal(false)
      setActivityForm({ name: '', type: 'exam', max_score: '', due_date: '', description: '', learning_outcome_id: '' })
      fetchActivities(classroom)
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteActivity = async (actId) => {
    await supabase.from('activities').delete().eq('id', actId)
    fetchActivities(classroom)
  }

  // ── NOTAS ────────────────────────────────────────────────

  const handleGradeChange = (activityId, studentId, value) => {
    setGrades(prev => ({ ...prev, [activityId]: { ...(prev[activityId] || {}), [studentId]: value } }))
  }

  const handleSaveGrades = async () => {
    setSavingGrades(true)
    try {
      const upserts = []
      Object.entries(grades).forEach(([actId, studentGrades]) => {
        const act = activities.find(a => a.id === actId)
        if (!act) return
        Object.entries(studentGrades).forEach(([stuId, score]) => {
          if (score === '' || score === null || score === undefined) return
          const numScore = Math.min(parseFloat(score), act.max_score)
          upserts.push({
            activity_id: actId, student_id: stuId, score: numScore,
            status: 'graded', graded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          })
        })
      })
      if (upserts.length > 0) {
        const { error } = await supabase.from('activity_grades').upsert(upserts, { onConflict: 'activity_id,student_id' })
        if (error) throw error
      }
      showSuccessMsg('Notas guardadas.')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSavingGrades(false)
    }
  }

  // ── RAs ──────────────────────────────────────────────────

  const totalRAWeight = learningOutcomes.reduce((sum, ra) => sum + ra.weight, 0)

  const handleCreateRA = async () => {
    if (!raForm.code || !raForm.description || !raForm.weight) { setFormError('Todos los campos son obligatorios.'); return }
    const newWeight = totalRAWeight + parseInt(raForm.weight)
    if (newWeight > 100) { setFormError(`Disponible: ${100 - totalRAWeight} pts`); return }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase.from('learning_outcomes').insert({
        subject_id: classroom?.teacher_subjects?.subjects?.id,
        code: raForm.code, description: raForm.description, weight: parseInt(raForm.weight),
      })
      if (error) throw error
      showSuccessMsg('RA creado.')
      setShowRAModal(false)
      setRaForm({ code: '', description: '', weight: '' })
      fetchLearningOutcomes(classroom?.teacher_subjects?.subjects?.id)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteRA = async (raId) => {
    await supabase.from('learning_outcomes').delete().eq('id', raId)
    if (selectedRA === raId) setSelectedRA(null)
    fetchLearningOutcomes(classroom?.teacher_subjects?.subjects?.id)
  }

  // ── ENTREGAS ─────────────────────────────────────────────

  const handleSelectActivityForSubmissions = async (act) => {
    setSelectedActivity(act)
    await fetchSubmissions(act.id)
  }

  const openGradeModal = (submission) => {
    setSelectedSubmission(submission)
    const existingGrade = grades[submission.activity_id]?.[submission.student_id]
    setGradeInput(existingGrade ?? '')
    setGradeComment('')
    setShowGradeModal(true)
  }

  const handleGradeFromSubmission = async () => {
    if (gradeInput === '') { setFormError('Ingresa una nota.'); return }
    const act = activities.find(a => a.id === selectedSubmission.activity_id)
    const numScore = Math.min(parseFloat(gradeInput), act?.max_score || 100)
    setGradingLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('activity_grades')
        .upsert({
          activity_id: selectedSubmission.activity_id,
          student_id: selectedSubmission.student_id,
          score: numScore,
          status: 'graded',
          teacher_comment: gradeComment || null,
          graded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'activity_id,student_id' })
      if (error) throw error
      showSuccessMsg(`Nota de ${selectedSubmission.users?.full_name} guardada.`)
      setShowGradeModal(false)
      fetchActivities(classroom)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setGradingLoading(false)
    }
  }

  const getFileUrl = async (path) => {
    const { data } = await supabase.storage.from('submissions').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#94A3B8' }}>
      Cargando aula...
    </div>
  )

  const currentActivities = getActivitiesForView()
  const subjectName = classroom?.teacher_subjects?.subjects?.name
  const sectionName = classroom?.sections?.name
  const periodName = classroom?.academic_periods?.name

  return (
    <div style={styles.page}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}><GraduationCap size={22} color="#fff" /></div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>
        <nav style={styles.nav}>
          {[
            { key: 'students', icon: <Users size={18} />, label: 'Estudiantes' },
            { key: 'grades', icon: <BookOpen size={18} />, label: 'Evaluación' },
            { key: 'submissions', icon: <FileText size={18} />, label: 'Entregas' },
          ].map(item => (
            <div key={item.key}
              style={{ ...styles.navItem, ...(activeTab === item.key ? styles.navActive : {}) }}
              onClick={() => setActiveTab(item.key)}>
              {item.icon}<span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{profile?.full_name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>{isWorkshop ? 'Prof. de Taller' : 'Prof. Académico'}</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>

        <div style={styles.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/teacher')} style={styles.backBtn}><ArrowLeft size={18} /></button>
            <div>
              <h1 style={styles.pageTitle}>{subjectName} — {sectionName}</h1>
              <p style={styles.pageSubtitle}>{isWorkshop ? 'Materia de Taller' : `Período: ${periodName}`}</p>
            </div>
          </div>
          {activeTab === 'grades' && (
            <button onClick={handleSaveGrades} disabled={savingGrades}
              style={{ ...styles.primaryButton, opacity: savingGrades ? 0.7 : 1 }}>
              <Save size={16} style={{ marginRight: '6px' }} />
              {savingGrades ? 'Guardando...' : 'Guardar notas'}
            </button>
          )}
        </div>

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />{success}
          </div>
        )}

        {/* ── TAB: ESTUDIANTES ── */}
        {activeTab === 'students' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Estudiantes ({students.length})</h2>
              <button onClick={() => { setShowAddStudents(!showAddStudents); setFormError('') }} style={styles.primaryButton}>
                <Plus size={16} style={{ marginRight: '6px' }} /> Agregar estudiantes
              </button>
            </div>

            {showAddStudents && (
              <div style={styles.addStudentsBox}>
                <p style={styles.addStudentsHint}>
                  La contraseña temporal será <strong>123456</strong>. Los estudiantes quedarán inscritos en la sección <strong>{sectionName}</strong> y aparecerán en todas las materias de esta sección.
                </p>
                {studentRows.map((row, i) => (
                  <div key={i} style={styles.studentRow}>
                    <span style={styles.studentRowNum}>{i + 1}</span>
                    <input style={styles.studentInput} placeholder="Nombre completo" value={row.fullName}
                      onChange={e => updateStudentRow(i, 'fullName', e.target.value)}
                      onFocus={e => e.target.style.borderColor = '#6C63FF'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    <input style={styles.studentInput} placeholder="Correo" type="email" value={row.email}
                      onChange={e => updateStudentRow(i, 'email', e.target.value)}
                      onFocus={e => e.target.style.borderColor = '#6C63FF'}
                      onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    {studentRows.length > 1 && (
                      <button onClick={() => removeStudentRow(i)} style={styles.removeRowBtn}><X size={14} /></button>
                    )}
                  </div>
                ))}
                {formError && <div style={styles.errorBox}>{formError}</div>}
                <div style={styles.addStudentsBtns}>
                  <button onClick={addStudentRow} style={styles.secondaryButton}>
                    <Plus size={14} style={{ marginRight: '4px' }} /> Añadir fila
                  </button>
                  <button onClick={handleAddStudents} disabled={addingStudents}
                    style={{ ...styles.primaryButton, opacity: addingStudents ? 0.7 : 1 }}>
                    {addingStudents ? 'Agregando...' : 'Guardar estudiantes'}
                  </button>
                </div>
              </div>
            )}

            {students.length === 0 ? (
              <div style={styles.emptyState}>
                <Users size={36} color="#CBD5E1" />
                <p style={styles.emptyText}>No hay estudiantes en esta sección aún.</p>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>{['#', 'Nombre', 'Correo', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {students.map((ss, i) => (
                      <tr key={ss.id} style={styles.tr}>
                        <td style={{ ...styles.td, color: '#94A3B8', width: '40px' }}>{i + 1}</td>
                        <td style={styles.td}>
                          <div style={styles.nameCell}>
                            <div style={styles.tableAvatar}>{ss.users?.full_name?.charAt(0).toUpperCase()}</div>
                            {ss.users?.full_name}
                          </div>
                        </td>
                        <td style={styles.td}>{ss.users?.email}</td>
                        <td style={styles.td}>
                          <button onClick={() => handleRemoveStudent(ss.id)} style={styles.deleteBtn}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EVALUACIÓN ── */}
        {activeTab === 'grades' && (
          <div>
            {!isWorkshop && (
              <div style={styles.periodTabs}>
                {periods.map(p => (
                  <button key={p} onClick={() => setActivePeriod(p)}
                    style={{
                      ...styles.periodTab,
                      background: activePeriod === p ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#fff',
                      color: activePeriod === p ? '#fff' : '#64748B',
                      border: activePeriod === p ? 'none' : '1.5px solid #E2E8F0',
                    }}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {isWorkshop && (
              <div style={styles.raSection}>
                <div style={styles.raSectionHeader}>
                  <div>
                    <h3 style={styles.raSectionTitle}>Resultados de Aprendizaje</h3>
                    <p style={styles.raWeightInfo}>
                      Peso total: <strong style={{ color: totalRAWeight === 100 ? '#10B981' : '#F97316' }}>
                        {totalRAWeight}/100
                      </strong>
                    </p>
                  </div>
                  <button onClick={() => { setShowRAModal(true); setFormError('') }} style={styles.secondaryButton}>
                    <Plus size={14} style={{ marginRight: '4px' }} /> Nuevo RA
                  </button>
                </div>
                <div style={styles.raList}>
                  {learningOutcomes.length === 0 ? (
                    <p style={styles.emptyText}>No hay RAs aún.</p>
                  ) : (
                    learningOutcomes.map(ra => (
                      <div key={ra.id} onClick={() => setSelectedRA(ra.id === selectedRA ? null : ra.id)}
                        style={{
                          ...styles.raCard,
                          border: selectedRA === ra.id ? '2px solid #6C63FF' : '1.5px solid #E2E8F0',
                          backgroundColor: selectedRA === ra.id ? '#EEF2FF' : '#fff',
                        }}>
                        <div style={styles.raCardLeft}>
                          <span style={styles.raCode}>{ra.code}</span>
                          <span style={styles.raDesc}>{ra.description}</span>
                        </div>
                        <div style={styles.raCardRight}>
                          <span style={styles.raWeight}>{ra.weight} pts</span>
                          <button onClick={e => { e.stopPropagation(); handleDeleteRA(ra.id) }} style={styles.deleteBtn}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>
                  {isWorkshop
                    ? selectedRA ? `Actividades — ${learningOutcomes.find(r => r.id === selectedRA)?.code}` : 'Selecciona un RA'
                    : `Actividades — ${activePeriod}`}
                </h2>
                {(!isWorkshop || selectedRA) && (
                  <button onClick={() => { setShowActivityModal(true); setFormError('') }} style={styles.primaryButton}>
                    <Plus size={16} style={{ marginRight: '6px' }} /> Nueva actividad
                  </button>
                )}
              </div>

              {currentActivities.length === 0 ? (
                <div style={styles.emptyState}>
                  <BookOpen size={36} color="#CBD5E1" />
                  <p style={styles.emptyText}>No hay actividades aún.</p>
                </div>
              ) : students.length === 0 ? (
                <p style={styles.emptyText}>Agrega estudiantes primero.</p>
              ) : (
                <div style={styles.gradesTableWrapper}>
                  <table style={styles.gradesTable}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, minWidth: '160px' }}>Estudiante</th>
                        {currentActivities.map(act => (
                          <th key={act.id} style={styles.activityHeader}>
                            <div style={styles.activityHeaderContent}>
                              <span style={styles.activityName}>{act.name}</span>
                              <span style={styles.activityMax}>/{act.max_score}</span>
                              <button onClick={() => handleDeleteActivity(act.id)} style={styles.deleteActivityBtn}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </th>
                        ))}
                        <th style={styles.th}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(ss => {
                        const stuId = ss.users?.id
                        const total = currentActivities.reduce((sum, act) => {
                          const score = parseFloat(grades[act.id]?.[stuId] ?? 0)
                          return sum + (isNaN(score) ? 0 : score)
                        }, 0)
                        const maxTotal = currentActivities.reduce((sum, act) => sum + act.max_score, 0)
                        const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
                        return (
                          <tr key={ss.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.nameCell}>
                                <div style={styles.tableAvatar}>{ss.users?.full_name?.charAt(0).toUpperCase()}</div>
                                {ss.users?.full_name}
                              </div>
                            </td>
                            {currentActivities.map(act => (
                              <td key={act.id} style={styles.gradeCell}>
                                <input style={styles.gradeInput} type="number" min="0" max={act.max_score}
                                  placeholder="—" value={grades[act.id]?.[stuId] ?? ''}
                                  onChange={e => handleGradeChange(act.id, stuId, e.target.value)} />
                              </td>
                            ))}
                            <td style={styles.td}>
                              <span style={{
                                ...styles.totalBadge,
                                backgroundColor: pct >= 70 ? '#ECFDF5' : '#FEF2F2',
                                color: pct >= 70 ? '#10B981' : '#EF4444',
                              }}>{pct}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ENTREGAS ── */}
        {activeTab === 'submissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Selecciona una actividad</h2>
              {activities.length === 0 ? (
                <div style={styles.emptyState}>
                  <FileText size={36} color="#CBD5E1" />
                  <p style={styles.emptyText}>No hay actividades creadas aún.</p>
                </div>
              ) : (
                <div style={styles.activitySelector}>
                  {activities.map(act => {
                    const isSelected = selectedActivity?.id === act.id
                    return (
                      <div key={act.id}
                        onClick={() => handleSelectActivityForSubmissions(act)}
                        style={{
                          ...styles.activitySelectorCard,
                          border: isSelected ? '2px solid #6C63FF' : '1.5px solid #E2E8F0',
                          backgroundColor: isSelected ? '#EEF2FF' : '#FAFAFA',
                        }}>
                        <div style={styles.activitySelectorLeft}>
                          <div style={{ ...styles.activitySelectorIcon, backgroundColor: isSelected ? '#6C63FF' : '#E2E8F0' }}>
                            <FileText size={14} color={isSelected ? '#fff' : '#94A3B8'} />
                          </div>
                          <div>
                            <p style={{ ...styles.activitySelectorName, color: isSelected ? '#6C63FF' : '#1E293B' }}>
                              {act.name}
                            </p>
                            <p style={styles.activitySelectorMeta}>
                              Vale {act.max_score} pts
                              {act.due_date && ` · Entrega: ${new Date(act.due_date).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span style={styles.submissionCountBadge}>{submissions.length} entrega(s)</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {selectedActivity && (
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.sectionTitle}>Entregas — {selectedActivity.name}</h2>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0' }}>
                      {submissions.length} de {students.length} estudiante(s) han entregado
                    </p>
                  </div>
                </div>

                <div style={styles.submissionProgress}>
                  <div style={styles.submissionProgressFill(submissions.length, students.length)} />
                </div>

                {students.length === 0 ? (
                  <p style={styles.emptyText}>No hay estudiantes en esta sección.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {students.map(ss => {
                      const submission = submissions.find(s => s.student_id === ss.users?.id)
                      const grade = grades[selectedActivity.id]?.[ss.users?.id]
                      const hasGrade = grade !== null && grade !== undefined && grade !== ''
                      return (
                        <div key={ss.id} style={styles.submissionRow}>
                          <div style={styles.submissionStudentInfo}>
                            <div style={styles.tableAvatar}>{ss.users?.full_name?.charAt(0).toUpperCase()}</div>
                            <div>
                              <p style={styles.submissionStudentName}>{ss.users?.full_name}</p>
                              <p style={styles.submissionStudentEmail}>{ss.users?.email}</p>
                            </div>
                          </div>

                          <div style={styles.submissionContent}>
                            {!submission ? (
                              <span style={styles.noSubmissionBadge}>
                                <Clock size={12} style={{ marginRight: '4px' }} /> Sin entregar
                              </span>
                            ) : (
                              <div style={styles.submissionDetails}>
                                {submission.comment && (
                                  <div style={styles.submissionComment}>
                                    <MessageSquare size={13} color="#6C63FF" />
                                    <span style={styles.submissionCommentText}>{submission.comment}</span>
                                  </div>
                                )}
                                {submission.file_url && (
                                  <button onClick={() => getFileUrl(submission.file_url)} style={styles.downloadBtn}>
                                    <Download size={13} style={{ marginRight: '4px' }} /> Ver archivo
                                  </button>
                                )}
                                <span style={styles.submittedAt}>
                                  {new Date(submission.submitted_at).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div style={styles.submissionGradeArea}>
                            {hasGrade ? (
                              <div style={styles.gradedInfo}>
                                <span style={{
                                  ...styles.totalBadge,
                                  backgroundColor: (grade / selectedActivity.max_score) >= 0.7 ? '#ECFDF5' : '#FEF2F2',
                                  color: (grade / selectedActivity.max_score) >= 0.7 ? '#10B981' : '#EF4444',
                                }}>
                                  {grade}/{selectedActivity.max_score}
                                </span>
                                <button onClick={() => openGradeModal({ ...submission, student_id: ss.users?.id, users: ss.users })} style={styles.editGradeBtn}>
                                  Editar
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => openGradeModal({
                                activity_id: selectedActivity.id,
                                student_id: ss.users?.id,
                                users: ss.users,
                                comment: submission?.comment || null,
                                file_url: submission?.file_url || null,
                              })} style={styles.gradeBtn}>
                                Calificar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal nueva actividad */}
      {showActivityModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva actividad</h2>
              <button onClick={() => setShowActivityModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              {isWorkshop && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>RA al que pertenece</label>
                  <select style={styles.input} value={activityForm.learning_outcome_id}
                    onChange={e => setActivityForm(p => ({ ...p, learning_outcome_id: e.target.value }))}>
                    <option value="">Selecciona un RA</option>
                    {learningOutcomes.map(ra => (
                      <option key={ra.id} value={ra.id}>{ra.code} — {ra.description}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la actividad</label>
                <input style={styles.input} placeholder="Ej: Examen parcial..."
                  value={activityForm.name}
                  onChange={e => { setActivityForm(p => ({ ...p, name: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.twoCol}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Tipo</label>
                  <select style={styles.input} value={activityForm.type}
                    onChange={e => setActivityForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="exam">Examen</option>
                    <option value="homework">Tarea</option>
                    <option value="notebook">Cuaderno</option>
                    <option value="project">Proyecto</option>
                    <option value="practice">Práctica</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Valor (puntos)</label>
                  <input style={styles.input} type="number" min="1" placeholder="Ej: 20"
                    value={activityForm.max_score}
                    onChange={e => setActivityForm(p => ({ ...p, max_score: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Fecha de entrega <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                <input style={styles.input} type="date" value={activityForm.due_date}
                  onChange={e => setActivityForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                <input style={styles.input} placeholder="Instrucciones..."
                  value={activityForm.description}
                  onChange={e => setActivityForm(p => ({ ...p, description: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowActivityModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateActivity} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear actividad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo RA */}
      {showRAModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nuevo RA</h2>
              <button onClick={() => setShowRAModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.infoBox}>
                Peso disponible: <strong>{100 - totalRAWeight} puntos</strong>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Código</label>
                <input style={styles.input} placeholder="Ej: RA-01" value={raForm.code}
                  onChange={e => { setRaForm(p => ({ ...p, code: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción</label>
                <input style={styles.input} placeholder="Ej: Demuestra dominio de..." value={raForm.description}
                  onChange={e => { setRaForm(p => ({ ...p, description: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Peso (puntos)</label>
                <input style={styles.input} type="number" min="1" max={100 - totalRAWeight}
                  placeholder={`Máximo ${100 - totalRAWeight}`} value={raForm.weight}
                  onChange={e => { setRaForm(p => ({ ...p, weight: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowRAModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateRA} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear RA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal calificar */}
      {showGradeModal && selectedSubmission && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Calificar entrega</h2>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0' }}>
                  {selectedSubmission.users?.full_name}
                </p>
              </div>
              <button onClick={() => setShowGradeModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              {selectedSubmission.comment && (
                <div style={styles.submissionPreview}>
                  <p style={styles.submissionPreviewLabel}>Comentario del estudiante:</p>
                  <p style={styles.submissionPreviewText}>{selectedSubmission.comment}</p>
                </div>
              )}
              {selectedSubmission.file_url && (
                <button onClick={() => getFileUrl(selectedSubmission.file_url)} style={styles.downloadBtn}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Ver archivo adjunto
                </button>
              )}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nota (máximo: {selectedActivity?.max_score} pts)</label>
                <input style={styles.input} type="number" min="0" max={selectedActivity?.max_score}
                  placeholder={`0 — ${selectedActivity?.max_score}`}
                  value={gradeInput}
                  onChange={e => { setGradeInput(e.target.value); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Retroalimentación <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                <textarea style={styles.textarea} rows={3}
                  placeholder="Ej: Buen trabajo, pero falta desarrollar el punto 2..."
                  value={gradeComment}
                  onChange={e => setGradeComment(e.target.value)}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowGradeModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleGradeFromSubmission} disabled={gradingLoading}
                style={{ ...styles.primaryButton, opacity: gradingLoading ? 0.7 : 1 }}>
                {gradingLoading ? 'Guardando...' : 'Guardar nota'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600', flexShrink: 0 },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', cursor: 'pointer' },
  pageTitle: { fontSize: '22px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  secondaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0, textAlign: 'center' },
  addStudentsBox: { backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  addStudentsHint: { fontSize: '13px', color: '#64748B', margin: 0 },
  studentRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  studentRowNum: { fontSize: '13px', color: '#94A3B8', minWidth: '20px', textAlign: 'center' },
  studentInput: { flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', color: '#1E293B', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' },
  removeRowBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer', flexShrink: 0 },
  addStudentsBtns: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94A3B8', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', letterSpacing: '0.5px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#475569' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', color: '#1E293B' },
  tableAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600', flexShrink: 0 },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer' },
  periodTabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
  periodTab: { padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  raSection: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9', marginBottom: '20px' },
  raSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  raSectionTitle: { fontSize: '15px', fontWeight: '600', color: '#1E293B', margin: '0 0 4px' },
  raWeightInfo: { fontSize: '13px', color: '#64748B', margin: 0 },
  raList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  raCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s' },
  raCardLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  raCode: { fontSize: '13px', fontWeight: '700', color: '#6C63FF', backgroundColor: '#EEF2FF', padding: '3px 8px', borderRadius: '6px' },
  raDesc: { fontSize: '14px', color: '#1E293B' },
  raCardRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  raWeight: { fontSize: '13px', fontWeight: '700', color: '#10B981' },
  gradesTableWrapper: { overflowX: 'auto' },
  gradesTable: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  activityHeader: { padding: '10px 8px', borderBottom: '1px solid #F1F5F9', minWidth: '100px' },
  activityHeaderContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  activityName: { fontSize: '11px', fontWeight: '600', color: '#475569', textAlign: 'center' },
  activityMax: { fontSize: '11px', color: '#94A3B8' },
  deleteActivityBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: '2px' },
  gradeCell: { padding: '8px', textAlign: 'center' },
  gradeInput: { width: '60px', padding: '6px 8px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', textAlign: 'center', outline: 'none', backgroundColor: '#F8FAFC', color: '#1E293B' },
  totalBadge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  infoBox: { backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', color: '#6C63FF', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  activitySelector: { display: 'flex', flexDirection: 'column', gap: '8px' },
  activitySelectorCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s' },
  activitySelectorLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  activitySelectorIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' },
  activitySelectorName: { fontSize: '14px', fontWeight: '600', margin: '0 0 2px' },
  activitySelectorMeta: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  submissionCountBadge: { fontSize: '12px', fontWeight: '600', color: '#6C63FF', backgroundColor: '#EEF2FF', padding: '4px 10px', borderRadius: '20px' },
  submissionProgress: { height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' },
  submissionProgressFill: (count, total) => ({
    height: '100%',
    width: total > 0 ? `${(count / total) * 100}%` : '0%',
    backgroundColor: '#6C63FF',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  }),
  submissionRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' },
  submissionStudentInfo: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' },
  submissionStudentName: { fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 2px' },
  submissionStudentEmail: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  submissionContent: { flex: 1 },
  noSubmissionBadge: { display: 'flex', alignItems: 'center', fontSize: '12px', color: '#94A3B8', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '20px', width: 'fit-content' },
  submissionDetails: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  submissionComment: { display: 'flex', alignItems: 'flex-start', gap: '6px', maxWidth: '300px' },
  submissionCommentText: { fontSize: '13px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' },
  downloadBtn: { display: 'flex', alignItems: 'center', padding: '5px 12px', borderRadius: '8px', border: '1.5px solid #C7D2FE', backgroundColor: '#EEF2FF', color: '#6C63FF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  submittedAt: { fontSize: '11px', color: '#94A3B8' },
  submissionGradeArea: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px', justifyContent: 'flex-end' },
  gradedInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  gradeBtn: { padding: '7px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  editGradeBtn: { padding: '5px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px', borderRadius: '8px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F1F5F9' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC' },
  textarea: { padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', resize: 'vertical', fontFamily: 'inherit', backgroundColor: '#F8FAFC', boxSizing: 'border-box', width: '100%' },
  submissionPreview: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' },
  submissionPreviewLabel: { fontSize: '11px', fontWeight: '600', color: '#94A3B8', margin: '0 0 6px', textTransform: 'uppercase' },
  submissionPreviewText: { fontSize: '14px', color: '#475569', margin: 0, lineHeight: '1.6' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}

export default ClassroomView