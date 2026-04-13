-- ============================================================
-- Universal Manu Command Center — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Topics: per-user syllabus progress tracking
create table if not exists public.topics (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  exam             text        not null,
  section          text        not null,
  topic            text        not null,
  "questionsSolved" integer   not null default 0,
  "totalQuestions"  integer   not null default 50,
  lod              text        not null default 'Medium'
                               check (lod in ('Easy','Medium','Hard')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- prevent duplicate topic rows per user
  unique (user_id, exam, section, topic)
);

create index if not exists idx_topics_user      on public.topics (user_id);
create index if not exists idx_topics_user_exam on public.topics (user_id, exam);

-- 2. Timer state: cross-device countdown sync (one row per user)
create table if not exists public.timer_state (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade unique,
  end_time          timestamptz,
  remaining_seconds integer     not null default 1500,
  duration_seconds  integer     not null default 1500,
  is_active         boolean     not null default false,
  exam              text,
  section           text,
  topic             text,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_timer_user on public.timer_state (user_id);

-- 3. Row-Level Security
alter table public.topics      enable row level security;
alter table public.timer_state enable row level security;

-- PERMISSIVE SELECT: Allow instantaneous multi-device inheritance using shared ID
-- UPDATED: Hardened to auth.uid() = user_id for production privacy
create policy "topics_select" on public.topics
  for select using (auth.uid() = user_id);
create policy "topics_insert" on public.topics
  for insert with check (auth.uid() = user_id);
create policy "topics_update" on public.topics
  for update using (auth.uid() = user_id);
create policy "topics_delete" on public.topics
  for delete using (auth.uid() = user_id);

create policy "timer_select" on public.timer_state
  for select using (auth.uid() = user_id);
create policy "timer_insert" on public.timer_state
  for insert with check (auth.uid() = user_id);
create policy "timer_update" on public.timer_state
  for update using (auth.uid() = user_id);

-- 4. Enable Realtime for existing tables
alter publication supabase_realtime add table public.topics;
alter publication supabase_realtime add table public.timer_state;

-- 5. Focus Sessions: historical log of individual study sessions
create table if not exists public.focus_sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  exam             text        not null,
  section          text        not null,
  topic            text        not null,
  duration_seconds integer     not null check (duration_seconds >= 0),
  questions_attempted integer  not null default 0 check (questions_attempted >= 0),
  questions_correct   integer  not null default 0 check (questions_correct >= 0),
  notes               text,
  created_at       timestamptz not null default now(),

  -- Logic check: Correct answers cannot exceed attempts
  constraint logical_scores check (questions_correct <= questions_attempted)
);

-- Index for fast user history queries
create index if not exists idx_focus_user on public.focus_sessions (user_id);

-- Enable Security
alter table public.focus_sessions enable row level security;

-- Policies for TRULY isolated user data
drop policy if exists "focus_select" on public.focus_sessions;
create policy "focus_select" on public.focus_sessions for select using (auth.uid() = user_id);

drop policy if exists "focus_insert" on public.focus_sessions;
create policy "focus_insert" on public.focus_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "focus_update" on public.focus_sessions;
create policy "focus_update" on public.focus_sessions for update using (auth.uid() = user_id);

drop policy if exists "focus_delete" on public.focus_sessions;
create policy "focus_delete" on public.focus_sessions for delete using (auth.uid() = user_id);

-- Enable Realtime
alter publication supabase_realtime add table public.focus_sessions;
