import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'notaya-api' })
})

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── USUARIOS ───────────────────────────────────────────────

app.post('/api/create-user', async (req, res) => {
  const { email, password, full_name, role, institution_id, created_by, subject_id, age, gender, phone, birth_date } = req.body
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authError) throw authError

    const userId = authData.user.id

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({ id: userId, institution_id, email, full_name, role, created_by, age, gender, phone, birth_date })
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

app.post('/api/admin/create-section-bundle', async (req, res) => {
  const { institution_id, created_by, section, period_id, teacher_subject_ids = [], students = [] } = req.body

  try {
    if (!institution_id || !created_by || !section?.name || !period_id) {
      throw new Error('Seccion, periodo e institucion son obligatorios.')
    }
    const { data: existingSection } = await supabaseAdmin
      .from('sections')
      .select('id')
      .eq('institution_id', institution_id)
      .eq('name', section.name.trim())
      .maybeSingle()

    let sectionId = existingSection?.id
    if (!sectionId) {
      const { data: newSection, error: sectionError } = await supabaseAdmin
        .from('sections')
        .insert({ institution_id, name: section.name.trim(), level: section.level?.trim() || null, created_by })
        .select('id')
        .single()
      if (sectionError) throw sectionError
      sectionId = newSection.id
    }

    const classroomIds = []
    for (const teacherSubjectId of teacher_subject_ids) {
      const { data: existingClassroom } = await supabaseAdmin
        .from('classrooms')
        .select('id')
        .eq('teacher_subject_id', teacherSubjectId)
        .eq('section_id', sectionId)
        .eq('period_id', period_id)
        .maybeSingle()

      if (existingClassroom?.id) {
        classroomIds.push(existingClassroom.id)
        continue
      }

      const { data: classroom, error: classroomError } = await supabaseAdmin
        .from('classrooms')
        .insert({ teacher_subject_id: teacherSubjectId, section_id: sectionId, period_id })
        .select('id')
        .single()
      if (classroomError) throw classroomError
      classroomIds.push(classroom.id)
    }

    const createdStudents = []
    for (const row of students.filter(s => s.full_name?.trim() && s.email?.trim())) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: row.email.trim(),
        password: row.password?.trim() || '123456',
        email_confirm: true,
      })
      if (authError) throw authError

      const studentId = authData.user.id
      const { error: userError } = await supabaseAdmin.from('users').insert({
        id: studentId,
        institution_id,
        email: row.email.trim(),
        full_name: row.full_name.trim(),
        role: 'student',
        created_by,
        age: row.age ? parseInt(row.age) : null,
        gender: row.gender?.trim() || null,
        phone: row.phone?.trim() || null,
        birth_date: row.birth_date || null,
      })
      if (userError) throw userError

      const { error: sectionStudentError } = await supabaseAdmin
        .from('section_students')
        .insert({ section_id: sectionId, student_id: studentId })
      if (sectionStudentError && sectionStudentError.code !== '23505') throw sectionStudentError

      if (classroomIds.length > 0) {
        const { error: classroomStudentsError } = await supabaseAdmin.from('classroom_students').insert(
          classroomIds.map(classroom_id => ({ classroom_id, student_id: studentId }))
        )
        if (classroomStudentsError && classroomStudentsError.code !== '23505') throw classroomStudentsError
      }

      if (row.tutor_email?.trim()) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingTutor = existingUsers?.users?.find(u => u.email === row.tutor_email.trim())
        let tutorId = existingTutor?.id

        if (!tutorId) {
          const { data: tutorAuth, error: tutorAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: row.tutor_email.trim(),
            password: row.tutor_password?.trim() || '123456',
            email_confirm: true,
          })
          if (tutorAuthError) throw tutorAuthError
          tutorId = tutorAuth.user.id
        }

        const { data: tutorProfile } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', tutorId)
          .maybeSingle()

        if (!tutorProfile) {
          const { error: tutorError } = await supabaseAdmin.from('users').insert({
            id: tutorId,
            institution_id,
            email: row.tutor_email.trim(),
            full_name: row.tutor_name?.trim() || `Tutor de ${row.full_name.trim()}`,
            role: 'tutor',
            created_by,
          })
          if (tutorError) throw tutorError
        }

        const { error: linkError } = await supabaseAdmin
          .from('student_tutors')
          .insert({ student_id: studentId, tutor_id: tutorId })
        if (linkError && linkError.code !== '23505') throw linkError
      }

      createdStudents.push(studentId)
    }

    res.json({ success: true, sectionId, classroomIds, students: createdStudents.length })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.patch('/api/admin/sections/:sectionId', async (req, res) => {
  const { sectionId } = req.params
  const { institution_id, created_by, section, period_id, teacher_subject_ids = [], students = [] } = req.body

  try {
    if (!sectionId || !institution_id || !section?.name || !period_id) {
      throw new Error('Seccion, periodo e institucion son obligatorios.')
    }

    const { error: sectionError } = await supabaseAdmin
      .from('sections')
      .update({ name: section.name.trim(), level: section.level?.trim() || null })
      .eq('id', sectionId)
      .eq('institution_id', institution_id)

    if (sectionError) throw sectionError

    const { data: currentClassrooms, error: currentClassroomsError } = await supabaseAdmin
      .from('classrooms')
      .select('id, teacher_subject_id, period_id')
      .eq('section_id', sectionId)
    if (currentClassroomsError) throw currentClassroomsError

    const requestedTeacherSubjectIds = teacher_subject_ids.filter(Boolean)
    const currentTeacherSubjectIds = (currentClassrooms || [])
      .filter(classroom => classroom.period_id === period_id)
      .map(classroom => classroom.teacher_subject_id)
    const classroomIdsToDelete = (currentClassrooms || [])
      .filter(classroom => classroom.period_id !== period_id || !requestedTeacherSubjectIds.includes(classroom.teacher_subject_id))
      .map(classroom => classroom.id)

    if (classroomIdsToDelete.length > 0) {
      const { error: deleteClassroomsError } = await supabaseAdmin
        .from('classrooms')
        .delete()
        .in('id', classroomIdsToDelete)
      if (deleteClassroomsError) throw deleteClassroomsError
    }

    for (const teacherSubjectId of requestedTeacherSubjectIds.filter(id => !currentTeacherSubjectIds.includes(id))) {
      const { error: classroomError } = await supabaseAdmin
        .from('classrooms')
        .insert({ teacher_subject_id: teacherSubjectId, section_id: sectionId, period_id })
      if (classroomError && classroomError.code !== '23505') throw classroomError
    }

    const { data: refreshedClassrooms, error: refreshedClassroomsError } = await supabaseAdmin
      .from('classrooms')
      .select('id')
      .eq('section_id', sectionId)
      .eq('period_id', period_id)
    if (refreshedClassroomsError) throw refreshedClassroomsError
    const classroomIds = refreshedClassrooms?.map(classroom => classroom.id) || []

    const validStudents = students.filter(student => student.full_name?.trim() && student.email?.trim())
    const requestedExistingStudentIds = validStudents.map(student => student.student_id).filter(Boolean)
    const { data: currentStudents, error: currentStudentsError } = await supabaseAdmin
      .from('section_students')
      .select('student_id')
      .eq('section_id', sectionId)
    if (currentStudentsError) throw currentStudentsError

    const currentStudentIds = currentStudents?.map(row => row.student_id) || []
    const studentIdsToRemove = currentStudentIds.filter(studentId => !requestedExistingStudentIds.includes(studentId))

    if (studentIdsToRemove.length > 0) {
      const { error: removeSectionStudentsError } = await supabaseAdmin
        .from('section_students')
        .delete()
        .eq('section_id', sectionId)
        .in('student_id', studentIdsToRemove)
      if (removeSectionStudentsError) throw removeSectionStudentsError

      if (classroomIds.length > 0) {
        const { error: removeClassroomStudentsError } = await supabaseAdmin
          .from('classroom_students')
          .delete()
          .in('classroom_id', classroomIds)
          .in('student_id', studentIdsToRemove)
        if (removeClassroomStudentsError) throw removeClassroomStudentsError
      }
    }

    const savedStudentIds = []
    for (const row of validStudents) {
      let studentId = row.student_id
      if (studentId) {
        const { error: updateUserError } = await supabaseAdmin
          .from('users')
          .update({
            email: row.email.trim(),
            full_name: row.full_name.trim(),
            age: row.age ? parseInt(row.age) : null,
            phone: row.phone?.trim() || null,
          })
          .eq('id', studentId)
        if (updateUserError) throw updateUserError
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: row.email.trim(),
          password: row.password?.trim() || '123456',
          email_confirm: true,
        })
        if (authError) throw authError
        studentId = authData.user.id

        const { error: userError } = await supabaseAdmin.from('users').insert({
          id: studentId,
          institution_id,
          email: row.email.trim(),
          full_name: row.full_name.trim(),
          role: 'student',
          created_by,
          age: row.age ? parseInt(row.age) : null,
          phone: row.phone?.trim() || null,
        })
        if (userError) throw userError
      }

      const { error: sectionStudentError } = await supabaseAdmin
        .from('section_students')
        .insert({ section_id: sectionId, student_id: studentId })
      if (sectionStudentError && sectionStudentError.code !== '23505') throw sectionStudentError

      if (classroomIds.length > 0) {
        const { error: classroomStudentsError } = await supabaseAdmin
          .from('classroom_students')
          .upsert(classroomIds.map(classroom_id => ({ classroom_id, student_id: studentId })), { onConflict: 'classroom_id,student_id' })
        if (classroomStudentsError) throw classroomStudentsError
      }

      if (row.tutor_email?.trim()) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingTutor = existingUsers?.users?.find(u => u.email === row.tutor_email.trim())
        let tutorId = existingTutor?.id

        if (!tutorId) {
          const { data: tutorAuth, error: tutorAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: row.tutor_email.trim(),
            password: row.tutor_password?.trim() || '123456',
            email_confirm: true,
          })
          if (tutorAuthError) throw tutorAuthError
          tutorId = tutorAuth.user.id
        }

        const { data: tutorProfile } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', tutorId)
          .maybeSingle()

        if (!tutorProfile) {
          const { error: tutorError } = await supabaseAdmin.from('users').insert({
            id: tutorId,
            institution_id,
            email: row.tutor_email.trim(),
            full_name: row.tutor_name?.trim() || `Tutor de ${row.full_name.trim()}`,
            role: 'tutor',
            created_by,
          })
          if (tutorError) throw tutorError
        } else if (row.tutor_name?.trim()) {
          const { error: updateTutorError } = await supabaseAdmin
            .from('users')
            .update({ full_name: row.tutor_name.trim(), email: row.tutor_email.trim() })
            .eq('id', tutorId)
          if (updateTutorError) throw updateTutorError
        }

        const { error: linkError } = await supabaseAdmin
          .from('student_tutors')
          .insert({ student_id: studentId, tutor_id: tutorId })
        if (linkError && linkError.code !== '23505') throw linkError
      }

      savedStudentIds.push(studentId)
    }

    res.json({ success: true, classroomIds, students: savedStudentIds.length })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/admin/sections/:sectionId/bundle', async (req, res) => {
  const { sectionId } = req.params
  const { institution_id } = req.query

  try {
    if (!sectionId || !institution_id) {
      throw new Error('Seccion e institucion son obligatorias.')
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('sections')
      .select('id, name, level')
      .eq('id', sectionId)
      .eq('institution_id', institution_id)
      .single()
    if (sectionError) throw sectionError

    const { data: classrooms, error: classroomsError } = await supabaseAdmin
      .from('classrooms')
      .select('id, teacher_subject_id, period_id')
      .eq('section_id', sectionId)
    if (classroomsError) throw classroomsError

    const periodId = classrooms?.[0]?.period_id || ''
    const teacherSubjectIds = (classrooms || [])
      .filter(classroom => !periodId || classroom.period_id === periodId)
      .map(classroom => classroom.teacher_subject_id)

    const { data: sectionStudents, error: sectionStudentsError } = await supabaseAdmin
      .from('section_students')
      .select('student_id, users(id, full_name, email, age, phone)')
      .eq('section_id', sectionId)
      .order('enrolled_at')
    if (sectionStudentsError) throw sectionStudentsError

    const studentIds = (sectionStudents || []).map(row => row.student_id)
    let tutorByStudentId = {}
    if (studentIds.length > 0) {
      const { data: studentTutors, error: studentTutorsError } = await supabaseAdmin
        .from('student_tutors')
        .select('student_id, users!student_tutors_tutor_id_fkey(full_name, email)')
        .in('student_id', studentIds)
      if (studentTutorsError) throw studentTutorsError
      tutorByStudentId = (studentTutors || []).reduce((map, row) => ({
        ...map,
        [row.student_id]: row.users,
      }), {})
    }

    res.json({
      success: true,
      section,
      period_id: periodId,
      teacher_subject_ids: teacherSubjectIds,
      students: (sectionStudents || []).map(row => ({
        student_id: row.users?.id || row.student_id,
        full_name: row.users?.full_name || '',
        email: row.users?.email || '',
        age: row.users?.age || '',
        phone: row.users?.phone || '',
        tutor_name: tutorByStudentId[row.student_id]?.full_name || '',
        tutor_email: tutorByStudentId[row.student_id]?.email || '',
      })),
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/admin/sections/:sectionId', async (req, res) => {
  const { sectionId } = req.params
  const { institution_id } = req.body

  try {
    if (!sectionId || !institution_id) {
      throw new Error('Seccion e institucion son obligatorias.')
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('sections')
      .select('id')
      .eq('id', sectionId)
      .eq('institution_id', institution_id)
      .maybeSingle()

    if (sectionError) throw sectionError
    if (!section) throw new Error('No se encontro la seccion.')

    const { data: classrooms, error: classroomError } = await supabaseAdmin
      .from('classrooms')
      .select('id')
      .eq('section_id', sectionId)

    if (classroomError) throw classroomError

    const classroomIds = classrooms?.map(classroom => classroom.id) || []
    if (classroomIds.length > 0) {
      const { data: activities, error: activitiesError } = await supabaseAdmin
        .from('activities')
        .select('id')
        .in('classroom_id', classroomIds)
      if (activitiesError) throw activitiesError

      const activityIds = activities?.map(activity => activity.id) || []
      if (activityIds.length > 0) {
        const { data: rubrics, error: rubricsError } = await supabaseAdmin
          .from('rubrics')
          .select('id')
          .in('activity_id', activityIds)
        if (rubricsError) throw rubricsError

        const rubricIds = rubrics?.map(rubric => rubric.id) || []
        if (rubricIds.length > 0) {
          const { error: rubricLevelsError } = await supabaseAdmin
            .from('rubric_levels')
            .delete()
            .in('rubric_id', rubricIds)
          if (rubricLevelsError) throw rubricLevelsError

          const { error: rubricCriteriaError } = await supabaseAdmin
            .from('rubric_criteria')
            .delete()
            .in('rubric_id', rubricIds)
          if (rubricCriteriaError) throw rubricCriteriaError

          const { error: rubricsDeleteError } = await supabaseAdmin
            .from('rubrics')
            .delete()
            .in('id', rubricIds)
          if (rubricsDeleteError) throw rubricsDeleteError
        }

        const activityChildTables = ['peer_evaluations', 'self_assessments', 'submissions', 'activity_grades']
        for (const table of activityChildTables) {
          const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .in('activity_id', activityIds)
          if (error) throw error
        }

        const { error: activitiesDeleteError } = await supabaseAdmin
          .from('activities')
          .delete()
          .in('id', activityIds)
        if (activitiesDeleteError) throw activitiesDeleteError
      }

      const classroomChildTables = ['recoveries', 'classroom_students']
      for (const table of classroomChildTables) {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .in('classroom_id', classroomIds)
        if (error) throw error
      }

      const { error: classroomDeleteError } = await supabaseAdmin
        .from('classrooms')
        .delete()
        .in('id', classroomIds)
      if (classroomDeleteError) throw classroomDeleteError
    }

    const { error: sectionStudentsDeleteError } = await supabaseAdmin
      .from('section_students')
      .delete()
      .eq('section_id', sectionId)
    if (sectionStudentsDeleteError) throw sectionStudentsDeleteError

    const { error: sectionDeleteError } = await supabaseAdmin
      .from('sections')
      .delete()
      .eq('id', sectionId)
      .eq('institution_id', institution_id)

    if (sectionDeleteError) throw sectionDeleteError
    res.json({ success: true, deletedClassrooms: classroomIds.length })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

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
