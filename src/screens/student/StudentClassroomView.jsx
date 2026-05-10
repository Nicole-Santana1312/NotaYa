import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, LogOut, ArrowLeft, BookOpen,
  Wrench, Upload, X, Check, Clock, Paperclip, Send
} from 'lucide-react'

const StudentClassroomView = () => {
  const { classroomId } = useParams()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [classroom, setClassroom] = useState(null)
  const [activities, setActivities] = useState([])
  const [grades, setGrades] = useState({})
  const [submissions, setSubmissions] = useState({})
  const [learningOutcomes, setLearningOutcomes] = useState([])
  const [isWorkshop, setIsWorkshop] = useState(false)
  const [activePeriod, setActivePeriod] = useState('P1')
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [recoveries, setRecoveries] = useState([])

  // Modal de entrega
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [selectedRecovery, setSelectedRecovery] = useState(null)
  const [submitComment, setSubmitComment] = useState('')
  const [submitFile, setSubmitFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const periods = ['P1', 'P2', 'P3', 'P4']
  const periodMap = { P1: 0, P2: 1, P3: 2, P4: 3 }

  useEffect(() => { fetchData() }, [classroomId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: cr } = await supabase
        .from('classrooms')
        .select(`
          *,
          teacher_subjects(subjects(id, name, type)),
          sections(name),
          academic_periods(name)
        `)
        .eq('id', classroomId)
        .single()

      setClassroom(cr)
      const workshop = cr?.teacher_subjects?.subjects?.type === 'workshop'
      setIsWorkshop(workshop)

      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at')

      setActivities(acts || [])

      if (acts?.length > 0) {
        const actIds = acts.map(a => a.id)

        const { data: gr } = await supabase
          .from('activity_grades')
          .select('*')
          .eq('student_id', profile.id)
          .in('activity_id', actIds)

        const gradeMap = {}
        gr?.forEach(g => { gradeMap[g.activity_id] = g.score })
        setGrades(gradeMap)

        const { data: subs } = await supabase
          .from('submissions')
          .select('*')
          .eq('student_id', profile.id)
          .in('activity_id', actIds)

        const subMap = {}
        subs?.forEach(s => { subMap[s.activity_id] = s })
        setSubmissions(subMap)
      }

      if (workshop) {
        const { data: ras } = await supabase
          .from('learning_outcomes')
          .select('*')
          .eq('subject_id', cr?.teacher_subjects?.subjects?.id)
          .order('created_at')
        setLearningOutcomes(ras || [])
      }

      // Fetch recoveries
      const { data: recs } = await supabase
        .from('recoveries')
        .select('*')
        .eq('student_id', profile.id)
        .eq('classroom_id', classroomId)
        .order('created_at')
      setRecoveries(recs || [])

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const showSuccessMsg = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const openSubmitModal = (activity) => {
    if (activity.due_date && new Date(activity.due_date) < new Date() && !submissions[activity.id]) {
      setSubmitError('La fecha de entrega ya pasó. No puedes enviar esta tarea.')
      return
    }
    setSelectedRecovery(null)
    setSelectedActivity(activity)
    const existing = submissions[activity.id]
    setSubmitComment(existing?.comment || '')
    setSubmitFile(null)
    setSubmitError('')
    setShowSubmitModal(true)
  }

  const openRecoverySubmitModal = (recovery) => {
    if (recovery.due_date && new Date(recovery.due_date) < new Date() && !recovery.submitted_at) {
      setSubmitError('La fecha de entrega ya paso. No puedes enviar esta recuperacion.')
      return
    }
    setSelectedActivity(null)
    setSelectedRecovery(recovery)
    setSubmitComment(recovery.submission_comment || '')
    setSubmitFile(null)
    setSubmitError('')
    setShowSubmitModal(true)
  }

  const handleSubmit = async () => {
    if (selectedRecovery) {
      if (selectedRecovery.due_date && new Date(selectedRecovery.due_date) < new Date()) {
        setSubmitError('La fecha de entrega ya paso. No puedes enviar esta recuperacion.')
        return
      }
      if (!submitComment.trim() && !submitFile) {
        setSubmitError('Agrega un comentario o un archivo.')
        return
      }
      setSubmitting(true)
      setSubmitError('')
      try {
        let fileUrl = selectedRecovery.submission_file_url || null
        if (submitFile) {
          const ext = submitFile.name.split('.').pop()
          const path = `${profile.id}/recoveries/${selectedRecovery.id}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('submissions')
            .upload(path, submitFile, { upsert: true })
          if (uploadError) throw uploadError
          fileUrl = path
        }

        const { error } = await supabase
          .from('recoveries')
          .update({
            submission_comment: submitComment.trim() || null,
            submission_file_url: fileUrl,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedRecovery.id)
          .eq('student_id', profile.id)

        if (error) throw error

        showSuccessMsg('Recuperacion entregada exitosamente.')
        setShowSubmitModal(false)
        setSelectedRecovery(null)
        fetchData()
      } catch (err) {
        setSubmitError(err.message || 'Ocurrio un error.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (selectedActivity?.due_date && new Date(selectedActivity.due_date) < new Date()) {
      setSubmitError('La fecha de entrega ya pasó. No puedes enviar esta tarea.')
      return
    }
    if (!submitComment.trim() && !submitFile) {
      setSubmitError('Agrega un comentario o un archivo.')
      return
    }
    setSubmitting(true)
    setSubmitError('')

    try {
      let fileUrl = submissions[selectedActivity.id]?.file_url || null

      // Subir archivo si hay uno nuevo
      if (submitFile) {
        const ext = submitFile.name.split('.').pop()
        const path = `${profile.id}/${selectedActivity.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(path, submitFile, { upsert: true })
        if (uploadError) throw uploadError
        fileUrl = path
      }

      // Guardar la entrega
      const { error } = await supabase
        .from('submissions')
        .upsert({
          activity_id: selectedActivity.id,
          student_id: profile.id,
          comment: submitComment.trim() || null,
          file_url: fileUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'activity_id,student_id' })

      if (error) throw error

      showSuccessMsg('Tarea entregada exitosamente.')
      fetchData()
    } catch (err) {
      setSubmitError(err.message || 'Ocurrió un error.')
    } finally {
      setSubmitting(false)
    }
  }

  const getActivitiesForPeriod = () => {
    return activities.filter(a => a.period_index === periodMap[activePeriod])
  }

  const getActivitiesForRA = (raId) => {
    return activities.filter(a => a.learning_outcome_id === raId)
  }

  const calcPeriodProgress = (acts) => {
    if (acts.length === 0) return { score: 0, max: 0, pct: 0 }
    const score = acts.reduce((s, a) => s + (grades[a.id] || 0), 0)
    const max = acts.reduce((s, a) => s + a.max_score, 0)
    const pct = max > 0 ? Math.round((score / max) * 100) : 0
    return { score, max, pct }
  }

  const calcRAProgress = (raId) => {
    const ra = learningOutcomes.find(r => r.id === raId)
    const acts = getActivitiesForRA(raId)
    if (acts.length === 0) return { score: 0, pct: 0, weight: ra?.weight || 0 }
    const score = acts.reduce((s, a) => s + (grades[a.id] || 0), 0)
    const max = acts.reduce((s, a) => s + a.max_score, 0)
    const pct = max > 0 ? Math.round((score / max) * ra.weight) : 0
    return { score, pct, weight: ra?.weight || 0 }
  }

  const totalWorkshopScore = learningOutcomes.reduce((sum, ra) => {
    return sum + calcRAProgress(ra.id).pct
  }, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#94A3B8' }}>
      Cargando...
    </div>
  )

  const subjectName = classroom?.teacher_subjects?.subjects?.name
  const sectionName = classroom?.sections?.name
  const currentActs = isWorkshop ? [] : getActivitiesForPeriod()
  const currentProgress = isWorkshop ? { pct: totalWorkshopScore } : calcPeriodProgress(currentActs)

  const ActivityRow = ({ act }) => {
    const score = grades[act.id]
    const hasGrade = score !== null && score !== undefined
    const pct = hasGrade ? Math.round((score / act.max_score) * 100) : null
    const hasSubmission = !!submissions[act.id]
    const isPastDue = act.due_date && new Date(act.due_date) < new Date()
    const canSubmit = !isPastDue && !hasSubmission
    const dueDateLabel = act.due_date ? ` · Entrega: ${new Date(act.due_date).toLocaleDateString()}` : ''

    return (
      <div style={styles.activityRow}>
        <div style={styles.activityInfo}>
          <div style={{
            ...styles.activityDot,
            backgroundColor: !hasGrade ? '#E2E8F0' : pct >= 70 ? '#10B981' : '#EF4444',
          }} />
          <div>
            <p style={styles.activityName}>{act.name}</p>
            <p style={styles.activityType}>{act.type} · Vale {act.max_score} pts{dueDateLabel}</p>
          </div>
        </div>
        <div style={styles.activityRight}>
          {/* Botón entregar */}
          <button
            onClick={() => canSubmit ? openSubmitModal(act) : null}
            disabled={!canSubmit}
            style={{
              ...styles.submitBtn,
              backgroundColor: hasSubmission ? '#ECFDF5' : canSubmit ? '#EEF2FF' : '#F8FAFC',
              color: hasSubmission ? '#10B981' : canSubmit ? '#6C63FF' : '#94A3B8',
              border: `1.5px solid ${hasSubmission ? '#A7F3D0' : canSubmit ? '#C7D2FE' : '#E2E8F0'}`,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.75,
            }}
          >
            {hasSubmission
              ? <><Check size={13} style={{ marginRight: '4px' }} /> Entregado</>
              : isPastDue
                ? 'Entrega cerrada'
                : <><Send size={13} style={{ marginRight: '4px' }} /> Entregar</>
            }
          </button>

          {/* Nota */}
          {!hasGrade ? (
            <span style={styles.pendingBadge}>Sin calificar</span>
          ) : (
            <span style={{
              ...styles.gradeBadge,
              backgroundColor: pct >= 70 ? '#ECFDF5' : '#FEF2F2',
              color: pct >= 70 ? '#10B981' : '#EF4444',
            }}>
              {score}/{act.max_score}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}><GraduationCap size={22} color="#fff" /></div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>
        <div style={{ flex: 1 }} />
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

      {/* Main */}
      <div style={styles.main}>

        <div style={styles.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/student')} style={styles.backBtn}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={styles.pageTitle}>{subjectName}</h1>
              <p style={styles.pageSubtitle}>{sectionName} · {isWorkshop ? 'Taller' : 'Académica'}</p>
            </div>
          </div>
        </div>

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />{success}
          </div>
        )}

        {/* Resumen general */}
        <div style={styles.summaryCard}>
          <div style={styles.summaryLeft}>
            <div style={{
              ...styles.summaryIcon,
              backgroundColor: isWorkshop ? '#FFF7ED' : '#EEF2FF',
            }}>
              {isWorkshop
                ? <Wrench size={24} color="#F97316" />
                : <BookOpen size={24} color="#6C63FF" />
              }
            </div>
            <div>
              <p style={styles.summaryLabel}>Progreso general</p>
              <p style={styles.summaryScore}>
                {isWorkshop ? `${currentProgress.pct} pts` : `${currentProgress.pct}%`}
                <span style={{
                  ...styles.summaryStatus,
                  color: currentProgress.pct >= 70 ? '#10B981' : '#EF4444',
                }}>
                  {currentProgress.pct >= 70 ? ' · Aprobando' : ' · En riesgo'}
                </span>
              </p>
            </div>
          </div>
          <div style={styles.summaryProgressBar}>
            <div style={{
              ...styles.summaryProgressFill,
              width: `${currentProgress.pct}%`,
              backgroundColor: currentProgress.pct >= 70 ? '#10B981' : '#EF4444',
            }} />
          </div>
        </div>

        {/* ACADÉMICA */}
        {!isWorkshop && (
          <>
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

            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Actividades — {activePeriod}</h2>
                <div style={{
                  ...styles.periodScore,
                  color: currentProgress.pct >= 70 ? '#10B981' : '#EF4444',
                  backgroundColor: currentProgress.pct >= 70 ? '#ECFDF5' : '#FEF2F2',
                }}>
                  {currentProgress.pct}%
                </div>
              </div>

              {currentActs.length === 0 ? (
                <div style={styles.emptyState}>
                  <Clock size={32} color="#CBD5E1" />
                  <p style={styles.emptyText}>No hay actividades en este período aún.</p>
                </div>
              ) : (
                <div style={styles.activitiesList}>
                  {currentActs.map(act => <ActivityRow key={act.id} act={act} />)}
                </div>
              )}
            </div>
          </>
        )}

        {/* TALLER */}
        {isWorkshop && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {learningOutcomes.length === 0 ? (
              <div style={styles.section}>
                <div style={styles.emptyState}>
                  <BookOpen size={32} color="#CBD5E1" />
                  <p style={styles.emptyText}>El profesor aún no ha creado RAs.</p>
                </div>
              </div>
            ) : (
              learningOutcomes.map(ra => {
                const raProgress = calcRAProgress(ra.id)
                const raActs = getActivitiesForRA(ra.id)
                return (
                  <div key={ra.id} style={styles.section}>
                    <div style={styles.raHeader}>
                      <div>
                        <div style={styles.raCodeBadge}>{ra.code}</div>
                        <p style={styles.raDesc}>{ra.description}</p>
                      </div>
                      <div style={styles.raScoreBox}>
                        <span style={styles.raScoreValue}>{raProgress.pct}</span>
                        <span style={styles.raScoreMax}>/{ra.weight}</span>
                      </div>
                    </div>

                    <div style={styles.raProgressBar}>
                      <div style={{
                        ...styles.raProgressFill,
                        width: `${Math.min((raProgress.pct / ra.weight) * 100, 100)}%`,
                        backgroundColor: raProgress.pct >= ra.weight * 0.7 ? '#10B981' : '#EF4444',
                      }} />
                    </div>

                    {raActs.length === 0 ? (
                      <p style={{ ...styles.emptyText, padding: '12px 0 0' }}>
                        No hay actividades en este RA aún.
                      </p>
                    ) : (
                      <div style={{ ...styles.activitiesList, marginTop: '16px' }}>
                        {raActs.map(act => <ActivityRow key={act.id} act={act} />)}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* RECUPERACIONES */}
        {recoveries.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Recuperaciones</h2>
            </div>
            <div style={styles.recoveriesList}>
              {recoveries.map(recovery => (
                <div key={recovery.id} style={styles.recoveryCard}>
                  <div style={styles.recoveryHeader}>
                    <div>
                      <h3 style={styles.recoveryTitle}>Intento #{recovery.attempt_number}</h3>
                      <p style={styles.recoveryDesc}>{recovery.description}</p>
                    </div>
                    <div style={styles.recoveryScoreArea}>
                      {recovery.score !== null ? (
                        <div style={{
                          ...styles.recoveryScoreBadge,
                          backgroundColor: recovery.passed ? '#ECFDF5' : '#FEF2F2',
                          color: recovery.passed ? '#10B981' : '#EF4444',
                        }}>
                          {recovery.score}/70
                        </div>
                      ) : (
                        <span style={styles.recoveryPending}>Pendiente de calificación</span>
                      )}
                    </div>
                  </div>
                  <div style={styles.recoveryAssignmentActions}>
                    <button
                      onClick={() => openRecoverySubmitModal(recovery)}
                      disabled={!!recovery.score}
                      style={{
                        ...styles.submitBtn,
                        backgroundColor: recovery.submitted_at ? '#ECFDF5' : '#EEF2FF',
                        color: recovery.submitted_at ? '#10B981' : '#6C63FF',
                        border: `1.5px solid ${recovery.submitted_at ? '#A7F3D0' : '#C7D2FE'}`,
                        cursor: recovery.score ? 'not-allowed' : 'pointer',
                        opacity: recovery.score ? 0.7 : 1,
                      }}
                    >
                      {recovery.submitted_at
                        ? <><Check size={13} style={{ marginRight: '4px' }} /> Entregada</>
                        : <><Send size={13} style={{ marginRight: '4px' }} /> Entregar recuperacion</>
                      }
                    </button>
                    {recovery.due_date && (
                      <span style={styles.recoveryDate}>
                        Fecha limite: {new Date(recovery.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div style={styles.recoveryMeta}>
                    <span style={styles.recoveryDate}>
                      Creada: {new Date(recovery.created_at).toLocaleDateString()}
                    </span>
                    {recovery.graded_at && (
                      <span style={styles.recoveryDate}>
                        Calificada: {new Date(recovery.graded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal entregar tarea */}
      {showSubmitModal && (selectedActivity || selectedRecovery) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedRecovery ? 'Entregar recuperacion' : 'Entregar tarea'}</h2>
                <p style={styles.modalSubtitle}>{selectedRecovery ? `Intento #${selectedRecovery.attempt_number}` : selectedActivity.name}</p>
              </div>
              <button onClick={() => { setShowSubmitModal(false); setSelectedRecovery(null) }} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {selectedActivity && submissions[selectedActivity.id] && (
                <div style={styles.infoBox}>
                  <Check size={14} style={{ marginRight: '6px' }} />
                  Ya tienes una entrega. Puedes actualizarla.
                </div>
              )}
              {selectedRecovery?.submitted_at && (
                <div style={styles.infoBox}>
                  <Check size={14} style={{ marginRight: '6px' }} />
                  Ya entregaste esta recuperacion. Puedes actualizarla mientras no este calificada.
                </div>
              )}

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Comentario o respuesta</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Escribe tu respuesta, notas o comentarios aquí..."
                  rows={4}
                  value={submitComment}
                  onChange={e => { setSubmitComment(e.target.value); setSubmitError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Archivo adjunto <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                <div
                  style={styles.fileDropzone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                    onChange={e => setSubmitFile(e.target.files[0] || null)}
                  />
                  {submitFile ? (
                    <div style={styles.fileSelected}>
                      <Paperclip size={16} color="#6C63FF" />
                      <span style={styles.fileName}>{submitFile.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setSubmitFile(null) }}
                        style={styles.removeFileBtn}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={styles.filePrompt}>
                      <Upload size={20} color="#94A3B8" />
                      <span style={styles.filePromptText}>
                        Haz clic para adjuntar un archivo
                      </span>
                      <span style={styles.filePromptHint}>
                        PDF, Word, imagen o ZIP
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {submitError && <div style={styles.errorBox}>{submitError}</div>}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => { setShowSubmitModal(false); setSelectedRecovery(null) }} style={styles.cancelBtn}>
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...styles.primaryButton, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Enviando...' : (
                  <><Send size={15} style={{ marginRight: '6px' }} /> Enviar entrega</>
                )}
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
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', cursor: 'pointer' },
  pageTitle: { fontSize: '22px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  summaryCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #F1F5F9', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  summaryLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  summaryIcon: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: '13px', color: '#94A3B8', margin: '0 0 4px' },
  summaryScore: { fontSize: '22px', fontWeight: '700', color: '#1E293B', margin: 0 },
  summaryStatus: { fontSize: '14px', fontWeight: '600' },
  summaryProgressBar: { height: '10px', backgroundColor: '#F1F5F9', borderRadius: '5px', overflow: 'hidden' },
  summaryProgressFill: { height: '100%', borderRadius: '5px', transition: 'width 0.4s ease' },
  periodTabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
  periodTab: { padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  periodScore: { fontSize: '14px', fontWeight: '700', padding: '6px 14px', borderRadius: '20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0, textAlign: 'center' },
  activitiesList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  activityRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' },
  activityInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  activityRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  activityDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  activityName: { fontSize: '14px', fontWeight: '500', color: '#1E293B', margin: '0 0 2px' },
  activityType: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  submitBtn: { display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  pendingBadge: { fontSize: '12px', fontWeight: '600', color: '#94A3B8', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '20px' },
  gradeBadge: { fontSize: '13px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px' },
  raHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  raCodeBadge: { fontSize: '12px', fontWeight: '700', color: '#6C63FF', backgroundColor: '#EEF2FF', padding: '3px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '6px' },
  raDesc: { fontSize: '14px', color: '#1E293B', margin: 0 },
  raScoreBox: { display: 'flex', alignItems: 'baseline', gap: '2px' },
  raScoreValue: { fontSize: '22px', fontWeight: '700', color: '#1E293B' },
  raScoreMax: { fontSize: '14px', color: '#94A3B8' },
  raProgressBar: { height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' },
  raProgressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.4s ease' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 4px' },
  modalSubtitle: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px', borderRadius: '8px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F1F5F9' },
  infoBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  textarea: { padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', resize: 'vertical', fontFamily: 'inherit', backgroundColor: '#F8FAFC', boxSizing: 'border-box', width: '100%' },
  fileDropzone: { border: '2px dashed #E2E8F0', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s', backgroundColor: '#F8FAFC' },
  fileSelected: { display: 'flex', alignItems: 'center', gap: '10px' },
  fileName: { fontSize: '13px', color: '#1E293B', fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  removeFileBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: '2px' },
  filePrompt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  filePromptText: { fontSize: '13px', color: '#64748B', fontWeight: '500' },
  filePromptHint: { fontSize: '12px', color: '#94A3B8' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  recoveriesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  recoveryCard: { backgroundColor: '#ffffff', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  recoveryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  recoveryTitle: { fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 4px' },
  recoveryDesc: { fontSize: '13px', color: '#64748B', margin: 0 },
  recoveryScoreArea: { display: 'flex', alignItems: 'center' },
  recoveryScoreBadge: { padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' },
  recoveryPending: { fontSize: '12px', color: '#F97316', fontStyle: 'italic' },
  recoveryAssignmentActions: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' },
  recoveryMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' },
  recoveryDate: { fontSize: '11px', color: '#94A3B8' },
}

export default StudentClassroomView
