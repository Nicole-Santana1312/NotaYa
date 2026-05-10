import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const REQUEST_TIMEOUT_MS = 15000
const OTP_LENGTH = 8
const OTP_VERIFY_TYPES = ['otp']

const countries = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita', 'Argelia', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaiyán',
  'Bahamas', 'Bangladés', 'Barbados', 'Baréin', 'Bélgica', 'Belice', 'Benín', 'Bielorrusia', 'Birmania', 'Bolivia', 'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China', 'Chipre', 'Ciudad del Vaticano', 'Colombia', 'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia', 'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos', 'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Esuatini', 'Etiopía', 'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada', 'Grecia', 'Guatemala', 'Guinea', 'Guinea-Bisáu', 'Guinea Ecuatorial', 'Guyana', 'Haití', 'Honduras', 'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall', 'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia', 'Kirguistán', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia', 'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas', 'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco', 'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria', 'Noruega', 'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea', 'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Centroafricana', 'República Checa', 'República del Congo', 'República Democrática del Congo', 'República Dominicana', 'Ruanda', 'Rumania', 'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino', 'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Sudáfrica', 'Sudán', 'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán', 'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía', 'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue'
]

const withTimeout = (promise, timeoutMs = REQUEST_TIMEOUT_MS) => {
  let timeoutId

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('La solicitud tardo demasiado. Intenta de nuevo.'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

const verifyEmailOtp = async ({ email, token }) => {
  const { error } = await withTimeout(
    supabase.auth.verifyOtp({
      email,
      token,
      type: 'otp',
    })
  )

  if (error) throw error
}

const RegisterScreen = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState('forward')
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const otpRefs = useRef([])

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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.institutionEmail)) {
      setError('Por favor ingresa un correo institucional válido.')
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

const handleNext = async () => {
  if (!validateStep1()) return

  setLoading(true)
  setError('')

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithOtp({
        email: form.institutionEmail,
        options: { shouldCreateUser: true, type: 'otp' },
      })
    )

    if (error) {
      console.error(error)
      setError(error.message)
      return
    }

    goToStep(2, 'forward')

  } catch (err) {
    console.error(err)
    setError(err.message)
  } finally {
    setLoading(false)
  }
}
  // Reenviar OTP
  const handleResendOtp = async () => {
    setLoading(true)
    setError('')
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email: form.institutionEmail,
          options: { shouldCreateUser: true, type: 'otp' },
        })
      )
      if (error) throw error
      setError('Código reenviado. Revisa tu correo.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo reenviar el código.')
    } finally {
      setLoading(false)
    }
  }

  // Verificar OTP ingresado
  const handleVerifyOtp = async () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) {
      setError(`Ingresa el código completo de ${OTP_LENGTH} dígitos.`)
      return
    }
    setLoading(true)
    setError('')
    try {
      await verifyEmailOtp({
        email: form.institutionEmail,
        token: code,
      })
      goToStep(3, 'forward')
    } catch (err) {
      console.error('Verify OTP error:', err)
      setError('Código incorrecto o expirado. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Manejar input de cada caja OTP
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') handleVerifyOtp()
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const newOtp = [...otp]
    pasted.split('').forEach((char, i) => { newOtp[i] = char })
    setOtp(newOtp)
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

const { fetchProfile } = useAuth()  // ✅ importarlo

const handleRegister = async () => {
  if (!validateStep2()) return
  setLoading(true)
  setError('')
  try {
    const { data: authData, error: authError } = await withTimeout(
      supabase.auth.signUp({
        email: form.directorEmail,
        password: form.password,
      })
    )
    if (authError) throw authError
    if (!authData.user?.id) {
      throw new Error('No se pudo crear el usuario director.')
    }

    const { error: fnError } = await withTimeout(
      supabase.rpc('register_institution', {
        p_institution_name:  form.institutionName,
        p_institution_code:  form.institutionCode,
        p_country:           form.country,
        p_institution_email: form.institutionEmail,
        p_director_id:       authData.user.id,
        p_director_email:    form.directorEmail,
        p_director_name:     form.directorName,
      })
    )
    if (fnError) throw fnError

    // ✅ Ahora sí existe el perfil, cargarlo
    await fetchProfile(authData.user.id)

    goToStep(4, 'forward')
  } catch (err) {
    setError(err.message || 'Ocurrió un error. Intenta de nuevo.')
  } finally {
    setLoading(false)
  }
}

  const handleBack = () => {
    setError('')
    setOtp(Array(OTP_LENGTH).fill(''))
    goToStep(step - 1, 'backward')
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

  // Steps: 1=Institución, 2=Verificación OTP, 3=Director, 4=Éxito
  const stepLabels = ['Institución', 'Verificación', 'Director']

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .form-field { animation: fadeSlideIn 0.3s ease forwards; }
        .otp-input:focus { border-color: #6C63FF !important; background: #F0EEFF !important; }
        .otp-input { transition: border-color 0.2s, background 0.2s; }
        .resend-btn:hover { color: #6C63FF !important; }
        .back-btn:hover { border-color: #6C63FF !important; color: #6C63FF !important; }
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

        {/* Steps indicator - solo pasos 1, 2, 3 */}
        {step !== 4 && (
          <div style={styles.stepsWrapper}>
            {stepLabels.map((label, i) => {
              const stepNum = i + 1
              const isCompleted = step > stepNum
              const isActive = step === stepNum
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={styles.stepItem}>
                    <div style={{
                      ...styles.stepCircle,
                      background: isCompleted || isActive
                        ? 'linear-gradient(135deg, #6C63FF, #4FACFE)'
                        : '#E2E8F0',
                    }}>
                      {isCompleted
                        ? <Check size={14} color="#fff" />
                        : <span style={styles.stepNumber}>{stepNum}</span>
                      }
                    </div>
                    <span style={{ ...styles.stepLabel, color: isActive || isCompleted ? '#6C63FF' : '#94A3B8' }}>
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div style={styles.stepLineWrapper}>
                      <div style={styles.stepLineBase} />
                      <div style={{
                        ...styles.stepLineFill,
                        width: step > stepNum ? '100%' : '0%',
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Contenido animado */}
        <div style={getAnimationStyle()}>

          {/* Step 1: Institución */}
          {step === 1 && (
            <div style={styles.form}>
              {[
                { label: 'Nombre de la institución', field: 'institutionName', placeholder: 'Ej: Instituto Nacional Don Bosco', delay: '0ms' },
                { label: 'Código institucional', field: 'institutionCode', placeholder: 'Ej: INDB-001', delay: '60ms' },
                { label: 'País', field: 'country', type: 'select', options: countries, placeholder: 'Selecciona un país', delay: '120ms' },
                { label: 'Correo institucional', field: 'institutionEmail', placeholder: 'contacto@institución.edu', type: 'email', delay: '180ms' },
              ].map(({ label, field, placeholder, type = 'text', options = [], delay }) => (
                <div key={field} className="form-field" style={{ animationDelay: delay }}>
                  <Field
                    label={label}
                    type={type}
                    options={options}
                    value={form[field]}
                    onChange={v => handleChange(field, v)}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              {error && <div style={styles.errorBox}>{error}</div>}

              <button
                onClick={handleNext}
                disabled={loading}
                style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Enviando código...' : <><span>Siguiente</span> <ArrowRight size={16} style={{ marginLeft: '6px' }} /></>}
              </button>
            </div>
          )}

          {/* Step 2: Verificación OTP */}
          {step === 2 && (
            <div style={styles.form}>
              <div style={styles.otpInfo}>
                <div style={styles.otpIconWrapper}>
                  <Mail size={22} color="#6C63FF" />
                </div>
                <p style={styles.otpInfoTitle}>Revisa tu correo</p>
                <p style={styles.otpInfoText}>
                  Enviamos un código de {OTP_LENGTH} dígitos a{' '}
                  <strong style={{ color: '#1E293B' }}>{form.institutionEmail}</strong>
                </p>
              </div>

              {/* Cajas OTP */}
              <div style={styles.otpWrapper} onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => otpRefs.current[index] = el}
                    className="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    style={{
                      ...styles.otpBox,
                      borderColor: digit ? '#6C63FF' : '#E2E8F0',
                      background: digit ? '#F0EEFF' : '#F8FAFC',
                      color: digit ? '#6C63FF' : '#1E293B',
                    }}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                style={{ ...styles.submitButton, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Verificando...' : <><Check size={16} style={{ marginRight: '6px' }} /><span>Verificar código</span></>}
              </button>

              <div style={styles.buttonRow}>
                <button onClick={handleBack} className="back-btn" style={styles.backButton}>
                  <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Atrás
                </button>
                <button
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="resend-btn"
                  style={styles.resendButton}
                >
                  Reenviar código
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Director */}
          {step === 3 && (
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
                <button onClick={handleBack} className="back-btn" style={styles.backButton}>
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

          {/* Step 4: Éxito */}
          {step === 4 && (
            <div style={styles.successWrapper}>
              <div style={styles.successIcon}>
                <Check size={36} color="#fff" />
              </div>
              <h2 style={styles.successTitle}>¡Institución registrada!</h2>
              <p style={styles.successText}>
                Tu institución ha sido creada exitosamente. Ya puedes iniciar sesión con tu cuenta de director.
              </p>
              <button onClick={() => navigate('/login')} style={styles.submitButton}>
                Ir al inicio de sesión
              </button>
            </div>
          )}

        </div>

        {/* Link al login */}
        {step !== 4 && (
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

const Field = ({ label, value, onChange, placeholder, type = 'text', options = [] }) => (
  <div style={styles.fieldGroup}>
    <label style={styles.label}>{label}</label>
    {type === 'select' ? (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={styles.input}
        onFocus={e => e.target.style.borderColor = '#6C63FF'}
        onBlur={e => e.target.style.borderColor = '#E2E8F0'}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
        onFocus={e => e.target.style.borderColor = '#6C63FF'}
        onBlur={e => e.target.style.borderColor = '#E2E8F0'}
      />
    )}
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
    width: '40px',
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
    transition: 'border-color 0.2s, color 0.2s',
  },
  resendButton: {
    flex: 1,
    padding: '13px',
    borderRadius: '12px',
    border: '1.5px solid #E2E8F0',
    background: '#fff',
    color: '#94A3B8',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  // OTP
  otpInfo: {
    textAlign: 'center',
    padding: '16px',
    backgroundColor: '#F8FAFF',
    borderRadius: '16px',
    border: '1.5px solid #E8E4FF',
  },
  otpIconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: '#EDE9FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
  },
  otpInfoTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1E293B',
    margin: '0 0 6px',
  },
  otpInfoText: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
    lineHeight: '1.5',
  },
  otpWrapper: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  otpBox: {
    width: '40px',
    height: '52px',
    borderRadius: '12px',
    border: '2px solid #E2E8F0',
    fontSize: '22px',
    fontWeight: '700',
    textAlign: 'center',
    outline: 'none',
    cursor: 'text',
  },
  // Success
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
