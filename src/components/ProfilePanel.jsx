import { useEffect, useState } from 'react'
import { Camera, Check, Eye, EyeOff, Save, UserCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const getAvatarKey = (userId) => `notaya:avatar:${userId}`

const ProfilePanel = ({ roleLabel = 'Usuario' }) => {
  const { user, profile, fetchProfile } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [avatar, setAvatar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setForm({
      fullName: profile?.full_name || '',
      email: profile?.email || user?.email || '',
      password: '',
      confirmPassword: '',
    })
    setAvatar(localStorage.getItem(getAvatarKey(profile?.id || user?.id)) || '')
  }, [profile, user])

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen valida.')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('La imagen debe pesar menos de 1 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      localStorage.setItem(getAvatarKey(profile.id), result)
      setAvatar(result)
      setError('')
      setSuccess('Foto actualizada.')
      setTimeout(() => setSuccess(''), 2500)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    localStorage.removeItem(getAvatarKey(profile.id))
    setAvatar('')
    setSuccess('Foto eliminada.')
    setTimeout(() => setSuccess(''), 2500)
  }

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios.')
      return
    }
    if (form.password && form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const emailChanged = form.email.trim() !== (user?.email || profile?.email)
      const authUpdates = {}
      if (emailChanged) authUpdates.email = form.email.trim()
      if (form.password) authUpdates.password = form.password

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) throw authError
      }

      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      await fetchProfile(profile.id)
      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }))
      setSuccess(emailChanged
        ? 'Perfil guardado. Revisa tu correo para confirmar el cambio de email si Supabase lo solicita.'
        : 'Perfil guardado correctamente.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil.')
    } finally {
      setLoading(false)
    }
  }

  const initials = profile?.full_name?.charAt(0).toUpperCase() || 'U'

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Mi perfil</h1>
          <p style={styles.subtitle}>Datos personales, foto y seguridad de la cuenta.</p>
        </div>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.photoBlock}>
            <div style={styles.avatar}>
              {avatar
                ? <img src={avatar} alt="Foto de perfil" style={styles.avatarImage} />
                : <span>{initials}</span>}
            </div>
            <div style={styles.photoActions}>
              <label style={styles.uploadButton}>
                <Camera size={16} />
                Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={styles.fileInput} />
              </label>
              {avatar && (
                <button type="button" onClick={handleRemoveAvatar} style={styles.ghostButton}>
                  Quitar foto
                </button>
              )}
            </div>
          </div>

          <div style={styles.identity}>
            <UserCircle size={18} color="#6C63FF" />
            <div>
              <p style={styles.identityName}>{profile?.full_name}</p>
              <p style={styles.identityMeta}>{roleLabel}</p>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Nombre completo</label>
              <input
                style={styles.input}
                value={form.fullName}
                onChange={e => { setForm(prev => ({ ...prev, fullName: e.target.value })); setError('') }}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Correo electronico</label>
              <input
                style={styles.input}
                type="email"
                value={form.email}
                onChange={e => { setForm(prev => ({ ...prev, email: e.target.value })); setError('') }}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Nueva contrasena</label>
              <div style={styles.passwordWrapper}>
                <input
                  style={{ ...styles.input, paddingRight: '44px' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Dejar vacio para no cambiar"
                  value={form.password}
                  onChange={e => { setForm(prev => ({ ...prev, password: e.target.value })); setError('') }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirmar nueva contrasena</label>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite la nueva contrasena"
                value={form.confirmPassword}
                onChange={e => { setForm(prev => ({ ...prev, confirmPassword: e.target.value })); setError('') }}
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}><Check size={16} />{success}</div>}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{ ...styles.saveButton, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <Save size={16} />
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '20px', alignItems: 'start' },
  card: { backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  photoBlock: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  avatar: { width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', fontWeight: '700', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
  photoActions: { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' },
  uploadButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 14px', borderRadius: '12px', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  fileInput: { display: 'none' },
  ghostButton: { padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  identity: { marginTop: '22px', padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' },
  identityName: { fontSize: '14px', color: '#1E293B', fontWeight: '700', margin: '0 0 2px' },
  identityMeta: { fontSize: '12px', color: '#94A3B8', margin: 0 },
  form: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC' },
  passwordWrapper: { position: 'relative' },
  eyeButton: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', display: 'flex' },
  errorBox: { gridColumn: '1 / -1', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  successBox: { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  saveButton: { gridColumn: '1 / -1', justifySelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
}

export default ProfilePanel
