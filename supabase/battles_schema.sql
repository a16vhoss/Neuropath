-- ============================================
-- STUDY BATTLES SCHEMA
-- Run this in Supabase SQL Editor after the main schema
-- ============================================

-- BATTLES TABLE
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  challenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
  challenger_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  winner_id UUID REFERENCES public.profiles(id),
  mode TEXT DEFAULT 'async' CHECK (mode IN ('realtime', 'async')),
  question_count INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMPTZ
);

-- BATTLE QUESTIONS (links battles to flashcards used)
CREATE TABLE IF NOT EXISTS public.battle_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL
);

-- BATTLE ANSWERS (each player's response)
CREATE TABLE IF NOT EXISTS public.battle_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.battle_questions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  answer_time_ms INTEGER,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, question_id, player_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_answers ENABLE ROW LEVEL SECURITY;

-- Battles: Players can see their own battles
CREATE POLICY "Users can view their battles" ON public.battles
  FOR SELECT USING (
    auth.uid() = challenger_id OR auth.uid() = opponent_id
  );

CREATE POLICY "Users can create battles" ON public.battles
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Players can update their battles" ON public.battles
  FOR UPDATE USING (
    auth.uid() = challenger_id OR auth.uid() = opponent_id
  );

-- Battle Questions: Players can see questions for their battles
CREATE POLICY "Players can view battle questions" ON public.battle_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.battles 
      WHERE id = battle_id 
      AND (challenger_id = auth.uid() OR opponent_id = auth.uid())
    )
  );

CREATE POLICY "Challengers can create questions" ON public.battle_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.battles 
      WHERE id = battle_id AND challenger_id = auth.uid()
    )
  );

-- Battle Answers: Players can see and submit their own answers
CREATE POLICY "Players can view battle answers" ON public.battle_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.battles 
      WHERE id = battle_id 
      AND (challenger_id = auth.uid() OR opponent_id = auth.uid())
    )
  );

CREATE POLICY "Players can submit answers" ON public.battle_answers
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_battles_challenger ON public.battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_battles_opponent ON public.battles(opponent_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON public.battles(status);
CREATE INDEX IF NOT EXISTS idx_battle_questions_battle ON public.battle_questions(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_answers_battle ON public.battle_answers(battle_id);
