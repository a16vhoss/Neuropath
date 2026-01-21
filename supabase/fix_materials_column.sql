-- Add generated_content column to materials table
-- This column is required for Magic Import to store summary stats (flashcards count, quiz count)

ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS generated_content JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.materials.generated_content IS 'Stores metadata about AI generated content like flashcard counts';
