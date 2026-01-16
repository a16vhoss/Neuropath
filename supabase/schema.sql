-- NEUROPATH Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'institution')),
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  last_study_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLASSES TABLE
-- ============================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  topics TEXT[] DEFAULT '{}',
  exam_date DATE,
  gamification_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENROLLMENTS (students in classes)
-- ============================================
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'at_risk')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- ============================================
-- MATERIALS TABLE
-- ============================================
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'pptx', 'link', 'doc')),
  file_url TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  flashcards_count INTEGER DEFAULT 0,
  quizzes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FLASHCARDS TABLE
-- ============================================
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FLASHCARD PROGRESS (spaced repetition)
-- ============================================
CREATE TABLE public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review DATE DEFAULT CURRENT_DATE,
  last_reviewed TIMESTAMPTZ,
  UNIQUE(student_id, flashcard_id)
);

-- ============================================
-- QUIZZES TABLE
-- ============================================
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quiz', 'exam', 'practice')),
  scheduled_date DATE,
  time_limit_minutes INTEGER DEFAULT 30,
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUIZ QUESTIONS
-- ============================================
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1
);

-- ============================================
-- QUIZ ATTEMPTS
-- ============================================
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  answers JSONB,
  time_taken_seconds INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL
);

-- ============================================
-- STUDENT ACHIEVEMENTS
-- ============================================
CREATE TABLE public.student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, achievement_id)
);

-- ============================================
-- STUDY SESSIONS LOG
-- ============================================
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('flashcards', 'quiz', 'exam', 'cramming')),
  duration_seconds INTEGER NOT NULL,
  cards_reviewed INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for auth" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Classes
CREATE POLICY "Teachers can manage own classes" ON public.classes
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view enrolled classes" ON public.classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE class_id = classes.id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view classes by code" ON public.classes
  FOR SELECT USING (true);

-- Enrollments
CREATE POLICY "Students can view own enrollments" ON public.enrollments
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create enrollments" ON public.enrollments
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can manage class enrollments" ON public.enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = enrollments.class_id AND teacher_id = auth.uid()
    )
  );

-- Materials
CREATE POLICY "Teachers can manage materials" ON public.materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = materials.class_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view class materials" ON public.materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON c.id = e.class_id
      WHERE e.student_id = auth.uid() AND c.id = materials.class_id
    )
  );

-- Flashcards
CREATE POLICY "Anyone enrolled can view flashcards" ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE class_id = flashcards.class_id AND student_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = flashcards.class_id AND teacher_id = auth.uid()
    )
  );

-- Flashcard progress
CREATE POLICY "Students manage own progress" ON public.flashcard_progress
  FOR ALL USING (auth.uid() = student_id);

-- Quizzes
CREATE POLICY "Anyone in class can view quizzes" ON public.quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE class_id = quizzes.class_id AND student_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = quizzes.class_id AND teacher_id = auth.uid()
    )
  );

-- Quiz questions
CREATE POLICY "Anyone in class can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.enrollments e ON e.class_id = q.class_id
      WHERE q.id = quiz_questions.quiz_id AND e.student_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.classes c ON c.id = q.class_id
      WHERE q.id = quiz_questions.quiz_id AND c.teacher_id = auth.uid()
    )
  );

-- Quiz attempts
CREATE POLICY "Students manage own attempts" ON public.quiz_attempts
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Teachers view class attempts" ON public.quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.classes c ON c.id = q.class_id
      WHERE q.id = quiz_attempts.quiz_id AND c.teacher_id = auth.uid()
    )
  );

-- Achievements
CREATE POLICY "Anyone can view achievements" ON public.achievements
  FOR SELECT USING (true);

-- Student achievements
CREATE POLICY "Students manage own achievements" ON public.student_achievements
  FOR ALL USING (auth.uid() = student_id);

-- Study sessions
CREATE POLICY "Students manage own sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Teachers view class sessions" ON public.study_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = study_sessions.class_id AND teacher_id = auth.uid()
    )
  );

-- ============================================
-- INSERT DEFAULT ACHIEVEMENTS
-- ============================================
INSERT INTO public.achievements (name, description, icon, xp_reward, requirement_type, requirement_value) VALUES
  ('Primera Racha', '7 días seguidos estudiando', 'local_fire_department', 100, 'streak_days', 7),
  ('Explorador', 'Completa 10 sesiones de estudio', 'explore', 150, 'sessions_count', 10),
  ('Quiz Master', 'Obtén 100% en un quiz', 'military_tech', 200, 'perfect_quiz', 1),
  ('Cerebro de Acero', 'Domina 5 temas diferentes', 'psychology', 300, 'topics_mastered', 5),
  ('Maratón', 'Estudia 2 horas en un día', 'timer', 250, 'daily_minutes', 120),
  ('Ayudante', 'Responde 20 dudas en la comunidad', 'support_agent', 200, 'help_count', 20),
  ('Racha Legendaria', '30 días seguidos estudiando', 'whatshot', 500, 'streak_days', 30),
  ('Perfeccionista', '5 exámenes con puntaje perfecto', 'workspace_premium', 400, 'perfect_exams', 5);

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
