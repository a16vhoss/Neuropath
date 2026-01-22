-- NUCLEAR OPTION: FIX RLS INFINITE RECURSION
-- This script does not guess policy names. It wipes ALL policies on 'study_sets' and starts fresh.

DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    -- Loop through all policies on the study_sets table and drop them one by one
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'study_sets') LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON study_sets'; 
    END LOOP; 
END $$;

-- Now that the table is clean, add back the ONE simple rule:
-- "Owner can do everything. Public can view."

-- 1. VIEW: Owner OR Public
CREATE POLICY "study_sets_select_policy" 
ON study_sets FOR SELECT 
USING (auth.uid() = student_id OR is_public = true);

-- 2. INSERT: Owner only (auth.uid matches student_id)
CREATE POLICY "study_sets_insert_policy" 
ON study_sets FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- 3. UPDATE: Owner only
CREATE POLICY "study_sets_update_policy" 
ON study_sets FOR UPDATE 
USING (auth.uid() = student_id);

-- 4. DELETE: Owner only
CREATE POLICY "study_sets_delete_policy" 
ON study_sets FOR DELETE 
USING (auth.uid() = student_id);

-- 5. Ensure RLS is enabled
ALTER TABLE study_sets ENABLE ROW LEVEL SECURITY;
