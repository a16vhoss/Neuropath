-- Migration: Add source_name to flashcards
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS source_name TEXT;

-- Update existing cards if possible (optional, but keep it clean)
COMMENT ON COLUMN public.flashcards.source_name IS 'Name of the material(s) this flashcard was derived from';
