-- ============================================
-- FOLDERS MIGRATION
-- Use in Supabase SQL Editor
-- ============================================

-- 1. Create FOLDERS table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE, -- Recursive deletion happens here for subfolders
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE, -- Optional: if belongs to a class
  color TEXT,
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add folder_id to STUDY_SETS
-- We use ON DELETE CASCADE so if a folder is deleted, the sets inside are also deleted (User Requirement)
ALTER TABLE public.study_sets 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

-- 3. RLS Policies for Folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own folders (Personal Study)
CREATE POLICY "Users can manage own folders" ON public.folders
  FOR ALL USING (auth.uid() = owner_id);

-- Policy: Teachers can manage folders in their classes
CREATE POLICY "Teachers can manage class folders" ON public.folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE id = folders.class_id AND teacher_id = auth.uid()
    )
  );

-- Policy: Students can view folders in classes they are enrolled in
CREATE POLICY "Students can view class folders" ON public.folders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE class_id = folders.class_id AND student_id = auth.uid()
    )
  );

-- 4. Enable Realtime (Optional, usually good for UI updates)
alter publication supabase_realtime add table public.folders;
