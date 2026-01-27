-- ============================================
-- CLASSROOM ENHANCEMENTS SCHEMA
-- NeuropPath - Enhanced Teacher Dashboard
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLASS TOPICS (for organizing content)
-- ============================================
CREATE TABLE IF NOT EXISTS public.class_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,


  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENTS (class stream)
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  allow_comments BOOLEAN DEFAULT TRUE,
  scheduled_for TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]',
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENT COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSIGNMENTS (Tareas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.class_topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  points INTEGER DEFAULT 100,
  due_date TIMESTAMPTZ,
  due_time TIME,
  scheduled_publish TIMESTAMPTZ,
  allow_late_submissions BOOLEAN DEFAULT TRUE,
  late_penalty_percent INTEGER DEFAULT 0,
  attachments JSONB DEFAULT '[]',
  attached_materials UUID[] DEFAULT '{}',
  attached_flashcard_sets UUID[] DEFAULT '{}',
  type TEXT DEFAULT 'assignment' CHECK (type IN ('assignment', 'quiz_assignment', 'material', 'discussion')),
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'turned_in', 'graded', 'returned', 'missing')),
  submitted_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]',
  text_response TEXT,
  link_response TEXT,
  grade INTEGER,
  grade_percent DECIMAL(5,2),
  feedback TEXT,
  private_notes TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.profiles(id),
  is_late BOOLEAN DEFAULT FALSE,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- ============================================
-- GRADING RUBRICS
-- ============================================
CREATE TABLE IF NOT EXISTS public.rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]',
  -- criteria format: [{ "name": "Clarity", "points": 25, "levels": [{"score": 25, "description": "Excellent"}, ...] }]
  max_points INTEGER DEFAULT 100,
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link rubrics to assignments
CREATE TABLE IF NOT EXISTS public.assignment_rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE,
  UNIQUE(assignment_id)
);

-- ============================================
-- SCHEDULED EXAMS
-- ============================================
CREATE TABLE IF NOT EXISTS public.scheduled_exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.class_topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  allow_retakes BOOLEAN DEFAULT FALSE,
  max_attempts INTEGER DEFAULT 1,
  shuffle_questions BOOLEAN DEFAULT TRUE,
  shuffle_options BOOLEAN DEFAULT TRUE,
  show_results_immediately BOOLEAN DEFAULT TRUE,
  show_correct_answers BOOLEAN DEFAULT FALSE,
  require_webcam BOOLEAN DEFAULT FALSE,
  passcode TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track exam attempts with more detail
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_exam_id UUID REFERENCES public.scheduled_exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INTEGER,
  max_score INTEGER,
  percentage DECIMAL(5,2),
  answers JSONB DEFAULT '[]',
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded', 'timed_out')),
  ip_address TEXT,
  browser_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GUARDIANS/PARENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.guardians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  relationship TEXT DEFAULT 'guardian',
  notification_frequency TEXT DEFAULT 'weekly' CHECK (notification_frequency IN ('daily', 'weekly', 'never')),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, email)
);

-- ============================================
-- STUDENT GROUPS (for differentiated learning)
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.class_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_group_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Class Topics
CREATE POLICY "Teachers can manage class topics" ON public.class_topics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_topics.class_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students can view class topics" ON public.class_topics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.enrollments WHERE class_id = class_topics.class_id AND student_id = auth.uid())
  );

-- Announcements
CREATE POLICY "Teachers can manage announcements" ON public.announcements
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view published announcements" ON public.announcements
  FOR SELECT USING (
    published = TRUE AND (
      scheduled_for IS NULL OR scheduled_for <= NOW()
    ) AND EXISTS (
      SELECT 1 FROM public.enrollments WHERE class_id = announcements.class_id AND student_id = auth.uid()
    )
  );

-- Announcement Comments
CREATE POLICY "Authors can manage own comments" ON public.announcement_comments
  FOR ALL USING (author_id = auth.uid());

