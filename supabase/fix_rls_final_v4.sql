-- ==========================================================
-- FINAL RLS RESET & PERMISSIONS FIX (V4)
-- ==========================================================

-- 1. LIMPIEZA TOTAL (Eliminar políticas conflictivas)
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies 
               WHERE schemaname = 'public' 
               AND tablename IN ('enrollments', 'profiles', 'classes', 'study_sets', 'flashcards', 'study_set_materials')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. PROFILES (Básico y sin recursión)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_v4" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_v4" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. CLASSES
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes_select_v4" ON public.classes FOR SELECT USING (true);
CREATE POLICY "classes_manage_v4" ON public.classes FOR ALL USING (auth.uid() = teacher_id);

-- 4. ENROLLMENTS (Sin mirar a perfiles ni recursivamente a sí misma)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_select_v4" ON public.enrollments FOR SELECT USING (
    student_id = auth.uid() 
    OR 
    EXISTS (SELECT 1 FROM public.classes WHERE id = enrollments.class_id AND teacher_id = auth.uid())
);
CREATE POLICY "enrollments_insert_v4" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 5. STUDY SETS (Dueño y Profesor siempre pueden)
ALTER TABLE public.study_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_sets_select_v4" ON public.study_sets FOR SELECT USING (true);
CREATE POLICY "study_sets_manage_v4" ON public.study_sets FOR ALL USING (
    student_id = auth.uid() 
    OR 
    (class_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.classes WHERE id = study_sets.class_id AND teacher_id = auth.uid()))
);

-- 6. FLASHCARDS Y MATERIALES
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flashcards_select_v4" ON public.flashcards FOR SELECT USING (true);
CREATE POLICY "flashcards_manage_v4" ON public.flashcards FOR ALL USING (
    EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = study_set_id AND (s.student_id = auth.uid() OR (s.class_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid()))))
);

ALTER TABLE public.study_set_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_select_v4" ON public.study_set_materials FOR SELECT USING (true);
CREATE POLICY "materials_manage_v4" ON public.study_set_materials FOR ALL USING (
    EXISTS (SELECT 1 FROM public.study_sets s WHERE s.id = study_set_id AND (s.student_id = auth.uid() OR (s.class_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id AND c.teacher_id = auth.uid()))))
);

-- NOTA: Este script es plano y evita bucles entre tablas.
