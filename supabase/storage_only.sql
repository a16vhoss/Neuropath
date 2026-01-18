-- 1. Crear el bucket 'materials' si no existe
insert into storage.buckets (id, name, public) 
values ('materials', 'materials', true) 
on conflict (id) do nothing;

-- 2. Eliminar políticas de storage antiguas si existen para evitar conflictos
drop policy if exists "Authenticated users can upload materials" on storage.objects;
drop policy if exists "Users can view materials" on storage.objects;

-- 3. Crear políticas de Storage
-- Permitir subir archivos a usuarios autenticados
create policy "Authenticated users can upload materials"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'materials' );

-- Permitir ver archivos
create policy "Users can view materials"
on storage.objects for select
to public
using ( bucket_id = 'materials' );
