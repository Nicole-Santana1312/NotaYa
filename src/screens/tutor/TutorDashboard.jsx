import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ProfilePanel from '../../components/ProfilePanel'
import {
  GraduationCap, LogOut, Users, BookOpen,
  Wrench, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, UserCircle
} from 'lucide-react'

const TutorDashboard = () => {
  const { profile, signOut } = useAuth()

  const [students, setStudents] = useState([])       // hijos vinculados
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [academicData, setAcademicData] = useState([])
  const [workshopData, setWorkshopData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [expandedSubject, setExpandedSubject] = useState(null)
  const [activeTab, setActiveTab] = useState('academic')
  const [activeView, setActiveView] = useState('grades')

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    if (selectedStudent) fetchGrades(selectedStudent.id)
  }, [selectedStudent])

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('student_tutors')
        .select('*, users!student_tutors_student_id_fkey(id, full_name, email)')
        .eq('tutor_id', profile.id)

      const studentList = data?.map(st => st.users) || []
      setStudents(studentList)
      if (studentList.length > 0) setSelectedStudent(studentList[0])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGrades = async (studentId) => {
    setLoadingGrades(true)
    setAcademicData([])
    setWorkshopData([])
    try {
      // Traer todos los aulas en los que está el estudiante
      const { data: csData } = await supabase
        .from('classroom_students')
        .select(`
          classroom_id,
          classrooms(
            id,
            is_active,
            teacher_subjects(
              subjects(id, name, type)
            ),
            sections(name),
            academic_periods(id, name)
          )
        `)
        .eq('student_id', studentId)

      if (!csData || csData.length === 0) {
        setLoadingGrades(false)
        return
      }

      const academic = []
      const workshop = []

      for (const cs of csData) {
        const classroom = cs.classrooms
        if (!classroom) continue

        const subject = classroom.teacher_subjects?.subjects
        const section = classroom.sections?.name
        const period = classroom.academic_periods?.name
        const classroomId = classroom.id

        // Traer actividades del aula
        const { data: activities } = await supabase
          .from('activities')
          .select('id, name, max_score, type, learning_outcome_id, period_index')
          .eq('classroom_id', classroomId)
          .order('created_at')

        // Traer notas del estudiante en esas actividades
        const actIds = activities?.map(a => a.id) || []
        let gradeMap = {}

        if (actIds.length > 0) {
          const { data: grades } = await supabase
            .from('activity_grades')
            .select('activity_id, score, status')
            .in('activity_id', actIds)
            .eq('student_id', studentId)

          grades?.forEach(g => { gradeMap[g.activity_id] = g })
        }

        if (subject?.type === 'academic') {
          // Agrupar por periodo (P1-P4)
          const periods = ['P1', 'P2', 'P3', 'P4']
          const byPeriod = periods.map((pName, idx) => {
            const periodActs = activities?.filter(a => a.period_index === idx) || []
            const totalMax = periodActs.reduce((s, a) => s + a.max_score, 0)
            const totalScore = periodActs.reduce((s, a) => {
              const g = gradeMap[a.id]
              return s + (g?.score ?? 0)
            }, 0)
            const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null
            return {
              period: pName,
              activities: periodActs.map(a => ({
                ...a,
                grade: gradeMap[a.id] || null,
              })),
              percentage: pct,
              totalMax,
            }
          })

          academic.push({
            subjectId: subject.id,
            subjectName: subject.name,
            section,
            classroomId,
            periods: byPeriod,
          })
        } else if (subject?.type === 'workshop') {
          // Traer RAs de la materia
          const { data: ras } = await supabase
            .from('learning_outcomes')
            .select('id, code, description, weight')
            .eq('subject_id', subject.id)
            .order('created_at')

          const raData = ras?.map(ra => {
            const raActs = activities?.filter(a => a.learning_outcome_id === ra.id) || []
            const totalMax = raActs.reduce((s, a) => s + a.max_score, 0)
            const totalScore = raActs.reduce((s, a) => {
              const g = gradeMap[a.id]
              return s + (g?.score ?? 0)
            }, 0)
            const raScore = totalMax > 0
              ? (totalScore / totalMax) * ra.weight
              : null

            return {
              ...ra,
              activities: raActs.map(a => ({ ...a, grade: gradeMap[a.id] || null })),
              raScore: raScore !== null ? Math.round(raScore * 100) / 100 : null,
            }
          }) || []

          const totalWorkshopScore = raData.reduce((s, ra) => s + (ra.raScore ?? 0), 0)
          const hasAnyScore = raData.some(ra => ra.raScore !== null)

          workshop.push({
            subjectId: subject.id,
            subjectName: subject.name,
            section,
            period,
            classroomId,
            ras: raData,
            totalScore: hasAnyScore ? Math.round(totalWorkshopScore * 100) / 100 : null,
          })
        }
      }

      setAcademicData(academic)
      setWorkshopData(workshop)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingGrades(false)
    }
  }

  const toggleSubject = (key) => {
    setExpandedSubject(prev => prev === key ? null : key)
  }

  const getScoreColor = (score, max = 100) => {
    const pct = max === 100 ? score : (score / max) * 100
    if (pct === null || pct === undefined) return { bg: '#F1F5F9', color: '#94A3B8' }
    if (pct >= 70) return { bg: '#ECFDF5', color: '#10B981' }
    return { bg: '#FEF2F2', color: '#EF4444' }
  }

  const getActivityTypeName = (type) => {
    const map = { exam: 'Examen', homework: 'Tarea', notebook: 'Cuaderno', project: 'Proyecto', practice: 'Práctica', other: 'Otro' }
    return map[type] || type
  }

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

        {/* Lista de hijos */}
        <div style={styles.studentsSection}>
          <p style={styles.studentsSectionLabel}>MIS HIJOS</p>
          {loading ? (
            <p style={styles.loadingText}>Cargando...</p>
          ) : students.length === 0 ? (
            <p style={styles.noStudentsText}>No hay estudiantes vinculados.</p>
          ) : (
            students.map(student => (
              <div
                key={student.id}
                onClick={() => { setSelectedStudent(student); setActiveView('grades') }}
                style={{
                  ...styles.studentItem,
                  backgroundColor: selectedStudent?.id === student.id ? '#EEF2FF' : 'transparent',
                  color: selectedStudent?.id === student.id ? '#6C63FF' : '#64748B',
                }}
              >
                <div style={{
                  ...styles.studentAvatar,
                  background: selectedStudent?.id === student.id
                    ? 'linear-gradient(135deg, #6C63FF, #4FACFE)'
                    : '#E2E8F0',
                  color: selectedStudent?.id === student.id ? '#fff' : '#94A3B8',
                }}>
                  {student.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={styles.studentName}>{student.full_name}</p>
                  <p style={styles.studentEmail}>{student.email}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <nav style={styles.profileNav}>
          <div
            style={{
              ...styles.profileNavItem,
              ...(activeView === 'profile' ? styles.profileNavItemActive : {}),
            }}
            onClick={() => setActiveView('profile')}
          >
            <UserCircle size={18} />
            <span>Mi perfil</span>
          </div>
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>Tutor</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {activeView === 'profile' ? (
          <ProfilePanel roleLabel="Tutor" />
        ) : (
          <>

        {!selectedStudent ? (
          <div style={styles.emptyMain}>
            <Users size={48} color="#CBD5E1" />
            <p style={styles.emptyMainText}>Selecciona un estudiante para ver sus notas.</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div style={styles.topBar}>
              <div>
                <h1 style={styles.pageTitle}>{selectedStudent.full_name}</h1>
                <p style={styles.pageSubtitle}>Monitoreo de notas — solo lectura</p>
              </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
              <button
                onClick={() => setActiveTab('academic')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'academic' ? '2px solid #6C63FF' : '2px solid transparent',
                  color: activeTab === 'academic' ? '#6C63FF' : '#94A3B8',
                }}
              >
                <BookOpen size={16} style={{ marginRight: '6px' }} />
                Materias Académicas
                {academicData.length > 0 && (
                  <span style={styles.tabBadge}>{academicData.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('workshop')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'workshop' ? '2px solid #F97316' : '2px solid transparent',
                  color: activeTab === 'workshop' ? '#F97316' : '#94A3B8',
                }}
              >
                <Wrench size={16} style={{ marginRight: '6px' }} />
                Materias de Taller
                {workshopData.length > 0 && (
                  <span style={{ ...styles.tabBadge, backgroundColor: '#FFF7ED', color: '#F97316' }}>{workshopData.length}</span>
                )}
              </button>
            </div>

            {loadingGrades ? (
              <div style={styles.loadingBox}>
                <p style={styles.loadingText}>Cargando notas...</p>
              </div>
            ) : (

              /* ── ACADÉMICAS ── */
              activeTab === 'academic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {academicData.length === 0 ? (
                    <div style={styles.emptyState}>
                      <BookOpen size={36} color="#CBD5E1" />
                      <p style={styles.emptyText}>No hay materias académicas registradas.</p>
                    </div>
                  ) : (
                    academicData.map(subject => {
                      const key = `academic-${subject.classroomId}`
                      const isExpanded = expandedSubject === key

                      // Calcular promedio general de las notas disponibles
                      const validPeriods = subject.periods.filter(p => p.percentage !== null)
                      const avg = validPeriods.length > 0
                        ? Math.round(validPeriods.reduce((s, p) => s + p.percentage, 0) / validPeriods.length)
                        : null

                      return (
                        <div key={key} style={styles.subjectCard}>
                          {/* Header del subject */}
                          <div
                            style={styles.subjectHeader}
                            onClick={() => toggleSubject(key)}
                          >
                            <div style={styles.subjectHeaderLeft}>
                              <div style={styles.subjectIconBox}>
                                <BookOpen size={18} color="#6C63FF" />
                              </div>
                              <div>
                                <p style={styles.subjectName}>{subject.subjectName}</p>
                                <p style={styles.subjectSection}>Sección: {subject.section}</p>
                              </div>
                            </div>
                            <div style={styles.subjectHeaderRight}>
                              {avg !== null && (
                                <div style={styles.avgBox}>
                                  {avg >= 70
                                    ? <CheckCircle size={14} color="#10B981" />
                                    : <AlertCircle size={14} color="#EF4444" />}
                                  <span style={{
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    color: avg >= 70 ? '#10B981' : '#EF4444',
                                  }}>
                                    Promedio: {avg}%
                                  </span>
                                </div>
                              )}
                              {isExpanded
                                ? <ChevronUp size={18} color="#94A3B8" />
                                : <ChevronDown size={18} color="#94A3B8" />}
                            </div>
                          </div>

                          {/* Períodos */}
                          {isExpanded && (
                            <div style={styles.subjectBody}>
                              {/* Resumen de períodos */}
                              <div style={styles.periodsGrid}>
                                {subject.periods.map(p => {
                                  const c = p.percentage !== null ? getScoreColor(p.percentage) : { bg: '#F8FAFC', color: '#94A3B8' }
                                  return (
                                    <div key={p.period} style={{ ...styles.periodSummaryCard, backgroundColor: c.bg }}>
                                      <p style={styles.periodLabel}>{p.period}</p>
                                      <p style={{ ...styles.periodScore, color: c.color }}>
                                        {p.percentage !== null ? `${p.percentage}%` : '—'}
                                      </p>
                                      <p style={{ ...styles.periodStatus, color: c.color }}>
                                        {p.percentage === null ? 'Sin notas'
                                          : p.percentage >= 70 ? 'Aprobado' : 'Por debajo'}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Actividades por período */}
                              {subject.periods.map(p => p.activities.length > 0 && (
                                <div key={p.period} style={styles.periodDetail}>
                                  <p style={styles.periodDetailTitle}>{p.period}</p>
                                  <div style={styles.activityList}>
                                    {p.activities.map(act => {
                                      const score = act.grade?.score
                                      const hasGrade = score !== null && score !== undefined
                                      const c = hasGrade ? getScoreColor(score, act.max_score) : { bg: '#F8FAFC', color: '#94A3B8' }
                                      return (
                                        <div key={act.id} style={styles.activityRow}>
                                          <div style={styles.activityRowLeft}>
                                            <span style={styles.activityType}>
                                              {getActivityTypeName(act.type)}
                                            </span>
                                            <span style={styles.activityRowName}>{act.name}</span>
                                          </div>
                                          <span style={{ ...styles.activityGrade, backgroundColor: c.bg, color: c.color }}>
                                            {hasGrade ? `${score}/${act.max_score}` : 'Pendiente'}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )
            )}

            {/* ── TALLER ── */}
            {!loadingGrades && activeTab === 'workshop' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {workshopData.length === 0 ? (
                  <div style={styles.emptyState}>
                    <Wrench size={36} color="#CBD5E1" />
                    <p style={styles.emptyText}>No hay materias de taller registradas.</p>
                  </div>
                ) : (
                  workshopData.map(subject => {
                    const key = `workshop-${subject.classroomId}`
                    const isExpanded = expandedSubject === key
                    const total = subject.totalScore

                    return (
                      <div key={key} style={styles.subjectCard}>
                        <div
                          style={styles.subjectHeader}
                          onClick={() => toggleSubject(key)}
                        >
                          <div style={styles.subjectHeaderLeft}>
                            <div style={{ ...styles.subjectIconBox, backgroundColor: '#FFF7ED' }}>
                              <Wrench size={18} color="#F97316" />
                            </div>
                            <div>
                              <p style={styles.subjectName}>{subject.subjectName}</p>
                              <p style={styles.subjectSection}>
                                Sección: {subject.section} · {subject.period}
                              </p>
                            </div>
                          </div>
                          <div style={styles.subjectHeaderRight}>
                            {total !== null && (
                              <div style={styles.avgBox}>
                                {total >= 70
                                  ? <TrendingUp size={14} color="#10B981" />
                                  : <TrendingDown size={14} color="#EF4444" />}
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: total >= 70 ? '#10B981' : '#EF4444',
                                }}>
                                  Total: {total}/100
                                </span>
                              </div>
                            )}
                            {isExpanded
                              ? <ChevronUp size={18} color="#94A3B8" />
                              : <ChevronDown size={18} color="#94A3B8" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={styles.subjectBody}>
                            {subject.ras.length === 0 ? (
                              <p style={styles.emptyText}>No hay RAs definidos aún.</p>
                            ) : (
                              subject.ras.map(ra => {
                                const c = ra.raScore !== null ? getScoreColor(ra.raScore, ra.weight) : { bg: '#F8FAFC', color: '#94A3B8' }
                                return (
                                  <div key={ra.id} style={styles.raBlock}>
                                    {/* Cabecera del RA */}
                                    <div style={styles.raBlockHeader}>
                                      <div style={styles.raBlockLeft}>
                                        <span style={styles.raCode}>{ra.code}</span>
                                        <span style={styles.raDesc}>{ra.description}</span>
                                        <span style={styles.raWeight}>Peso: {ra.weight} pts</span>
                                      </div>
                                      <span style={{ ...styles.raScore, backgroundColor: c.bg, color: c.color }}>
                                        {ra.raScore !== null ? `${ra.raScore}/${ra.weight}` : '—'}
                                      </span>
                                    </div>

                                    {/* Actividades del RA */}
                                    {ra.activities.length > 0 && (
                                      <div style={styles.activityList}>
                                        {ra.activities.map(act => {
                                          const score = act.grade?.score
                                          const hasGrade = score !== null && score !== undefined
                                          const ac = hasGrade ? getScoreColor(score, act.max_score) : { bg: '#F8FAFC', color: '#94A3B8' }
                                          return (
                                            <div key={act.id} style={styles.activityRow}>
                                              <div style={styles.activityRowLeft}>
                                                <span style={styles.activityType}>
                                                  {getActivityTypeName(act.type)}
                                                </span>
                                                <span style={styles.activityRowName}>{act.name}</span>
                                              </div>
                                              <span style={{ ...styles.activityGrade, backgroundColor: ac.bg, color: ac.color }}>
                                                {hasGrade ? `${score}/${act.max_score}` : 'Pendiente'}
                                              </span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}

                            {/* Total de la materia */}
                            {subject.totalScore !== null && (
                              <div style={{
                                ...styles.totalRow,
                                backgroundColor: subject.totalScore >= 70 ? '#ECFDF5' : '#FEF2F2',
                                borderColor: subject.totalScore >= 70 ? '#A7F3D0' : '#FECACA',
                              }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                                  Nota total de la materia
                                </span>
                                <span style={{
                                  fontSize: '18px',
                                  fontWeight: '700',
                                  color: subject.totalScore >= 70 ? '#10B981' : '#EF4444',
                                }}>
                                  {subject.totalScore}/100
                                  {subject.totalScore >= 70 ? ' ✓' : ' ✗'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Inter', sans-serif" },
  sidebar: { width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 20px', borderBottom: '1px solid #E2E8F0' },
  sidebarIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { fontSize: '18px', fontWeight: '700', color: '#1E293B' },
  studentsSection: { flex: 1, padding: '16px 12px', overflowY: 'auto' },
  studentsSectionLabel: { fontSize: '11px', fontWeight: '700', color: '#94A3B8', letterSpacing: '1px', margin: '0 0 10px 8px' },
  studentItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '4px', transition: 'background 0.15s' },
  studentAvatar: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  studentName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: '0 0 2px' },
  studentEmail: { fontSize: '11px', color: '#94A3B8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' },
  noStudentsText: { fontSize: '13px', color: '#94A3B8', padding: '8px 12px' },
  profileNav: { padding: '10px 12px', borderTop: '1px solid #F1F5F9' },
  profileNavItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', color: '#64748B', cursor: 'pointer' },
  profileNavItemActive: { backgroundColor: '#EEF2FF', color: '#6C63FF', fontWeight: '600' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600', flexShrink: 0 },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '260px', flex: 1, padding: '32px' },
  emptyMain: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' },
  emptyMainText: { fontSize: '15px', color: '#94A3B8' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  tabs: { display: 'flex', gap: '0', borderBottom: '1px solid #E2E8F0', marginBottom: '24px' },
  tab: { display: 'flex', alignItems: 'center', padding: '12px 20px', fontSize: '14px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' },
  tabBadge: { marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: '#EEF2FF', color: '#6C63FF' },
  loadingBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' },
  loadingText: { fontSize: '14px', color: '#94A3B8' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', gap: '12px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #F1F5F9' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  subjectCard: { backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  subjectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', cursor: 'pointer', transition: 'background 0.15s' },
  subjectHeaderLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  subjectIconBox: { width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subjectName: { fontSize: '16px', fontWeight: '700', color: '#1E293B', margin: '0 0 3px' },
  subjectSection: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  subjectHeaderRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  avgBox: { display: 'flex', alignItems: 'center', gap: '6px' },
  subjectBody: { padding: '0 24px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '20px' },
  periodsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  periodSummaryCard: { borderRadius: '12px', padding: '14px', textAlign: 'center' },
  periodLabel: { fontSize: '12px', fontWeight: '700', color: '#64748B', margin: '0 0 6px', textTransform: 'uppercase' },
  periodScore: { fontSize: '22px', fontWeight: '800', margin: '0 0 4px' },
  periodStatus: { fontSize: '11px', fontWeight: '600', margin: 0 },
  periodDetail: { display: 'flex', flexDirection: 'column', gap: '8px' },
  periodDetailTitle: { fontSize: '13px', fontWeight: '700', color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' },
  activityList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  activityRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' },
  activityRowLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  activityType: { fontSize: '11px', fontWeight: '600', color: '#6C63FF', backgroundColor: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' },
  activityRowName: { fontSize: '13px', color: '#475569', fontWeight: '500' },
  activityGrade: { fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' },
  raBlock: { backgroundColor: '#F8FAFC', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #F1F5F9' },
  raBlockHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  raBlockLeft: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  raCode: { fontSize: '12px', fontWeight: '700', color: '#F97316', backgroundColor: '#FFF7ED', padding: '3px 8px', borderRadius: '6px' },
  raDesc: { fontSize: '14px', fontWeight: '600', color: '#1E293B' },
  raWeight: { fontSize: '12px', color: '#94A3B8' },
  raScore: { fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', whiteSpace: 'nowrap' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '12px', border: '1px solid' },
}

export default TutorDashboard
