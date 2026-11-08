// Dedicated read-only Zoho receiver. Never writes production contract records.
const enc = new TextEncoder();
const regions = new Set(['com','eu','in','com.au','jp','ca','sa','com.cn']);
export function plain(s='') { return String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').slice(0,100000); }
export function suggest(text) {
  const t=plain(text).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  const get=r=>t.match(r)?.[1]?.trim()||'';
  return {ref_no:get(/(?:رقم العقد|contract\s*(?:no|number))\s*[:#：-]?\s*([\w/-]+)/i),
    trade_name:get(/(?:الاسم التجاري|اسم المنشأة|الطرف الثاني)\s*[:：]\s*([^\n]{3,100})/),
    cr_no:get(/(?:السجل التجاري|الرقم الموحد)\s*[:：]?\s*(7\d{9})/),
    value:get(/(?:قيمة العقد|contract value)\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/i)};
}
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(e){return crypto.subtle.importKey('raw',un64(e.TOKEN_KEY),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(e,value){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('tamkeen-zoho-v1')},await key(e),enc.encode(value)));}
export async function unseal(e,value){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:enc.encode('tamkeen-zoho-v1')},await key(e),un64(data)));}
function config(e){if(!regions.has(e.ZOHO_REGION)||!e.ZOHO_CLIENT_ID||!e.ZOHO_CLIENT_SECRET||!e.TOKEN_KEY||!e.CALLBACK_URL)throw Error('setup_required');return {accounts:'https://accounts.zoho.'+e.ZOHO_REGION,mail:'https://mail.zoho.'+e.ZOHO_REGION};}
async function user(req,e){const a=req.headers.get('authorization')||'';if(!a.startsWith('Bearer '))throw Error('unauthorized');const r=await fetch(e.SUPABASE_URL+'/auth/v1/user',{headers:{authorization:a,apikey:e.SUPABASE_PUBLISHABLE_KEY}});if(!r.ok)throw Error('unauthorized');const u=await r.json();if(!(e.ALLOWED_USER_IDS||'').split(',').map(s=>s.trim()).includes(u.id)&&!(u.email_confirmed_at&&e.REVIEWER_EMAIL&&String(u.email).toLowerCase()===e.REVIEWER_EMAIL.toLowerCase()))throw Error('forbidden');return u.id;}
async function token(e,params){const c=config(e);const r=await fetch(c.accounts+'/oauth/v2/token',{method:'POST',body:new URLSearchParams({...params,client_id:e.ZOHO_CLIENT_ID,client_secret:e.ZOHO_CLIENT_SECRET})});const j=await r.json();if(!r.ok||!j.access_token)throw Error('zoho_authorization_required');return j;}
async function access(e,c){return (await token(e,{grant_type:'refresh_token',refresh_token:await unseal(e,c.secret)})).access_token;}
async function zoho(e,t,path,raw=false){const r=await fetch(config(e).mail+'/api/accounts/'+e.ZOHO_ACCOUNT_ID+path,{headers:{Authorization:'Zoho-oauthtoken '+t},redirect:'manual'});if(!r.ok)throw Error('zoho_unavailable');if(raw)return r;const j=await r.json();if(j.status?.code>=400)throw Error('zoho_unavailable');return j.data;}
async function resolved(e){if(!e.MAILBOX_EMAIL)return e;const c=await e.DB.prepare('SELECT * FROM mailbox_config WHERE email=?').bind(e.MAILBOX_EMAIL).first();return c?{...e,ZOHO_ACCOUNT_ID:c.account_id,ZOHO_FOLDER_ID:c.folder_id}:e;}
async function discover(e,t){
 let stage='accounts_fetch';
 try {
 const r=await fetch(config(e).mail+'/api/accounts',{headers:{Authorization:'Zoho-oauthtoken '+t},redirect:'manual'});if(!r.ok)throw Error('zoho_unavailable');stage='accounts_json';const j=await r.json();
 stage='accounts_shape';if(!Array.isArray(j.data))throw Error('unexpected_zoho_response');
 const account=j.data.find(a=>Array.isArray(a.emailAddress)&&a.emailAddress.some(x=>String(x.mailId).toLowerCase()===e.MAILBOX_EMAIL.toLowerCase()));if(!account||!/^\d+$/.test(String(account.accountId)))throw Error('forbidden');
 e={...e,ZOHO_ACCOUNT_ID:String(account.accountId)};stage='folders_fetch';const folders=await zoho(e,t,'/folders');stage='folders_shape';if(!Array.isArray(folders))throw Error('unexpected_zoho_response');const inbox=folders.find(f=>f.path==='/Inbox'&&f.folderType==='Inbox');if(!inbox||!/^\d+$/.test(String(inbox.folderId)))throw Error('unexpected_zoho_response');
 e.ZOHO_FOLDER_ID=String(inbox.folderId);stage='mailbox_save';await e.DB.prepare('INSERT INTO mailbox_config(email,account_id,folder_id) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET account_id=excluded.account_id,folder_id=excluded.folder_id').bind(e.MAILBOX_EMAIL,e.ZOHO_ACCOUNT_ID,e.ZOHO_FOLDER_ID).run();return e;
 }catch(err){throw Error('discovery_'+stage);}
}
async function finishConnection(e,uid,encrypted,accessToken){
 if(e.MAILBOX_EMAIL)e=await discover(e,accessToken);
 await zoho(e,accessToken,'/messages/view?folderId='+e.ZOHO_FOLDER_ID+'&limit=1');
 await e.DB.prepare('INSERT INTO connections(id,uid,secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET uid=excluded.uid,secret=excluded.secret,error=NULL').bind(e.ZOHO_ACCOUNT_ID,uid,encrypted).run();
 await e.DB.prepare('DELETE FROM connections WHERE id=? AND uid=?').bind('pending_'+uid,uid).run();
}

