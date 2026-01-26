-- =====================================================
-- DAILY MISSIONS SYSTEM
-- Gamified daily tasks that reward students with XP
-- =====================================================

-- ===========================================
-- 1. Mission Definitions (Catalog)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.mission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  title_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'task_alt',
  xp_reward_min INTEGER NOT NULL DEFAULT 20,
  xp_reward_max INTEGER NOT NULL DEFAULT 50,
  requirement_min INTEGER NOT NULL DEFAULT 1,
  requirement_max INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. Daily Missions (User assignments)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_definition_id UUID NOT NULL REFERENCES public.mission_definitions(id) ON DELETE CASCADE,
  mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_target INTEGER NOT NULL,
  current_progress INTEGER DEFAULT 0,
  xp_reward INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  is_claimed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one mission of each type per user per day
  UNIQUE(user_id, mission_definition_id, mission_date)
);

-- ===========================================
-- 3. Daily Mission Bonuses (Completion tracking)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.daily_mission_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_date DATE NOT NULL DEFAULT CURRENT_DATE,
  missions_required INTEGER NOT NULL DEFAULT 4,
  missions_completed INTEGER DEFAULT 0,
  bonus_xp INTEGER NOT NULL DEFAULT 100,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One bonus tracker per user per day
  UNIQUE(user_id, bonus_date)
);

-- ===========================================
-- 4. Row Level Security
-- ===========================================
ALTER TABLE public.mission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mission_bonuses ENABLE ROW LEVEL SECURITY;

-- Mission definitions are read-only for all authenticated users
CREATE POLICY "Anyone can read mission definitions" ON public.mission_definitions
  FOR SELECT USING (true);

-- Users can only manage their own daily missions
CREATE POLICY "Users manage own daily missions" ON public.daily_missions
  FOR ALL USING (auth.uid() = user_id);

-- Users can only manage their own bonuses
CREATE POLICY "Users manage own daily bonuses" ON public.daily_mission_bonuses
  FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- 5. Indexes for Performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date
  ON public.daily_missions(user_id, mission_date);

CREATE INDEX IF NOT EXISTS idx_daily_missions_unclaimed
  ON public.daily_missions(user_id, mission_date, is_completed, is_claimed);

CREATE INDEX IF NOT EXISTS idx_daily_mission_bonuses_user_date
  ON public.daily_mission_bonuses(user_id, bonus_date);

CREATE INDEX IF NOT EXISTS idx_mission_definitions_active
  ON public.mission_definitions(is_active);

-- ===========================================
-- 6. Seed Mission Definitions
-- ===========================================
INSERT INTO public.mission_definitions (type, title_template, description_template, icon, xp_reward_min, xp_reward_max, requirement_min, requirement_max, is_active)
VALUES
  ('quiz_count', 'Completa {n} quiz(es)', 'Pon a prueba tus conocimientos completando {n} quiz(es) hoy', 'quiz', 30, 50, 1, 3, true),
  ('study_minutes', 'Estudia {n} minutos', 'Dedica {n} minutos al estudio activo', 'timer', 20, 60, 10, 30, true),
  ('flashcard_reviews', 'Repasa {n} tarjetas', 'Revisa y practica {n} flashcards', 'style', 25, 75, 15, 50, true),
  ('quiz_score_threshold', 'Obtén 80%+ en un quiz', 'Demuestra dominio obteniendo al menos 80% en un quiz', 'military_tech', 50, 50, 1, 1, true),
  ('streak_maintain', 'Mantén tu racha', 'Estudia hoy para mantener tu racha activa', 'local_fire_department', 40, 40, 1, 1, true),
  ('new_cards_learned', 'Aprende {n} tarjetas nuevas', 'Introduce {n} nuevas tarjetas a tu repertorio', 'school', 30, 70, 5, 15, true),
  ('session_count', 'Completa {n} sesión(es)', 'Finaliza {n} sesión(es) de estudio completa(s)', 'play_circle', 35, 65, 1, 3, true)
ON CONFLICT (type) DO NOTHING;
