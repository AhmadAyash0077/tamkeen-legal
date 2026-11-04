# يبني laws/all.json و laws/changes.json من ملف المزامنة (boe.json.gz) ويقارن بالنسخة السابقة
import gzip,json,re,sys,time,hashlib,subprocess
src=sys.argv[1]; repo=sys.argv[2] if len(sys.argv)>2 else '.'
exec(open(__file__.replace('build_laws.py','build_laws_num.py')).read().split("d=json.load(gzip.open('boe.json.gz'))")[0])
exec('def _n():\n  pass')
ns={};code=open(__file__.replace('build_laws.py','build_laws_num.py')).read()
num_src=code[code.index('def norm'):code.index('bad=collections')]
exec("import re\nTASH=re.compile('[\\u064B-\\u0652\\u0640]')\n"+num_src,ns)
num=ns['num']
d=json.load(gzip.open(src))
old={}
try: old={L['id']:L for L in json.load(open(repo+'/laws/all.json'))['laws']}
except Exception: pass
laws=[]
for L in d['laws']:
    arts=[]
    for a in L['arts']:
        row=[num(a.get('h','')),a.get('h',''),a.get('t','')]
        if a.get('s') or a.get('a'): row.append(a.get('s',''))
        if a.get('a'): row.append(a['a'])
        arts.append(row)
    t=re.sub(r'\s+',' ',L['t']).strip()
    kind='لائحة' if t.startswith(('اللائحة','لائحة')) else 'تنظيم' if t.startswith(('تنظيم','الترتيبات')) else 'قواعد' if t.startswith('قواعد') else 'نظام'
    laws.append({'id':L['id'],'t':t,'st':L['st'] or 'غير محدد','k':kind,'date':L['date'],'pub':L['pub'],'u':L['u'],'b':L['brief'],'a':arts})
laws.sort(key=lambda x:(x['st']!='ساري',x['t']))
h=lambda L:hashlib.md5(json.dumps(L['a'],ensure_ascii=False).encode()).hexdigest()
added=[];amended=[];repealed=[]
if old:
    for L in laws:
        o=old.get(L['id'])
        if not o: added.append({'id':L['id'],'t':L['t'],'note':L['st']})
        else:
            if o['st']=='ساري' and L['st']=='لاغي': repealed.append({'id':L['id'],'t':L['t']})
            elif h(o)!=h(L):
                ch=[a[1] for a,b in zip(L['a'],o['a']) if a!=b][:8]
                amended.append({'id':L['id'],'t':L['t'],'note':('تغيّر: '+'، '.join(ch)) if ch else 'تغيّر عدد المواد'})
v=time.strftime('%Y%m%d%H%M')
json.dump({'v':v,'src':'هيئة الخبراء بمجلس الوزراء — laws.boe.gov.sa','at':d['at'],'laws':laws},open(repo+'/laws/all.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'v':v,'n':len(laws),'arts':sum(len(x['a']) for x in laws),'at':d['at']},open(repo+'/laws/meta.json','w'),ensure_ascii=False)
if old: json.dump({'at':d['at'],'added':added,'amended':amended,'repealed':repealed,'note':'' if (added or amended or repealed) else 'لا تغييرات منذ المزامنة السابقة.'},open(repo+'/laws/changes.json','w'),ensure_ascii=False)
print(len(laws),'added',len(added),'amended',len(amended),'repealed',len(repealed))
