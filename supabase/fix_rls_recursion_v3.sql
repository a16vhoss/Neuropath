-- FIX V3: FORCE RECURSION BREAK
-- The previous fixes likely failed because the functions were owned by a non-superuser,
-- so SECURITY DEFINER didn't actually bypass RLS.
-- This script explicitly changes ownership to 'postgres' (superuser).

-- 1. Drop everything to start clean
DROP POLICY IF EXISTS "Collaborators can view list" ON public.study_set_collaborators;
DROP POLICY IF EXISTS "Owners can manage collaborators" ON public.study_set_collaborators;
DROP POLICY IF EXISTS "Users can view study sets" ON public.study_sets;
DROP POLICY IF EXISTS "Users can update study sets" ON public.study_sets;

DROP FUNCTION IF EXISTS public.is_set_collaborator(uuid);
DROP FUNCTION IF EXISTS public.is_study_set_owner(uuid);

-- 2. Create Helper Functions (SECURITY DEFINER)

-- Check ownership (Bypass RLS)
CREATE OR REPLACE FUNCTION public.is_study_set_owner(set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_sets
    WHERE id = set_id
    AND student_id = auth.uid()
  );
$$;

-- FORCE OWNER TO POSTGRES (Critical for RLS bypass)
ALTER FUNCTION public.is_study_set_owner(UUID) OWNER TO postgres;


-- Check collaboration (Bypass RLS)
CREATE OR REPLACE FUNCTION public.is_set_collaborator(set_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_set_collaborators
    WHERE study_set_id = set_id
    AND user_id = auth.uid()
  );
$$;

-- FORCE OWNER TO POSTGRES (Critical for RLS bypass)
ALTER FUNCTION public.is_set_collaborator(UUID) OWNER TO postgres;


-- 3. Re-create Policies on 'study_set_collaborators'
-- Now these use the postgres-owned functions, so they WON'T trigger recursive RLS checks

CREATE POLICY "Collaborators can view list" ON public.study_set_collaborators
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    public.is_study_set_owner(study_set_id)
    OR
    public.is_set_collaborator(study_set_id)
  );

CREATE POLICY "Owners can manage collaborators" ON public.study_set_collaborators
  FOR ALL USING (
    public.is_study_set_owner(study_set_id)
  );


-- 4. Re-create Policies on 'study_sets'

CREATE POLICY "Users can view study sets" ON public.study_sets
  FOR SELECT USING (
    student_id = auth.uid()
    OR
    ( -- Class Member (Standard check)
      class_id IS NOT NULL AND
      is_public_to_class = TRUE AND
      EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.class_id = study_sets.class_id AND e.student_id = auth.uid()
      )
    )
    OR
    -- Safe Collaborator Check (Bypasses RLS loop)
    public.is_set_collaborator(id)
  );

CREATE POLICY "Users can update study sets" ON public.study_sets
  FOR UPDATE USING (
    student_id = auth.uid()
    OR
    -- Editor check using direct query (safe because study_sets is invalidating, and we query collabs which is now safe)
    -- But let's use a function if we wanted to be 100% sure, although this direction wasn't the loop cause.
    EXISTS (
      SELECT 1 FROM study_set_collaborators c
      WHERE c.study_set_id = id
      AND c.user_id = auth.uid()
      AND c.role = 'editor'
    )
  );

-- 5. Standard Insert/Delete
CREATE POLICY "Users can create study sets" ON public.study_sets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can delete study sets" ON public.study_sets
  FOR DELETE USING (student_id = auth.uid());

