-- Study Set Materials Table
-- Tracks materials (PDFs, notes, etc.) uploaded to each study set

CREATE TABLE IF NOT EXISTS public.study_set_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_set_id UUID REFERENCES public.study_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'manual', 'url', 'notes')),
  file_url TEXT,
  content_text TEXT,
  flashcards_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.study_set_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own study set materials" ON public.study_set_materials
  FOR SELECT USING (
    study_set_id IN (SELECT id FROM public.study_sets WHERE student_id = auth.uid())
  );

CREATE POLICY "Users can insert own study set materials" ON public.study_set_materials
  FOR INSERT WITH CHECK (
    study_set_id IN (SELECT id FROM public.study_sets WHERE student_id = auth.uid())
  );

CREATE POLICY "Users can update own study set materials" ON public.study_set_materials
  FOR UPDATE USING (
    study_set_id IN (SELECT id FROM public.study_sets WHERE student_id = auth.uid())
  );

CREATE POLICY "Users can delete own study set materials" ON public.study_set_materials
  FOR DELETE USING (
    study_set_id IN (SELECT id FROM public.study_sets WHERE student_id = auth.uid())
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_study_set_materials_study_set_id ON public.study_set_materials(study_set_id);
