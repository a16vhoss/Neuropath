-- Create table for chat sessions
create table if not exists study_set_chat_sessions (
  id uuid default gen_random_uuid() primary key,
  study_set_id uuid references study_sets(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Nuevo Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for sessions
alter table study_set_chat_sessions enable row level security;

create policy "Users can view their own chat sessions"
  on study_set_chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat sessions"
  on study_set_chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chat sessions"
  on study_set_chat_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own chat sessions"
  on study_set_chat_sessions for delete
  using (auth.uid() = user_id);

-- Update messages table to link to sessions
alter table study_set_chat_messages 
add column if not exists session_id uuid references study_set_chat_sessions(id) on delete cascade;

-- Index for performance
create index idx_chat_sessions_user_set on study_set_chat_sessions(user_id, study_set_id);
create index idx_chat_messages_session on study_set_chat_messages(session_id);
