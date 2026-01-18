-- Este script ARREGLA los permisos de la tabla de materiales.
-- EL PROBLEMA: Probablemente tienes permiso para VER (Select) pero no para GUARDAR (Insert).
-- SOLUCIÓN: Borramos permisos viejos y creamos los correctos completos.

-- 1. Borrar políticas antiguas para limpiar (evita el error "Policy already exists")
drop policy if exists "Users can view materials from their own study sets" on public.study_set_materials;
drop policy if exists "Users can insert materials into their own study sets" on public.study_set_materials;
drop policy if exists "Users can delete materials from their own study sets" on public.study_set_materials;

-- 2. Asegurar que RLS esté activo
alter table public.study_set_materials enable row level security;

-- 3. Crear política para VER (SELECT)
create policy "Users can view materials from their own study sets"
  on public.study_set_materials for select
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- 4. Crear política para INSERTAR (INSERT) - ¡Esta es la crítica que faltaba!
create policy "Users can insert materials into their own study sets"
  on public.study_set_materials for insert
  with check (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- 5. Crear política para BORRAR (DELETE)
create policy "Users can delete materials from their own study sets"
  on public.study_set_materials for delete
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );
