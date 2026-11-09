import test from 'node:test';
import assert from 'node:assert/strict';
import {signHandler,summarizeRequest} from './wholesale-sign/handler.mjs';

const id='ab000000-0000-0000-0000-000000000001';
const requestId='1222333444';
const signers=['ahmed@example.test','sultan@example.test','zuhair@example.test'];
const doc={
  request_id:requestId,request_name:'Tamkeen Wholesale / '+id,is_deleted:false,is_sequential:true,
  request_status:'completed',
  actions:signers.map((recipient_email,i)=>({recipient_email,signing_order:i+1,action_type:'SIGN',action_status:'SIGNED'}))
};
const config={
  WHOLESALE_APP_ORIGIN:'https://app.example.test',WHOLESALE_SIGN_REGION:'sa',SUPABASE_URL:'https://db.example.test',
  SUPABASE_ANON_KEY:'test-public-key',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',
  WHOLESALE_SIGN_CLIENT_ID:'test-client',WHOLESALE_SIGN_CLIENT_SECRET:'test-secret',WHOLESALE_SIGN_REFRESH_TOKEN:'test-refresh',
  WHOLESALE_SIGN_AHMED:signers[0],WHOLESALE_SIGN_SULTAN:signers[1],WHOLESALE_SIGN_ZUHAIR:signers[2]
};
const makeRequest=(approved=true, origin=config.WHOLESALE_APP_ORIGIN)=>new Request('https://db.example.test/sign',{
  method:'POST',headers:{origin,authorization:'Bearer test-user'},body:JSON.stringify({id,request_id:requestId,approved})
});

test('rejects parallel signing, another file, wrong recipients and a skipped signer',()=>{
  assert.deepEqual(summarizeRequest(doc,id,requestId,signers),{status:'completed',signed:3});
  for(const change of [
    {is_sequential:false},{request_name:'another file'},
    {actions:[...doc.actions.slice(0,2),{...doc.actions[2],recipient_email:'wrong@example.test'}]},
    {actions:[{...doc.actions[0],action_status:'NOACTION'},...doc.actions.slice(1)]},
    {actions:[{...doc.actions[0],signing_order:2},...doc.actions.slice(1)]}
  ]) assert.throws(()=>summarizeRequest({...doc,...change},id,requestId,signers),/sign_mismatch/);
});

test('requires consent and database authorization before calling Zoho',async()=>{
  const calls=[];
  const handler=signHandler(k=>config[k],async url=>{
    calls.push(url);
    return Response.json({error:'denied'},{status:403});
  });
  assert.equal((await handler(makeRequest(false))).status,400);
  assert.equal((await handler(makeRequest(true,'https://other.example.test'))).status,403);
  assert.equal(calls.length,0);
  assert.equal((await handler(makeRequest())).status,403);
  assert.deepEqual(calls,[config.SUPABASE_URL+'/rest/v1/rpc/tl_wholesale']);
});

test('persists only a verified provider response using server credentials',async()=>{
  const calls=[];
  const handler=signHandler(k=>config[k],async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/tl_wholesale'))return Response.json({id});
    if(url.endsWith('/token'))return Response.json({access_token:'provider-token'});
    if(url.endsWith(requestId))return Response.json({code:0,requests:doc});
    return Response.json({status:'completed',signed:3});
  });
  const response=await handler(makeRequest());
  assert.deepEqual(await response.json(),{status:'completed',signed:3});
  assert.deepEqual(calls.map(c=>new URL(c.url).hostname),['db.example.test','accounts.zoho.sa','sign.zoho.sa','db.example.test']);
  assert.equal(calls[2].options.method,undefined);
  assert.equal(calls[2].options.headers.Authorization,'Zoho-oauthtoken provider-token');
  assert.equal(calls[3].options.headers.authorization,'Bearer test-server-key');
  assert.equal(calls.every(c=>c.options.redirect==='error'),true);
  assert.deepEqual(JSON.parse(calls[3].options.body),{p_id:id,p_request_id:requestId,p_status:'completed',p_signed:3});
});
