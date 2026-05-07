-- NOTAYA - SCRIPT COMPLETO DE BASE DE DATOS 
-- Versión: 1.0 | Fecha: Abril 2026 -- 1. EXTENSIONES 
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- 2. TABLAS BASE 


CREATE TABLE IF NOT EXISTS institutions ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
name            TEXT NOT NULL, 
code            TEXT NOT NULL UNIQUE, 
country         TEXT NOT NULL, 
email           TEXT NOT NULL UNIQUE, 
plan            TEXT NOT NULL DEFAULT 'basic', 
active          BOOLEAN NOT NULL DEFAULT TRUE, 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
CONSTRAINT valid_plan CHECK (plan IN ('basic', 'pro', 'enterprise')) 
); 

CREATE TABLE IF NOT EXISTS users ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE, 
email           TEXT NOT NULL UNIQUE, 
full_name       TEXT NOT NULL, 
role            TEXT NOT NULL, 
active          BOOLEAN NOT NULL DEFAULT TRUE, 
created_by      UUID REFERENCES users(id), 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
CONSTRAINT valid_role CHECK (role IN ( 
'director', 'coordinator_academic', 'coordinator_workshop', 
'teacher', 'student', 'tutor' 
)) 
); 

2. TABLAS BASE 

CREATE TABLE IF NOT EXISTS academic_periods ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE, 
name            TEXT NOT NULL, 
start_date      DATE NOT NULL, 
end_date        DATE NOT NULL, 
is_active       BOOLEAN NOT NULL DEFAULT FALSE, 
is_closed       BOOLEAN NOT NULL DEFAULT FALSE, 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() 
); 

CREATE TABLE IF NOT EXISTS sections ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE, 
name            TEXT NOT NULL, 
level           TEXT, 
created_by      UUID REFERENCES users(id), 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
UNIQUE(institution_id, name) 
); 


CREATE TABLE IF NOT EXISTS subjects ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE, 
coordinator_id  UUID REFERENCES users(id), 
name            TEXT NOT NULL, 
type            TEXT NOT NULL, 
CONSTRAINT valid_type CHECK (type IN ('academic', 'workshop')) 
); 

 3. TABLAS INTERMEDIAS

 CREATE TABLE IF NOT EXISTS teacher_subjects ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, 
assigned_by     UUID REFERENCES users(id), 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
UNIQUE(teacher_id, subject_id) 
); 
CREATE TABLE IF NOT EXISTS classrooms ( 
id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
teacher_subject_id  UUID NOT NULL REFERENCES teacher_subjects(id) ON DELETE CASCADE, 
section_id          UUID NOT NULL REFERENCES sections(id), 
period_id           UUID NOT NULL REFERENCES academic_periods(id), 
is_active           BOOLEAN NOT NULL DEFAULT TRUE, 
created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
UNIQUE(teacher_subject_id, section_id, period_id) 
); 
CREATE TABLE IF NOT EXISTS classroom_students ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, 
student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
UNIQUE(classroom_id, student_id) 
); 
CREATE TABLE IF NOT EXISTS student_tutors ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
tutor_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
UNIQUE(student_id, tutor_id) 
);

4. TABLAS DE EVALUACION 

CREATE TABLE IF NOT EXISTS learning_outcomes ( 
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, 
code            TEXT NOT NULL, 
description     TEXT NOT NULL, 
weight          INTEGER NOT NULL, 
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
CONSTRAINT positive_weight CHECK (weight > 0 AND weight <= 100) 
); 
 
CREATE TABLE IF NOT EXISTS activities ( 
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
  classroom_id          UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, 
  learning_outcome_id   UUID REFERENCES learning_outcomes(id), 
  name                  TEXT NOT NULL, 
  description           TEXT, 
  type                  TEXT NOT NULL, 
  max_score             NUMERIC(5,2) NOT NULL, 
  due_date              DATE, 
  period_index          INTEGER, 
  allow_resubmit        BOOLEAN NOT NULL DEFAULT FALSE, 
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  CONSTRAINT valid_activity_type CHECK (type IN ( 
    'exam', 'homework', 'notebook', 'project', 'practice', 'other' 
  )), 
  CONSTRAINT positive_score CHECK (max_score > 0) 
); 
 
CREATE TABLE IF NOT EXISTS activity_grades ( 
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
  activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE, 
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
  score           NUMERIC(5,2), 
  status          TEXT NOT NULL DEFAULT 'pending', 
  teacher_comment TEXT, 
  graded_at       TIMESTAMPTZ, 
  updated_at      TIMESTAMPTZ, 
  UNIQUE(activity_id, student_id), 
  CONSTRAINT valid_status CHECK (status IN ('pending', 'graded', 'excused')) 
); 
 
