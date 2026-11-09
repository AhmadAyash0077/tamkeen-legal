import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createBridge,snapshot} from './bridge.mjs';
test('business namespaces isolate users and source records; drafts are not mirrored',()=>{
  const record={assistantMemory:[{id:'a',text:'accepted',reviewed:true},{id:'b',text:'draft'},{id:'c',text:'withdrawn',reviewed:true,withdrawn:true}]};
  const a=snapshot('user','cases','a',record);
  assert.equal(a.count,1);assert.doesNotMatch(a.text,/draft|withdrawn/);
  assert.notEqual(a.project,snapshot('other','cases','a',record).project);
  assert.notEqual(a.project,snapshot('user','cases','b',record).project);
});
test('bridge rejects foreign origins, missing sessions and forged host without contacting providers',async()=>{
  let calls=0;const server=createBridge({fetcher:async()=>{calls++;throw Error('unexpected')}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port;
  try{
    for(const [headers,status] of [[{host:'127.0.0.1:37721',origin:'https://evil.example'},403],[{host:'evil.example'},403],[{host:'127.0.0.1:37721'},401]]){
      const response=await new Promise((resolve,reject)=>{const req=http.request(url+'/sync',{method:'POST',headers},res=>{res.resume();res.on('end',()=>resolve(res))});req.on('error',reject);req.end('{}')});assert.equal(response.statusCode,status);
    }
    assert.equal(calls,0);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
test('sync rechecks owner and source access, deduplicates snapshot, and removes withdrawn mirror',async()=>{
  let role='owner',record={assistantMemory:[{id:'note',text:'synthetic record note',reviewed:true}]},rows=[],writes=0;
  const fake=async(url,options={})=>{
    const u=new URL(url);let value;
    if(u.pathname==='/auth/v1/user')value={id:'owner-test'};
    else if(u.pathname.endsWith('/my_role'))value=role;
    else if(u.pathname==='/rest/v1/records')value=record?[{data:record}]:[];
    else if(u.pathname==='/api/observations')value={items:rows.filter(x=>x.project===u.searchParams.get('project'))};
    else if(u.pathname==='/api/memory/save'){const item=JSON.parse(options.body);rows.push({...item,id:++writes});value={success:true,id:writes}}
    else if(u.pathname.startsWith('/api/observation/')&&options.method==='DELETE'){rows=rows.filter(x=>x.id!==Number(u.pathname.split('/').pop()));value={success:true}}
    else throw Error('Unexpected '+url);
    return Response.json(value);
  };
  const server=createBridge({fetcher:fake});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const sync=()=>new Promise((resolve,reject)=>{const req=http.request('http://127.0.0.1:'+server.address().port+'/sync',{method:'POST',headers:{host:'127.0.0.1:37721',authorization:'Bearer test',origin:'https://ahmadayash0077.github.io'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(body)}))});req.on('error',reject);req.end(JSON.stringify({mod:'cases',id:'synthetic'}))});
  try{
    assert.equal((await sync()).count,1);assert.equal(writes,1);
    assert.equal((await sync()).count,1);assert.equal(writes,1);
    role='viewer';assert.equal((await sync()).status,403);assert.equal(rows.length,1);
    role='owner';record.assistantMemory[0].withdrawn=true;assert.equal((await sync()).empty,true);assert.equal(rows.length,0);
    record=null;assert.equal((await sync()).status,404);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
