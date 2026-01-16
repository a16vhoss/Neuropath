-- FIX: Infinite Recursion in RLS Policies
-- The issue is a cycle between 'enrollments' and 'classes' policies.
-- Teachers querying 'enrollments' check 'classes'.
-- Students querying 'classes' check 'enrollments'.
-- This creates a loop. We break it by using a SECURITY DEFINER function 
-- that bypasses RLS when checking if a user is the teacher of a class.

-- 1. Create helper function to check teacher status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_class_teacher(c_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This runs as the database owner, bypassing RLS on 'classes'
  RETURN EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = c_id
    AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update 'enrollments' policy
DROP POLICY IF EXISTS "Teachers can manage class enrollments" ON public.enrollments;

CREATE POLICY "Teachers can manage class enrollments" ON public.enrollments
  FOR ALL USING (
    public.is_class_teacher(class_id)
  );

-- 3. Update 'materials' policy (preventative measure)
DROP POLICY IF EXISTS "Teachers can manage materials" ON public.materials;

CREATE POLICY "Teachers can manage materials" ON public.materials
  FOR ALL USING (
    public.is_class_teacher(class_id)
  );
