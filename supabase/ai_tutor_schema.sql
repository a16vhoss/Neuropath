-- Add content_text column to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Create an index for faster text searching (simple ILIKE for now, full text search later if needed)
CREATE INDEX IF NOT EXISTS idx_materials_content_text ON public.materials USING gin(to_tsvector('spanish', coalesce(content_text, '')));