CREATE POLICY "Class members can view comments" ON public.announcement_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      JOIN public.enrollments e ON e.class_id = a.class_id
      WHERE a.id = announcement_comments.announcement_id AND e.student_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_comments.announcement_id AND a.teacher_id = auth.uid()
    )
  );

-- Assignments
CREATE POLICY "Teachers can manage assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = assignments.class_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students can view published assignments" ON public.assignments
  FOR SELECT USING (
    published = TRUE AND (
      scheduled_publish IS NULL OR scheduled_publish <= NOW()
    ) AND EXISTS (
      SELECT 1 FROM public.enrollments WHERE class_id = assignments.class_id AND student_id = auth.uid()
    )
  );

-- Assignment Submissions
CREATE POLICY "Students can manage own submissions" ON public.assignment_submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view and grade submissions" ON public.assignment_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE a.id = assignment_submissions.assignment_id AND c.teacher_id = auth.uid()
    )
  );

-- Rubrics
CREATE POLICY "Teachers can manage own rubrics" ON public.rubrics
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can view template rubrics" ON public.rubrics
  FOR SELECT USING (is_template = TRUE);

-- Assignment Rubrics
CREATE POLICY "Teachers can link rubrics" ON public.assignment_rubrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE a.id = assignment_rubrics.assignment_id AND c.teacher_id = auth.uid()
    )
  );

-- Scheduled Exams
CREATE POLICY "Teachers can manage scheduled exams" ON public.scheduled_exams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = scheduled_exams.class_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students can view published exams" ON public.scheduled_exams
  FOR SELECT USING (
    published = TRUE AND EXISTS (
      SELECT 1 FROM public.enrollments WHERE class_id = scheduled_exams.class_id AND student_id = auth.uid()
    )
  );

-- Exam Attempts
CREATE POLICY "Students can manage own attempts" ON public.exam_attempts
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view exam attempts" ON public.exam_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_exams se
      JOIN public.classes c ON c.id = se.class_id
      WHERE se.id = exam_attempts.scheduled_exam_id AND c.teacher_id = auth.uid()
    )
  );

-- Guardians
CREATE POLICY "Students can manage own guardians" ON public.guardians
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers can view student guardians" ON public.guardians
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON c.id = e.class_id
      WHERE e.student_id = guardians.student_id AND c.teacher_id = auth.uid()
    )
  );

-- Student Groups
CREATE POLICY "Teachers can manage student groups" ON public.student_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = student_groups.class_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Teachers can manage group members" ON public.student_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.student_groups sg
      JOIN public.classes c ON c.id = sg.class_id
      WHERE sg.id = student_group_members.group_id AND c.teacher_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON public.announcements(class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exams_class ON public.scheduled_exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON public.exam_attempts(scheduled_exam_id);
CREATE INDEX IF NOT EXISTS idx_class_topics_class ON public.class_topics(class_id);

-- ============================================
-- FUNCTION: Auto-create submissions when assignment published
-- ============================================
CREATE OR REPLACE FUNCTION public.create_assignment_submissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.published = TRUE AND (OLD IS NULL OR OLD.published = FALSE) THEN
    INSERT INTO public.assignment_submissions (assignment_id, student_id, status)
    SELECT NEW.id, e.student_id, 'assigned'
    FROM public.enrollments e
    WHERE e.class_id = NEW.class_id
    ON CONFLICT (assignment_id, student_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_assignment_published
  AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.create_assignment_submissions();

-- ============================================
-- FUNCTION: Mark submissions as missing after due date
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_missing_submissions()
RETURNS void AS $$
BEGIN
  UPDATE public.assignment_submissions
  SET status = 'missing', updated_at = NOW()
  WHERE status = 'assigned'
    AND assignment_id IN (
      SELECT id FROM public.assignments
      WHERE due_date < NOW() AND allow_late_submissions = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABLE: Attendance Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: Attendance Records
-- ============================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('present', 'late', 'excused', 'absent')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);