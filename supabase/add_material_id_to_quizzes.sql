-- Add material_id to quizzes table to link quizzes to source materials (PDF/YouTube/etc)
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_material_id ON public.quizzes(material_id);
