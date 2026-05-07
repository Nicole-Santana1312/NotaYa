import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── USUARIOS ───────────────────────────────────────────────

app.post('/api/create-user', async (req, res) => {
  const { email, password, full_name, role, institution_id, created_by, subject_id } = req.body
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) throw authError

    const userId = authData.user.id

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({ id: userId, institution_id, email, full_name, role, created_by })
    if (userError) throw userError

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

app.post('/api/update-password', async (req, res) => {
  const { userId, password } = req.body
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/delete-user', async (req, res) => {
  const { userId } = req.body
  try {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) throw authError
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', userId)
    if (dbError) throw dbError
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ─── TUTORES ────────────────────────────────────────────────

app.post('/api/create-tutor', async (req, res) => {
  const { email, full_name, password, institution_id, created_by, student_id } = req.body

  console.log('📥 create-tutor recibido:', { email, full_name, institution_id, created_by, student_id })

  try {
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.log('❌ Error listando usuarios:', listError)
      throw listError
    }

    const existing = existingUsers?.users?.find(u => u.email === email)
    console.log('🔍 Usuario existente en auth:', existing ? 'SÍ' : 'NO')

    let userId

    if (existing) {
      userId = existing.id

      const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      console.log('🔍 Perfil en tabla users:', existingProfile ? 'existe' : 'no existe', profileError?.code)

      if (!existingProfile) {
        const { error: insertError } = await supabaseAdmin.from('users').insert({
          id: userId, institution_id, email, full_name, role: 'tutor', created_by,
        })
        if (insertError) {
          console.log('❌ Error insertando usuario existente:', insertError)
          throw insertError
        }
      }
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (authError) {
        console.log('❌ Error creando auth user:', authError)
        throw authError
      }

      userId = authData.user.id
      console.log('✅ Auth user creado:', userId)

      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({ id: userId, institution_id, email, full_name, role: 'tutor', created_by })
      if (userError) {
        console.log('❌ Error insertando en tabla users:', userError)
        throw userError
      }
      console.log('✅ Usuario insertado en tabla users')
    }

    const { error: linkError } = await supabaseAdmin
      .from('student_tutors')
      .insert({ student_id, tutor_id: userId })

    if (linkError && linkError.code !== '23505') {
      console.log('❌ Error vinculando tutor-estudiante:', linkError)
      throw linkError
    }
    console.log('✅ Tutor vinculado al estudiante')

    res.json({ success: true, userId })
  } catch (error) {
    console.log('💥 Error final:', error.message)
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/delete-tutor', async (req, res) => {
  const { tutorId, studentId } = req.body
  try {
    const { error } = await supabaseAdmin
      .from('student_tutors')
      .delete()
      .eq('tutor_id', tutorId)
      .eq('student_id', studentId)
    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ─── ESTUDIANTE ─────────────────────────────────────────────

app.get('/api/student/classrooms/:studentId', async (req, res) => {
  const { studentId } = req.params
  try {
    const { data: csData, error: csError } = await supabaseAdmin
      .from('classroom_students')
      .select('classroom_id')
      .eq('student_id', studentId)

    if (csError) throw csError

    const classroomIds = csData?.map(cs => cs.classroom_id) || []
    if (classroomIds.length === 0) return res.json({ success: true, data: [] })

    const { data, error } = await supabaseAdmin
      .from('classrooms')
      .select(`
        id,
        period_id,
        academic_periods ( name, is_active ),
        teacher_subjects (
          subjects ( id, name, type ),
          users ( full_name )
        ),
        sections ( name )
      `)
      .in('id', classroomIds)

    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/student/pending/:studentId', async (req, res) => {
  const { studentId } = req.params
  try {
    const { data: csData } = await supabaseAdmin
      .from('classroom_students')
      .select('classroom_id')
      .eq('student_id', studentId)

    const classroomIds = csData?.map(cs => cs.classroom_id) || []
    if (classroomIds.length === 0) return res.json({ success: true, data: [] })

    const { data, error } = await supabaseAdmin
      .from('activities')
      .select(`
        id, name, type, due_date, max_score, classroom_id,
        classrooms (
          teacher_subjects ( subjects ( name, type ) ),
          sections ( name )
        ),
        activity_grades ( score, status )
      `)
      .in('classroom_id', classroomIds)
      .order('due_date', { ascending: true })

    if (error) throw error

    const pending = data.filter(a => {
      const grade = a.activity_grades?.[0]
      return !grade || grade.status === 'pending'
    })

    res.json({ success: true, data: pending })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/student/grades/:studentId/:classroomId', async (req, res) => {
  const { studentId, classroomId } = req.params
  try {
    // Traemos todas las actividades del aula
    const { data: activities, error: actError } = await supabaseAdmin
      .from('activities')
      .select(`
        id, name, type, max_score, due_date, learning_outcome_id,
        learning_outcomes ( code, description, weight )
      `)
      .eq('classroom_id', classroomId)
      .order('due_date', { ascending: true })

    if (actError) throw actError
    if (!activities || activities.length === 0) return res.json({ success: true, data: [] })

    const activityIds = activities.map(a => a.id)

    // Traemos solo las notas de ese estudiante
    const { data: grades, error: gradeError } = await supabaseAdmin
      .from('activity_grades')
      .select('activity_id, score, status, teacher_comment, file_path')
      .eq('student_id', studentId)
      .in('activity_id', activityIds)

    if (gradeError) throw gradeError

    // Unimos manualmente
    const gradeMap = {}
    grades?.forEach(g => { gradeMap[g.activity_id] = g })

    const result = activities.map(a => ({
      ...a,
      activity_grades: gradeMap[a.id] || null,
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/student/final-grade/:studentId/:classroomId', async (req, res) => {
  const { studentId, classroomId } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('period_final_grades')
      .select('final_score, passed, is_closed, closed_at, notes')
      .eq('student_id', studentId)
      .eq('classroom_id', classroomId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    res.json({ success: true, data: data || null })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/student/upload-url', async (req, res) => {
  const { studentId, activityId, fileName } = req.body
  try {
    const filePath = `submissions/${studentId}/${activityId}/${fileName}`
    const { data, error } = await supabaseAdmin.storage
      .from('student-submissions')
      .createSignedUploadUrl(filePath)
    if (error) throw error
    res.json({ success: true, uploadUrl: data.signedUrl, path: filePath })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/student/submit', async (req, res) => {
  const { activityId, studentId, filePath } = req.body
  try {
    const { error } = await supabaseAdmin
      .from('activity_grades')
      .upsert({
        activity_id: activityId,
        student_id: studentId,
        status: 'pending',
        file_path: filePath,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'activity_id,student_id' })
    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ─── TUTOR ──────────────────────────────────────────────────

app.get('/api/tutor/students/:tutorId', async (req, res) => {
  const { tutorId } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('student_tutors')
      .select('student_id, users!student_tutors_student_id_fkey(id, full_name, email)')
      .eq('tutor_id', tutorId)
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/tutor/classrooms/:studentId', async (req, res) => {
  const { studentId } = req.params
  try {
    const { data: csData } = await supabaseAdmin
      .from('classroom_students')
      .select('classroom_id')
      .eq('student_id', studentId)

    const classroomIds = csData?.map(cs => cs.classroom_id) || []
    if (classroomIds.length === 0) return res.json({ success: true, data: [] })

    const { data, error } = await supabaseAdmin
      .from('classrooms')
      .select(`
        id,
        academic_periods ( name, is_active ),
        teacher_subjects (
          subjects ( id, name, type ),
          users ( full_name )
        ),
        sections ( name )
      `)
      .in('id', classroomIds)

    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/tutor/grades/:studentId/:classroomId', async (req, res) => {
  const { studentId, classroomId } = req.params
  try {
    const { data: activities, error: actError } = await supabaseAdmin
      .from('activities')
      .select(`
        id, name, type, max_score, due_date, learning_outcome_id,
        learning_outcomes ( code, description, weight )
      `)
      .eq('classroom_id', classroomId)
      .order('due_date', { ascending: true })

    if (actError) throw actError
    if (!activities || activities.length === 0) return res.json({ success: true, data: [] })

    const activityIds = activities.map(a => a.id)

    const { data: grades, error: gradeError } = await supabaseAdmin
      .from('activity_grades')
      .select('activity_id, score, status, teacher_comment')
      .eq('student_id', studentId)
      .in('activity_id', activityIds)

    if (gradeError) throw gradeError

    const gradeMap = {}
    grades?.forEach(g => { gradeMap[g.activity_id] = g })

    const result = activities.map(a => ({
      ...a,
      activity_grades: gradeMap[a.id] || null,
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ─── COMPETENCIAS ──────────────────────────────────────────

app.post('/api/competencies', async (req, res) => {
  const { institution_id, name, description, type, subject_id } = req.body
  try {
    const { data, error } = await supabaseAdmin
      .from('competencies')
      .insert({ institution_id, name, description, type, subject_id })
      .select()
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/competencies/:institution_id', async (req, res) => {
  const { institution_id } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('competencies')
      .select('*')
      .eq('institution_id', institution_id)
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/competencies/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body
  try {
    const { data, error } = await supabaseAdmin
      .from('competencies')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/competencies/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabaseAdmin
      .from('competencies')
      .delete()
      .eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.listen(3001, () => console.log('Servidor corriendo en puerto 3001'))