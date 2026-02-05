-- ==============================================================================
-- FIX EXERCISE VISIBILITY
-- Updates RLS policy to allow class members to view exercises in class study sets
-- ==============================================================================

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view exercise templates" ON public.exercise_templates;

-- 2. Create the unified policy (Owner + Class Members + Class Teachers)
CREATE POLICY "Users can view exercise templates" ON public.exercise_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.study_sets s
            WHERE s.id = exercise_templates.study_set_id
            AND (
                -- Case A: User is the owner (Personal Study Set)
                s.student_id = auth.uid()
                OR
                -- Case B: Study Set belongs to a Class
                (
                    s.class_id IS NOT NULL AND (
                        -- User is an enrolled student in that class
                        EXISTS (
                            SELECT 1 FROM public.enrollments e
                            WHERE e.class_id = s.class_id
                            AND e.student_id = auth.uid()
                        )
                        OR
                        -- User is the teacher of that class
                        EXISTS (
                            SELECT 1 FROM public.classes c
                            WHERE c.id = s.class_id
                            AND c.teacher_id = auth.uid()
                        )
                    )
                )
            )
        )
    );
