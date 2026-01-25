-- Add is_ai_generated column to flashcards table
alter table flashcards 
add column if not exists is_ai_generated boolean default false;

-- Update existing rows (optional, defaulting to false is fine)
