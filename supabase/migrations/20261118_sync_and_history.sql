-- مزامنة تزايدية + سجل نسخ للسجلات (يطبَّق على مشروع Supabase مرة واحدة)

-- 1) توقيت الخادم لكل إضافة أو تعديل: تعتمد عليه المزامنة التزايدية بدل تحميل الجدول كاملًا
create or replace function public.tl_records_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists tl_records_touch on public.records;
create trigger tl_records_touch before insert or update on public.records
  for each row execute function public.tl_records_touch();

create index if not exists records_owner_updated_idx on public.records (owner, updated_at);

-- 2) سجل بالنسخة السابقة لكل تعديل أو حذف (استرجاع أي سجل لحالته قبل التعديل)
create table if not exists public.records_history (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  op text not null check (op in ('UPDATE','DELETE')),
  owner uuid not null,
  path text not null,
  data jsonb,
  changed_by text not null default ''
);
create index if not exists records_history_path_idx on public.records_history (owner, path, at desc);
create index if not exists records_history_at_idx on public.records_history (at);
alter table public.records_history enable row level security;
revoke all on public.records_history from anon, authenticated;

create or replace function public.tl_records_hist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.data is not distinct from new.data then return null; end if;
  insert into public.records_history(op, owner, path, data, changed_by)
  values (tg_op, old.owner, old.path, old.data, coalesce(auth.jwt() ->> 'email', ''));
  return null;
end $$;

revoke execute on function public.tl_records_touch(), public.tl_records_hist() from public, anon, authenticated;

drop trigger if exists tl_records_hist on public.records;
create trigger tl_records_hist after update or delete on public.records
  for each row execute function public.tl_records_hist();

-- 3) تنظيف السجل بعد 60 يومًا (يوميًا 02:30 UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'tl-history-purge';
select cron.schedule('tl-history-purge', '30 2 * * *',
  $job$delete from public.records_history where at < now() - interval '60 days'$job$);
