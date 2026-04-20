import { createClient } from '@supabase/supabase-js'

// Cliente con SERVICE ROLE KEY (nunca lo expongas en el frontend)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // esta key está en Supabase → Settings → API
)

// Endpoint para crear cualquier usuario (coordinador, profesor, etc.)
app.post('/api/create-user', async (req, res) => {
  const { email, password, full_name, role, institution_id, created_by, subject_id } = req.body

  try {
    // 1. Supabase crea el usuario en auth correctamente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // lo confirma automáticamente
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 2. Insertar en tu tabla users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        institution_id,
        email,
        full_name,
        role,
        created_by,
      })

    if (userError) throw userError

    // 3. Si es profesor académico con materia
    if (subject_id) {
      await supabaseAdmin
        .from('teacher_subjects')
        .insert({ teacher_id: userId, subject_id, assigned_by: created_by })
    }

    res.json({ success: true, userId })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})