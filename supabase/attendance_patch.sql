-- ============================================
-- PATCH: Attendance Tables
-- Run this if the main script failed halfway
-- ============================================

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('present', 'late', 'excused', 'absent')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- RLS Policies for Attendance
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Teachers can manage attendance sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Teachers can manage attendance records" ON public.attendance_records;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance_records;

-- Teachers can manage sessions
CREATE POLICY "Teachers can manage attendance sessions" ON public.attendance_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = attendance_sessions.class_id AND teacher_id = auth.uid())
  );

-- Teachers can manage records
CREATE POLICY "Teachers can manage attendance records" ON public.attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = attendance_records.session_id AND c.teacher_id = auth.uid()
    )
  );

-- Students can view their own records
CREATE POLICY "Students can view own attendance" ON public.attendance_records
  FOR SELECT USING (student_id = auth.uid());
