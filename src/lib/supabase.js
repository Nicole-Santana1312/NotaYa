import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mubizzwnskpgdksqbqgi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Yml6enduc2twZ2Rrc3FicWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTI4NjgsImV4cCI6MjA5MTI2ODg2OH0.F2fAPkiv2C8kKICmn4Lx0dlGS7UU8zkMCUdn0OlJMdQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)