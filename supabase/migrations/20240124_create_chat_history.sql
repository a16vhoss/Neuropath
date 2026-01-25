-- Create table for storing ZpBot chat history per study set
create table if not exists study_set_chat_messages (
  id uuid default gen_random_uuid() primary key,
  study_set_id uuid references study_sets(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table study_set_chat_messages enable row level security;

-- Policies
create policy "Users can view their own chat messages"
  on study_set_chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat messages"
  on study_set_chat_messages for insert
  with check (auth.uid() = user_id);

-- Optional: Index for faster retrieval by study set
create index idx_chat_study_set on study_set_chat_messages(study_set_id, created_at);
