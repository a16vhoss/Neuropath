-- ============================================
-- NEUROPATH Adaptive Learning System Migration
-- Sistema FSRS (Free Spaced Repetition Scheduler)
-- ============================================
-- INSTRUCCIONES: Copia y pega este script completo en tu
-- Supabase SQL Editor y ejecutalo.
-- ============================================

-- 1. Nueva tabla para datos FSRS por flashcard
CREATE TABLE IF NOT EXISTS public.flashcard_srs_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  
  -- FSRS Core Parameters
  stability REAL DEFAULT 1.0,          -- Tiempo hasta 90% olvido (días)
  difficulty REAL DEFAULT 0.3,         -- 0-1, qué tan difícil es este item
  retrievability REAL DEFAULT 1.0,     -- 0-1, probabilidad actual de recall
  
  -- Scheduling
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  last_review_at TIMESTAMPTZ,
  interval_days REAL DEFAULT 1.0,
  
  -- Performance tracking
  reps INTEGER DEFAULT 0,              -- Total de repeticiones
  lapses INTEGER DEFAULT 0,            -- Veces que olvidó
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  
  -- Response time tracking
  avg_response_time_ms INTEGER DEFAULT 0,
  last_response_time_ms INTEGER,
  
  -- Mastery
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, flashcard_id)
);

-- 2. Tabla para log detallado de cada review
CREATE TABLE IF NOT EXISTS public.review_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  
  -- Response data
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4), -- 1=Again, 2=Hard, 3=Good, 4=Easy
  response_time_ms INTEGER,
  
  -- State at review time
  stability_before REAL,
  difficulty_before REAL,
  retrievability_at_review REAL,
  
  -- Calculated values
  stability_after REAL,
  difficulty_after REAL,
  next_interval_days REAL,
  
  -- Context
  session_id UUID,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla para sesiones de estudio adaptativas
CREATE TABLE IF NOT EXISTS public.adaptive_study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_set_id UUID,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  
  -- Session config
  mode TEXT NOT NULL CHECK (mode IN ('adaptive', 'review_due', 'learn_new', 'cramming', 'quiz', 'exam')),
  target_cards INTEGER DEFAULT 20,
  
  -- Performance
  cards_studied INTEGER DEFAULT 0,
  cards_correct INTEGER DEFAULT 0,
  cards_again INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Rewards
  xp_earned INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,
  
  -- Learning metrics
  retention_rate REAL,
  new_cards_learned INTEGER DEFAULT 0,
  reviews_completed INTEGER DEFAULT 0
);

-- 4. Tabla para tracking de categorías/temas
CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_set_id UUID,
  topic_name TEXT NOT NULL,
  
  -- Mastery metrics
  total_cards INTEGER DEFAULT 0,
  mastered_cards INTEGER DEFAULT 0,
  learning_cards INTEGER DEFAULT 0,
  new_cards INTEGER DEFAULT 0,
  
  -- Aggregate stats
  avg_stability REAL DEFAULT 1.0,
  avg_difficulty REAL DEFAULT 0.3,
  estimated_retention REAL DEFAULT 0.0,
  
  -- Dates
  last_studied_at TIMESTAMPTZ,
  next_review_recommended TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, study_set_id, topic_name)
);

-- 5. Nuevos achievements para sistema adaptativo
INSERT INTO public.achievements (name, description, icon, xp_reward, requirement_type, requirement_value) VALUES
  ('Memoria de Elefante', 'Alcanza 80% de retención en 50 tarjetas', 'neurology', 300, 'retention_80', 50),
  ('Maestro del Recall', 'Domina 20 tarjetas (nivel 5)', 'psychology', 400, 'mastered_cards', 20),
  ('Velocista Mental', 'Responde correctamente en menos de 3 segundos', 'speed', 150, 'fast_correct', 10),
  ('Constancia', 'Completa tu carga diaria 7 días seguidos', 'event_repeat', 350, 'daily_goal_streak', 7),
  ('Renacer', 'Recupera una tarjeta olvidada al nivel de dominio', 'refresh', 100, 'recovered_cards', 5)
ON CONFLICT DO NOTHING;

-- 6. Enable RLS
ALTER TABLE public.flashcard_srs_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "Users manage own SRS data" ON public.flashcard_srs_data;
CREATE POLICY "Users manage own SRS data" ON public.flashcard_srs_data
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own review logs" ON public.review_logs;
CREATE POLICY "Users manage own review logs" ON public.review_logs
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own adaptive sessions" ON public.adaptive_study_sessions;
CREATE POLICY "Users manage own adaptive sessions" ON public.adaptive_study_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users manage own topic mastery" ON public.topic_mastery
  FOR ALL USING (auth.uid() = user_id);

-- 8. Índices para performance
CREATE INDEX IF NOT EXISTS idx_srs_next_review ON public.flashcard_srs_data(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_srs_state ON public.flashcard_srs_data(user_id, state);
CREATE INDEX IF NOT EXISTS idx_review_logs_date ON public.review_logs(user_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON public.topic_mastery(user_id);

-- ============================================
-- ¡MIGRACIÓN COMPLETADA!
-- Ahora confirma en el chat que las tablas fueron creadas.
-- ============================================
