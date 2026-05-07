import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
const PROFILE_TIMEOUT_MS = 10000

const withTimeout = (promise, timeoutMs = PROFILE_TIMEOUT_MS) => {
  let timeoutId

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('La consulta del perfil tardo demasiado.'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      console.log('🚀 init started')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('📦 session:', session)

        if (session?.user) {
          setUser(session.user)
          console.log('👤 user found, fetching profile...')
          await fetchProfile(session.user.id)
        } else {
          console.log('❌ no session')
        }

      } catch (err) {
        console.error('Error init:', err.message)
      } finally {
        console.log('✅ loading done')
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('🔄 onAuthStateChange:', _event, session?.user?.id)
        if (session?.user) {
          setUser(session.user)
          setTimeout(() => {
            fetchProfile(session.user.id)
          }, 0)
        } else {
          setUser(null)
          setProfile(null)
          setProfileLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    console.log('🔍 fetchProfile called for:', userId)
    setProfileLoading(true)
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      )

      console.log('📋 fetchProfile result:', { data, error })

      if (error) {
        console.error('Error profile:', error.message)
        return
      }

      if (!data) {
        console.log('⚠️ no profile found for user:', userId)
        return
      }

      console.log('✅ profile loaded:', data)
      setProfile(data)

    } catch (err) {
      console.error('Error inesperado:', err.message)
    } finally {
      console.log('🏁 profileLoading done')
      setProfileLoading(false)
    }
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      profileLoading,
      signIn,
      signOut,
      fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
