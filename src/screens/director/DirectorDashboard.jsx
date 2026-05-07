import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ProfilePanel from '../../components/ProfilePanel'
import {
  GraduationCap, LogOut, Users, BookOpen,
  Plus, X, Eye, EyeOff, Check, School,
  Pencil, Trash2, UserCircle
} from 'lucide-react'

const DirectorDashboard = () => {
  const { profile, signOut } = useAuth()
  const [stats, setStats] = useState({ coordinators: 0, teachers: 0, students: 0 })
  const [coordinators, setCoordinators] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCoord, setSelectedCoord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'coordinator_academic' })
  const [editForm, setEditForm] = useState({ fullName: '', email: '', password: '', role: 'coordinator_academic' })
  const [showPassword, setShowPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeView, setActiveView] = useState('dashboard')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: users } = await supabase
        .from('users')
        .select('role')
        .eq('institution_id', profile.institution_id)

      setStats({
        coordinators: users?.filter(u => u.role === 'coordinator_academic' || u.role === 'coordinator_workshop').length || 0,
        teachers: users?.filter(u => u.role === 'teacher').length || 0,
        students: users?.filter(u => u.role === 'student').length || 0,
      })

      const { data: coords } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .in('role', ['coordinator_academic', 'coordinator_workshop'])
        .order('created_at', { ascending: false })

      setCoordinators(coords || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCoordinator = async () => {
    if (!form.fullName || !form.email || !form.password) {
      setFormError('Por favor completa todos los campos.')
      return
    }
    if (form.password.length < 6) {
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
          email: form.email,
          password: form.password,
          full_name: form.fullName,
          role: form.role,
          institution_id: profile.institution_id,
          created_by: profile.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ocurrió un error.')
      setSuccess('Coordinador creado exitosamente.')
      setShowModal(false)
      setForm({ fullName: '', email: '', password: '', role: 'coordinator_academic' })
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditModal = (coord) => {
    setSelectedCoord(coord)
    setEditForm({ fullName: coord.full_name, email: coord.email, password: '', role: coord.role })
    setFormError('')
    setShowEditPassword(false)
    setShowEditModal(true)
  }

  const handleEditCoordinator = async () => {
    if (!editForm.fullName || !editForm.email) {
      setFormError('Nombre y correo son obligatorios.')
      return
    }
    if (editForm.password && editForm.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      // Actualizar en tabla users
      const { error } = await supabase
        .from('users')
        .update({ full_name: editForm.fullName, email: editForm.email, role: editForm.role })
        .eq('id', selectedCoord.id)
      if (error) throw error

      // Si cambió la contraseña, actualizarla via backend
      if (editForm.password) {
        const res = await fetch('http://localhost:3001/api/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedCoord.id, password: editForm.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña.')
      }

      setSuccess('Coordinador actualizado exitosamente.')
      setShowEditModal(false)
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteModal = (coord) => {
    setSelectedCoord(coord)
    setShowDeleteModal(true)
  }

  const handleDeleteCoordinator = async () => {
    setFormLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedCoord.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar.')

      setSuccess('Coordinador eliminado.')
      setShowDeleteModal(false)
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const roleLabel = (role) => {
    if (role === 'coordinator_academic') return 'Coordinador Académico'
    if (role === 'coordinator_workshop') return 'Coordinador de Taller'
    return role
  }

  const roleColor = (role) => {
    if (role === 'coordinator_academic') return { bg: '#EEF2FF', color: '#6C63FF' }
    if (role === 'coordinator_workshop') return { bg: '#FFF7ED', color: '#F97316' }
    return { bg: '#F1F5F9', color: '#64748B' }
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
          <div
            style={{ ...styles.navItem, ...(activeView === 'dashboard' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('dashboard')}
          ><School size={18} /><span>Panel</span></div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'profile' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('profile')}
          ><UserCircle size={18} /><span>Mi perfil</span></div>
          <div style={styles.navItem}><School size={18} /><span>Mi institución</span></div>
          <div style={styles.navItem}><Users size={18} /><span>Coordinadores</span></div>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{profile?.full_name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>Director</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {activeView === 'profile' ? (
          <ProfilePanel roleLabel="Director" />
        ) : (
          <>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>Panel del Director</h1>
            <p style={styles.pageSubtitle}>Bienvenido, {profile?.full_name}</p>
          </div>
          <button onClick={() => { setShowModal(true); setFormError('') }} style={styles.primaryButton}>
            <Plus size={16} style={{ marginRight: '6px' }} />
            Nuevo coordinador
          </button>
        </div>

        <div style={styles.statsGrid}>
          {[
            { label: 'Coordinadores', value: stats.coordinators, icon: <Users size={20} />, color: '#6C63FF', bg: '#EEF2FF' },
            { label: 'Profesores', value: stats.teachers, icon: <BookOpen size={20} />, color: '#10B981', bg: '#ECFDF5' },
            { label: 'Estudiantes', value: stats.students, icon: <GraduationCap size={20} />, color: '#F97316', bg: '#FFF7ED' },
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

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Coordinadores</h2>
          {loading ? (
            <p style={styles.emptyText}>Cargando...</p>
          ) : coordinators.length === 0 ? (
            <div style={styles.emptyState}>
              <Users size={40} color="#CBD5E1" />
              <p style={styles.emptyText}>No hay coordinadores aún.</p>
              <p style={styles.emptySubtext}>Crea el primero con el botón de arriba.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coordinators.map(coord => {
                    const rc = roleColor(coord.role)
                    return (
                      <tr key={coord.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.nameCell}>
                            <div style={styles.tableAvatar}>{coord.full_name?.charAt(0).toUpperCase()}</div>
                            {coord.full_name}
                          </div>
                        </td>
                        <td style={styles.td}>{coord.email}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, backgroundColor: rc.bg, color: rc.color }}>
                            {roleLabel(coord.role)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: coord.active ? '#ECFDF5' : '#FEF2F2',
                            color: coord.active ? '#10B981' : '#EF4444',
                          }}>
                            {coord.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.actions}>
                            <button onClick={() => openEditModal(coord)} style={styles.editBtn}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => openDeleteModal(coord)} style={styles.deleteBtn}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Modal crear coordinador */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nuevo coordinador</h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} placeholder="Ej: Juan Pérez" value={form.fullName}
                  onChange={e => { setForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" placeholder="correo@institución.edu" value={form.email}
                  onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Contraseña temporal</label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={form.password}
                    onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo de coordinador</label>
                <div style={styles.roleSelector}>
                  {[{ value: 'coordinator_academic', label: 'Académico' }, { value: 'coordinator_workshop', label: 'Taller' }].map(opt => (
                    <button key={opt.value} onClick={() => setForm(p => ({ ...p, role: opt.value }))}
                      style={{
                        ...styles.roleOption,
                        background: form.role === opt.value ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#F8FAFC',
                        color: form.role === opt.value ? '#fff' : '#64748B',
                        border: form.role === opt.value ? 'none' : '1.5px solid #E2E8F0',
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateCoordinator} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1, cursor: formLoading ? 'not-allowed' : 'pointer' }}>
                {formLoading ? 'Creando...' : 'Crear coordinador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar coordinador */}
      {showEditModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar coordinador</h2>
              <button onClick={() => setShowEditModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} value={editForm.fullName}
                  onChange={e => { setEditForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" value={editForm.email}
                  onChange={e => { setEditForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nueva contraseña <span style={{ color: '#94A3B8', fontWeight: 400 }}>(dejar vacío para no cambiar)</span></label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showEditPassword ? 'text' : 'password'} placeholder="Nueva contraseña" value={editForm.password}
                    onChange={e => { setEditForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} style={styles.eyeButton}>
                    {showEditPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo de coordinador</label>
                <div style={styles.roleSelector}>
                  {[{ value: 'coordinator_academic', label: 'Académico' }, { value: 'coordinator_workshop', label: 'Taller' }].map(opt => (
                    <button key={opt.value} onClick={() => setEditForm(p => ({ ...p, role: opt.value }))}
                      style={{
                        ...styles.roleOption,
                        background: editForm.role === opt.value ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#F8FAFC',
                        color: editForm.role === opt.value ? '#fff' : '#64748B',
                        border: editForm.role === opt.value ? 'none' : '1.5px solid #E2E8F0',
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditCoordinator} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1, cursor: formLoading ? 'not-allowed' : 'pointer' }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {showDeleteModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '380px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar coordinador</h2>
              <button onClick={() => setShowDeleteModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar a <strong>{selectedCoord?.full_name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteCoordinator} disabled={formLoading}
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
  navItemActive: { backgroundColor: '#EEF2FF', color: '#6C63FF', fontWeight: '600' },
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
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 2px' },
  statLabel: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  emptySubtext: { fontSize: '13px', color: '#CBD5E1', margin: 0 },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94A3B8', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', letterSpacing: '0.5px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#475569' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', color: '#1E293B' },
  tableAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', border: 'none', backgroundColor: '#EEF2FF', color: '#6C63FF', cursor: 'pointer' },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer' },
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
  roleSelector: { display: 'flex', gap: '10px' },
  roleOption: { flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}

export default DirectorDashboard
