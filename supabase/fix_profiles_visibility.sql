-- FIX PROFILES VISIBILITY
-- The issue is that students can only see their OWN profile, so the 'Personas' list looks empty to them.
-- We will allow any authenticated user to view other profiles (names/avatars).

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Allow reading profiles if you are logged in
CREATE POLICY "Public profiles for authenticated users" ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- Also ensure Enrollments are visible to class members
-- Existing policy in schema.sql likely restricts to "own enrollments" or "teacher view".
-- We need students to see WHO ELSE is in their class.

DROP POLICY IF EXISTS "Students can view own enrollments" ON public.enrollments;

CREATE POLICY "View Class Enrollments" ON public.enrollments
FOR SELECT USING (
    -- You can view your own enrollment
    auth.uid() = student_id
    OR
    -- OR you can view enrollments for a class you are teaching
    EXISTS (SELECT 1 FROM public.classes WHERE id = enrollments.class_id AND teacher_id = auth.uid())
    OR
    -- OR you can view enrollments for a class you are ENROLLED in (so you can see classmates)
    EXISTS (
        SELECT 1 FROM public.enrollments my_enr 
        WHERE my_enr.class_id = enrollments.class_id 
        AND my_enr.student_id = auth.uid()
    )
);
