-- Apply in a test Supabase project before production. No changes to legacy contracts.
begin;
create schema if not exists wholesale_private;
revoke all on schema wholesale_private from public, anon, authenticated;

create table if not exists wholesale_private.settings (
  singleton boolean primary key default true check (singleton),
  mail_enabled boolean not null default false
);
insert into wholesale_private.settings(singleton) values(true) on conflict do nothing;

create table if not exists wholesale_private.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('legal','accountant','viewer'))
);
create table if not exists wholesale_private.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration text not null unique check (registration ~ '^[0-9]{10}$'),
  legacy_path text unique,
  customer_code text,
  nafith jsonb,
  created_at timestamptz not null default now()
);
alter table wholesale_private.clients add column if not exists documents_review jsonb;
alter table wholesale_private.clients add column if not exists profile jsonb not null default '{}';
create unique index if not exists wholesale_customer_code
  on wholesale_private.clients (lower(customer_code)) where customer_code is not null;

create table if not exists wholesale_private.intake (
  id uuid primary key,
  client_id uuid not null references wholesale_private.clients(id),
  channel text not null check (channel in ('whatsapp','zoho','manual')),
  message text not null,
  source_ref text,
  created_at timestamptz not null default now()
);
alter table wholesale_private.intake add column if not exists profile jsonb not null default '{}';
create unique index if not exists wholesale_mail_source
  on wholesale_private.intake (source_ref) where channel = 'zoho';

