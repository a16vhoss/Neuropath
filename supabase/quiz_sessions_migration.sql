-- Migration: Create quiz_sessions and quiz_question_results tables
-- For adaptive quiz system with performance tracking

-- Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  study_set_id UUID REFERENCES study_sets NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percent_correct DECIMAL(5,2) NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  weak_topics TEXT[], -- Topics user struggled with
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Question Results
CREATE TABLE IF NOT EXISTS quiz_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id UUID REFERENCES quiz_sessions ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  topic TEXT, -- Category/topic of question
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_study_set ON quiz_sessions(study_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_results_session ON quiz_question_results(quiz_session_id);

-- RLS Policies
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_results ENABLE ROW LEVEL SECURITY;

-- Users can only see their own quiz sessions
CREATE POLICY "Users can view own quiz sessions"
  ON quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz sessions"
  ON quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view/insert question results for their sessions
CREATE POLICY "Users can view own question results"
  ON quiz_question_results FOR SELECT
  USING (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert question results"
  ON quiz_question_results FOR INSERT
  WITH CHECK (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = auth.uid()
    )
  );
