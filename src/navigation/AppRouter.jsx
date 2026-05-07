import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import DirectorDashboard from '../screens/director/DirectorDashboard'
import CoordinatorDashboard from '../screens/coordinator/CoordinatorDashboard'
import TeacherDashboard from '../screens/teacher/TeacherDashboard'
import ClassroomView from '../screens/teacher/ClassroomView'
import StudentDashboard from '../screens/student/StudentDashboard'
import StudentClassroomView from '../screens/student/StudentClassroomView'
import TutorDashboard from '../screens/tutor/TutorDashboard'

const getDashboardPath = (role) => {
  switch (role) {
    case 'director':               return '/director'
    case 'coordinator_academic':
    case 'coordinator_workshop':   return '/coordinator'
    case 'teacher':                return '/teacher'
    case 'student':                return '/student'
    case 'tutor':                  return '/tutor'
    default:                       return '/login'
  }
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading, profileLoading, signOut } = useAuth()

  if (loading || profileLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <ProfileMissingScreen onSignOut={signOut} />
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/login" replace />
  }

  return children
}

const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '3px solid #E2E8F0',
        borderTop: '3px solid #6C63FF',
        margin: '0 auto 16px',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#94A3B8', fontSize: '14px', margin: 0 }}>Cargando...</p>
    </div>
  </div>
)

const ProfileMissingScreen = ({ onSignOut }) => (
  <div style={{
    minHeight: '100vh',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: '24px',
  }}>
    <div style={{
      width: '100%',
      maxWidth: '420px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      padding: '24px',
      textAlign: 'center',
      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
    }}>
      <h1 style={{ margin: '0 0 8px', color: '#0F172A', fontSize: '20px' }}>
        Perfil no disponible
      </h1>
      <p style={{ margin: '0 0 20px', color: '#64748B', fontSize: '14px', lineHeight: 1.5 }}>
        Tu sesion esta activa, pero no encontramos un perfil asociado a esta cuenta.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        style={{
          width: '100%',
          height: '42px',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Cerrar sesion
      </button>
    </div>
  </div>
)

const AppRouter = () => {
  const { user, profile, loading, profileLoading, signOut } = useAuth()

  if (loading || profileLoading) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!user ? <LoginScreen /> : profile ? <Navigate to={getDashboardPath(profile.role)} replace /> : <ProfileMissingScreen onSignOut={signOut} />}
        />

        <Route
          path="/register"
          element={!user || !profile ? <RegisterScreen /> : <Navigate to={getDashboardPath(profile.role)} replace />}
        />

        <Route path="/director" element={
          <ProtectedRoute allowedRoles={['director']}>
            <DirectorDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/coordinator" element={
          <ProtectedRoute allowedRoles={['coordinator_academic', 'coordinator_workshop']}>
            <CoordinatorDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/teacher" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/teacher/classroom/:classroomId" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <ClassroomView />
          </ProtectedRoute>
        }/>

        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/student/classroom/:classroomId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentClassroomView />
          </ProtectedRoute>
        }/>

        <Route path="/tutor" element={
          <ProtectedRoute allowedRoles={['tutor']}>
            <TutorDashboard />
          </ProtectedRoute>
        }/>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
