import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const RegisterScreen = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState('forward')

  const [form, setForm] = useState({
    institutionName: '',
    institutionCode: '',
    country: '',
    institutionEmail: '',
    directorName: '',
    directorEmail: '',
    password: '',
    confirmPassword: '',
  })

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep1 = () => {
    if (!form.institutionName || !form.institutionCode || !form.country || !form.institutionEmail) {
      setError('Por favor completa todos los campos.')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!form.directorName || !form.directorEmail || !form.password || !form.confirmPassword) {
      setError('Por favor completa todos los campos.')
      return false
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return false
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return false
    }
    return true
  }

  const goToStep = (nextStep, dir) => {
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setStep(nextStep)
      setAnimating(false)
    }, 320)
  }

  const handleNext = () => {
    if (validateStep1()) {
      setError('')
      goToStep(2, 'forward')
    }
  }

  const handleBack = () => {
    setError('')
    goToStep(1, 'backward')
  }

  const handleRegister = async () => {
  if (!validateStep2()) return
  setLoading(true)
  setError('')

  try {
    // 1. Crear usuario en Supabase Auth primero
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.directorEmail,
      password: form.password,
    })
    if (authError) throw authError

    // 2. Llamar la función que bypasea RLS
    const { error: fnError } = await supabase.rpc('register_institution', {
      p_institution_name: form.institutionName,
      p_institution_code: form.institutionCode,
      p_country: form.country,
      p_institution_email: form.institutionEmail,
      p_director_id: authData.user.id,
      p_director_email: form.directorEmail,
      p_director_name: form.directorName,
    })
    if (fnError) throw fnError

    goToStep(3, 'forward')
  } catch (err) {
    setError(err.message || 'Ocurrió un error. Intenta de nuevo.')
  } finally {
    setLoading(false)
  }
}
  const getAnimationStyle = () => {
    if (!animating) return {
      opacity: 1,
      transform: 'translateX(0)',
      transition: 'opacity 0.32s ease, transform 0.32s ease',
    }
    return {
      opacity: 0,
      transform: direction === 'forward' ? 'translateX(-24px)' : 'translateX(24px)',
      transition: 'opacity 0.32s ease, transform 0.32s ease',
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .form-field {
          animation: fadeSlideIn 0.3s ease forwards;
        }
      `}</style>

      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <GraduationCap size={28} color="#fff" />
          </div>
          <h1 style={styles.title}>NotaYa</h1>
          <p style={styles.subtitle}>Registro de institución</p>
        </div>

        {/* Steps indicator */}
        {step !== 3 && (
          <div style={styles.stepsWrapper}>
            <div style={styles.stepItem}>
              <div style={{
                ...styles.stepCircle,
                background: step >= 1 ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#E2E8F0',
              }}>
                {step > 1
                  ? <Check size={14} color="#fff" />
                  : <span style={styles.stepNumber}>1</span>
                }
              </div>
              <span style={{ ...styles.stepLabel, color: step >= 1 ? '#6C63FF' : '#94A3B8' }}>
                Institución
              </span>
            </div>

            <div style={styles.stepLineWrapper}>
              <div style={styles.stepLineBase} />
              <div style={{
                ...styles.stepLineFill,
                width: step >= 2 ? '100%' : '0%',
              }} />
            </div>

            <div style={styles.stepItem}>
              <div style={{
                ...styles.stepCircle,
                background: step >= 2 ? 'linear-gradient(135deg, #6C63FF, #4FACFE)' : '#E2E8F0',
              }}>
                <span style={styles.stepNumber}>2</span>
              </div>
              <span style={{ ...styles.stepLabel, color: step >= 2 ? '#6C63FF' : '#94A3B8' }}>
                Director
              </span>
            </div>
          </div>
        )}

        {/* Contenido animado */}
        <div style={getAnimationStyle()}>

          {/* Step 1 */}
          {step === 1 && (
            <div style={styles.form}>
              {[
                { label: 'Nombre de la institución', field: 'institutionName', placeholder: 'Ej: Instituto Nacional Don Bosco', delay: '0ms' },
                { label: 'Código institucional', field: 'institutionCode', placeholder: 'Ej: INDB-001', delay: '60ms' },
                { label: 'País', field: 'country', placeholder: 'Ej: República Dominicana', delay: '120ms' },
                { label: 'Correo institucional', field: 'institutionEmail', placeholder: 'contacto@institución.edu', type: 'email', delay: '180ms' },
              ].map(({ label, field, placeholder, type = 'text', delay }) => (
                <div key={field} className="form-field" style={{ animationDelay: delay }}>
                  <Field
                    label={label}
                    type={type}
                    value={form[field]}
                    onChange={v => handleChange(field, v)}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              {error && <div style={styles.errorBox}>{error}</div>}

              <button onClick={handleNext} style={styles.submitButton}>
                Siguiente <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={styles.form}>
              {[
                { label: 'Nombre completo del director', field: 'directorName', placeholder: 'Ej: María González', delay: '0ms' },
                { label: 'Correo del director', field: 'directorEmail', placeholder: 'director@institución.edu', type: 'email', delay: '60ms' },
                { label: 'Contraseña', field: 'password', placeholder: 'Mínimo 6 caracteres', type: 'password', delay: '120ms' },
                { label: 'Confirmar contraseña', field: 'confirmPassword', placeholder: 'Repite la contraseña', type: 'password', delay: '180ms' },
              ].map(({ label, field, placeholder, type = 'text', delay }) => (
                <div key={field} className="form-field" style={{ animationDelay: delay }}>
                  <Field
                    label={label}
                    type={type}
                    value={form[field]}
                    onChange={v => handleChange(field, v)}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              {error && <div style={styles.errorBox}>{error}</div>}

              <div style={styles.buttonRow}>
                <button onClick={handleBack} style={styles.backButton}>
                  <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Atrás
                </button>
                <button
                  onClick={handleRegister}
                  disabled={loading}
                  style={{
                    ...styles.submitButton,
                    flex: 1,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Registrando...' : 'Crear cuenta'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Éxito */}
          {step === 3 && (
            <div style={styles.successWrapper}>
              <div style={styles.successIcon}>
                <Check size={36} color="#fff" />
              </div>
              <h2 style={styles.successTitle}>¡Institución registrada!</h2>
              <p style={styles.successText}>
                Tu institución ha sido creada exitosamente. Ya puedes iniciar sesión con tu cuenta de director.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={styles.submitButton}
              >
                Ir al inicio de sesión
              </button>
            </div>
          )}

        </div>

        {/* Link al login */}
        {step !== 3 && (
          <div style={styles.loginWrapper}>
            <span style={styles.loginText}>¿Ya tienes cuenta? </span>
            <button onClick={() => navigate('/login')} style={styles.loginLink}>
              Inicia sesión
            </button>
          </div>
        )}

      </div>

      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />
    </div>
  )
}

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div style={styles.fieldGroup}>
    <label style={styles.label}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={styles.input}
      onFocus={e => e.target.style.borderColor = '#6C63FF'}
      onBlur={e => e.target.style.borderColor = '#E2E8F0'}
    />
  </div>
)

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 20px 60px rgba(108, 99, 255, 0.12)',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  iconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    boxShadow: '0 8px 24px rgba(108, 99, 255, 0.35)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1E293B',
    margin: '0 0 4px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#94A3B8',
    margin: 0,
  },
  stepsWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.4s ease',
  },
  stepNumber: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: '11px',
    fontWeight: '600',
    transition: 'color 0.4s ease',
  },
  stepLineWrapper: {
    position: 'relative',
    width: '60px',
    height: '2px',
    marginInline: '8px',
    marginBottom: '22px',
  },
  stepLineBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: '2px',
  },
  stepLineFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    background: 'linear-gradient(90deg, #6C63FF, #4FACFE)',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    letterSpacing: '0.3px',
  },
  input: {
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1.5px solid #E2E8F0',
    fontSize: '14px',
    color: '#1E293B',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#F8FAFC',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  submitButton: {
    padding: '13px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(108, 99, 255, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: '4px',
    transition: 'opacity 0.2s',
  },
  backButton: {
    padding: '13px 16px',
    borderRadius: '12px',
    border: '1.5px solid #E2E8F0',
    background: '#fff',
    color: '#64748B',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.2s',
  },
  successWrapper: {
    textAlign: 'center',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  successIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(108, 99, 255, 0.35)',
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1E293B',
    margin: 0,
  },
  successText: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: '1.6',
    margin: 0,
  },
  loginWrapper: {
    textAlign: 'center',
    marginTop: '20px',
  },
  loginText: {
    fontSize: '13px',
    color: '#94A3B8',
  },
  loginLink: {
    background: 'none',
    border: 'none',
    color: '#6C63FF',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '0',
  },
  bgCircle1: {
    position: 'fixed',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108,99,255,0.08), transparent)',
    top: '-100px',
    right: '-100px',
    zIndex: 0,
  },
  bgCircle2: {
    position: 'fixed',
    width: '350px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(79,172,254,0.08), transparent)',
    bottom: '-80px',
    left: '-80px',
    zIndex: 0,
  },
}

export default RegisterScreen