const msgPath=d=>'/folders/'+encodeURIComponent(d.folderId)+'/messages/'+encodeURIComponent(d.messageId);
export async function sync(e,c){
  const t=await access(e,c);let count=0;
  // Rescan the dedicated contracts folder with stable IDs; never mark messages read.
  // At most 10 pages/run; stop with visible error rather than claim completeness.
  for(let page=0;page<10;page++){
    const rows=await zoho(e,t,'/messages/view?folderId='+e.ZOHO_FOLDER_ID+'&start='+(page*100+1)+'&limit=100&sortBy=date&sortorder=false');
    if(!Array.isArray(rows))throw Error('unexpected_zoho_response');
    for(const m of rows){
      if(!/^\d+$/.test(String(m.messageId))||String(m.folderId)!==e.ZOHO_FOLDER_ID)throw Error('unexpected_zoho_response');
      if(e.MAILBOX_EMAIL&&!/(عقد|عقود|تجديد|contract|renewal|agreement)/i.test(m.subject+' '+m.summary))continue;
      const id=e.ZOHO_ACCOUNT_ID+'_'+m.messageId;
      if(await e.DB.prepare('SELECT id FROM drafts WHERE id=?').bind(id).first())continue;
      const content=await zoho(e,t,msgPath(m)+'/content');
      const ai=String(m.hasAttachment)==='1'||m.hasAttachment===true?await zoho(e,t,msgPath(m)+'/attachmentinfo'):null;
      const attachments=(ai?.attachments||[]).map(a=>({id:String(a.attachmentId),name:String(a.attachmentName||'attachment'),size:Number(a.attachmentSize||0)}));
      const text=plain(content?.content||m.summary||'');
      const d={id,messageId:String(m.messageId),folderId:String(m.folderId),subject:String(m.subject||''),sender:String(m.fromAddress||''),received:String(m.receivedTime||''),kind:/تجديد|renew/i.test(m.subject+' '+text)?'renewal':'new',text,attachments,fields:suggest(text)};
      await e.DB.prepare('INSERT OR IGNORE INTO drafts(id,uid,data,created) VALUES(?,?,?,?)').bind(id,c.uid,JSON.stringify(d),new Date().toISOString()).run();count++;
    }
    if(rows.length<100){await e.DB.prepare('UPDATE connections SET last_sync=?,error=NULL WHERE id=?').bind(new Date().toISOString(),c.id).run();return count;}
  }
  throw Error('folder_over_1000_messages_narrow_folder');
}
export default {
 async fetch(req,e){
  e=await resolved(e);
  const url=new URL(req.url),origin=req.headers.get('origin');
  const headers={'Access-Control-Allow-Origin':e.APP_ORIGIN,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Vary':'Origin'};
  const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  let stage='request';
  try{
   if(url.pathname==='/oauth/complete')return new Response(null,{status:303,headers:{...headers,Location:e.APP_RETURN}});
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(url.pathname==='/oauth/start'&&req.method==='GET'){
    const state=url.searchParams.get('ticket');const st=await e.DB.prepare('SELECT uid FROM oauth_states WHERE state=? AND expires>?').bind(state,Date.now()).first();if(!st)throw Error('invalid_state');
    const target=new URL(config(e).accounts+'/oauth/v2/auth');target.search=new URLSearchParams({scope:e.MAILBOX_EMAIL?'ZohoMail.messages.READ,ZohoMail.accounts.READ,ZohoMail.folders.READ':'ZohoMail.messages.READ',client_id:e.ZOHO_CLIENT_ID,response_type:'code',access_type:'offline',prompt:'consent',redirect_uri:e.CALLBACK_URL,state}).toString();
    return new Response(null,{status:303,headers:{...headers,Location:target.href,'Set-Cookie':'tl_mail_state='+state+'; HttpOnly; Secure; SameSite=Lax; Path=/oauth; Max-Age=600'}});
   }
   if(url.pathname==='/oauth/callback'&&req.method==='GET'){
    config(e);const state=url.searchParams.get('state');
    if(!state||!req.headers.get('cookie')?.split(';').some(s=>s.trim()==='tl_mail_state='+state))throw Error('invalid_state');
    stage='state_consume';
    const st=await e.DB.prepare('DELETE FROM oauth_states WHERE state=? AND expires>? RETURNING uid').bind(state,Date.now()).first();if(!st||!url.searchParams.get('code'))throw Error('invalid_state');
    stage='token_exchange';
    const j=await token(e,{grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:e.CALLBACK_URL});if(!j.refresh_token)throw Error('zoho_authorization_required');
    stage='token_encryption';const encrypted=await seal(e,j.refresh_token);
    stage='pending_save';await e.DB.prepare('INSERT INTO connections(id,uid,secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret').bind('pending_'+st.uid,st.uid,encrypted).run();
    stage='mailbox_discovery';await finishConnection(e,st.uid,encrypted,j.access_token);
    return new Response(null,{status:303,headers:{...headers,Location:e.APP_RETURN,'Set-Cookie':'tl_mail_state=; HttpOnly; Secure; SameSite=Lax; Path=/oauth; Max-Age=0'}});
   }
   if(origin!==e.APP_ORIGIN)throw Error('forbidden');
   const uid=await user(req,e);config(e);
   if(req.method==='POST'&&url.pathname==='/connect'){
    const pending=await e.DB.prepare('SELECT * FROM connections WHERE id=? AND uid=?').bind('pending_'+uid,uid).first();
    if(pending){await finishConnection(e,uid,pending.secret,await access(e,pending));return json({url:new URL('/oauth/complete',req.url).href});}
    await key(e);
    const state=crypto.randomUUID();await e.DB.prepare('DELETE FROM oauth_states WHERE expires<?').bind(Date.now()).run();await e.DB.prepare('INSERT INTO oauth_states VALUES(?,?,?)').bind(state,uid,Date.now()+600000).run();
    // Cookie must be set during a top-level same-site navigation, via /oauth/start.
    return json({url:new URL('/oauth/start?ticket='+state,req.url).href});
   }
   const c=e.ZOHO_ACCOUNT_ID?await e.DB.prepare('SELECT * FROM connections WHERE id=? AND uid=?').bind(e.ZOHO_ACCOUNT_ID,uid).first():null;
   if(req.method==='GET'&&url.pathname==='/status')return json({connected:!!c,lastSync:c?.last_sync||null,error:c?.error||null});
   if(!c)throw Error('zoho_authorization_required');
   if(req.method==='POST'&&url.pathname==='/sync'){try{return json({imported:await sync(e,c)})}catch(err){await e.DB.prepare('UPDATE connections SET error=? WHERE id=?').bind(err.message,c.id).run();throw err;}}
   if(req.method==='GET'&&url.pathname==='/drafts'){const r=await e.DB.prepare("SELECT data FROM drafts WHERE uid=? AND status='pending' ORDER BY created DESC LIMIT 200").bind(uid).all();return json({drafts:r.results.map(x=>JSON.parse(x.data))});}
   if(req.method==='POST'&&url.pathname==='/disconnect'){
    const r=await fetch(config(e).accounts+'/oauth/v2/token/revoke',{method:'POST',body:new URLSearchParams({token:await unseal(e,c.secret)})});const j=await r.json();if(!r.ok||j.status!=='success')throw Error('revoke_failed');await e.DB.prepare('DELETE FROM connections WHERE id=? AND uid=?').bind(c.id,uid).run();return json({ok:true});
   }
   if(req.method==='POST'&&url.pathname==='/dismiss'){const b=await req.json();await e.DB.prepare("UPDATE drafts SET status='dismissed' WHERE id=? AND uid=?").bind(String(b.id),uid).run();return json({ok:true});}
   if(req.method==='GET'&&url.pathname==='/attachment'){
    const row=await e.DB.prepare('SELECT data FROM drafts WHERE id=? AND uid=?').bind(url.searchParams.get('draft'),uid).first();if(!row)throw Error('not_found');const d=JSON.parse(row.data),a=d.attachments.find(a=>a.id===url.searchParams.get('id'));if(!a)throw Error('not_found');
    const r=await zoho(e,await access(e,c),msgPath(d)+'/attachments/'+encodeURIComponent(a.id),true);
    const reader=r.body.getReader();let length=0,chunks=[];for(;;){const x=await reader.read();if(x.done)break;length+=x.value.length;if(length>20*1024*1024){await reader.cancel();throw Error('attachment_too_large');}chunks.push(x.value);}
    return new Response(new Blob(chunks),{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment','X-Content-Type-Options':'nosniff'}});
   }
   return json({error:'not_found'},404);
  }catch(err){const allowed=['unauthorized','forbidden','setup_required','invalid_state','zoho_authorization_required','zoho_unavailable','not_found','attachment_too_large','revoke_failed','folder_over_1000_messages_narrow_folder','unexpected_zoho_response','discovery_accounts_fetch','discovery_accounts_json','discovery_accounts_shape','discovery_folders_fetch','discovery_folders_shape','discovery_mailbox_save'];const code=allowed.includes(err.message)?err.message:'service_error';return json({error:code,...(code==='service_error'?{stage}: {})},code==='unauthorized'?401:code==='forbidden'?403:400);}
 },
 async scheduled(_event,e,ctx){ctx.waitUntil((async()=>{e=await resolved(e);config(e);if(!e.ZOHO_ACCOUNT_ID)return;const c=await e.DB.prepare('SELECT * FROM connections WHERE id=?').bind(e.ZOHO_ACCOUNT_ID).first();if(c)try{await sync(e,c)}catch(err){await e.DB.prepare('UPDATE connections SET error=? WHERE id=?').bind('sync_failed',c.id).run();}})());}
};
