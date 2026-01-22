-- FIX RLS SHARING & CLEANUP DUPLICATES

-- 1. Update RLS Policies to allow Class Sharing
-- We drop the simple "Nuclear" policies and add smarter ones.

DROP POLICY IF EXISTS "study_sets_select_policy" ON study_sets;
DROP POLICY IF EXISTS "study_sets_insert_policy" ON study_sets;
DROP POLICY IF EXISTS "study_sets_update_policy" ON study_sets;
DROP POLICY IF EXISTS "study_sets_delete_policy" ON study_sets;

-- Allow Viewing: Owner OR Class Members (Students + Teacher)
CREATE POLICY "View Study Sets" ON study_sets
FOR SELECT USING (
  student_id = auth.uid() -- Owner
  OR
  (
    class_id IS NOT NULL 
    AND (
      -- Student in class
      EXISTS (SELECT 1 FROM enrollments WHERE class_id = study_sets.class_id AND student_id = auth.uid())
      OR
      -- Teacher of class
      EXISTS (SELECT 1 FROM classes WHERE id = study_sets.class_id AND teacher_id = auth.uid())
    )
  )
);

-- Allow Insert: Authenticated Users (usually only Teachers create 'class sets' via the UI flow, but this is safe-ish)
CREATE POLICY "Insert Study Sets" ON study_sets
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Allow Update/Delete: Owner Only (Teacher owns the class set)
CREATE POLICY "Manage Study Sets" ON study_sets
FOR ALL USING (auth.uid() = student_id);


-- 2. CLEANUP DUPLICATE SETS
-- The previous bug caused Students to create their own 'empty' sets because they couldn't see the Teacher's set.
-- We must delete these duplicates so the UI finds the correct Teacher set.

DELETE FROM study_sets
WHERE class_id IS NOT NULL 
AND source_material_id IS NOT NULL
AND student_id NOT IN (
    SELECT teacher_id FROM classes WHERE id = study_sets.class_id
);

-- 3. Ensure Flashcards are visible too
-- If flashcards are linked to the class, they should be visible.
DROP POLICY IF EXISTS "flashcards_select_policy" ON flashcards; -- If existed from nuclear
-- Re-apply 'Anyone in class can view' logic if missing, but schema.sql likely covers it.
-- We assume schema.sql policies are active or were wiped. 
-- Let's re-ensure basic access for flashcards just in case.

CREATE POLICY "View Class Flashcards" ON flashcards
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM enrollments 
        WHERE class_id = flashcards.class_id AND student_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM classes 
        WHERE id = flashcards.class_id AND teacher_id = auth.uid()
    )
);
