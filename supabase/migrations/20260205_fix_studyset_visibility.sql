-- ==============================================================================
-- FIX STUDY SET VISIBILITY
-- Updates RLS policy to allow class members to view study sets and their materials
-- ==============================================================================

-- 1. STUDY SETS: Allow view if owner OR in same class
DROP POLICY IF EXISTS "Users can view study sets" ON public.study_sets;

CREATE POLICY "Users can view study sets" ON public.study_sets
    FOR SELECT USING (
        -- Case A: User is the owner (Personal Study Set)
        student_id = auth.uid()
        OR
        -- Case B: User is an editor
        auth.uid() = ANY(editors)
        OR
        -- Case C: Study Set belongs to a Class
        (
            class_id IS NOT NULL AND (
                -- User is an enrolled student in that class
                EXISTS (
                    SELECT 1 FROM public.enrollments e
                    WHERE e.class_id = class_id
                    AND e.student_id = auth.uid()
                )
                OR
                -- User is the teacher of that class
                EXISTS (
                    SELECT 1 FROM public.classes c
                    WHERE c.id = class_id
                    AND c.teacher_id = auth.uid()
                )
            )
        )
    );

-- 2. STUDY SET MATERIALS: Allow view if user can view the parent study set
-- Note: Often these tables inherit access from the parent, but we ensure it here.
DROP POLICY IF EXISTS "Users can view study set materials" ON public.study_set_materials;

CREATE POLICY "Users can view study set materials" ON public.study_set_materials
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.study_sets s
            WHERE s.id = study_set_materials.study_set_id
            AND (
                -- Re-using the logic above, or simply checking if the user can SELECT the study set?
                -- Supabase policies don't support "can select X", so we repeat logic or use a simpler proxy.
                -- Repeating logic for safety:
                s.student_id = auth.uid()
                OR auth.uid() = ANY(s.editors)
                OR (
                    s.class_id IS NOT NULL AND (
                        EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = s.class_id AND e.student_id = auth.uid())
                        OR
                        EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid())
                    )
                )
            )
        )
    );
