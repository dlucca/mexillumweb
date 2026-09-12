-- Apply once in the existing Supabase project. Server service-role only; no public policies.
create table if not exists public.prospect_expedientes (
 id uuid primary key, token_hash text unique not null, revision integer not null default 0,
 data jsonb not null default '{}'::jsonb, created_by text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null, submitted_at timestamptz
);
alter table public.prospect_expedientes enable row level security;
revoke all on public.prospect_expedientes from anon, authenticated;
grant all on public.prospect_expedientes to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('expediente-files','expediente-files',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;
-- Deliberately no anonymous storage policies: uploads and downloads use scoped signed URLs.
-- Durable request quotas across serverless instances. Store only a salted/hashed key, no IPs.
create table if not exists public.expediente_rate_limits (key text primary key, hits int not null, expires_at timestamptz not null);
alter table public.expediente_rate_limits enable row level security;
revoke all on public.expediente_rate_limits from anon, authenticated;
create or replace function public.expediente_rate_limit(p_key text,p_limit int,p_seconds int)
returns boolean language plpgsql security definer set search_path=public as $$
declare n int;
begin
 insert into expediente_rate_limits(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when expediente_rate_limits.expires_at<now() then 1 else expediente_rate_limits.hits+1 end,
 expires_at=case when expediente_rate_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else expediente_rate_limits.expires_at end
 returning hits into n;
 return n<=p_limit;
end; $$;
revoke all on function public.expediente_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.expediente_rate_limit(text,int,int) to service_role;
-- Remove expired drafts + their storage objects via the server-side cleanup script (see docs).
grant all on public.expediente_rate_limits to service_role;
