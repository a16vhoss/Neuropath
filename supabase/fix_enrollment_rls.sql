-- FIX: Allow students to join classes by fixing RLS policies on enrollments table
-- This script clears conflicting policies and adds a clean one for self-enrollment.

-- 1. Cleanup old conflicting policies
DROP POLICY IF EXISTS "enrollments_insert_v4" ON public.enrollments;
DROP POLICY IF EXISTS "Students can create enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Students can enroll themselves" ON public.enrollments;
DROP POLICY IF EXISTS "Teachers can manage class enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "View Class Enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "View enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "allow_self_enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "allow_view_enrollments" ON public.enrollments;

-- 2. Create clean, robust policies
-- Allow authenticated users to enroll themselves
CREATE POLICY "allow_self_enrollment" 
ON public.enrollments FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- Allow users to view their own enrollments and teachers to view their class enrollments
CREATE POLICY "allow_view_enrollments" 
ON public.enrollments FOR SELECT 
USING (
    auth.uid() = student_id 
    OR 
    EXISTS (SELECT 1 FROM public.classes WHERE id = enrollments.class_id AND teacher_id = auth.uid())
);

-- 3. Ensure RLS is active
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
