Descripción del Proyecto 
NotaYa es un SaaS multi-institución de gestión de evaluaciones y calificaciones diseñado para instituciones educativas. Soporta dos modalidades de evaluación: académica (por períodos P1P4) y taller (por Resultados de Aprendizaje). Cada institución registrada tiene su propio espacio completamente aislado con control de acceso por roles. 
 
Tecnologías Utilizadas 
Capa 	Tecnología 	Versión 
Frontend 	React + Vite 	19 / 8 
Backend 	Node.js + Express 	18+ / 5 
Base de datos 	Supabase (PostgreSQL) 	15+ 
Autenticación 	Supabase Auth 	Incluida 
Estilos 	CSS-in-JS (inline styles) 	- 
Enrutamiento 	React Router DOM 	v7 
Iconos 	Lucide React 	Latest 
 
Requisitos del Sistema 
•	Node.js v18 o superior 
•	npm v9 o superior 
•	Cuenta en Supabase (supabase.com) 
•	Navegador moderno (Chrome, Firefox, Edge) 
 
Instalación del Proyecto 
1. Clonar el repositorio 
https://github.com/Nicole-Santana1312/NotaYa.git 

cd notaya && npm install 
 
2. Configurar variables de entorno (.env) 
Crear archivo .env en la raíz del proyecto: 
VITE_SUPABASE_URL=https://mubizzwnskpgdksqbqgi.supabase.co/rest/v1/
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11Yml6enduc2twZ2Rrc3FicWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTI4NjgsImV4cCI6MjA5MTI2ODg2OH0.F2fAPkiv2C8kKICmn4Lx0dlGS7UU8zkMCUdn0OlJMdQ
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key 
Las keys se encuentran en: Supabase → Settings → API 
 
3. Configurar la base de datos 
1.	Ir a Supabase → SQL Editor 
2.	Copiar y pegar el contenido del archivo database/schema.sql 
3.	Ejecutar el script completo 
 
Ejecución del Proyecto 
El proyecto requiere dos terminales simultáneas: 
 
Terminal 1 — Frontend 
npm run dev    →  http://localhost:5173 
Terminal 2 — Backend 
npm run server →  http://localhost:3001 
 
Estructura del Proyecto 
notaya/ ├── src/ 
│   ├── context/AuthContext.jsx 
│   ├── lib/supabase.js 
│   ├── navigation/AppRouter.jsx 
│   └── screens/ 
│       ├── auth/ (LoginScreen, RegisterScreen) │       ├── director/ (DirectorDashboard) 
│       ├── coordinator/ (CoordinatorDashboard) 
│       ├── teacher/ (TeacherDashboard, ClassroomView) 
│       ├── student/ (StudentDashboard, StudentClassroomView) 
│       └── tutor/ (TutorDashboard) 
├── database/schema.sql 
├── server.js ├── .env 
└── package.json 
 
Roles y Accesos 
Rol 	URL 	Cómo se crea 
Director 	/director 	Se registra en /register 
Coordinador 	/coordinator 	Lo crea el Director 
Profesor 	/teacher 	Lo crea el Coordinador 
Rol 	URL 	Cómo se crea 
Estudiante 	/student 	Lo crea el Profesor 
Tutor 	/tutor 	Lo agrega el Estudiante 
 
Flujo del Sistema 
4.	Director se registra con su institución 
5.	Director crea Coordinadores (académico y/o taller) 
6.	Coordinadores crean Profesores y Materias 
7.	Profesores crean Aulas (materia + sección + período) 
8.	Profesores agregan Estudiantes a las aulas 
9.	Profesores crean Actividades y colocan Notas 
10.	Estudiantes ven su progreso y agregan Tutores 
11.	Tutores monitorean el avance de sus hijos (solo lectura) 
 
API del Backend 
Método 	Ruta 	Descripción 
POST 	/api/create-user 	Crea coordinador, profesor o estudiante 
POST 	/api/update-password 	Actualiza contraseña de un usuario 
POST 	/api/delete-user 	Elimina usuario de auth y de la BD 
POST 	/api/create-tutor 	Crea tutor y lo vincula al estudiante 
POST 	/api/delete-tutor 	Desvincula tutor del estudiante 
GET 	/api/student/classrooms/:id 	Aulas del estudiante 
GET 	/api/student/grades/:id/:cid 	Notas por aula 
GET 	/api/tutor/students/:id 	Estudiantes del tutor 
GET 	/api/tutor/classrooms/:id 	Aulas del hijo vinculado 
 
Autores 
Rol 	Nombre 
Desarrollador 	Xiomara Santana 
Administrador de Proyecto 	Rijo 
 
