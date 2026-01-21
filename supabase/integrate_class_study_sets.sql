-- 0. Create study_sets table if it strictly doesn't exist
CREATE TABLE IF NOT EXISTS public.study_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  topics TEXT[],
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on study_sets
ALTER TABLE public.study_sets ENABLE ROW LEVEL SECURITY;

-- Basic policy for owners (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'study_sets' AND policyname = 'Users can manage own study sets'
    ) THEN
        CREATE POLICY "Users can manage own study sets" ON public.study_sets
        FOR ALL USING (student_id = auth.uid());
    END IF;
END
$$;

-- 1. Add columns to link Study Sets to Classes
ALTER TABLE public.study_sets
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS source_material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_public_to_class BOOLEAN DEFAULT FALSE;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_study_sets_source_material ON public.study_sets(source_material_id);
CREATE INDEX IF NOT EXISTS idx_study_sets_class_id ON public.study_sets(class_id);

-- 3. RLS: Allow students to VIEW study sets if they are in the class
-- Note: We use a new policy to avoid conflict with existing owner-only policies
DROP POLICY IF EXISTS "Students can view class study sets" ON public.study_sets;
CREATE POLICY "Students can view class study sets" ON public.study_sets
FOR SELECT USING (
  class_id IS NOT NULL AND
  is_public_to_class = TRUE AND
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.class_id = study_sets.class_id AND e.student_id = auth.uid()
  )
);

-- 4. RLS: Same for Flashcards
-- Ensure flashcards table has study_set_id if not already (it should, based on client code)
-- Assuming flashcards table exists.

DROP POLICY IF EXISTS "Students can view class flashcards" ON public.flashcards;
CREATE POLICY "Students can view class flashcards" ON public.flashcards
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.study_sets s
    JOIN public.enrollments e ON e.class_id = s.class_id
    WHERE s.id = flashcards.study_set_id 
    AND s.is_public_to_class = TRUE 
    AND e.student_id = auth.uid()
  )
);

-- 5. RLS: Same for Materials inside Study Set
-- Ensure study_set_materials table exists
CREATE TABLE IF NOT EXISTS public.study_set_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  study_set_id UUID REFERENCES public.study_sets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('pdf', 'manual', 'url', 'notes')) NOT NULL,
  file_url TEXT,
  content_text TEXT,
  flashcards_generated INTEGER DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.study_set_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view class set materials" ON public.study_set_materials;
CREATE POLICY "Students can view class set materials" ON public.study_set_materials
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.study_sets s
    JOIN public.enrollments e ON e.class_id = s.class_id
    WHERE s.id = study_set_materials.study_set_id 
    AND s.is_public_to_class = TRUE
    AND e.student_id = auth.uid()
  )
);
