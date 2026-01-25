-- Migration: Create study guide reading progress tracking
-- Date: 2025-01-25
-- Purpose: Track which sections of the study guide users have read

-- Create table for tracking reading progress per section
CREATE TABLE IF NOT EXISTS public.study_guide_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,           -- e.g., "section-0", "section-2"
  section_title TEXT,                 -- For reference/debugging
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per student per section per study set
  UNIQUE(student_id, study_set_id, section_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_study_guide_progress_student
  ON public.study_guide_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_study_guide_progress_study_set
  ON public.study_guide_progress(study_set_id);
CREATE INDEX IF NOT EXISTS idx_study_guide_progress_composite
  ON public.study_guide_progress(student_id, study_set_id);

-- Enable RLS
ALTER TABLE public.study_guide_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Students can manage their own reading progress
CREATE POLICY "Students manage own reading progress"
  ON public.study_guide_progress
  FOR ALL USING (auth.uid() = student_id);

-- Teachers can view progress for class study sets
CREATE POLICY "Teachers can view class progress"
  ON public.study_guide_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_sets s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = study_guide_progress.study_set_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_study_guide_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_study_guide_progress_updated
  BEFORE UPDATE ON public.study_guide_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_study_guide_progress_timestamp();
