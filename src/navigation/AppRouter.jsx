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
  const { user, profile, loading } = useAuth()

  if (loading) return <div>Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/login" replace />
  }

  return children
}

const AppRouter = () => {
  const { user, profile, loading } = useAuth()

  if (loading) return <div>Cargando...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!user ? <LoginScreen /> : <Navigate to={getDashboardPath(profile?.role)} replace />}
        />

        <Route
          path="/register"
          element={!user ? <RegisterScreen /> : <Navigate to={getDashboardPath(profile?.role)} replace />}
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