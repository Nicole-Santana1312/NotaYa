import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import ProfilePanel from '../../components/ProfilePanel'
import {
  GraduationCap, LogOut, Users, BookOpen,
  Plus, X, Eye, EyeOff, Check, Pencil, Trash2,
  Printer, FileText, ChevronDown, UserCircle
} from 'lucide-react'

const CoordinatorDashboard = () => {
  const { profile, signOut } = useAuth()
  const isAcademic = profile?.role === 'coordinator_academic'

  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [stats, setStats] = useState({ teachers: 0, subjects: 0 })
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [activeView, setActiveView] = useState('dashboard')

  // Modales
  const [showModal, setShowModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false)
  const [showDeleteTeacherModal, setShowDeleteTeacherModal] = useState(false)
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false)
  const [showDeleteSubjectModal, setShowDeleteSubjectModal] = useState(false)

  // Modal detalle profesor
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTeacher, setDetailTeacher] = useState(null)
  const [detailSubjects, setDetailSubjects] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ── REPORTE DE NOTAS ────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false)
  const [sections, setSections] = useState([])
  const [reportSection, setReportSection] = useState('')
  const [reportPeriod, setReportPeriod] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)

  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', password: '', subjectId: '' })
  const [editTeacherForm, setEditTeacherForm] = useState({ fullName: '', email: '', password: '', subjectId: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '' })
  const [competencies, setCompetencies] = useState([])
  const [showCompetencyModal, setShowCompetencyModal] = useState(false)
  const [showEditCompetencyModal, setShowEditCompetencyModal] = useState(false)
  const [showDeleteCompetencyModal, setShowDeleteCompetencyModal] = useState(false)
  const [competencyForm, setCompetencyForm] = useState({ name: '', description: '', type: 'general', subject_id: '' })
  const [editCompetencyForm, setEditCompetencyForm] = useState({ name: '', description: '', type: 'general', subject_id: '' })
  const [selectedCompetency, setSelectedCompetency] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: teacherData } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false })

      const { data: subjectData } = await supabase
        .from('subjects')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('type', isAcademic ? 'academic' : 'workshop')
        .order('name', { ascending: true })

      const { data: sectionData } = await supabase
        .from('sections')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .order('name', { ascending: true })

      const { data: competencyData } = await supabase
        .from('competencies')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .order('name', { ascending: true })

      setTeachers(teacherData || [])
      setSubjects(subjectData || [])
      setSections(sectionData || [])
      setCompetencies(competencyData || [])
      setStats({ teachers: teacherData?.length || 0, subjects: subjectData?.length || 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // ── REPORTE DE NOTAS ────────────────────────────────────

  const openReportModal = () => {
    setReportSection('')
    setReportPeriod('')
    setReportData(null)
    setReportError('')
    setShowReportModal(true)
  }

  const fetchReportData = async () => {
    if (!reportSection || !reportPeriod) {
      setReportError('Selecciona una sección y un período.')
      return
    }
    setReportLoading(true)
    setReportError('')
    try {
      // Obtener estudiantes de la sección
      const { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('student_id, users(id, full_name)')
        .eq('section_id', reportSection)

      if (enrollErr) throw enrollErr

      const students = enrollments?.map(e => e.users).filter(Boolean) || []

      if (students.length === 0) {
        setReportError('No hay estudiantes en esta sección.')
        setReportLoading(false)
        return
      }

      const studentIds = students.map(s => s.id)

      // Obtener notas del período seleccionado
      const { data: gradesData, error: gradesErr } = await supabase
        .from('grades')
        .select('student_id, subject_id, value, subjects(name)')
        .in('student_id', studentIds)
        .eq('section_id', reportSection)
        .eq('period', reportPeriod)

      if (gradesErr) throw gradesErr

      // Construir mapa de notas por estudiante
      const gradeMap = {}
      const subjectSet = {}

      gradesData?.forEach(g => {
        if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {}
        gradeMap[g.student_id][g.subject_id] = g.value
        if (g.subjects?.name) subjectSet[g.subject_id] = g.subjects.name
      })

      const subjectList = Object.entries(subjectSet).map(([id, name]) => ({ id, name }))

      const sectionInfo = sections.find(s => s.id === reportSection)

      setReportData({
        students,
        subjectList,
        gradeMap,
        sectionName: sectionInfo?.name || 'Sección',
        period: reportPeriod,
        generatedAt: new Date().toLocaleString('es-DO', {
          day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      })
    } catch (err) {
      setReportError(err.message || 'Error al cargar el reporte.')
    } finally {
      setReportLoading(false)
    }
  }

  const getAverage = (studentId) => {
    if (!reportData) return '-'
    const grades = Object.values(reportData.gradeMap[studentId] || {})
    if (grades.length === 0) return '-'
    const avg = grades.reduce((a, b) => a + b, 0) / grades.length
    return avg.toFixed(1)
  }

  const getStatus = (avg) => {
    if (avg === '-') return { label: 'Sin notas', color: '#94A3B8', bg: '#F1F5F9' }
    const n = parseFloat(avg)
    if (n >= 70) return { label: 'Aprobado', color: '#10B981', bg: '#ECFDF5' }
    return { label: 'Reprobado', color: '#EF4444', bg: '#FEF2F2' }
  }

  const handlePrint = () => {
    if (!reportData) return

    const { students, subjectList, gradeMap, sectionName, period, generatedAt } = reportData

    const rows = students.map((student, idx) => {
      const avg = getAverage(student.id)
      const status = getStatus(avg)
      const subjectCells = subjectList.map(sub => {
        const grade = gradeMap[student.id]?.[sub.id]
        const val = grade !== undefined ? grade : '-'
        const color = val === '-' ? '#94A3B8' : val >= 70 ? '#10B981' : '#EF4444'
        return `<td style="padding:10px 14px;text-align:center;font-weight:600;color:${color};border-bottom:1px solid #F1F5F9;">${val}</td>`
      }).join('')

      return `
        <tr style="background:${idx % 2 === 0 ? '#fff' : '#F8FAFC'};">
          <td style="padding:10px 14px;border-bottom:1px solid #F1F5F9;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6C63FF,#4FACFE);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;flex-shrink:0;">
                ${student.full_name?.charAt(0).toUpperCase()}
              </div>
              <span style="font-weight:500;color:#1E293B;font-size:14px;">${student.full_name}</span>
            </div>
          </td>
          ${subjectCells}
          <td style="padding:10px 14px;text-align:center;font-weight:700;color:#1E293B;border-bottom:1px solid #F1F5F9;font-size:15px;">${avg}</td>
          <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #F1F5F9;">
            <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${status.bg};color:${status.color};">${status.label}</span>
          </td>
        </tr>`
    }).join('')

    const subjectHeaders = subjectList.map(sub =>
      `<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#6C63FF;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;">${sub.name}</th>`
    ).join('')

    const approved = students.filter(s => {
      const avg = getAverage(s.id)
      return avg !== '-' && parseFloat(avg) >= 70
    }).length
    const failed = students.length - approved

    const printContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte de Notas - ${sectionName} - ${period}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1E293B; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div style="max-width:900px;margin:0 auto;padding:40px 32px;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #6C63FF;">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6C63FF,#4FACFE);display:flex;align-items:center;justify-content:center;">
            <svg width="22" height="22" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <span style="font-size:22px;font-weight:800;color:#1E293B;letter-spacing:-0.5px;">NotaYa</span>
        </div>
        <h1 style="font-size:26px;font-weight:800;color:#1E293B;letter-spacing:-0.5px;margin-bottom:4px;">Reporte de Calificaciones</h1>
        <p style="font-size:14px;color:#64748B;">Generado el ${generatedAt}</p>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;padding:8px 18px;background:linear-gradient(135deg,#6C63FF,#4FACFE);border-radius:12px;margin-bottom:8px;">
          <span style="font-size:14px;font-weight:700;color:#fff;">Período: ${period}</span>
        </div>
        <br/>
        <div style="display:inline-block;padding:6px 14px;background:#EEF2FF;border-radius:10px;border:1px solid #C7D2FE;">
          <span style="font-size:13px;font-weight:600;color:#6C63FF;">Sección: ${sectionName}</span>
        </div>
      </div>
    </div>

    <!-- Resumen -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px;">
      <div style="background:#F8FAFC;border-radius:14px;padding:18px;border:1px solid #E2E8F0;text-align:center;">
        <p style="font-size:28px;font-weight:800;color:#6C63FF;margin:0 0 4px;">${students.length}</p>
        <p style="font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Estudiantes</p>
      </div>
      <div style="background:#ECFDF5;border-radius:14px;padding:18px;border:1px solid #A7F3D0;text-align:center;">
        <p style="font-size:28px;font-weight:800;color:#10B981;margin:0 0 4px;">${approved}</p>
        <p style="font-size:12px;font-weight:600;color:#6EE7B7;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Aprobados</p>
      </div>
      <div style="background:#FEF2F2;border-radius:14px;padding:18px;border:1px solid #FECACA;text-align:center;">
        <p style="font-size:28px;font-weight:800;color:#EF4444;margin:0 0 4px;">${failed}</p>
        <p style="font-size:12px;font-weight:600;color:#FCA5A5;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Reprobados</p>
      </div>
    </div>

    <!-- Tabla -->
    <div style="border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:linear-gradient(135deg,#6C63FF,#4FACFE);">
            <th style="padding:14px 14px;text-align:left;font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.5px;text-transform:uppercase;">Estudiante</th>
            ${subjectHeaders}
            <th style="padding:14px 14px;text-align:center;font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.5px;text-transform:uppercase;">Promedio</th>
            <th style="padding:14px 14px;text-align:center;font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.5px;text-transform:uppercase;">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;">
      <p style="font-size:12px;color:#CBD5E1;margin:0;">NotaYa · Sistema de Gestión de Calificaciones</p>
      <p style="font-size:12px;color:#CBD5E1;margin:0;">Firma del coordinador: ________________________</p>
    </div>

  </div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(printContent)
    win.document.close()
  }

  // ── DETALLE PROFESOR ────────────────────────────────────

  const handlePrintIndividualReports = () => {
    if (!reportData) return

    const { students, subjectList, gradeMap, sectionName, period, generatedAt } = reportData
    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const studentPages = students.map(student => {
      const avg = getAverage(student.id)
      const status = getStatus(avg)
      const gradeRows = subjectList.map(subject => {
        const grade = gradeMap[student.id]?.[subject.id]
        const value = grade !== undefined ? grade : '-'
        const color = value === '-' ? '#94A3B8' : value >= 70 ? '#10B981' : '#EF4444'

        return `
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#1E293B;font-weight:600;">${escapeHtml(subject.name)}</td>
            <td style="padding:14px 18px;border-bottom:1px solid #F1F5F9;text-align:center;font-size:16px;font-weight:800;color:${color};">${escapeHtml(value)}</td>
          </tr>`
      }).join('')

      return `
        <section class="student-report">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:22px;border-bottom:3px solid #6C63FF;">
            <div>
              <p style="font-size:13px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;margin:0 0 8px;">Reporte individual de calificaciones</p>
              <h1 style="font-size:30px;font-weight:800;color:#1E293B;margin:0 0 6px;">${escapeHtml(student.full_name)}</h1>
              <p style="font-size:14px;color:#64748B;margin:0;">NotaYa - Generado el ${escapeHtml(generatedAt)}</p>
            </div>
            <div style="text-align:right;">
              <div style="display:inline-block;padding:8px 18px;background:linear-gradient(135deg,#6C63FF,#4FACFE);border-radius:12px;margin-bottom:8px;">
                <span style="font-size:14px;font-weight:700;color:#fff;">Periodo: ${escapeHtml(period)}</span>
              </div>
              <br/>
              <div style="display:inline-block;padding:6px 14px;background:#EEF2FF;border-radius:10px;border:1px solid #C7D2FE;">
                <span style="font-size:13px;font-weight:700;color:#6C63FF;">Seccion: ${escapeHtml(sectionName)}</span>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;">
            <div style="background:#F8FAFC;border-radius:14px;padding:18px;border:1px solid #E2E8F0;text-align:center;">
              <p style="font-size:28px;font-weight:800;color:#1E293B;margin:0 0 4px;">${escapeHtml(avg)}</p>
              <p style="font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Promedio</p>
            </div>
            <div style="background:${status.bg};border-radius:14px;padding:18px;border:1px solid ${status.color};text-align:center;">
              <p style="font-size:22px;font-weight:800;color:${status.color};margin:0 0 6px;">${escapeHtml(status.label)}</p>
              <p style="font-size:12px;font-weight:700;color:${status.color};text-transform:uppercase;letter-spacing:0.5px;margin:0;">Estado</p>
            </div>
            <div style="background:#EEF2FF;border-radius:14px;padding:18px;border:1px solid #C7D2FE;text-align:center;">
              <p style="font-size:22px;font-weight:800;color:#6C63FF;margin:0 0 6px;">${subjectList.length}</p>
              <p style="font-size:12px;font-weight:700;color:#6C63FF;text-transform:uppercase;letter-spacing:0.5px;margin:0;">Materias</p>
            </div>
          </div>

          <div style="border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:linear-gradient(135deg,#6C63FF,#4FACFE);">
                  <th style="padding:14px 18px;text-align:left;font-size:12px;font-weight:800;color:rgba(255,255,255,0.92);letter-spacing:0.5px;text-transform:uppercase;">Materia</th>
                  <th style="padding:14px 18px;text-align:center;font-size:12px;font-weight:800;color:rgba(255,255,255,0.92);letter-spacing:0.5px;text-transform:uppercase;width:160px;">Calificacion</th>
                </tr>
              </thead>
              <tbody>${gradeRows || '<tr><td colspan="2" style="padding:24px;text-align:center;color:#94A3B8;font-size:14px;">No hay calificaciones registradas para este periodo.</td></tr>'}</tbody>
            </table>
          </div>

          <div style="margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end;color:#CBD5E1;font-size:12px;">
            <p style="margin:0;">NotaYa - Sistema de Gestion de Calificaciones</p>
            <p style="margin:0;">Firma del coordinador: ________________________</p>
          </div>
        </section>`
    }).join('')

    const printContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reportes Individuales - ${escapeHtml(sectionName)} - ${escapeHtml(period)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1E293B; }
    .student-report { max-width: 900px; min-height: 100vh; margin: 0 auto; padding: 40px 32px; page-break-after: always; break-after: page; }
    .student-report:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      @page { size: A4; margin: 10mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .student-report { min-height: auto; padding: 0; }
    }
  </style>
</head>
<body>
  ${studentPages}
  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(printContent)
    win.document.close()
  }

  const openDetailModal = async (teacher) => {
    setDetailTeacher(teacher)
    setDetailSubjects([])
    setDetailLoading(true)
    setShowDetailModal(true)
    try {
      const { data: ts } = await supabase
        .from('teacher_subjects')
        .select('subject_id, subjects(id, name, type)')
        .eq('teacher_id', teacher.id)

      setDetailSubjects(ts?.map(t => t.subjects).filter(Boolean) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── PROFESORES ──────────────────────────────────────────

  const handleCreateTeacher = async () => {
    if (!teacherForm.fullName || !teacherForm.email || !teacherForm.password) {
      setFormError('Por favor completa todos los campos.')
      return
    }
    if (isAcademic && !teacherForm.subjectId) {
      setFormError('Selecciona una materia para el profesor.')
      return
    }
    if (teacherForm.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const res = await fetch('http://localhost:3001/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: teacherForm.email,
          password: teacherForm.password,
          full_name: teacherForm.fullName,
          role: 'teacher',
          institution_id: profile.institution_id,
          created_by: profile.id,
          subject_id: isAcademic ? teacherForm.subjectId : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ocurrió un error.')
      showSuccess('Profesor creado exitosamente.')
      setShowModal(false)
      setTeacherForm({ fullName: '', email: '', password: '', subjectId: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setEditTeacherForm({ fullName: teacher.full_name, email: teacher.email, password: '', subjectId: '' })
    setFormError('')
    setShowEditPassword(false)
    setShowEditTeacherModal(true)
  }

  const handleEditTeacher = async () => {
    if (!editTeacherForm.fullName || !editTeacherForm.email) {
      setFormError('Nombre y correo son obligatorios.')
      return
    }
    if (editTeacherForm.password && editTeacherForm.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: editTeacherForm.fullName, email: editTeacherForm.email })
        .eq('id', selectedTeacher.id)
      if (error) throw error

      if (editTeacherForm.password) {
        const res = await fetch('http://localhost:3001/api/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedTeacher.id, password: editTeacherForm.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña.')
      }

      if (isAcademic && editTeacherForm.subjectId) {
        await supabase.from('teacher_subjects').delete().eq('teacher_id', selectedTeacher.id)
        await supabase.from('teacher_subjects').insert({
          teacher_id: selectedTeacher.id,
          subject_id: editTeacherForm.subjectId,
          assigned_by: profile.id,
        })
      }

      showSuccess('Profesor actualizado exitosamente.')
      setShowEditTeacherModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteTeacher = (teacher) => {
    setSelectedTeacher(teacher)
    setShowDeleteTeacherModal(true)
  }

  const handleDeleteTeacher = async () => {
    setFormLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedTeacher.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar.')
      showSuccess('Profesor eliminado.')
      setShowDeleteTeacherModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  // ── MATERIAS ─────────────────────────────────────────────

  const handleCreateSubject = async () => {
    if (!subjectForm.name) {
      setFormError('Escribe el nombre de la materia.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase.from('subjects').insert({
        institution_id: profile.institution_id,
        coordinator_id: profile.id,
        name: subjectForm.name,
        type: isAcademic ? 'academic' : 'workshop',
      })
      if (error) throw error
      showSuccess('Materia creada exitosamente.')
      setShowSubjectModal(false)
      setSubjectForm({ name: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditSubject = (subject) => {
    setSelectedSubject(subject)
    setEditSubjectForm({ name: subject.name })
    setFormError('')
    setShowEditSubjectModal(true)
  }

  const handleEditSubject = async () => {
    if (!editSubjectForm.name) {
      setFormError('El nombre no puede estar vacío.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editSubjectForm.name })
        .eq('id', selectedSubject.id)
      if (error) throw error
      showSuccess('Materia actualizada.')
      setShowEditSubjectModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteSubject = (subject) => {
    setSelectedSubject(subject)
    setShowDeleteSubjectModal(true)
  }

  const handleDeleteSubject = async () => {
    setFormLoading(true)
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', selectedSubject.id)
      if (error) throw error
      showSuccess('Materia eliminada.')
      setShowDeleteSubjectModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  // ── COMPETENCIAS ─────────────────────────────────────────────

  const handleCreateCompetency = async () => {
    if (!competencyForm.name) {
      setFormError('Escribe el nombre de la competencia.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase.from('competencies').insert({
        institution_id: profile.institution_id,
        name: competencyForm.name,
        description: competencyForm.description,
        type: competencyForm.type,
        subject_id: competencyForm.subject_id || null,
      })
      if (error) throw error
      showSuccess('Competencia creada exitosamente.')
      setShowCompetencyModal(false)
      setCompetencyForm({ name: '', description: '', type: 'general', subject_id: '' })
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditCompetency = async () => {
    if (!editCompetencyForm.name) {
      setFormError('El nombre no puede estar vacío.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const { error } = await supabase
        .from('competencies')
        .update({
          name: editCompetencyForm.name,
          description: editCompetencyForm.description,
          type: editCompetencyForm.type,
          subject_id: editCompetencyForm.subject_id || null,
        })
        .eq('id', selectedCompetency.id)
      if (error) throw error
      showSuccess('Competencia actualizada.')
      setShowEditCompetencyModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteCompetency = async () => {
    setFormLoading(true)
    try {
      const { error } = await supabase.from('competencies').delete().eq('id', selectedCompetency.id)
      if (error) throw error
      showSuccess('Competencia eliminada.')
      setShowDeleteCompetencyModal(false)
      fetchData()
    } catch (err) {
      setFormError(err.message || 'Ocurrió un error.')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarIcon}><GraduationCap size={22} color="#fff" /></div>
          <span style={styles.sidebarTitle}>NotaYa</span>
        </div>
        <nav style={styles.nav}>
          <div
            style={{ ...styles.navItem, ...(activeView === 'dashboard' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('dashboard')}
          >
            <Users size={18} /><span>Panel</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'teachers' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('teachers')}
          >
            <Users size={18} /><span>Profesores</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'subjects' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('subjects')}
          >
            <BookOpen size={18} /><span>Materias</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'competencies' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('competencies')}
          >
            <GraduationCap size={18} /><span>Competencias</span>
          </div>
          <div style={{ ...styles.navItem, color: '#6C63FF', backgroundColor: '#EEF2FF', fontWeight: '600' }}
            onClick={openReportModal}>
            <FileText size={18} /><span>Reporte de notas</span>
          </div>
          <div
            style={{ ...styles.navItem, ...(activeView === 'profile' ? styles.navItemActive : {}) }}
            onClick={() => setActiveView('profile')}
          >
            <UserCircle size={18} /><span>Mi perfil</span>
          </div>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{profile?.full_name?.charAt(0).toUpperCase()}</div>
            <div>
              <p style={styles.userName}>{profile?.full_name}</p>
              <p style={styles.userRole}>{isAcademic ? 'Coord. Académico' : 'Coord. de Taller'}</p>
            </div>
          </div>
          <button onClick={signOut} style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {activeView === 'profile' ? (
          <ProfilePanel roleLabel={isAcademic ? 'Coordinador Academico' : 'Coordinador de Taller'} />
        ) : activeView === 'teachers' ? (
          // Teachers view
          <>
            <div style={styles.topBar}>
              <div>
                <h1 style={styles.pageTitle}>Profesores</h1>
                <p style={styles.pageSubtitle}>Gestión de docentes</p>
              </div>
              <button onClick={() => { setShowModal(true); setFormError('') }} style={styles.primaryButton}>
                <Plus size={16} style={{ marginRight: '6px' }} />Nuevo profesor
              </button>
            </div>
            <div style={styles.content}>
              {teachers.map(teacher => (
                <div key={teacher.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{teacher.full_name}</h3>
                    <div style={styles.cardActions}>
                      <button onClick={() => openDetailModal(teacher)} style={styles.iconButton}>
                        <Eye size={16} />
                      </button>
                      <button onClick={() => { setSelectedTeacher(teacher); setEditTeacherForm({ fullName: teacher.full_name, email: teacher.email, password: '', subjectId: teacher.subject_id || '' }); setShowEditTeacherModal(true) }} style={styles.iconButton}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => { setSelectedTeacher(teacher); setShowDeleteTeacherModal(true) }} style={styles.iconButton}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={styles.cardText}>{teacher.email}</p>
                </div>
              ))}
            </div>
          </>
        ) : activeView === 'subjects' ? (
          // Subjects view
          <>
            <div style={styles.topBar}>
              <div>
                <h1 style={styles.pageTitle}>Materias</h1>
                <p style={styles.pageSubtitle}>Gestión de asignaturas</p>
              </div>
              <button onClick={() => { setShowSubjectModal(true); setFormError('') }} style={styles.primaryButton}>
                <Plus size={16} style={{ marginRight: '6px' }} />Nueva materia
              </button>
            </div>
            <div style={styles.content}>
              {subjects.map(subject => (
                <div key={subject.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{subject.name}</h3>
                    <div style={styles.cardActions}>
                      <button onClick={() => { setSelectedSubject(subject); setEditSubjectForm({ name: subject.name }); setShowEditSubjectModal(true) }} style={styles.iconButton}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => { setSelectedSubject(subject); setShowDeleteSubjectModal(true) }} style={styles.iconButton}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={styles.cardText}>Tipo: {subject.type}</p>
                </div>
              ))}
            </div>
          </>
        ) : activeView === 'competencies' ? (
          // Competencies view
          <>
            <div style={styles.topBar}>
              <div>
                <h1 style={styles.pageTitle}>Competencias</h1>
                <p style={styles.pageSubtitle}>Gestión de competencias</p>
              </div>
              <button onClick={() => { setShowCompetencyModal(true); setFormError('') }} style={styles.primaryButton}>
                <Plus size={16} style={{ marginRight: '6px' }} />Nueva competencia
              </button>
            </div>
            <div style={styles.content}>
              {competencies.map(competency => (
                <div key={competency.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{competency.name}</h3>
                    <div style={styles.cardActions}>
                      <button onClick={() => { setSelectedCompetency(competency); setEditCompetencyForm({ name: competency.name, description: competency.description, type: competency.type, subject_id: competency.subject_id || '' }); setShowEditCompetencyModal(true) }} style={styles.iconButton}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => { setSelectedCompetency(competency); setShowDeleteCompetencyModal(true) }} style={styles.iconButton}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={styles.cardText}>{competency.description}</p>
                  <p style={styles.cardText}>Tipo: {competency.type}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Dashboard view
          <>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.pageTitle}>{isAcademic ? 'Coordinación Académica' : 'Coordinación de Taller'}</h1>
            <p style={styles.pageSubtitle}>Bienvenido, {profile?.full_name}</p>
          </div>
          <div style={styles.buttonGroup}>
            <button onClick={openReportModal} style={styles.reportButton}>
              <Printer size={16} style={{ marginRight: '6px' }} />Imprimir reporte
            </button>
            <button onClick={() => { setShowSubjectModal(true); setFormError('') }} style={styles.secondaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} />Nueva materia
            </button>
            <button onClick={() => { setShowModal(true); setFormError('') }} style={styles.primaryButton}>
              <Plus size={16} style={{ marginRight: '6px' }} />Nuevo profesor
            </button>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {[
            { label: 'Profesores', value: stats.teachers, icon: <Users size={20} />, color: '#6C63FF', bg: '#EEF2FF' },
            { label: 'Materias', value: stats.subjects, icon: <BookOpen size={20} />, color: '#10B981', bg: '#ECFDF5' },
          ].map(stat => (
            <div key={stat.label} style={styles.statCard}>
              <div style={{ ...styles.statIcon, backgroundColor: stat.bg, color: stat.color }}>{stat.icon}</div>
              <div>
                <p style={styles.statValue}>{stat.value}</p>
                <p style={styles.statLabel}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {success && (
          <div style={styles.successBox}>
            <Check size={16} style={{ marginRight: '8px' }} />{success}
          </div>
        )}

        {/* Materias */}
        <div style={{ ...styles.section, marginBottom: '24px' }}>
          <h2 style={styles.sectionTitle}>Materias {isAcademic ? 'académicas' : 'de taller'}</h2>
          {subjects.length === 0 ? (
            <div style={styles.emptyState}>
              <BookOpen size={36} color="#CBD5E1" />
              <p style={styles.emptyText}>No hay materias aún.</p>
            </div>
          ) : (
            <div style={styles.subjectGrid}>
              {subjects.map(subject => (
                <div key={subject.id} style={styles.subjectCard}>
                  <div style={styles.subjectIcon}><BookOpen size={16} color="#6C63FF" /></div>
                  <span style={styles.subjectName}>{subject.name}</span>
                  <div style={styles.subjectActions}>
                    <button onClick={() => openEditSubject(subject)} style={styles.editBtn}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => openDeleteSubject(subject)} style={styles.deleteBtn}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profesores */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Profesores</h2>
          {loading ? (
            <p style={styles.emptyText}>Cargando...</p>
          ) : teachers.length === 0 ? (
            <div style={styles.emptyState}>
              <Users size={36} color="#CBD5E1" />
              <p style={styles.emptyText}>No hay profesores aún.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Nombre', 'Correo', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => (
                    <tr key={teacher.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div
                          style={{ ...styles.nameCell, cursor: 'pointer' }}
                          onClick={() => openDetailModal(teacher)}
                        >
                          <div style={styles.tableAvatar}>{teacher.full_name?.charAt(0).toUpperCase()}</div>
                          {teacher.full_name}
                        </div>
                      </td>
                      <td style={styles.td}>{teacher.email}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: teacher.active ? '#ECFDF5' : '#FEF2F2',
                          color: teacher.active ? '#10B981' : '#EF4444',
                        }}>
                          {teacher.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button onClick={() => openEditTeacher(teacher)} style={styles.editBtn}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => openDeleteTeacher(teacher)} style={styles.deleteBtn}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* ── MODAL REPORTE DE NOTAS ── */}
      {showReportModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: reportData ? '760px' : '460px' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={18} color="#fff" />
                </div>
                <h2 style={styles.modalTitle}>Reporte de notas</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <div style={styles.modalBody}>
              {/* Filtros */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Sección</label>
                  <div style={styles.selectWrapper}>
                    <select
                      style={styles.selectInput}
                      value={reportSection}
                      onChange={e => { setReportSection(e.target.value); setReportData(null); setReportError('') }}
                    >
                      <option value="">Selecciona una sección</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={16} style={styles.selectIcon} />
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Período</label>
                  <div style={styles.selectWrapper}>
                    <select
                      style={styles.selectInput}
                      value={reportPeriod}
                      onChange={e => { setReportPeriod(e.target.value); setReportData(null); setReportError('') }}
                    >
                      <option value="">Selecciona un período</option>
                      {['P1', 'P2', 'P3', 'P4'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={16} style={styles.selectIcon} />
                  </div>
                </div>
              </div>

              {reportError && <div style={styles.errorBox}>{reportError}</div>}

              {/* Preview del reporte */}
              {reportData && (
                <div style={{
                  border: '1px solid #E2E8F0', borderRadius: '14px',
                  overflow: 'hidden', marginTop: '4px',
                }}>
                  {/* Cabecera preview */}
                  <div style={{
                    background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
                    padding: '16px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                        Vista previa del reporte
                      </p>
                      <p style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: '700' }}>
                        {reportData.sectionName} · {reportData.period}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {[
                        { label: 'Estudiantes', val: reportData.students.length, color: '#fff' },
                        {
                          label: 'Aprobados',
                          val: reportData.students.filter(s => { const a = getAverage(s.id); return a !== '-' && parseFloat(a) >= 70 }).length,
                          color: '#A7F3D0',
                        },
                        {
                          label: 'Reprobados',
                          val: reportData.students.filter(s => { const a = getAverage(s.id); return a !== '-' && parseFloat(a) < 70 }).length,
                          color: '#FECACA',
                        },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: item.color }}>{item.val}</p>
                          <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabla preview */}
                  <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ backgroundColor: '#F8FAFC' }}>
                          <th style={{ ...styles.th, textAlign: 'left', padding: '10px 16px' }}>Estudiante</th>
                          {reportData.subjectList.map(sub => (
                            <th key={sub.id} style={{ ...styles.th, textAlign: 'center', padding: '10px 12px', whiteSpace: 'nowrap' }}>{sub.name}</th>
                          ))}
                          <th style={{ ...styles.th, textAlign: 'center', padding: '10px 12px' }}>Promedio</th>
                          <th style={{ ...styles.th, textAlign: 'center', padding: '10px 12px' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.students.map((student, idx) => {
                          const avg = getAverage(student.id)
                          const status = getStatus(avg)
                          return (
                            <tr key={student.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ ...styles.td, padding: '10px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: '11px', fontWeight: '700', flexShrink: 0,
                                  }}>
                                    {student.full_name?.charAt(0).toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{student.full_name}</span>
                                </div>
                              </td>
                              {reportData.subjectList.map(sub => {
                                const grade = reportData.gradeMap[student.id]?.[sub.id]
                                const val = grade !== undefined ? grade : '-'
                                const gradeColor = val === '-' ? '#94A3B8' : val >= 70 ? '#10B981' : '#EF4444'
                                return (
                                  <td key={sub.id} style={{ ...styles.td, textAlign: 'center', padding: '10px 12px', fontWeight: '600', color: gradeColor }}>
                                    {val}
                                  </td>
                                )
                              })}
                              <td style={{ ...styles.td, textAlign: 'center', fontWeight: '700', fontSize: '15px', padding: '10px 12px' }}>{avg}</td>
                              <td style={{ ...styles.td, textAlign: 'center', padding: '10px 12px' }}>
                                <span style={{
                                  padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                                  backgroundColor: status.bg, color: status.color,
                                }}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowReportModal(false)} style={styles.cancelBtn}>Cancelar</button>
              {!reportData ? (
                <button
                  onClick={fetchReportData}
                  disabled={reportLoading}
                  style={{ ...styles.primaryButton, opacity: reportLoading ? 0.7 : 1 }}
                >
                  {reportLoading ? 'Cargando...' : 'Generar reporte'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handlePrint} style={styles.secondaryButton}>
                    <Printer size={16} style={{ marginRight: '6px' }} />Reporte grupal
                  </button>
                  <button onClick={handlePrintIndividualReports} style={styles.printButton}>
                    <Printer size={16} style={{ marginRight: '6px' }} />Reportes individuales
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle profesor */}
      {showDetailModal && detailTeacher && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6C63FF, #4FACFE)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '16px', fontWeight: '600', flexShrink: 0,
                }}>
                  {detailTeacher.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>
                    {detailTeacher.full_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                    {detailTeacher.email}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: '600', padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: detailTeacher.active ? '#ECFDF5' : '#FEF2F2',
                  color: detailTeacher.active ? '#065F46' : '#991B1B',
                }}>
                  {detailTeacher.active ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => setShowDetailModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={styles.modalBody}>
              <p style={{
                margin: '0 0 12px', fontSize: '11px', fontWeight: '600',
                color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Materias que imparte
              </p>

              {detailLoading ? (
                <p style={styles.emptyText}>Cargando...</p>
              ) : detailSubjects.length === 0 ? (
                <div style={{
                  padding: '20px', borderRadius: '12px',
                  border: '1.5px dashed #E2E8F0', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                    Sin materias asignadas aún.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {detailSubjects.map(subject => {
                    const isAcademicSubject = subject.type === 'academic'
                    return (
                      <div key={subject.id} style={{
                        border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden',
                      }}>
                        <div style={{
                          padding: '12px 16px', backgroundColor: '#F8FAFC',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              backgroundColor: isAcademicSubject ? '#6C63FF' : '#F97316',
                            }} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                              {subject.name}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: '600', padding: '3px 8px',
                            borderRadius: '20px',
                            backgroundColor: isAcademicSubject ? '#EEF2FF' : '#FFF7ED',
                            color: isAcademicSubject ? '#3C3489' : '#9A3412',
                          }}>
                            {isAcademicSubject ? 'Académica' : 'Taller'}
                          </span>
                        </div>
                        <div style={{
                          padding: '10px 16px', borderTop: '1px solid #F1F5F9',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="#94A3B8" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                            Secciones pendientes de configurar
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setShowDetailModal(false)} style={styles.cancelBtn}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear profesor */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nuevo profesor</h2>
              <button onClick={() => setShowModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} placeholder="Ej: Ana Martínez" value={teacherForm.fullName}
                  onChange={e => { setTeacherForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" placeholder="correo@institución.edu" value={teacherForm.email}
                  onChange={e => { setTeacherForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Contraseña temporal</label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={teacherForm.password}
                    onChange={e => { setTeacherForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              {isAcademic && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Materia asignada</label>
                  {subjects.length === 0 ? (
                    <p style={styles.warningText}>No hay materias. Crea una materia primero.</p>
                  ) : (
                    <select style={styles.input} value={teacherForm.subjectId}
                      onChange={e => setTeacherForm(p => ({ ...p, subjectId: e.target.value }))}>
                      <option value="">Selecciona una materia</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear profesor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar profesor */}
      {showEditTeacherModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar profesor</h2>
              <button onClick={() => setShowEditTeacherModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre completo</label>
                <input style={styles.input} value={editTeacherForm.fullName}
                  onChange={e => { setEditTeacherForm(p => ({ ...p, fullName: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo electrónico</label>
                <input style={styles.input} type="email" value={editTeacherForm.email}
                  onChange={e => { setEditTeacherForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nueva contraseña <span style={{ color: '#94A3B8', fontWeight: 400 }}>(dejar vacío para no cambiar)</span></label>
                <div style={styles.passwordWrapper}>
                  <input style={{ ...styles.input, paddingRight: '44px' }}
                    type={showEditPassword ? 'text' : 'password'} placeholder="Nueva contraseña" value={editTeacherForm.password}
                    onChange={e => { setEditTeacherForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
                    onFocus={e => e.target.style.borderColor = '#6C63FF'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} style={styles.eyeButton}>
                    {showEditPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
                  </button>
                </div>
              </div>
              {isAcademic && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Cambiar materia <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></label>
                  <select style={styles.input} value={editTeacherForm.subjectId}
                    onChange={e => setEditTeacherForm(p => ({ ...p, subjectId: e.target.value }))}>
                    <option value="">Sin cambio</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditTeacherModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar profesor */}
      {showDeleteTeacherModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '380px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar profesor</h2>
              <button onClick={() => setShowDeleteTeacherModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar a <strong>{selectedTeacher?.full_name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteTeacherModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteTeacher} disabled={formLoading}
                style={{ ...styles.primaryButton, background: '#EF4444', boxShadow: 'none', opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear materia */}
      {showSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva materia</h2>
              <button onClick={() => setShowSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la materia</label>
                <input style={styles.input} placeholder={isAcademic ? 'Ej: Matemáticas' : 'Ej: Electricidad'}
                  value={subjectForm.name}
                  onChange={e => { setSubjectForm({ name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear materia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar materia */}
      {showEditSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar materia</h2>
              <button onClick={() => setShowEditSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre de la materia</label>
                <input style={styles.input} value={editSubjectForm.name}
                  onChange={e => { setEditSubjectForm({ name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar materia */}
      {showDeleteSubjectModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '380px' }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar materia</h2>
              <button onClick={() => setShowDeleteSubjectModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar <strong>{selectedSubject?.name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteSubjectModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteSubject} disabled={formLoading}
                style={{ ...styles.primaryButton, background: '#EF4444', boxShadow: 'none', opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear competencia */}
      {showCompetencyModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nueva competencia</h2>
              <button onClick={() => setShowCompetencyModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre</label>
                <input style={styles.input} value={competencyForm.name}
                  onChange={e => { setCompetencyForm({ ...competencyForm, name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción</label>
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }} value={competencyForm.description}
                  onChange={e => { setCompetencyForm({ ...competencyForm, description: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo</label>
                <div style={styles.selectWrapper}>
                  <select style={styles.selectInput} value={competencyForm.type}
                    onChange={e => setCompetencyForm({ ...competencyForm, type: e.target.value })}>
                    <option value="general">General</option>
                    <option value="specific">Específica</option>
                  </select>
                  <ChevronDown size={16} style={styles.selectIcon} />
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Materia (opcional)</label>
                <div style={styles.selectWrapper}>
                  <select style={styles.selectInput} value={competencyForm.subject_id}
                    onChange={e => setCompetencyForm({ ...competencyForm, subject_id: e.target.value })}>
                    <option value="">Ninguna</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} style={styles.selectIcon} />
                </div>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowCompetencyModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleCreateCompetency} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Creando...' : 'Crear competencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar competencia */}
      {showEditCompetencyModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Editar competencia</h2>
              <button onClick={() => setShowEditCompetencyModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre</label>
                <input style={styles.input} value={editCompetencyForm.name}
                  onChange={e => { setEditCompetencyForm({ ...editCompetencyForm, name: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción</label>
                <textarea style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }} value={editCompetencyForm.description}
                  onChange={e => { setEditCompetencyForm({ ...editCompetencyForm, description: e.target.value }); setFormError('') }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo</label>
                <div style={styles.selectWrapper}>
                  <select style={styles.selectInput} value={editCompetencyForm.type}
                    onChange={e => setEditCompetencyForm({ ...editCompetencyForm, type: e.target.value })}>
                    <option value="general">General</option>
                    <option value="specific">Específica</option>
                  </select>
                  <ChevronDown size={16} style={styles.selectIcon} />
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Materia (opcional)</label>
                <div style={styles.selectWrapper}>
                  <select style={styles.selectInput} value={editCompetencyForm.subject_id}
                    onChange={e => setEditCompetencyForm({ ...editCompetencyForm, subject_id: e.target.value })}>
                    <option value="">Ninguna</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} style={styles.selectIcon} />
                </div>
              </div>
              {formError && <div style={styles.errorBox}>{formError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditCompetencyModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleEditCompetency} disabled={formLoading}
                style={{ ...styles.primaryButton, opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar competencia */}
      {showDeleteCompetencyModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Eliminar competencia</h2>
              <button onClick={() => setShowDeleteCompetencyModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
                ¿Estás seguro de que quieres eliminar <strong>{selectedCompetency?.name}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowDeleteCompetencyModal(false)} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleDeleteCompetency} disabled={formLoading}
                style={{ ...styles.primaryButton, background: '#EF4444', boxShadow: 'none', opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Inter', 'Segoe UI', sans-serif" },
  sidebar: { width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 20px', borderBottom: '1px solid #E2E8F0' },
  sidebarIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { fontSize: '18px', fontWeight: '700', color: '#1E293B', letterSpacing: '-0.5px' },
  nav: { padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '14px', color: '#64748B', cursor: 'pointer' },
  navItemActive: { backgroundColor: '#EEF2FF', color: '#6C63FF', fontWeight: '600' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '600' },
  userName: { fontSize: '13px', fontWeight: '600', color: '#1E293B', margin: 0 },
  userRole: { fontSize: '11px', color: '#94A3B8', margin: 0 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px' },
  main: { marginLeft: '240px', flex: 1, padding: '32px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' },
  pageSubtitle: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  buttonGroup: { display: 'flex', gap: '12px' },
  primaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  secondaryButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  reportButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #C7D2FE', background: '#EEF2FF', color: '#6C63FF', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  printButton: { display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '32px' },
  statCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 2px' },
  statLabel: { fontSize: '13px', color: '#94A3B8', margin: 0 },
  successBox: { display: 'flex', alignItems: 'center', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', marginBottom: '20px' },
  section: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '8px' },
  emptyText: { fontSize: '14px', color: '#94A3B8', margin: 0 },
  subjectGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  subjectCard: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' },
  subjectIcon: { display: 'flex', alignItems: 'center' },
  subjectName: { fontSize: '13px', fontWeight: '600', color: '#6C63FF' },
  subjectActions: { display: 'flex', gap: '4px', marginLeft: '4px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94A3B8', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', letterSpacing: '0.5px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#475569' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '500', color: '#1E293B' },
  tableAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6C63FF, #4FACFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '600' },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#EEF2FF', color: '#6C63FF', cursor: 'pointer' },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', border: 'none', backgroundColor: '#FEF2F2', color: '#EF4444', cursor: 'pointer' },
  content: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  cardActions: { display: 'flex', gap: '8px' },
  cardText: { fontSize: '14px', color: '#64748B', margin: '4px 0' },
  iconButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#F8FAFC', color: '#64748B' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { backgroundColor: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: '4px', borderRadius: '8px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #F1F5F9' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC' },
  selectWrapper: { position: 'relative' },
  selectInput: { padding: '11px 14px', paddingRight: '36px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#1E293B', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: '#F8FAFC', appearance: 'none', cursor: 'pointer' },
  selectIcon: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' },
  passwordWrapper: { position: 'relative' },
  eyeButton: { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  warningText: { fontSize: '13px', color: '#F97316', margin: 0, padding: '10px 14px', backgroundColor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA' },
  errorBox: { backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' },
  cancelBtn: { padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
}

export default CoordinatorDashboard
