-- المساعد القانوني — تمكين: تفعيل الدخول باسم المستخدم وكلمة المرور، وإدارة المستخدمين، وطلبات الدخول
-- يُشغَّل مرة واحدة من Supabase ← SQL Editor. آمن لإعادة التشغيل.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.tl_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where lower(email) = lower(coalesce(auth.jwt()->>'email','')) and role = 'owner')
$$;

create or replace function public.tl_user_email(p_username text) returns text
language sql immutable as $$
  select case when position('@' in p_username) > 0 then lower(trim(p_username))
              else lower(trim(p_username)) || '@users.tamkeen.local' end
$$;

-- إضافة مستخدم بكلمة مرور جاهزة (أو تحديث كلمة مروره وصلاحيته إن كان موجودًا) — لمدير النظام فقط
create or replace function public.tl_admin_create_user(p_username text, p_password text, p_role text, p_name text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_email text := public.tl_user_email(p_username); v_id uuid;
begin
  if not public.tl_is_owner() then raise exception 'not_allowed'; end if;
  if p_role not in ('owner','editor','viewer') then raise exception 'bad_role'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'weak_password'; end if;
  if v_email !~ '^[a-z0-9._+-]+@[a-z0-9.-]+$' then raise exception 'bad_username'; end if;
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', p_name), now(), now(),
      '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_id;
  end if;
  insert into public.members (email, role, name) values (v_email, p_role, nullif(trim(p_name), ''))
  on conflict (email) do update set role = excluded.role, name = coalesce(excluded.name, members.name);
  return v_email;
end $$;

-- تعيين كلمة مرور جديدة لمستخدم — لمدير النظام فقط
create or replace function public.tl_admin_set_password(p_email text, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.tl_is_owner() then raise exception 'not_allowed'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'weak_password'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where lower(email) = lower(p_email);
  if not found then raise exception 'user_not_found'; end if;
end $$;

-- حذف مستخدم ومنعه من الدخول — لمدير النظام فقط (لا يحذف نفسه)
create or replace function public.tl_admin_delete_user(p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.tl_is_owner() then raise exception 'not_allowed'; end if;
  if lower(p_email) = lower(coalesce(auth.jwt()->>'email','')) then raise exception 'cannot_delete_self'; end if;
  delete from public.members where lower(email) = lower(p_email);
  delete from auth.users where lower(email) = lower(p_email);
end $$;

-- طلبات الدخول
create table if not exists public.access_requests (
  id bigserial primary key, name text not null, username text not null, contact text, dept text, note text,
  kind text not null default 'new', status text not null default 'pending',
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by text);
alter table public.access_requests enable row level security;

create or replace function public.tl_request_access(p_name text, p_username text, p_contact text, p_dept text, p_note text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 80
     or length(trim(coalesce(p_username,''))) < 3 or length(p_username) > 60
     or length(coalesce(p_contact,'')) > 80 or length(coalesce(p_dept,'')) > 80 or length(coalesce(p_note,'')) > 500
     or coalesce(p_kind,'new') not in ('new','reset') then raise exception 'invalid'; end if;
  if (select count(*) from public.access_requests where status = 'pending') >= 100 then raise exception 'too_many'; end if;
  if exists (select 1 from public.access_requests where status = 'pending' and lower(username) = lower(trim(p_username))
             and created_at > now() - interval '10 minutes') then raise exception 'duplicate'; end if;
  insert into public.access_requests (name, username, contact, dept, note, kind)
  values (trim(p_name), lower(trim(p_username)), nullif(trim(p_contact),''), nullif(trim(p_dept),''), nullif(trim(p_note),''), coalesce(p_kind,'new'));
end $$;

create or replace function public.tl_access_requests()
returns setof public.access_requests language plpgsql stable security definer set search_path = public as $$
begin
  if not public.tl_is_owner() then raise exception 'not_allowed'; end if;
  return query select * from public.access_requests order by created_at desc limit 200;
end $$;

create or replace function public.tl_resolve_request(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.tl_is_owner() then raise exception 'not_allowed'; end if;
  if p_status not in ('approved','rejected') then raise exception 'invalid'; end if;
  update public.access_requests set status = p_status, resolved_at = now(), resolved_by = auth.jwt()->>'email' where id = p_id;
end $$;

revoke all on function public.tl_admin_create_user(text,text,text,text), public.tl_admin_set_password(text,text),
  public.tl_admin_delete_user(text), public.tl_access_requests(), public.tl_resolve_request(bigint,text) from public, anon;
grant execute on function public.tl_admin_create_user(text,text,text,text), public.tl_admin_set_password(text,text),
  public.tl_admin_delete_user(text), public.tl_access_requests(), public.tl_resolve_request(bigint,text) to authenticated;
grant execute on function public.tl_request_access(text,text,text,text,text,text) to anon, authenticated;

-- إلغاء خطوة تأكيد البريد للمستخدمين الحاليين المضافين للبرنامج
update auth.users set email_confirmed_at = now()
where email_confirmed_at is null and lower(email) in (select lower(email) from public.members);

select 'تم التفعيل' as result;
