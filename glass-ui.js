/* تفعيل واجهة «تمكين الزجاجي» افتراضيًا، مع خيار الرجوع للشكل الكلاسيكي من الإعدادات.
   الاختيار يُحفظ في هذا المتصفح فقط (tl_ui). */
(function(){
  'use strict';
  var KEY='tl_ui';
  function get(){try{return localStorage.getItem(KEY)==='classic'?'classic':'glass'}catch(e){return'glass'}}
  function apply(v){if(v==='glass')document.documentElement.dataset.ui='glass';else delete document.documentElement.dataset.ui}
  apply(get());
  window.TamkeenUI={get:get,set:function(v){try{localStorage.setItem(KEY,v)}catch(e){}apply(v)}};
  function hook(){
    if(typeof window.viewPrefs!=='function'||typeof window.h!=='function'||window.viewPrefs.__ui)return;
    var orig=window.viewPrefs;
    window.viewPrefs=function(){
      var v=orig.apply(this,arguments);
      try{
        var h=window.h,box=h('div',{class:'panel'});
        var opt=function(val,label){var on=get()===val;return h('button',{type:'button',class:'btn sm'+(on?' primary':''),'aria-pressed':String(on),onclick:function(){window.TamkeenUI.set(val);paint()}},label)};
        var paint=function(){box.replaceChildren(
          h('h2',{style:'margin:0 0 6px;font-size:1.1rem'},'شكل الواجهة'),
          h('p',{class:'small muted',style:'margin:0 0 12px'},'«الزجاجي» هو التصميم الجديد. يُحفظ اختيارك على هذا الجهاز فقط.'),
          h('div',{class:'row'},opt('glass','الزجاجي'),opt('classic','الكلاسيكي')))};
        paint();
        var place=function(){var g=v.el.querySelector('.grid-dash');if(g&&!g.contains(box))g.prepend(box);else if(!g&&!v.el.contains(box))v.el.prepend(box)};
        place();var r=v.refresh;if(typeof r==='function')v.refresh=function(){r.apply(this,arguments);place()};
      }catch(e){console.warn('ui toggle',e)}
      return v};
    window.viewPrefs.__ui=true;
  }
  // انتقال ناعم عند تغيّر الصفحة فقط (لا يتكرر مع تحديثات الصفحة نفسها)
  var lastPage=null;
  window.addEventListener('hashchange',function(){
    if(document.documentElement.dataset.ui!=='glass')return;
    var page=(location.hash.slice(1)||'home').split('-')[0];if(page===lastPage)return;lastPage=page;
    var v=document.getElementById('view');if(!v)return;
    v.classList.remove('g-enter');void v.offsetWidth;v.classList.add('g-enter');
    setTimeout(function(){v.classList.remove('g-enter')},700);
  });
  if(document.readyState!=='loading')hook();else document.addEventListener('DOMContentLoaded',hook);
})();
