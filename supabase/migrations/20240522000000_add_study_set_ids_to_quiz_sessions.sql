-- Migration: Add study_set_ids to quiz_sessions table
-- This allows linking a quiz session to multiple study sets.

ALTER TABLE quiz_sessions 
ADD COLUMN IF NOT EXISTS study_set_ids UUID[] DEFAULT '{}';

-- Optional: Create index for faster searching by study set ID in the array
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_study_set_ids 
ON quiz_sessions USING GIN (study_set_ids);

-- Update existing rows to populate study_set_ids from study_set_id if existing
UPDATE quiz_sessions 
SET study_set_ids = ARRAY[study_set_id] 
WHERE (study_set_ids IS NULL OR array_length(study_set_ids, 1) IS NULL) AND study_set_id IS NOT NULL;


-- ========================================================
-- ULTRA REVIEW MIGRATION
-- Support multi-set ultra review sessions
-- ========================================================

-- 1. Make study_set_id nullable (since we might have multiple sets)
ALTER TABLE ultra_review_sessions 
ALTER COLUMN study_set_id DROP NOT NULL;

-- 2. Add study_set_ids column
ALTER TABLE ultra_review_sessions 
ADD COLUMN IF NOT EXISTS study_set_ids UUID[] DEFAULT '{}';

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_ultra_review_sessions_study_set_ids 
ON ultra_review_sessions USING GIN (study_set_ids);

-- 4. Backfill existing data
UPDATE ultra_review_sessions 
SET study_set_ids = ARRAY[study_set_id] 
WHERE (study_set_ids IS NULL OR array_length(study_set_ids, 1) IS NULL) AND study_set_id IS NOT NULL;
