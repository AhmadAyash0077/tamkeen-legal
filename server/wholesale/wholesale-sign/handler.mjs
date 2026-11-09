const regions = new Set(['com','eu','in','com.au','jp','ca','sa','com.cn']);
const states = new Set(['draft','inprogress','completed','declined','expired','recalled']);
const idFormat = /^[0-9]{6,32}$/;
const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function summarizeRequest(document, id, requestId, signers) {
  if (!document || document.is_deleted !== false || document.is_sequential !== true
    || document.request_name !== 'Tamkeen Wholesale / '+id
    || String(document.request_id) !== requestId
    || !Array.isArray(document.actions) || document.actions.length!==3) throw Error('sign_mismatch');
  const ordered=[...document.actions].sort((a,b)=>Number(a.signing_order)-Number(b.signing_order));
  let signed=0;
  for (const [i, action] of ordered.entries()) {
    if (Number(action.signing_order)!==i+1 || action.action_type!=='SIGN'
      || String(action.recipient_email).trim().toLowerCase()!==signers[i]) throw Error('sign_mismatch');
    if (action.action_status==='SIGNED') {
      if (signed!==i) throw Error('sign_mismatch');
      signed++;
    }
  }
  const status=String(document.request_status).toLowerCase().replace(/[ _-]/g,'');
  if (!states.has(status) || (status==='completed' && signed!==3)) throw Error('sign_mismatch');
  return {status,signed};
}

export function signHandler(env, fetcher=fetch) {
  return async request=>{
    const origin=env('WHOLESALE_APP_ORIGIN');
    const incoming=request.headers.get('origin');
    const headers={
      'Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json',
      'Access-Control-Allow-Methods':'POST,OPTIONS',
      'Access-Control-Allow-Headers':'authorization,apikey,content-type'
    };
    if(origin && incoming===origin)headers['Access-Control-Allow-Origin']=origin;
    const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(!origin || incoming!==origin)return send({error:'wholesale_forbidden'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return send({error:'wholesale_forbidden'},405);

    const authorization=request.headers.get('authorization');
    if(!authorization?.startsWith('Bearer '))return send({error:'wholesale_forbidden'},401);
    const body=await request.json().catch(()=>null);
    if(body?.approved!==true || typeof body.id!=='string' || !uuidFormat.test(body.id)
      || typeof body.request_id!=='string' || !idFormat.test(body.request_id))
      return send({error:'invalid_signature'},400);

    const project=env('SUPABASE_URL'), key=env('SUPABASE_ANON_KEY');
    const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
    const region=env('WHOLESALE_SIGN_REGION'), client=env('WHOLESALE_SIGN_CLIENT_ID');
    const secret=env('WHOLESALE_SIGN_CLIENT_SECRET'), refresh=env('WHOLESALE_SIGN_REFRESH_TOKEN');
    const signers=['AHMED','SULTAN','ZUHAIR'].map(name=>String(env('WHOLESALE_SIGN_'+name)||'').trim().toLowerCase());
    if(!project || !key || !serviceKey || !regions.has(region) || !client || !secret || !refresh
      || new Set(signers).size!==3 || signers.some(email=>!emailFormat.test(email)))
      return send({error:'setup_required'},503);

    try {
      const safeFetch=(url,options)=>fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
      const rpc=await safeFetch(project+'/rest/v1/rpc/tl_wholesale',{
        method:'POST',headers:{authorization,apikey:key,'Content-Type':'application/json'},
        body:JSON.stringify({action:'sign_check',payload:{id:body.id,request_id:body.request_id,approved:true}})
      });
      if(!rpc.ok)return send({error:'wholesale_forbidden'},403);
      const oauth=await safeFetch('https://accounts.zoho.'+region+'/oauth/v2/token',{
        method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refresh,client_id:client,client_secret:secret})
      });
      const token=await oauth.json();
      if(!oauth.ok || typeof token.access_token!=='string' || !token.access_token)throw Error('sign_unavailable');
      const result=await safeFetch('https://sign.zoho.'+region+'/api/v1/requests/'+body.request_id,{
        headers:{Authorization:'Zoho-oauthtoken '+token.access_token}
      });
      const data=await result.json();
      if(!result.ok || data.code!==0)throw Error('sign_unavailable');
      const verified=summarizeRequest(data.requests,body.id,body.request_id,signers);
      const saved=await safeFetch(project+'/rest/v1/rpc/tl_wholesale_sign_result',{
        method:'POST',headers:{authorization:'Bearer '+serviceKey,apikey:serviceKey,'Content-Type':'application/json'},
        body:JSON.stringify({p_id:body.id,p_request_id:body.request_id,p_status:verified.status,p_signed:verified.signed})
      });
      if(!saved.ok)throw Error('sign_mismatch');
      return send(await saved.json());
    } catch(error) {
      return send({error:error.message==='sign_mismatch'?'sign_mismatch':'sign_unavailable'},502);
    }
  };
}
