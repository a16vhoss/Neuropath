-- Add infographic and presentation columns to study_sets
ALTER TABLE public.study_sets
ADD COLUMN IF NOT EXISTS infographic TEXT,
ADD COLUMN IF NOT EXISTS presentation TEXT;

-- Update RLS if needed (usually columns don't need explicit RLS if the table has it)
-- But we should ensure the policies still apply (they use SELECT * usually)
