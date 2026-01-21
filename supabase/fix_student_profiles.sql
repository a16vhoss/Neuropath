
-- Fix Profile Visibility for Teachers
-- This policy allows a user to view another user's profile if they share a class context (e.g. Teacher viewing Student)

-- 1. Check if policy exists and drop it to avoid conflicts (optional but safer)
DROP POLICY IF EXISTS "Teachers can view class student profiles" ON public.profiles;

-- 2. Create the policy
CREATE POLICY "Teachers can view class student profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if the requesting user is a teacher of a class the profile user is enrolled in
  EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = profiles.id
    AND c.teacher_id = auth.uid()
  )
);

-- 3. Also allow basic "Public Profile" visibility if not already set
-- (Optional: Some apps allow anyone to see names/avatars)
-- CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
