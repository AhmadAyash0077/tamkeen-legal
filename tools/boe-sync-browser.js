// يُشغَّل داخل متصفح على صفحة https://laws.boe.gov.sa/BoeLaws/Laws/ (الموقع يمنع السيرفرات)
// ينتج window.__OUT = {src,at,laws:[{id,t,u,date,pub,st,brief,arts:[{h,t,a?,s?}]}]}
(async()=>{
const txt=el=>{if(!el)return'';const c=el.cloneNode(true);c.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));c.querySelectorAll('p,div,li,tr').forEach(p=>p.append('\n'));return c.textContent.replace(/ /g,' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{2,}/g,'\n').trim()};
const parse=(html,u,t)=>{const d=new DOMParser().parseFromString(html,'text/html');const box=d.querySelector('.system_details_box');const lab={};if(box){const ss=[...box.querySelectorAll('*')].filter(e=>e.children.length===0).map(e=>e.textContent.trim().replace(/\s+/g,' ')).filter(Boolean);for(let i=0;i<ss.length-1;i++)if(['تاريخ الإصدار','تاريخ النشر','الحالة'].includes(ss[i])&&!lab[ss[i]])lab[ss[i]]=ss[i+1]}
 const root=d.querySelector('.app_inner_pages_container');if(!root)return null;const arts=[];let sec='';
 for(const el of root.querySelectorAll('.article_item, h3.center:not(.article_item h3), .system_title:not(h1)')){if(!el.classList.contains('article_item')){if(!el.closest('.article_item'))sec=el.textContent.trim().replace(/\s+/g,' ');continue}
  const h=el.querySelector(':scope > h3');const body=[...el.children].find(c=>c.classList.contains('HTMLContainer'));const am=[...el.querySelectorAll('.article_item_popup .HTMLContainer')].map(txt);arts.push({h:(h?.textContent||'').trim().replace(/\s+/g,' '),t:txt(body),...(am.length?{a:am}:{}),...(sec?{s:sec}:{})})}
 if(!arts.length){const cs=[...root.querySelectorAll('.HTMLContainer')].filter(c=>!c.closest('.system_brief'));const t2=cs.map(txt).filter(Boolean).join('\n\n');if(t2)arts.push({h:'نص الوثيقة',t:t2})}
 return{id:u.split('/')[4],t:d.querySelector('h1.system_title')?.textContent.trim()||t,u:'https://laws.boe.gov.sa'+u,date:lab['تاريخ الإصدار']||'',pub:lab['تاريخ النشر']||'',st:lab['الحالة']||'',brief:txt(d.querySelector('.system_brief .HTMLContainer')),arts}};
const fd=new DOMParser().parseFromString(await (await fetch('/BoeLaws/Laws/Folders')).text(),'text/html');
const L=[...new Map([...fd.querySelectorAll('a[href*="LawDetails"]')].map(a=>[a.getAttribute('href'),{t:a.textContent.trim(),u:a.getAttribute('href')}])).values()];
const D=[];const q=[...L];window.__PROG=0;
await Promise.all([1,2,3,4,5].map(async()=>{while(q.length){const x=q.shift();for(let k=0;k<3;k++){try{const r=await fetch(x.u);const p=parse(await r.text(),x.u,x.t);if(p)D.push(p);break}catch(e){await new Promise(r=>setTimeout(r,1500))}}window.__PROG++}}));
window.__OUT={src:'laws.boe.gov.sa',at:new Date().toISOString(),laws:D};})();
