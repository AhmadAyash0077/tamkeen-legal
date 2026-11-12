/* صقل الواجهة: يجمع أزرار رأس الصفحة الزائدة في قائمة «المزيد»، ويمنع انكسار الأكواد والأرقام في الجداول.
   لا يغيّر أي بيانات ولا أي وظيفة — ينقل نفس الأزرار بنفس أحداثها. */
(function(){
  'use strict';
  var KEEP_OTHERS=2,MIN_TO_FOLD=5;
  function fold(row){
    var more=row.querySelector(':scope>.pl-more');
    var kids=[].filter.call(row.children,function(c){return c!==more&&!c.hidden&&c.style.display!=='none'});
    var total=kids.length+(more?more.querySelector('.pl-menu').children.length:0);
    if(!more&&total<MIN_TO_FOLD)return;
    var others=0,move=[];
    kids.forEach(function(c){
      var primary=c.classList.contains('primary')||!!c.querySelector(':scope>.primary');
      if(primary)return;
      others++;if(others>KEEP_OTHERS)move.push(c);
    });
    if(!move.length)return;
    if(!more){
      more=document.createElement('details');more.className='pl-more';
      var s=document.createElement('summary');s.className='btn';s.textContent='المزيد ▾';s.setAttribute('aria-label','إجراءات إضافية');
      var m=document.createElement('div');m.className='pl-menu';
      more.appendChild(s);more.appendChild(m);row.appendChild(more);
      m.addEventListener('click',function(e){if(e.target.closest('button,a'))setTimeout(function(){more.open=false},0)});
    }
    var menu=more.querySelector('.pl-menu');
    move.forEach(function(c){menu.appendChild(c)});
    if(row.lastElementChild!==more){/* أبقِ «المزيد» قبل الزر الأساسي الأخير إن وُجد */}
  }
  function cells(root){
    var tds=root.querySelectorAll('.table-wrap td:not(.pl-c)');
    for(var i=0;i<tds.length;i++){var td=tds[i];td.classList.add('pl-c');
      if(td.children.length&&!(td.children.length===1&&td.firstElementChild.classList.contains('ee-pen')))continue;var t=(td.textContent||'').replace('✎','').trim();
      if(t&&t.length<=16&&!/\s/.test(t)&&/[\d-]/.test(t))td.classList.add('pl-nw')}
  }
  var queued=false;
  function run(){queued=false;var v=document.getElementById('view');if(!v)return;
    try{[].forEach.call(v.querySelectorAll('.page-head>.row'),fold);cells(v)}catch(e){console.warn('polish',e)}}
  function queue(){if(queued)return;queued=true;setTimeout(run,30)}
  function start(){var v=document.getElementById('view');if(!v)return;
    new MutationObserver(queue).observe(v,{childList:true,subtree:true});queue()}
  document.addEventListener('click',function(e){
    [].forEach.call(document.querySelectorAll('details.pl-more[open]'),function(d){if(!d.contains(e.target))d.open=false})});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')[].forEach.call(document.querySelectorAll('details.pl-more[open]'),function(d){d.open=false})});
  if(document.readyState!=='loading')start();else document.addEventListener('DOMContentLoaded',start);
})();

/* تنبيه التحديث: إذا نزلت نسخة جديدة من البرنامج والصفحة المفتوحة قديمة، يظهر شريط «حدّث الآن» بدل ما يبقى المستخدم على النسخة القديمة. */
(function(){
  'use strict';
  var sig=function(html){return (html.match(/[\w-]+\.(?:js|css)\?v=\d+/g)||[]).join('|')+'#'+html.length};
  var mine=null,shown=false;
  function fresh(){return fetch(location.pathname+'?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():null})}
  function bar(){
    if(shown)return;shown=true;
    var b=document.createElement('div');b.className='pl-update';b.setAttribute('role','status');
    var t=document.createElement('span');t.textContent='نزل تحديث جديد للبرنامج.';
    var go=document.createElement('button');go.type='button';go.className='btn primary sm';go.textContent='حدّث الآن';
    go.onclick=function(){location.replace(location.pathname+'?u='+Date.now()+location.hash)};
    b.appendChild(t);b.appendChild(go);document.body.appendChild(b);
  }
  function check(){
    fresh().then(function(html){if(!html)return;var s=sig(html);if(mine===null){mine=s;return}if(s!==mine)bar()}).catch(function(){});
  }
  // توقيع الصفحة المحمّلة فعلًا (قد تكون من الكاش) مقابل نسخة الخادم
  function start(){
    var loaded=(document.documentElement.outerHTML.match(/[\w-]+\.(?:js|css)\?v=\d+/g)||[]).join('|');
    fresh().then(function(html){if(!html)return;mine=sig(html);var srv=mine.split('#')[0];if(loaded&&srv&&loaded!==srv)bar()}).catch(function(){});
    setInterval(check,5*60*1000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)check()});
  }
  if(document.readyState!=='loading')start();else document.addEventListener('DOMContentLoaded',start);
})();
