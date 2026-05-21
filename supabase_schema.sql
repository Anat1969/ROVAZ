-- ============================================================
-- Supabase schema for מערכת ניהול בקשות — רובע ז׳
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Table: requests
create table if not exists requests (
  id            text primary key,
  version       integer not null default 1,
  parent_id     text references requests(id),
  original_id   text,
  superseded    boolean not null default false,
  submitter_name    text not null default '',
  applicant_name    text not null default '',
  submitter_email   text not null default '',
  submitter_phone   text not null default '',
  street            text not null default '',
  building_number   text not null default '',
  address           text not null default '',
  gush_number       text not null default '',
  helka_number      text not null default '',
  description       text not null default '',
  notes             text not null default '',
  status            text not null default 'pending',
  created_at        text not null default '',
  lat               double precision,
  lng               double precision,
  checklist         jsonb not null default '[]',
  approval          jsonb,
  comments          jsonb not null default '[]',
  plan_attachment   text,
  visualization_image text,
  summary_text      text not null default '',
  inserted_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Table: documents_content
create table if not exists documents_content (
  id          integer primary key default 1,
  links       jsonb not null default '[]',
  files       jsonb not null default '[]',
  notes       jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);

-- Insert default row for documents_content
insert into documents_content (id) values (1) on conflict (id) do nothing;

-- Auto-update updated_at on requests
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists requests_updated_at on requests;
create trigger requests_updated_at
  before update on requests
  for each row execute procedure set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- Allow all operations without authentication (open access)
-- ============================================================
alter table requests enable row level security;
alter table documents_content enable row level security;

-- Allow anonymous read
create policy "allow_anon_read_requests" on requests
  for select using (true);

-- Allow anonymous insert
create policy "allow_anon_insert_requests" on requests
  for insert with check (true);

-- Allow anonymous update
create policy "allow_anon_update_requests" on requests
  for update using (true) with check (true);

-- Allow anonymous read/write documents_content
create policy "allow_anon_read_docs" on documents_content
  for select using (true);

create policy "allow_anon_write_docs" on documents_content
  for all using (true) with check (true);
