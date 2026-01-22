-- FIX INFINITE RECURSION IN RLS
-- The previous policy caused a loop because asking "can I see this enrollment?" asked "am I enrolled?" which asked "can I see my enrollment?" etc.
-- We fix this by moving the check into a SECURITY DEFINER function that bypasses RLS.

-- 1. Create a secure function to check class membership
CREATE OR REPLACE FUNCTION public.is_user_in_class(class_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  -- This runs with permissions of the function creator (admin), bypassing RLS
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE class_id = class_uuid 
    AND student_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "View Class Enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Students can view own enrollments" ON public.enrollments;

-- 3. Re-create the policy using the secure function
CREATE POLICY "View Class Enrollments" ON public.enrollments
FOR SELECT USING (
    -- Case 1: It's my own enrollment
    auth.uid() = student_id
    OR
    -- Case 2: I am the teacher of the class
    EXISTS (SELECT 1 FROM public.classes WHERE id = enrollments.class_id AND teacher_id = auth.uid())
    OR
    -- Case 3: I am a classmate (using the secure function to avoid recursion)
    public.is_user_in_class(enrollments.class_id)
);

-- 4. Just in case, grant execute permission
GRANT EXECUTE ON FUNCTION public.is_user_in_class TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_in_class TO service_role;