create table if not exists wholesale_private.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references wholesale_private.clients(id),
  intake_id uuid references wholesale_private.intake(id),
  kind text not null check (kind in ('support','nafith','chamber','customer','zoho')),
  filename text not null,
  version integer not null,
  content bytea not null,
  created_at timestamptz not null default now(),
  unique (client_id, kind, filename, version)
);
create table if not exists wholesale_private.proofs (
  client_id uuid not null references wholesale_private.clients(id),
  kind text not null check (kind in ('nafith','chamber','customer')),
  reference text not null,
  document_id uuid not null references wholesale_private.documents(id),
  primary key (client_id, kind)
);
create table if not exists wholesale_private.signatures (
  client_id uuid not null references wholesale_private.clients(id),
  step integer not null check (step between 1 and 3),
  request_id text not null,
  signed_at timestamptz not null,
  certificate_id uuid not null references wholesale_private.documents(id),
  primary key (client_id, step),
  unique (request_id, step)
);
create table if not exists wholesale_private.sign_status (
  client_id uuid primary key references wholesale_private.clients(id),
  request_id text not null unique,
  status text not null check (status in ('draft','inprogress','completed','declined','expired','recalled')),
  signed integer not null check (signed between 0 and 3),
  checked_at timestamptz not null default now()
);
create table if not exists wholesale_private.audit (
  id bigint generated always as identity primary key,
  client_id uuid not null references wholesale_private.clients(id),
  actor uuid not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Keep the private tables closed even if default API privileges change later.
alter table wholesale_private.settings enable row level security;
alter table wholesale_private.staff enable row level security;
alter table wholesale_private.clients enable row level security;
alter table wholesale_private.intake enable row level security;
alter table wholesale_private.documents enable row level security;
alter table wholesale_private.proofs enable row level security;
alter table wholesale_private.signatures enable row level security;
alter table wholesale_private.sign_status enable row level security;
alter table wholesale_private.audit enable row level security;

create or replace function wholesale_private.normalize_digits(value text) returns text
language sql immutable set search_path = '' as $$
  select translate(coalesce(value,''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
$$;
create or replace function wholesale_private.normalize_name(value text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(translate(coalesce(value,''), 'أإآٱىةؤئ', 'اااايهوي'), '[[:space:][:punct:]ـً-ْ]+', '', 'g'))
$$;

create or replace function wholesale_private.legacy_matches(registration text, name text)
returns table(path text, registration_no text, trade_name text)
language sql stable set search_path = '' as $$
  select r.path, wholesale_private.normalize_digits(trim(r.data->>'cr_no')),
         coalesce(nullif(r.data->>'trade_name',''), r.data->>'title', r.path)
  from public.records r
  where r.owner = '00000000-0000-0000-0000-000000000001'
    and r.path like 'contracts/%' and r.path not like 'contracts/%/%'
    and coalesce(r.data->>'fileKind','') <> 'تركيب' and coalesce(r.data->>'ctype','') <> 'تركيب'
    and (wholesale_private.normalize_digits(trim(r.data->>'cr_no')) = registration
      or wholesale_private.normalize_name(coalesce(nullif(r.data->>'trade_name',''),r.data->>'title')) = wholesale_private.normalize_name(name))
  order by r.path
$$;

create or replace function wholesale_private.status(c wholesale_private.clients) returns text
language sql stable set search_path = '' as $$
  select case
    when (select count(*) from wholesale_private.signatures s where s.client_id=c.id) < 3 then 'signatures'
    when c.customer_code is null then 'accounting'
    when c.nafith is not null and c.documents_review is not null and (select count(*) from wholesale_private.proofs p where p.client_id=c.id)=3 then 'active'
    else 'requirements' end
$$;

create or replace function wholesale_private.add_document(client uuid, intake uuid, payload jsonb) returns uuid
language plpgsql set search_path = '' as $$
<<doc>>
declare
  category text := coalesce(payload->>'kind','support');
  filename text := trim(payload->>'name');
  encoded text := payload->>'content';
  bytes bytea;
  document_id uuid;
begin
  if category not in ('support','nafith','chamber','customer','zoho')
    or filename is null or length(filename) not between 1 and 160 or filename ~ '[[:cntrl:]/\\]'
    or filename !~* '\.(pdf|png|jpe?g|webp|docx|xlsx)$'
    or (category <> 'support' and filename !~* '\.(pdf|png|jpe?g|webp)$')
    or (category = 'zoho' and filename !~* '\.pdf$')
    or encoded is null or length(encoded) not between 4 and 6990508
    or encoded !~ '^[A-Za-z0-9+/]+={0,2}$'
  then raise exception 'invalid_document'; end if;
  bytes := decode(encoded,'base64');
  if octet_length(bytes) not between 1 and 5242880 then raise exception 'invalid_document'; end if;
  insert into wholesale_private.documents(client_id,intake_id,kind,filename,content,version)
  values(client,intake,category,filename,bytes,1 + coalesce((
    select max(d.version) from wholesale_private.documents d
    where d.client_id=client and d.kind=category and d.filename=doc.filename
  ),0)) returning id into document_id;
  return document_id;
end $$;

create or replace function public.tl_wholesale(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
<<ctx>>
declare
  actor uuid := auth.uid();
  staff_role text;
  c wholesale_private.clients;
  client uuid;
  receipt uuid;
  selected_path text;
  name text;
  registration text;
  channel text;
  source_ref text;
  message text;
  matches jsonb;
  found_existing uuid;
  files jsonb;
  reviewed_profile jsonb;
  item jsonb;
  document_id uuid;
  category text;
  reference text;
  customer_code text;
  request_id text;
  sign_step integer;
  signed_at timestamptz;
  prev wholesale_private.signatures;
  due_date date;
  details jsonb := '{}';
begin
  select s.role into staff_role from wholesale_private.staff s where s.user_id=actor;
  if staff_role is null then raise exception 'wholesale_forbidden'; end if;

  if action='list' then
    return jsonb_build_object('role',staff_role,'mail_enabled',
      staff_role='legal' and (select mail_enabled from wholesale_private.settings where singleton),
      'clients',coalesce((
      select jsonb_agg(to_jsonb(f)) from (
        select x.id,x.name,x.registration,x.customer_code,wholesale_private.status(x) as status
        from wholesale_private.clients x order by x.created_at desc,x.id
      ) f),'[]'));
  end if;

  if action in ('check','create') then
    if staff_role <> 'legal' then raise exception 'wholesale_forbidden'; end if;
    name := trim(payload->>'name');
    registration := wholesale_private.normalize_digits(trim(payload->>'registration'));
    if name is null or length(name) not between 2 and 160 or wholesale_private.normalize_name(name) = ''
       or registration !~ '^[0-9]{10}$' then raise exception 'invalid_identity'; end if;
    if action='create' then
      perform pg_advisory_xact_lock(hashtextextended(wholesale_private.normalize_name(name), 671));
    end if;
    select x.id into found_existing from wholesale_private.clients x where x.registration=ctx.registration;
    select coalesce(jsonb_agg(to_jsonb(m)), '[]') into matches
    from wholesale_private.legacy_matches(registration,name) m;
    if action='check' then
      return jsonb_build_object('existing',found_existing,'legacy',matches,'similar',coalesce((
        select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'registration',x.registration))
        from wholesale_private.clients x where x.registration<>ctx.registration
          and wholesale_private.normalize_name(x.name)=wholesale_private.normalize_name(ctx.name)
      ),'[]'));
    end if;
    if found_existing is not null then
      if exists (select 1 from wholesale_private.intake i
        where i.client_id=found_existing and i.id=(payload->>'receipt')::uuid)
      then return jsonb_build_object('id',found_existing); end if;
      raise exception 'duplicate_client';
    end if;
    selected_path := nullif(payload->>'legacy_path','');
    if exists(select 1 from jsonb_array_elements(matches) m where m->>'registration_no'=registration) and selected_path is null then
      raise exception 'legacy_link_required';
    end if;
    if selected_path is not null and payload->>'reviewed' is distinct from 'true' then raise exception 'legacy_review_required'; end if;
    if selected_path is not null and not exists (
      select 1 from jsonb_array_elements(matches) m
      where m->>'path'=selected_path and (m->>'registration_no'=registration or (m->>'registration_no'='' and not exists(select 1 from jsonb_array_elements(matches) exact_match where exact_match->>'registration_no'=registration)))
    ) then raise exception 'legacy_conflict'; end if;
    if selected_path is null and (
      jsonb_array_length(matches)>0 or exists (
        select 1 from wholesale_private.clients x where wholesale_private.normalize_name(x.name)=wholesale_private.normalize_name(ctx.name)
      )
    ) and coalesce(payload->>'reviewed','false') <> 'true' then raise exception 'legacy_review_required'; end if;
    begin
      insert into wholesale_private.clients(name,registration,legacy_path)
      values(name,registration,selected_path) returning * into c;
    exception when unique_violation then raise exception 'duplicate_client'; end;
  else
    if action not in ('detail','download','intake','document','prepare','proof','signature','code','sign_check','review_documents') then
      raise exception 'invalid_action';
    end if;
    client := (payload->>'id')::uuid;
    if action in ('detail','download') then
      select * into c from wholesale_private.clients x where x.id=client;
    else
      select * into c from wholesale_private.clients x where x.id=client for update;
    end if;
    if c.id is null then raise exception 'client_not_found'; end if;
  end if;

  if action='detail' then
    return to_jsonb(c) || jsonb_build_object(
      'status',wholesale_private.status(c),
      'intake',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from wholesale_private.intake i where i.client_id=c.id),'[]'),
      'documents',coalesce((select jsonb_agg(to_jsonb(d)-'content' order by d.created_at desc,d.version desc) from (
        select id,kind,filename,version,created_at,intake_id from wholesale_private.documents where client_id=c.id
      ) d),'[]'),
      'proofs',coalesce((select jsonb_agg(to_jsonb(p)) from wholesale_private.proofs p where p.client_id=c.id),'[]'),
      'zoho_status',(select to_jsonb(z) from wholesale_private.sign_status z where z.client_id=c.id),
      'signatures',coalesce((select jsonb_agg(to_jsonb(s) order by s.step) from wholesale_private.signatures s where s.client_id=c.id),'[]'),
      'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from (
        select * from wholesale_private.audit a where a.client_id=c.id order by a.id desc limit 50
      ) a),'[]')
    );
  end if;
  if action='download' then
    select jsonb_build_object('name',d.filename,'content',encode(d.content,'base64')) into details
    from wholesale_private.documents d where d.client_id=c.id and d.id=(payload->>'document_id')::uuid;
    if details is null then raise exception 'invalid_document'; end if;
    return details;
  end if;

  if action='code' then
    if staff_role <> 'accountant' then raise exception 'wholesale_forbidden'; end if;
    if (select count(*) from wholesale_private.signatures s where s.client_id=c.id)<>3 then raise exception 'signatures_pending'; end if;
    customer_code := wholesale_private.normalize_digits(trim(payload->>'code'));
    if customer_code is null or length(customer_code) not between 1 and 64 or customer_code ~ '[[:cntrl:]]' then raise exception 'invalid_code'; end if;
    if exists (select 1 from public.records r where r.owner='00000000-0000-0000-0000-000000000001'
      and r.path like 'contracts/%' and r.path not like 'contracts/%/%'
      and r.path is distinct from c.legacy_path
      and lower(wholesale_private.normalize_digits(trim(r.data->>'customer_code')))=lower(customer_code)
    ) then raise exception 'duplicate_code'; end if;
    begin
      update wholesale_private.clients x set customer_code=ctx.customer_code where x.id=c.id;
    exception when unique_violation then raise exception 'duplicate_code'; end;
    details := jsonb_build_object('code',customer_code);
  elsif staff_role <> 'legal' then
    raise exception 'wholesale_forbidden';
  elsif action in ('create','intake') then
    receipt := (payload->>'receipt')::uuid;
    channel := payload->>'channel';
    message := trim(coalesce(payload->>'message',''));
    source_ref := nullif(trim(payload->>'source_ref'),'');
    files := coalesce(payload->'files','[]');
    if channel='zoho' and not (select mail_enabled from wholesale_private.settings where singleton)
    then raise exception 'mail_disabled'; end if;
    if receipt is null or channel is null or channel not in ('whatsapp','zoho','manual')
       or length(message)>32000 or jsonb_typeof(files)<>'array'
       or jsonb_array_length(files)>12 or (channel='zoho' and coalesce(source_ref,'') !~ '^[0-9]+_[0-9]+$')
       or (channel='whatsapp' and message='' and jsonb_array_length(files)=0)
       or (action='intake' and message='' and jsonb_array_length(files)=0)
    then raise exception 'invalid_intake'; end if;
    if exists (select 1 from wholesale_private.intake i where i.id=receipt and i.client_id=c.id)
    then return jsonb_build_object('id',c.id); end if;
    if (select coalesce(sum(length(f->>'content')),0) from jsonb_array_elements(files) f)>22369664 then
      raise exception 'intake_size_limit';
    end if;
    reviewed_profile := coalesce(payload->'profile','{}');
    if jsonb_typeof(reviewed_profile)<>'object' then raise exception 'invalid_profile'; end if;
    if reviewed_profile<>'{}' then
      if payload->>'profile_reviewed' is distinct from 'true' or exists (
        select 1 from jsonb_each(reviewed_profile) as field(k,v)
        where field.k not in ('unified','old_registration','city','confirm','activity','address','manager','title','mobile','email',
          'ref','date','hijri','e1_name','e1_nat','e1_id','e1_title','e1_mobile','e2_name','e2_nat','e2_id','e2_title','e2_mobile')
          or jsonb_typeof(field.v)<>'string' or length(trim(field.v #>> '{}')) not between 1 and 160
          or (field.v #>> '{}') ~ '[[:cntrl:]]'
      ) or (reviewed_profile ? 'unified' and reviewed_profile->>'unified' !~ '^70[0-9]{8}$')
        or (reviewed_profile ? 'unified' and reviewed_profile->>'unified' <> c.registration)
      then raise exception 'invalid_profile'; end if;
      if action='intake' and payload->'profile_base' is distinct from c.profile then
        raise exception 'profile_changed';
      end if;
    end if;
    begin
      insert into wholesale_private.intake(id,client_id,channel,message,source_ref,profile)
      values(receipt,c.id,channel,message,source_ref,reviewed_profile);
    exception when unique_violation then raise exception 'duplicate_intake'; end;
    for item in select value from jsonb_array_elements(files) loop
      perform wholesale_private.add_document(c.id,receipt,item || '{"kind":"support"}');
    end loop;
    if jsonb_array_length(files)>0 or reviewed_profile<>'{}' then
      update wholesale_private.clients x set documents_review=null,profile=x.profile || reviewed_profile where x.id=c.id;
    end if;
    details := jsonb_build_object('receipt',receipt,'channel',channel,'profile_fields',
      coalesce((select jsonb_agg(k order by k) from jsonb_object_keys(reviewed_profile) k),'[]'));
  elsif action='document' then
    document_id := wholesale_private.add_document(c.id,null,payload);
    if coalesce(payload->>'kind','support')='support' then
      update wholesale_private.clients x set documents_review=null where x.id=c.id;
    end if;
    details := jsonb_build_object('document_id',document_id);
  elsif action='review_documents' then
    reference := trim(coalesce(payload->>'reference',''));
    files := coalesce(payload->'documents','[]');
    if payload->>'reviewed' is distinct from 'true' or length(reference) not between 2 and 500
      or jsonb_typeof(files)<>'array' or jsonb_array_length(files) not between 1 and 100
      or exists(select 1 from jsonb_array_elements_text(files) f
        where not exists(select 1 from wholesale_private.documents d
          where d.client_id=c.id and d.kind='support' and d.id::text=f.value
          and not exists(select 1 from wholesale_private.documents later
            where later.client_id=c.id and later.kind=d.kind and later.filename=d.filename and later.version>d.version)))
    then raise exception 'invalid_documents_review'; end if;
    details := jsonb_build_object('reference',reference,'documents',files);
    update wholesale_private.clients x set documents_review=details || jsonb_build_object('reviewed_at',now(),'reviewed_by',actor)
    where x.id=c.id;
  elsif action='prepare' then
    if coalesce(payload->>'amount','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
       or (payload->>'amount')::numeric <= 0
       or length(trim(coalesce(payload->>'issuer',''))) not between 2 and 160
       or coalesce(payload->>'due','') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception 'invalid_nafith'; end if;
    due_date := (payload->>'due')::date;
    if due_date < date '1900-01-01' then raise exception 'invalid_nafith'; end if;
    if exists (select 1 from wholesale_private.proofs p where p.client_id=c.id and p.kind='nafith') then
      raise exception 'nafith_already_verified';
    end if;
    update wholesale_private.clients x set nafith=jsonb_build_object('amount',(payload->>'amount')::numeric,
      'issuer',trim(payload->>'issuer'),'due',due_date,'currency','SAR') where x.id=c.id;
  elsif action='proof' then
    category := payload->>'kind';
    reference := trim(coalesce(payload->>'reference',''));
    document_id := (payload->>'document_id')::uuid;
    if category is null or category not in ('nafith','chamber','customer') or length(reference) not between 2 and 160
       or payload->>'reviewed' is distinct from 'true'
       or (category='nafith' and c.nafith is null)
       or not exists(select 1 from wholesale_private.documents d where d.client_id=c.id and d.id=document_id and d.kind=category)
    then raise exception 'invalid_proof'; end if;
    insert into wholesale_private.proofs(client_id,kind,reference,document_id)
    values(c.id,category,reference,document_id)
    on conflict on constraint proofs_pkey do update set reference=excluded.reference,document_id=excluded.document_id;
    details := jsonb_build_object('kind',category,'reference',reference,'document_id',document_id);
  elsif action='sign_check' then
    request_id := trim(coalesce(payload->>'request_id',''));
    if request_id !~ '^[0-9]{6,32}$' or payload->>'approved' is distinct from 'true'
      or exists(select 1 from wholesale_private.signatures s where s.client_id=c.id and s.request_id<>ctx.request_id)
      or exists(select 1 from wholesale_private.signatures s where s.client_id<>c.id and s.request_id=ctx.request_id)
    then raise exception 'invalid_signature'; end if;
    details := jsonb_build_object('request_id',request_id);
  elsif action='signature' then
    sign_step := (payload->>'step')::integer;
    request_id := trim(coalesce(payload->>'request_id',''));
    signed_at := (payload->>'signed_at')::timestamptz;
    document_id := (payload->>'document_id')::uuid;
    if request_id !~ '^[0-9]{6,32}$' or signed_at is null or signed_at>now()
       or payload->>'reviewed' is distinct from 'true'
       or not exists(select 1 from wholesale_private.documents d where d.client_id=c.id and d.id=document_id and d.kind='zoho')
    then raise exception 'invalid_signature'; end if;
    if not exists (select 1 from wholesale_private.sign_status z where z.client_id=c.id
      and z.request_id=ctx.request_id and z.status='completed' and z.signed=3)
    then raise exception 'zoho_verification_required'; end if;
    if sign_step is distinct from (select count(*)::integer+1 from wholesale_private.signatures s where s.client_id=c.id)
       or sign_step>3 then raise exception 'signature_order'; end if;
    if sign_step>1 then
      select * into prev from wholesale_private.signatures s where s.client_id=c.id and s.step=sign_step-1;
      if prev.request_id<>request_id or prev.signed_at>signed_at or prev.certificate_id<>document_id then
        raise exception 'signature_order';
      end if;
    end if;
    begin
      insert into wholesale_private.signatures values(c.id,sign_step,request_id,signed_at,document_id);
    exception when unique_violation then raise exception 'signature_reused'; end;
    details := jsonb_build_object('step',sign_step,'request_id',request_id,'document_id',document_id);
  end if;

  insert into wholesale_private.audit(client_id,actor,action,details) values(c.id,actor,action,details);
  return jsonb_build_object('id',c.id);
end $$;

revoke all on function public.tl_wholesale(text,jsonb) from public, anon, authenticated;
grant execute on function public.tl_wholesale(text,jsonb) to authenticated;

-- Only the server may write results obtained directly from Zoho.
create or replace function public.tl_wholesale_sign_result(
  p_id uuid, p_request_id text, p_status text, p_signed integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  previous wholesale_private.sign_status;
  result wholesale_private.sign_status;
begin
  if p_request_id is null or p_request_id !~ '^[0-9]{6,32}$' or p_status is null or p_signed is null
    or (p_status='completed' and p_signed<>3) then raise exception 'invalid_signature'; end if;
  perform 1 from wholesale_private.clients c where c.id=p_id for update;
  if not found then raise exception 'client_not_found'; end if;
  select * into previous from wholesale_private.sign_status z where z.client_id=p_id;
  if previous.status='completed' or (previous.request_id=p_request_id and (
    previous.signed>p_signed or (previous.status in ('declined','expired','recalled') and p_status in ('draft','inprogress'))
  )) then
    if previous.request_id<>p_request_id then raise exception 'signature_reused'; end if;
    return jsonb_build_object('status',previous.status,'signed',previous.signed);
  end if;
  if previous.request_id<>p_request_id and previous.status in ('draft','inprogress') then
    raise exception 'signature_order';
  end if;
  insert into wholesale_private.sign_status(client_id,request_id,status,signed)
  values(p_id,p_request_id,p_status,p_signed)
  on conflict (client_id) do update set request_id=excluded.request_id,status=excluded.status,signed=excluded.signed,checked_at=now()
  returning * into result;
  return jsonb_build_object('status',result.status,'signed',result.signed);
end $$;
revoke all on function public.tl_wholesale_sign_result(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.tl_wholesale_sign_result(uuid,text,text,integer) to service_role;
commit;
