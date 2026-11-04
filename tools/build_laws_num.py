import gzip,json,re,collections
d=json.load(gzip.open('boe.json.gz'))
TASH=re.compile('[ً-ْـ]')
def norm(s):
    s=TASH.sub('',s);s=re.sub('[أإآ]','ا',s);return s.replace('ى','ي').replace('ة','ه')
U={'الاولي':1,'الحاديه':1,'الواحده':1,'الثانيه':2,'الثالثه':3,'الرابعه':4,'الخامسه':5,'السادسه':6,'السابعه':7,'الثامنه':8,'التاسعه':9,'العاشره':10,
 'الاول':1,'الحادي':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10}
T={'العشرون':20,'الثلاثون':30,'الاربعون':40,'الخمسون':50,'الستون':60,'السبعون':70,'الثمانون':80,'التسعون':90,
   'العشرين':20,'الثلاثين':30,'الاربعين':40,'الخمسين':50,'الستين':60,'السبعين':70,'الثمانين':80,'التسعين':90}
H={'المائه':100,'الميه':100,'المئه':100,'المائتين':200,'المئتين':200,'المائتان':200,'الثلاثمائه':300,'الثلاثمئه':300,'الاربعمائه':400,'الاربعمئه':400,'الخمسمائه':500,'الستمائه':600,'السبعمائه':700,'الثمانمائه':800,'التسعمائه':900}
def num(h):
    m=re.search(r'(\d+)',h)
    s=norm(h)
    s=re.sub(r'(^|[^ل])ماده', r'\1الماده', s)
    if 'الماده' not in s: return None
    s=s.split('الماده',1)[1]
    m2=re.match(r'\D{0,12}?(\d+)',s)
    if m2: return int(m2.group(1))
    s=re.sub(r'[^\u0600-\u06FF\s:]',' ',s)
    s=s.split(':')[0].split('-')[0]
    w=re.findall(r'[؀-ۿ]+',s.replace('و',' و ') if False else s)
    # tokens: handle "والعشرون" -> "و" + "العشرون"
    toks=[]
    for x in re.findall(r'\S+',s):
        if x.startswith('و') and (x[1:] in T or x[1:] in U or x[1:] in H): toks+=[x[1:]]
        else: toks.append(x)
    n=0;seen=False;teen=False
    for i,x in enumerate(toks):
        if x in ('عشره','عشر'): n+=10;teen=True;seen=True;continue
        if x in U: n+=U[x];seen=True;continue
        if x in T: n+=T[x];seen=True;continue
        if x in H: n+=H[x];seen=True;continue
        if x in ('بعد','و'): continue
        if seen: break
    return n or None
bad=collections.Counter();tot=0
for L in d['laws']:
    prev=0
    for a in L['arts']:
        a['n']=num(a.get('h',''));tot+=1
        if a['n'] is None: bad['none']+=1
        elif prev and a['n']!=prev+1 and a['n']!=prev: bad['jump']+=1
        if a['n']: prev=a['n']
print(tot,bad)
# examples of none/jumps
k=0
for L in d['laws']:
    prev=0
    for a in L['arts']:
        if a['n'] is None or (prev and a['n']!=prev+1 and a['n']!=prev):
            if k<25: print(L['t'][:30],'|',a['h'][:60],'|',a['n'],prev);k+=1
        if a['n']: prev=a['n']
json.dump(d,open('boe_n.json','w'),ensure_ascii=False)