CREATE TABLE IF NOT EXISTS recoveries ( 
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
  classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, 
  attempt_number  INTEGER NOT NULL, 
  description     TEXT, 
  score           NUMERIC(5,2), 
  passed          BOOLEAN, 
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  graded_at       TIMESTAMPTZ, 
  UNIQUE(student_id, classroom_id, attempt_number), 
  CONSTRAINT valid_attempt CHECK (attempt_number IN (1, 2)), 
  CONSTRAINT max_recovery_score CHECK (score IS NULL OR score <= 70) 
); 
 
CREATE TABLE IF NOT EXISTS competencies (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
name            TEXT NOT NULL,
description     TEXT,
type            TEXT NOT NULL, -- 'general' or 'specific'
subject_id      UUID REFERENCES subjects(id) ON DELETE CASCADE,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT valid_competency_type CHECK (type IN ('general', 'specific'))
);

CREATE TABLE IF NOT EXISTS performance_indicators (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
learning_outcome_id UUID NOT NULL REFERENCES learning_outcomes(id) ON DELETE CASCADE,
description     TEXT NOT NULL,
observable_criteria TEXT,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link RA to competencies
CREATE TABLE IF NOT EXISTS ra_competencies (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
learning_outcome_id UUID NOT NULL REFERENCES learning_outcomes(id) ON DELETE CASCADE,
competency_id   UUID NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(learning_outcome_id, competency_id)
);

CREATE TABLE IF NOT EXISTS rubrics (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
name            TEXT NOT NULL,
description     TEXT,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
rubric_id       UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
description     TEXT NOT NULL,
weight          NUMERIC(5,2) NOT NULL DEFAULT 1.0,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT positive_criteria_weight CHECK (weight > 0)
);

CREATE TABLE IF NOT EXISTS rubric_levels (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
rubric_id       UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
criteria_id     UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
level_name      TEXT NOT NULL, -- 'Excelente', 'Bueno', 'En proceso', etc.
score           NUMERIC(5,2) NOT NULL,
description     TEXT,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT positive_level_score CHECK (score >= 0)
);

CREATE TABLE IF NOT EXISTS submissions (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
file_url        TEXT,
file_name       TEXT,
file_size       INTEGER,
submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
is_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
UNIQUE(activity_id, student_id)
);

CREATE TABLE IF NOT EXISTS notifications (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
type            TEXT NOT NULL, -- 'new_activity', 'grade_published', 'low_performance', 'bulletin_available'
title           TEXT NOT NULL,
message         TEXT NOT NULL,
is_read         BOOLEAN NOT NULL DEFAULT FALSE,
sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
data            JSONB -- additional data like activity_id, grade, etc.
);

CREATE TABLE IF NOT EXISTS audit_log (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id         UUID REFERENCES users(id), -- who made the change
table_name      TEXT NOT NULL,
record_id       UUID NOT NULL,
action          TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
old_values      JSONB,
new_values      JSONB,
justification   TEXT, -- for grade changes
changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evaluation scales
CREATE TABLE IF NOT EXISTS evaluation_scales (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
name            TEXT NOT NULL,
type            TEXT NOT NULL, -- 'numeric', 'literal', 'descriptive', 'custom'
config          JSONB NOT NULL, -- scale configuration
is_default      BOOLEAN NOT NULL DEFAULT FALSE,
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT valid_scale_type CHECK (type IN ('numeric', 'literal', 'descriptive', 'custom'))
);

-- Self-assessment and peer evaluation
CREATE TABLE IF NOT EXISTS self_assessments (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
self_score      NUMERIC(5,2),
self_comment    TEXT,
submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(activity_id, student_id)
);

CREATE TABLE IF NOT EXISTS peer_evaluations (
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
evaluator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
evaluatee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
peer_score      NUMERIC(5,2),
peer_comment    TEXT,
submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(activity_id, evaluator_id, evaluatee_id)
); 


-- 5. INDICES 
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id); 
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); 
CREATE INDEX IF NOT EXISTS idx_subjects_institution ON subjects(institution_id); 
CREATE INDEX IF NOT EXISTS idx_classrooms_section ON classrooms(section_id); 
CREATE INDEX IF NOT EXISTS idx_activities_classroom ON activities(classroom_id); 
CREATE INDEX IF NOT EXISTS idx_activity_grades_student ON activity_grades(student_id); 
CREATE INDEX IF NOT EXISTS idx_student_tutors_student ON student_tutors(student_id); 
CREATE INDEX IF NOT EXISTS idx_competencies_institution ON competencies(institution_id);
CREATE INDEX IF NOT EXISTS idx_competencies_subject ON competencies(subject_id);
CREATE INDEX IF NOT EXISTS idx_indicators_ra ON performance_indicators(learning_outcome_id);
CREATE INDEX IF NOT EXISTS idx_ra_competencies_ra ON ra_competencies(learning_outcome_id);
CREATE INDEX IF NOT EXISTS idx_ra_competencies_comp ON ra_competencies(competency_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_activity ON rubrics(activity_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_levels_rubric ON rubric_levels(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_levels_criteria ON rubric_levels(criteria_id);
CREATE INDEX IF NOT EXISTS idx_submissions_activity ON submissions(activity_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_scales_institution ON evaluation_scales(institution_id);
CREATE INDEX IF NOT EXISTS idx_self_assessments_activity ON self_assessments(activity_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_activity ON peer_evaluations(activity_id);

6. ROW LEVEL SECURITY 
ALTER TABLE institutions         ENABLE ROW LEVEL SECURITY; 
ALTER TABLE users                ENABLE ROW LEVEL SECURITY; 
ALTER TABLE academic_periods     ENABLE ROW LEVEL SECURITY; 
ALTER TABLE sections             ENABLE ROW LEVEL SECURITY; 
ALTER TABLE subjects             ENABLE ROW LEVEL SECURITY; 
ALTER TABLE teacher_subjects     ENABLE ROW LEVEL SECURITY; 
ALTER TABLE classrooms           ENABLE ROW LEVEL SECURITY; 
ALTER TABLE classroom_students   ENABLE ROW LEVEL SECURITY; 
ALTER TABLE student_tutors       ENABLE ROW LEVEL SECURITY; 
ALTER TABLE learning_outcomes    ENABLE ROW LEVEL SECURITY; 
ALTER TABLE activities           
ENABLE ROW LEVEL SECURITY; 
ALTER TABLE activity_grades      ENABLE ROW LEVEL SECURITY; 
ALTER TABLE recoveries           ENABLE ROW LEVEL SECURITY; 
ALTER TABLE competencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_competencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_levels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_assessments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_evaluations      ENABLE ROW LEVEL SECURITY; 


7. FUNCIONES RPC 

CREATE OR REPLACE FUNCTION register_institution( 
p_institution_name TEXT, p_institution_code TEXT, p_country TEXT, 
p_institution_email TEXT, p_director_id UUID, p_director_email TEXT, p_director_name 
TEXT 
) RETURNS void AS $$ 
BEGIN 
INSERT INTO institutions (name, code, country, email) 
VALUES (p_institution_name, p_institution_code, p_country, p_institution_email); 
INSERT INTO users (id, institution_id, email, full_name, role) 
VALUES (p_director_id, (SELECT id FROM institutions WHERE email = 
p_institution_email), 
p_director_email, p_director_name, 'director'); 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER; 

CREATE OR REPLACE FUNCTION calculate_academic_grade(p_classroom_id UUID, p_student_id 
UUID) 
RETURNS NUMERIC AS $$ 
DECLARE total_score NUMERIC := 0; total_max NUMERIC := 0; 
BEGIN 
SELECT COALESCE(SUM(ag.score), 0), COALESCE(SUM(a.max_score), 0) 
INTO total_score, total_max 
FROM activities a 
LEFT JOIN activity_grades ag ON ag.activity_id = a.id AND ag.student_id = 
p_student_id 
WHERE a.classroom_id = p_classroom_id AND a.learning_outcome_id IS NULL; 
IF total_max = 0 THEN RETURN 0; END IF; 
RETURN ROUND((total_score / total_max) * 100, 2); 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER; 
CREATE OR REPLACE FUNCTION calculate_ra_score(p_learning_outcome_id UUID, p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_weighted_score NUMERIC := 0;
  total_weight NUMERIC := 0;
  activity_record RECORD;
BEGIN
  FOR activity_record IN
    SELECT a.id, a.max_score, ag.score, a.weight
    FROM activities a
    LEFT JOIN activity_grades ag ON ag.activity_id = a.id AND ag.student_id = p_student_id
    WHERE a.learning_outcome_id = p_learning_outcome_id
  LOOP
    IF activity_record.score IS NOT NULL THEN
      total_weighted_score := total_weighted_score + (activity_record.score / activity_record.max_score) * COALESCE(activity_record.weight, 1);
      total_weight := total_weight + COALESCE(activity_record.weight, 1);
    END IF;
  END LOOP;

  IF total_weight = 0 THEN RETURN NULL; END IF;
  RETURN ROUND((total_weighted_score / total_weight) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_competency_score(p_competency_id UUID, p_student_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_ra_score NUMERIC := 0;
  ra_count INTEGER := 0;
  ra_record RECORD;
BEGIN
  FOR ra_record IN
    SELECT lo.id
    FROM learning_outcomes lo
    JOIN ra_competencies rc ON lo.id = rc.learning_outcome_id
    WHERE rc.competency_id = p_competency_id
  LOOP
    DECLARE ra_score NUMERIC := calculate_ra_score(ra_record.id, p_student_id);
    IF ra_score IS NOT NULL THEN
      total_ra_score := total_ra_score + ra_score;
      ra_count := ra_count + 1;
    END IF;
  END LOOP;

  IF ra_count = 0 THEN RETURN NULL; END IF;
  RETURN ROUND(total_ra_score / ra_count, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_notification(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_data JSONB DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_audit(p_table_name TEXT, p_record_id UUID, p_action TEXT, p_old_values JSONB DEFAULT NULL, p_new_values JSONB DEFAULT NULL, p_justification TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values, justification)
  VALUES (auth.uid(), p_table_name, p_record_id, p_action, p_old_values, p_new_values, p_justification);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_close_period(p_period_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  ungraded_count INTEGER;
  invalid_weight BOOLEAN;
BEGIN
  -- Check for ungraded activities
  SELECT COUNT(*) INTO ungraded_count
  FROM activities a
  JOIN classrooms c ON a.classroom_id = c.id
  LEFT JOIN activity_grades ag ON ag.activity_id = a.id
  WHERE c.period_id = p_period_id AND ag.id IS NULL;

  IF ungraded_count > 0 THEN RETURN FALSE; END IF;

  -- Check RA weights sum to 100
  SELECT NOT validate_ra_weights(s.id) INTO invalid_weight
  FROM subjects s
  WHERE s.institution_id = get_my_institution_id()
  LIMIT 1;

  IF invalid_weight THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_institution_id() 
RETURNS UUID AS $$ 
SELECT institution_id FROM users WHERE id = auth.uid() 
$$ LANGUAGE SQL SECURITY DEFINER STABLE; 
CREATE OR REPLACE FUNCTION get_my_role() 
RETURNS TEXT AS $$ 
SELECT role FROM users WHERE id = auth.uid() 
$$ LANGUAGE SQL SECURITY DEFINER STABLE; 
CREATE POLICY "institution_isolation" ON competencies FOR ALL USING (institution_id = get_my_institution_id());
CREATE POLICY "institution_isolation" ON performance_indicators FOR ALL USING (
  learning_outcome_id IN (
    SELECT lo.id FROM learning_outcomes lo
    JOIN subjects s ON lo.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON ra_competencies FOR ALL USING (
  learning_outcome_id IN (
    SELECT lo.id FROM learning_outcomes lo
    JOIN subjects s ON lo.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON rubrics FOR ALL USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON rubric_criteria FOR ALL USING (
  rubric_id IN (
    SELECT r.id FROM rubrics r
    JOIN activities a ON r.activity_id = a.id
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON rubric_levels FOR ALL USING (
  rubric_id IN (
    SELECT r.id FROM rubrics r
    JOIN activities a ON r.activity_id = a.id
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON submissions FOR ALL USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON notifications FOR ALL USING (user_id IN (
  SELECT id FROM users WHERE institution_id = get_my_institution_id()
));
CREATE POLICY "institution_isolation" ON audit_log FOR ALL USING (
  user_id IN (
    SELECT id FROM users WHERE institution_id = get_my_institution_id()
  ) OR user_id IS NULL
);
CREATE POLICY "institution_isolation" ON evaluation_scales FOR ALL USING (institution_id = get_my_institution_id());
CREATE POLICY "institution_isolation" ON self_assessments FOR ALL USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
);
CREATE POLICY "institution_isolation" ON peer_evaluations FOR ALL USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN classrooms c ON a.classroom_id = c.id
    JOIN teacher_subjects ts ON c.teacher_subject_id = ts.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE s.institution_id = get_my_institution_id()
  )
); 

8. REALTIME 

ALTER PUBLICATION supabase_realtime ADD TABLE activity_grades;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE period_final_grades;
ALTER PUBLICATION supabase_realtime ADD TABLE classrooms;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications; 