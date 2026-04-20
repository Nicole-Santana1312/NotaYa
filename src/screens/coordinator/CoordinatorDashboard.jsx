import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, LogOut, Users, BookOpen,
  Plus, X, Eye, EyeOff, Check, Pencil, Trash2
} from 'lucide-react'

const CoordinatorDashboard = () => {
  const { profile, signOut } = useAuth()
  const isAcademic = profile?.role === 'coordinator_academic'

  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [stats, setStats] = useState({ teachers: 0, subjects: 0 })
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  // Modales
  const [showModal, setShowModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false)
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false)
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false)
  const [showDeleteSubjectModal, setShowDeleteSubjectModal] = useState(false)

  // Modal detalle profesor
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTeacher, setDetailTeacher] = useState(null)
  const [detailSubjects, setDetailSubjects] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)

  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', password: '', subjectId: '' })
  const [editTeacherForm, setEditTeacherForm] = useState({ fullName: '', email: '', password: '', subjectId: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '' })
  const [editSubjectForm, setEditSubjectForm] = useState({ name: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: teacherData } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false })

      const { data: subjectData } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('type', isAcademic ? 'academic' : 'workshop')
        .order('name', { ascending: true })

      setTeachers(teacherData || [])
      setSubjects(subjectData || [])
      setStats({ teachers: teacherData?.length || 0, subjects: subjectData?.length || 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ── DETALLE PROFESOR ────────────────────────────────────

  const openDetailModal = async (teacher) => {
    setDetailTeacher(teacher)
    setDetailSubjects([])
    setDetailLoading(true)
    setShowDetailModal(true)
    try {
      const { data: ts } = await supabase
        .from('teacher_subjects')
        .select('subject_id, subjects(id, name, type)')
        .eq('teacher_id', teacher.id)

      setDetailSubjects(ts?.map(t => t.subjects).filter(Boolean) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── PROFESORES ──────────────────────────────────────────

  const handleCreateTeacher = async () => {
    if (!teacherForm.fullName || !teacherForm.email || !teacherForm.password) {
      setFormError('Por favor completa todos los campos.')
      return
    }
    if (isAcademic && !teacherForm.subjectId) {
      setFormError('Selecciona una materia para el profesor.')
      return
    }
    if (teacherForm.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const res = await fetch('http://localhost:3001/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacherForm.email,
          password: teacherForm.password,
          full_name: teacherForm.fullName,
          role: 'teacher',
          institution_id: profile.institution_id,
          created_by: profile.id,
          subject_id: isAcademic ? teacherForm.subjectId : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ocurrió un error.')
      showSuccess('Profesor creado exitosamente.')
      setShowModal(false)
      setTeacherForm({ fullName: '', email: '', password: '', subjectId: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setEditTeacherForm({ fullName: teacher.full_name, email: teacher.email, password: '', subjectId: '' })
    setFormError('')
    setShowEditPassword(false)
    setShowEditTeacherModal(true)
  }

  const handleEditTeacher = async () => {
    if (!editTeacherForm.fullName || !editTeacherForm.email) {
      setFormError('Nombre y correo son obligatorios.')
      return
    }
    if (editTeacherForm.password && editTeacherForm.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: editTeacherForm.fullName, email: editTeacherForm.email })
        .eq('id', selectedTeacher.id)
      if (error) throw error

      if (editTeacherForm.password) {
        const res = await fetch('http://localhost:3001/api/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedTeacher.id, password: editTeacherForm.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña.')
      }

      if (isAcademic && editTeacherForm.subjectId) {
        await supabase.from('teacher_subjects').delete().eq('teacher_id', selectedTeacher.id)
        await supabase.from('teacher_subjects').insert({
          teacher_id: selectedTeacher.id,
          subject_id: editTeacherForm.subjectId,
          assigned_by: profile.id,
        })
      }

      showSuccess('Profesor actualizado exitosamente.')
      setShowEditTeacherModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setShowDeleteTeacherModal(true)
  }

  const handleDeleteTeacher = async () => {
    setFormLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedTeacher.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar.')
      showSuccess('Profesor eliminado.')
      setShowDeleteTeacherModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  // ── MATERIAS ─────────────────────────────────────────────

  const handleCreateSubject = async () => {
    if (!subjectForm.name) {
      setFormError('Escribe el nombre de la materia.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase.from('subjects').insert({
        institution_id: profile.institution_id,
        coordinator_id: profile.id,
        name: subjectForm.name,
        type: isAcademic ? 'academic' : 'workshop',
      })
      if (error) throw error
      showSuccess('Materia creada exitosamente.')
      setShowSubjectModal(false)
      setSubjectForm({ name: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditSubject = (subject) => {
    setSelectedSubject(subject)
    setEditSubjectForm({ name: subject.name })
    setFormError('')
    setShowEditSubjectModal(true)
  }

  const handleEditSubject = async () => {
    if (!editSubjectForm.name) {
      setFormError('El nombre no puede estar vacío.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editSubjectForm.name })
        .eq('id', selectedSubject.id)
      if (error) throw error
      showSuccess('Materia actualizada.')
      setShowEditSubjectModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteSubject = (subject) => {
    setSelectedSubject(subject)
    setShowDeleteSubjectModal(true)
  }

  const handleDeleteSubject = async () => {
    setFormLoading(true)
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', selectedSubject.id)
      if (error) throw error
      showSuccess('Materia eliminada.')
      setShowDeleteSubjectModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}><GraduationCap size={22} color="#fff" /></div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>
        <nav style={styles.nav}>
          <div style={styles.navItem}><Users size={18} /><span>Profesores</span></div>
          <div style={styles.navItem}><BookOpen size={18} /><span>Materias</span></div>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{profile?.full_name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>{isAcademic ? 'Coord. Académico' : 'Coord. de Taller'}</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>{isAcademic ? 'Coordinación Académica' : 'Coordinación de Taller'}</h1>
            <p style={styles.pageSubtitle}>Bienvenido, {profile?.full_name}</p>
          </div>
          <div style={styles.buttonGroup}>
            <button onClick={() => { setShowSubjectModal(true); setFormError('') }} style={styles.secondaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} />Nueva materia
            </button>
            <button onClick={() => { setShowModal(true); setFormError('') }} style={styles.primaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} />Nuevo profesor
            </button>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {[
            { label: 'Profesores', value: stats.teachers, icon: <Users size={20} />, color: '#6C63FF', bg: '#EEF2FF' },
            { label: 'Materias', value: stats.subjects, icon: <BookOpen size={20} />, color: '#10B981', bg: '#ECFDF5' },
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

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />{success}
          </div>
        )}

        {/* Materias */}
        <div style={{ ...styles.section, marginBottom: '24px' }}>
          <h2 style={styles.sectionTitle}>Materias {isAcademic ? 'académicas' : 'de taller'}</h2>
          {subjects.length === 0 ? (
            <div style={styles.emptyState}>
              <BookOpen size={36} color="#CBD5E1" />
              <p style={styles.emptyText}>No hay materias aún.</p>
            </div>
          ) : (
            <div style={styles.subjectGrid}>
              {subjects.map(subject => (
                <div key={subject.id} style={styles.subjectCard}>
                  <div style={styles.subjectIcon}><BookOpen size={16} color="#6C63FF" /></div>
                  <span style={styles.subjectName}>{subject.name}</span>
                  <div style={styles.subjectActions}>
                    <button onClick={() => openEditSubject(subject)} style={styles.editBtn}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => openDeleteSubject(subject)} style={styles.deleteBtn}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profesores */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Profesores</h2>
          {loading ? (
            <p style={styles.emptyText}>Cargando...</p>
          ) : teachers.length === 0 ? (
            <div style={styles.emptyState}>
              <Users size={36} color="#CBD5E1" />
              <p style={styles.emptyText}>No hay profesores aún.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Nombre', 'Correo', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => (
                    <tr key={teacher.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div
                          style={{ ...styles.nameCell, cursor: 'pointer' }}
                          onClick={() => openDetailModal(teacher)}
                        >
                          <div style={styles.tableAvatar}>{teacher.full_name?.charAt(0).toUpperCase()}</div>
                          {teacher.full_name}
                        </div>
                      </td>
                      <td style={styles.td}>{teacher.email}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: teacher.active ? '#ECFDF5' : '#FEF2F2',
                          color: teacher.active ? '#10B981' : '#EF4444',
                        }}>
                          {teacher.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button onClick={() => openEditTeacher(teacher)} style={styles.editBtn}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openDeleteTeacher(teacher)} style={styles.deleteBtn}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle profesor */}
      {showDetailModal && detailTeacher && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '16px', fontWeight: '600', flexShrink: 0,
                }}>
                  {detailTeacher.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>
                    {detailTeacher.full_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                    {detailTeacher.email}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: '600', padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: detailTeacher.active ? '#ECFDF5' : '#FEF2F2',
                  color: detailTeacher.active ? '#065F46' : '#991B1B',
                }}>
                  {detailTeacher.active ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => setShowDetailModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={styles.modalBody}>
              <p style={{
                margin: '0 0 12px', fontSize: '11px', fontWeight: '600',
                color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Materias que imparte
              </p>

              {detailLoading ? (
                <p style={styles.emptyText}>Cargando...</p>
              ) : detailSubjects.length === 0 ? (
                <div style={{
                  padding: '20px', borderRadius: '12px',
                  border: '1.5px dashed #E2E8F0', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                    Sin materias asignadas aún.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {detailSubjects.map(subject => {
                    const isAcademicSubject = subject.type === 'academic'
                    return (
                      <div key={subject.id} style={{
                        border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden',
                      }}>
                        <div style={{
                          padding: '12px 16px', backgroundColor: '#F8FAFC',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              backgroundColor: isAcademicSubject ? '#6C63FF' : '#F97316',
                            }} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                              {subject.name}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: '600', padding: '3px 8px',
                            borderRadius: '20px',
                            backgroundColor: isAcademicSubject ? '#EEF2FF' : '#FFF7ED',
                            color: isAcademicSubject ? '#3C3489' : '#9A3412',
                          }}>
                            {isAcademicSubject ? 'Académica' : 'Taller'}
                          </span>
                        </div>
                        <div style={{
                          padding: '10px 16px', borderTop: '1px solid #F1F5F9',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="#94A3B8" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                            Secciones pendientes de configurar
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowDetailModal(false)} style={styles.cancelBtn}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear profesor */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nuevo profesor</h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} placeholder="Ej: Ana Martínez" value={teacherForm.fullName}
                  onChange={e => { setTeacherForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" placeholder="correo@institución.edu" value={teacherForm.email}
                  onChange={e => { setTeacherForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Contraseña temporal</label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={teacherForm.password}
                    onChange={e => { setTeacherForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              {isAcademic && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Materia asignada</label>
                  {subjects.length === 0 ? (
                    <p style={styles.warningText}>No hay materias. Crea una materia primero.</p>
                  ) : (
                    <select style={styles.input} value={teacherForm.subjectId}
                      onChange={e => setTeacherForm(p => ({ ...p, subjectId: e.target.value }))}>
                      <option value="">Selecciona una materia</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear profesor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar profesor */}
      {showEditTeacherModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar profesor</h2>
              <button onClick={() => setShowEditTeacherModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} value={editTeacherForm.fullName}
                  onChange={e => { setEditTeacherForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" value={editTeacherForm.email}
                  onChange={e => { setEditTeacherForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nueva contraseña <span style={{ color: '#94A3B8', fontWeight: 400 }}>(dejar vacío para no cambiar)</span></label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showEditPassword ? 'text' : 'password'} placeholder="Nueva contraseña" value={editTeacherForm.password}
                    onChange={e => { setEditTeacherForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} style={styles.eyeButton}>
                    {showEditPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              {isAcademic && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Cambiar materia <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                  <select style={styles.input} value={editTeacherForm.subjectId}
                    onChange={e => setEditTeacherForm(p => ({ ...p, subjectId: e.target.value }))}>
                    <option value="">Sin cambio</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditTeacherModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar profesor */}
      {showDeleteTeacherModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '380px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar profesor</h2>
              <button onClick={() => setShowDeleteTeacherModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar a <strong>{selectedTeacher?.full_name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteTeacherModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, background: '#EF4444', boxShadow: 'none', opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear materia */}
      {showSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva materia</h2>
              <button onClick={() => setShowSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la materia</label>
                <input style={styles.input} placeholder={isAcademic ? 'Ej: Matemáticas' : 'Ej: Electricidad'}
                  value={subjectForm.name}
                  onChange={e => { setSubjectForm({ name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear materia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar materia */}
      {showEditSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar materia</h2>
              <button onClick={() => setShowEditSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la materia</label>
                <input style={styles.input} value={editSubjectForm.name}
                  onChange={e => { setEditSubjectForm({ name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar materia */}
      {showDeleteSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '380px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar materia</h2>
              <button onClick={() => setShowDeleteSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar <strong>{selectedSubject?.name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, background: '#EF4444', boxShadow: 'none', opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Eliminando...' : 'Sí, eliminar'}
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
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0 },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  buttonGroup: { display: 'flex', gap: '12px' },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  secondaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '32px' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 2px' },
  statLabel: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  subjectGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  subjectCard: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' },
  subjectIcon: { display: 'flex', alignItems: 'center' },
  subjectName: { fontSize: '13px', fontWeight: '600', color: '#6C63FF' },
  subjectActions: { display: 'flex', gap: '4px', marginLeft: '4px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94A3B8', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', letterSpacing: '0.5px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#475569' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', color: '#1E293B' },
  tableAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#EEF2FF', color: '#6C63FF', cursor: 'pointer' },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px', borderRadius: '8px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F1F5F9' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC' },
  passwordWrapper: { position: 'relative' },
  eyeButton: { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  warningText: { fontSize: '13px', color: '#F97316', margin: 0, padding: '10px 14px', backgroundColor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}

export default CoordinatorDashboard