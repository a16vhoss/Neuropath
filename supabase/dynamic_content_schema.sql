-- Dynamic Content Generation Schema Migration
-- Run this in Supabase SQL Editor

-- 1. Add difficulty tier to flashcards (1=Basic, 2=Intermediate, 3=Advanced, 4=Expert)
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS difficulty_tier INTEGER DEFAULT 1;

-- 2. Add archived status to SRS data
ALTER TABLE flashcard_srs_data ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE flashcard_srs_data ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- 3. Track consecutive correct answers for mastery detection
ALTER TABLE flashcard_srs_data ADD COLUMN IF NOT EXISTS consecutive_correct INTEGER DEFAULT 0;

-- 4. Track generation history to avoid duplicates and manage context
CREATE TABLE IF NOT EXISTS content_generation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('flashcard', 'quiz', 'exam')),
    difficulty_tier INTEGER NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 4),
    prompt_context TEXT,
    generated_count INTEGER DEFAULT 0,
    source_card_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Enable RLS on new table
ALTER TABLE content_generation_log ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for content_generation_log
CREATE POLICY "Users can view own generation logs"
    ON content_generation_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation logs"
    ON content_generation_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 7. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_flashcard_srs_archived ON flashcard_srs_data(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_flashcards_difficulty_tier ON flashcards(study_set_id, difficulty_tier);
CREATE INDEX IF NOT EXISTS idx_generation_log_study_set ON content_generation_log(study_set_id, user_id);

-- 8. Add parent_card_id to track which card spawned a harder version
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS parent_card_id UUID REFERENCES flashcards(id);
