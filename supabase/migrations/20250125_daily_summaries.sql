-- =====================================================
-- DAILY SUMMARIES SYSTEM
-- Table for AI-generated daily study summaries
-- =====================================================

-- Tabla de resúmenes diarios
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  UNIQUE(user_id, summary_date)
);

-- RLS Policy
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own summaries
CREATE POLICY "Users manage own daily summaries" ON public.daily_summaries
  FOR ALL USING (auth.uid() = user_id);

-- Index for quick lookups by user and date
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date
  ON public.daily_summaries(user_id, summary_date DESC);
