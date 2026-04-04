-- Marketing Workflow — initial schema + RLS
-- Run in Supabase SQL editor or via CLI: supabase db push

create extension if not exists "uuid-ossp";

-- Enums
create type public.user_role as enum ('admin', 'marketing_head', 'designer_head', 'designer', 'marketing_executive');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum (
  'pending',
  'assigned',
  'in_progress',
  'review',
  'approved',
  'completed',
  'rejected'
);
create type public.platform_type as enum ('instagram', 'facebook', 'linkedin', 'gmb', 'website');
create type public.submission_kind as enum ('link', 'file');
create type public.performance_event as enum (
  'task_assigned',
  'task_completed',
  'task_delayed',
  'task_rejected',
  'platform_status_changed',
  'submission_added'
);

-- Profiles (1:1 auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'marketing_executive',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null default '',
  contact_email text,
  contact_phone text,
  contact_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_platforms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  platform public.platform_type not null,
  account_handle text,
  account_link text,
  is_active boolean not null default true,
  unique (client_id, platform)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  title text not null,
  description text default '',
  priority public.task_priority not null default 'medium',
  deadline timestamptz,
  publish_date timestamptz,
  status public.task_status not null default 'pending',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.task_platforms (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  client_platform_id uuid not null references public.client_platforms (id) on delete restrict,
  assigned_user_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'pending',
  submission_required boolean not null default true,
  unique (task_id, client_platform_id)
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order int not null default 0
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_platform_id uuid not null references public.task_platforms (id) on delete cascade,
  kind public.submission_kind not null,
  url text,
  storage_path text,
  file_name text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete cascade,
  task_platform_id uuid references public.task_platforms (id) on delete cascade,
  body text not null,
  is_rejection boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint comment_target check (
    (task_id is not null)::int + (task_platform_id is not null)::int >= 1
  )
);

create table public.performance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event public.performance_event not null,
  task_id uuid references public.tasks (id) on delete set null,
  task_platform_id uuid references public.task_platforms (id) on delete set null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text default '',
  type text not null default 'info',
  read boolean not null default false,
  related_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_tasks_client on public.tasks (client_id);
create index idx_tasks_status on public.tasks (status);
create index idx_tasks_deadline on public.tasks (deadline);
create index idx_task_platforms_task on public.task_platforms (task_id);
create index idx_notifications_user on public.notifications (user_id, read);
create index idx_performance_user on public.performance_logs (user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- New user → profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'marketing_executive'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: current role
create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff_elevated()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'marketing_head', 'designer_head')
  )
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_platforms enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_platforms enable row level security;
alter table public.subtasks enable row level security;
alter table public.submissions enable row level security;
alter table public.comments enable row level security;
alter table public.performance_logs enable row level security;
alter table public.notifications enable row level security;

-- Profiles: everyone reads all profiles (team directory); self update; admin/marketing_head can update roles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_staff_elevated()) with check (true);

-- Clients
create policy clients_all_elevated on public.clients for all to authenticated
  using (public.is_staff_elevated()) with check (public.is_staff_elevated());
create policy clients_select_all on public.clients for select to authenticated using (true);

-- Client platforms
create policy cp_all_elevated on public.client_platforms for all to authenticated
  using (public.is_staff_elevated()) with check (public.is_staff_elevated());
create policy cp_select on public.client_platforms for select to authenticated using (true);

-- Tasks: all authenticated read; insert elevated or any assignee logic — allow all auth insert for simplicity, restrict delete to elevated
create policy tasks_select on public.tasks for select to authenticated using (true);
create policy tasks_insert on public.tasks for insert to authenticated with check (created_by = auth.uid() or public.is_staff_elevated());
create policy tasks_update on public.tasks for update to authenticated using (true) with check (true);
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_staff_elevated());

-- Task assignees
create policy ta_select on public.task_assignees for select to authenticated using (true);
create policy ta_write on public.task_assignees for all to authenticated using (public.is_staff_elevated() or exists (
  select 1 from public.tasks t where t.id = task_id and t.created_by = auth.uid()
)) with check (true);

-- Task platforms
create policy tp_select on public.task_platforms for select to authenticated using (true);
create policy tp_write on public.task_platforms for all to authenticated using (true) with check (true);

-- Subtasks
create policy st_select on public.subtasks for select to authenticated using (true);
create policy st_write on public.subtasks for all to authenticated using (true) with check (true);

-- Submissions
create policy sub_select on public.submissions for select to authenticated using (true);
create policy sub_insert on public.submissions for insert to authenticated with check (created_by = auth.uid());
create policy sub_delete on public.submissions for delete to authenticated using (created_by = auth.uid() or public.is_staff_elevated());

-- Comments
create policy cm_select on public.comments for select to authenticated using (true);
create policy cm_insert on public.comments for insert to authenticated with check (created_by = auth.uid());

-- Performance logs (read elevated + self aggregates; insert via trigger recommended — allow service; for app insert:)
create policy pl_select on public.performance_logs for select to authenticated using (
  user_id = auth.uid() or public.is_staff_elevated()
);
create policy pl_insert on public.performance_logs for insert to authenticated
  with check (user_id = auth.uid() or public.is_staff_elevated());

-- Notifications
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid());
-- Loosened so any teammate can notify assignees from the app; tighten in production (e.g. Edge Function).
create policy notif_insert on public.notifications for insert to authenticated with check (true);

-- Notify assignee (bypasses RLS via security definer)
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t_title text;
begin
  select title into t_title from public.tasks where id = new.task_id;
  insert into public.notifications (user_id, title, body, type, related_task_id)
  values (
    new.user_id,
    'Task assigned',
    coalesce('You were assigned: ' || t_title, 'You were assigned to a task'),
    'task_assigned',
    new.task_id
  );
  return new;
end;
$$;

create trigger trg_task_assign_notify
  after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- Realtime (enable in Dashboard → Database → Replication if this fails)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- Storage bucket (create in dashboard or SQL)
insert into storage.buckets (id, name, public)
values ('task-submissions', 'task-submissions', false)
on conflict (id) do nothing;

create policy storage_task_submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'task-submissions');
create policy storage_task_submissions_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-submissions' and auth.uid()::text = (storage.foldername(name))[1]);

create policy storage_task_submissions_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-submissions'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_staff_elevated())
  );
