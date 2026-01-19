-- Add material_id column to flashcards table
ALTER TABLE flashcards 
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES study_set_materials(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_flashcards_material_id ON flashcards(material_id);

-- Verify the change (optional)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'flashcards' AND column_name = 'material_id';
