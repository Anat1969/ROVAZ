-- ROVAZ (רובע ז') schema inside the shared Supabase project ASHDODMAP (cbhexpybdggwzyakgagd).
-- The project hosts other apps, so every ROVAZ object carries the rz_ prefix. Applied as migrations
-- rz_rovaz_tables, rz_rovaz_functions, rz_rovaz_realtime.

create table if not exists public.rz_requests (
  id text primary key,
  version integer not null default 1,
  parent_id text references public.rz_requests(id),
  original_id text,
  superseded boolean not null default false,
  submitter_name text not null default '', applicant_name text not null default '',
  submitter_email text not null default '', submitter_phone text not null default '',
  street text not null default '', building_number text not null default '', address text not null default '',
  gush_number text not null default '', helka_number text not null default '',
  description text not null default '', notes text not null default '',
  status text not null default 'pending', created_at text not null default '',
  lat double precision, lng double precision,
  checklist jsonb not null default '[]', approval jsonb, comments jsonb not null default '[]',
  plan_attachment text, visualization_image text, summary_text text not null default '',
  inserted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.rz_documents_content (
  id integer primary key default 1,
  links jsonb not null default '[]', files jsonb not null default '[]', notes jsonb not null default '[]',
  page_content jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Reviewer password hash. No RLS policies: the browser never reads it.
create table if not exists public.rz_settings (key text primary key, value text not null, updated_at timestamptz not null default now());

alter table public.rz_requests enable row level security;
alter table public.rz_documents_content enable row level security;
alter table public.rz_settings enable row level security;

-- Submitters are anonymous (name based): read/insert/update open, no delete.
create policy rz_requests_read on public.rz_requests for select to anon, authenticated using (true);
create policy rz_requests_insert on public.rz_requests for insert to anon, authenticated with check (true);
create policy rz_requests_update on public.rz_requests for update to anon, authenticated using (true) with check (true);
create policy rz_documents_read on public.rz_documents_content for select to anon, authenticated using (true);

-- Security-definer functions (search_path = ''):
--   rz_reviewer_password_set()                    -> boolean
--   rz_check_reviewer(p_hash)                     -> boolean
--   rz_set_reviewer(p_new_hash, p_old_hash)       -> boolean (first set, or change with the old hash)
--   rz_save_documents(p_hash, p_links, p_files, p_notes, p_page_content) -> boolean
-- Trigger rz_requests_updated_at keeps updated_at current. rz_requests is in the supabase_realtime publication.
