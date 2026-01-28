-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store document chunks
create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  
  -- Links to source content (can be either material OR notebook)
  material_id uuid references materials(id) on delete cascade,
  notebook_id uuid references notebooks(id) on delete cascade,
  
  -- The actual text content of the chunk
  content text not null,
  
  -- The embedding vector (Gemini text-embedding-004 uses 768 dimensions)
  embedding vector(768),
  
  -- Metadata for citations (page number, section title, etc.)
  metadata jsonb default '{}'::jsonb,
  
  -- Ownership and timestamps
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Ensure at least one source is present
  constraint chunk_source_check check (
    (material_id is not null and notebook_id is null) or 
    (material_id is null and notebook_id is not null)
  )
);

-- Enable RLS
alter table document_chunks enable row level security;

-- Create policy to allow users to see/edit only their own chunks
create policy "Users can view their own document chunks"
  on document_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own document chunks"
  on document_chunks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own document chunks"
  on document_chunks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own document chunks"
  on document_chunks for delete
  using (auth.uid() = user_id);

-- Create a function to search for similar document chunks
create or replace function match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
  filter_study_set_id uuid default null -- Optional: Filter by Study Set (needs join)
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  source_type text,
  source_name text
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    case 
      when document_chunks.material_id is not null then 'material'
      else 'notebook'
    end as source_type,
    case 
      when m.id is not null then m.name
      when n.id is not null then n.title
      else 'Unknown'
    end as source_name
  from document_chunks
  left join materials m on document_chunks.material_id = m.id
  left join notebooks n on document_chunks.notebook_id = n.id
  where document_chunks.user_id = filter_user_id
  and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  and (
    filter_study_set_id is null 
    or m.study_set_id = filter_study_set_id 
    or n.study_set_id = filter_study_set_id
  )
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
