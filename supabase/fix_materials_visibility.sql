-- fix_materials_visibility.sql

-- 1. Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Users can view materials from their own study sets" ON public.study_set_materials;
DROP POLICY IF EXISTS "Students can view class set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Editors can manage set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Teachers can manage class set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "materials_select_v4" ON public.study_set_materials;
DROP POLICY IF EXISTS "materials_manage_v4" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can view own study set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can insert own study set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can update own study set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can delete own study set materials" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can view materials from their own study sets" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can insert materials into their own study sets" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can delete materials from their own study sets" ON public.study_set_materials;
DROP POLICY IF EXISTS "Users can update materials in their own study sets" ON public.study_set_materials;

-- 2. Asegurar RLS
ALTER TABLE public.study_set_materials ENABLE ROW LEVEL SECURITY;

-- 3. Política Unificada de Lectura (SELECT)
-- Permite ver si:
-- - Es el dueño del set
-- - Es un editor del set (UUID[] en editors)
-- - El set es público para la clase (is_public_to_class) Y el usuario está inscrito
-- - El usuario es el profesor de la clase vinculada al set
CREATE POLICY "View Materials Policy" ON public.study_set_materials
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.study_sets s
        WHERE s.id = study_set_materials.study_set_id
        AND (
            s.student_id = auth.uid() -- Dueño
            OR (s.editors IS NOT NULL AND auth.uid() = ANY(s.editors)) -- Editor
            OR (
                s.class_id IS NOT NULL AND (
                    -- Estudiante inscrito y el set es público
                    (COALESCE(s.is_public_to_class, FALSE) = TRUE AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = s.class_id AND e.student_id = auth.uid()))
                    OR
                    -- Profesor de la clase
                    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid())
                )
            )
        )
    )
);

-- 4. Política de Gestión (ALL)
-- Solo dueños y profesores de la clase pueden gestionar materiales
CREATE POLICY "Manage Materials Policy" ON public.study_set_materials
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.study_sets s
        WHERE s.id = study_set_materials.study_set_id
        AND (
            s.student_id = auth.uid() -- Dueño
            OR (
                s.class_id IS NOT NULL AND 
                EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid())
            )
        )
    )
);

-- 5. Política de Inserción (INSERT)
-- Necesaria explícitamente para WITH CHECK si se usa insert
CREATE POLICY "Insert Materials Policy" ON public.study_set_materials
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.study_sets s
        WHERE s.id = study_set_materials.study_set_id
        AND (
            s.student_id = auth.uid() -- Dueño
            OR (
                s.class_id IS NOT NULL AND 
                EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid())
            )
        )
    )
);
