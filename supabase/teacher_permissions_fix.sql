-- PERMISOS PARA PROFESORES EN SETS DE ESTUDIO
-- Permite que el profesor de la clase SIEMPRE pueda editar los sets creados dentro de su clase.

-- 1. Permisos en STUDY_SETS
DROP POLICY IF EXISTS "Teachers can manage class study sets" ON public.study_sets;
CREATE POLICY "Teachers can manage class study sets" ON public.study_sets
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = study_sets.class_id AND c.teacher_id = auth.uid()
    )
);

-- 2. Permisos en FLASHCARDS
DROP POLICY IF EXISTS "Teachers can manage class flashcards" ON public.flashcards;
CREATE POLICY "Teachers can manage class flashcards" ON public.flashcards
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.study_sets s
        JOIN public.classes c ON c.id = s.class_id
        WHERE s.id = flashcards.study_set_id AND c.teacher_id = auth.uid()
    )
);

-- 3. Permisos en STUDY_SET_MATERIALS
DROP POLICY IF EXISTS "Teachers can manage class set materials" ON public.study_set_materials;
CREATE POLICY "Teachers can manage class set materials" ON public.study_set_materials
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.study_sets s
        JOIN public.classes c ON c.id = s.class_id
        WHERE s.id = study_set_materials.study_set_id AND c.teacher_id = auth.uid()
    )
);

-- Nota: Estas políticas se suman a las de propietario (student_id = auth.uid()) que ya existen.
