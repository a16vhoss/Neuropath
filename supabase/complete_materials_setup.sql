-- 1. Crear tabla study_set_materials
create table if not exists public.study_set_materials (
  id uuid default gen_random_uuid() primary key,
  study_set_id uuid references public.study_sets(id) on delete cascade not null,
  name text not null,
  type text check (type in ('pdf', 'manual', 'url', 'notes')) not null,
  file_url text,
  content_text text,
  flashcards_generated integer default 0,
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar seguridad (RLS) en la tabla
alter table public.study_set_materials enable row level security;

-- 3. Políticas de acceso a la tabla
-- Ver materiales propios
create policy "Users can view materials from their own study sets"
  on public.study_set_materials for select
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Insertar materiales propios
create policy "Users can insert materials into their own study sets"
  on public.study_set_materials for insert
  with check (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Eliminar materiales propios
create policy "Users can delete materials from their own study sets"
  on public.study_set_materials for delete
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- 4. Configuración de Storage (Bucket 'materials')
insert into storage.buckets (id, name, public) 
values ('materials', 'materials', true) 
on conflict (id) do nothing;

-- 5. Políticas de Storage
-- Permitir subir archivos a usuarios autenticados
create policy "Authenticated users can upload materials"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'materials' );

-- Permitir ver archivos (ya es público, pero por si acaso)
create policy "Users can view materials"
on storage.objects for select
to public
using ( bucket_id = 'materials' );
