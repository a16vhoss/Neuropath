-- FIX: Allow users to manage flashcards in their own Study Sets
-- Currently, RLS only allows access based on 'class_id'. 
-- We need to add a policy for 'study_set_id' so students can add cards to their personal sets.

-- 1. Enable RLS on flashcards (already enabled, but good practice to ensure)
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for Personal Study Sets
-- This allows INSERT, UPDATE, DELETE, SELECT if the flashcard belongs to a study set owned by the user.
CREATE POLICY "Users can manage flashcards in their study sets" ON public.flashcards
  FOR ALL USING (
    study_set_id IN (
      SELECT id FROM public.study_sets 
      WHERE student_id = auth.uid()
    )
  )
  WITH CHECK (
    study_set_id IN (
      SELECT id FROM public.study_sets 
      WHERE student_id = auth.uid()
    )
  );

-- 3. Ensure Study Sets are viewable (Update existing if needed, or create new)
-- "Users can view own study sets" (Assuming this table exists and needs this policy)
-- If policy already exists, this might error, but it's safe to run in SQL Editor as it will just say "exists".
-- Better to use DO block or just the simple policy creation.

DROP POLICY IF EXISTS "Users can manage own study sets" ON public.study_sets;
CREATE POLICY "Users can manage own study sets" ON public.study_sets
  FOR ALL USING (auth.uid() = student_id);
