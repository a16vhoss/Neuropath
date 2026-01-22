-- 1. LIMPIEZA TOTAL DE POLÍTICAS (Para eliminar cualquier política antigua que esté causando el bucle)
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('enrollments', 'profiles', 'classes')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. FUNCIÓN DE SEGURIDAD (Sin RLS)
-- Esta función nos permite consultar si un usuario está en una clase sin disparar las políticas de RLS
CREATE OR REPLACE FUNCTION public.check_membership(class_uuid uuid, user_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE class_id = class_uuid AND student_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. NUEVAS POLÍTICAS PARA "PROFILES" (Seguras)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. NUEVAS POLÍTICAS PARA "CLASSES"
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes viewable by everyone" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Teachers can manage own classes" ON public.classes FOR ALL USING (auth.uid() = teacher_id);

-- 5. NUEVAS POLÍTICAS PARA "ENROLLMENTS" (Aquí estaba el bucle)
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View enrollments" ON public.enrollments
FOR SELECT USING (
    auth.uid() = student_id -- Puedo ver la mía
    OR 
    (SELECT teacher_id FROM public.classes WHERE id = class_id) = auth.uid() -- El profe puede ver a sus alumnos
    OR
    public.check_membership(class_id, auth.uid()) -- Compañeros (usa la función segura)
);

CREATE POLICY "Students can enroll themselves" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 6. PERMISOS
GRANT EXECUTE ON FUNCTION public.check_membership TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_membership TO service_role;
