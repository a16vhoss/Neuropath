-- Migration: Create tables for adaptive study (Quiz & Ultra Review) with Multi-Set support

-- 1. Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  study_set_id UUID REFERENCES study_sets, -- Nullable for multi-set sessions
  study_set_ids UUID[], -- Array of set IDs for multi-set
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percent_correct DECIMAL(5,2) NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  weak_topics TEXT[], 
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_study_set ON quiz_sessions(study_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_study_set_ids ON quiz_sessions USING GIN (study_set_ids);

-- 2. Individual Question Results
CREATE TABLE IF NOT EXISTS quiz_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID REFERENCES quiz_sessions ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_question_results_session ON quiz_question_results(quiz_session_id);

-- 3. Ultra Review Sessions
CREATE TABLE IF NOT EXISTS ultra_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  study_set_id UUID REFERENCES study_sets,
  study_set_ids UUID[],
  mode TEXT NOT NULL,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  active_phase_index INTEGER DEFAULT 0,
  phases JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultra_review_sessions_user ON ultra_review_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ultra_review_sessions_set_ids ON ultra_review_sessions USING GIN (study_set_ids);

-- RLS Policies
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ultra_review_sessions ENABLE ROW LEVEL SECURITY;

-- Quiz Policies
CREATE POLICY "Users can view own quiz sessions" ON quiz_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz sessions" ON quiz_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own question results" ON quiz_question_results FOR SELECT USING (quiz_session_id IN (SELECT id FROM quiz_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert question results" ON quiz_question_results FOR INSERT WITH CHECK (quiz_session_id IN (SELECT id FROM quiz_sessions WHERE user_id = auth.uid()));

-- Ultra Review Policies
CREATE POLICY "Users can view own review sessions" ON ultra_review_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review sessions" ON ultra_review_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review sessions" ON ultra_review_sessions FOR UPDATE USING (auth.uid() = user_id);
