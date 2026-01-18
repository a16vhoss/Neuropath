-- Create study_set_materials table if it doesn't exist
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

-- Enable RLS
alter table public.study_set_materials enable row level security;

-- Policies for study_set_materials

-- Users can view materials from their own study sets
create policy "Users can view materials from their own study sets"
  on public.study_set_materials for select
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Users can insert materials into their own study sets
create policy "Users can insert materials into their own study sets"
  on public.study_set_materials for insert
  with check (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Users can update materials in their own study sets
create policy "Users can update materials in their own study sets"
  on public.study_set_materials for update
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Users can delete materials from their own study sets
create policy "Users can delete materials from their own study sets"
  on public.study_set_materials for delete
  using (
    exists (
      select 1 from public.study_sets
      where study_sets.id = study_set_materials.study_set_id
      and study_sets.student_id = auth.uid()
    )
  );

-- Create storage bucket for materials if it doesn't exist (this is usually handled via UI but good to document)
-- insert into storage.buckets (id, name, public) values ('materials', 'materials', true) on conflict do nothing;

-- Storage policies for 'materials' bucket (if not already set)
-- create policy "Authenticated users can upload materials"
-- on storage.objects for insert
-- to authenticated
-- with check ( bucket_id = 'materials' );

-- create policy "Users can view their own materials"
-- on storage.objects for select
-- to authenticated
-- using ( bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text );
