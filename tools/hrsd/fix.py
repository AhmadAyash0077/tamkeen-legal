import json,re,collections,subprocess,sys
d=json.load(open('/home/claude/tamkeen-legal/laws/all.json'))
vocab=collections.Counter()
W=re.compile(r'[ء-ي]+')
for L in d['laws']:
    for a in L['a']:
        vocab.update(W.findall(re.sub('[ً-ْـ]','',a[2] or '')))
CTRL=re.compile('[‎‏‪-‮⁦-⁩﻿]')
PRE=('','و','ف','ب','ك','ل','وال','بال','فال','كال','لل','وب','ول','وك','فب','فل')
def variants(w):
    # positions where swap could apply
    idx=[]
    for m in re.finditer('(?=([اأإآ])ل)',w):
        i=m.start()
        idx.append(i)
    out={w}
    for i in idx:
        new=set()
        for v in out:
            if v[i+1:i+2]=='ل' and v[i] in 'اأإآ': new.add(v[:i]+'ل'+v[i]+v[i+2:])
        out|=new
    return out
cache={}
def fixword(w):
    if w in cache: return cache[w]
    vs=variants(w)
    o=vocab.get(w,0)
    best=max(vs,key=lambda v:(vocab.get(v,0), v==w))
    if vocab.get(best,0)==0 or (best!=w and o>=3 and vocab.get(best,0)<50*o): best=w
    cache[w]=best;return best
def joinfrag(t):
    def rep(m):
        a,b=m.group(1),m.group(2)
        ab=a+b
        if vocab.get(ab,0)>0 and (vocab.get(a,0)==0 or vocab.get(b,0)==0 or len(b)==1): return ab
        return m.group(0)
    prev=None
    while prev!=t:
        prev=t;t=re.sub(r'([ء-ي]+) ([ء-ي]+)',rep,t)
    return t
def clean(t):
    import unicodedata
    t=unicodedata.normalize('NFKC',t)
    t=CTRL.sub('',t)
    def _sp(m):
        toks=m.group(0).split(' ')
        if sum(1 for x in toks if len(x)==1)*2>=len(toks): return ''.join(toks)
        return m.group(0)
    t=re.sub(r'(?<![\u0621-\u064A])(?:[\u0621-\u064A]{1,2} ){3,}[\u0621-\u064A]{1,2}(?![\u0621-\u064A])',_sp,t)
    t=re.sub('ـ+ ?ـ*','',t)          # تطويل
    t=t.replace('ـ','')
    t=W.sub(lambda m:fixword(m.group(0)),t)
    t=t.translate(str.maketrans('()',')('))
    t=re.sub(r'\(\s*\)\s*([0-9][0-9\-]*)',r'(\1) ',t)
    t=re.sub(r'\.\)([0-9]+)',r'\1).',t)
    t=re.sub(r' ([،؛.])(?=[ء-ي])',r'\1 ',t)
    t=joinfrag(t)
    t=re.sub(r'(?m)^\s*\.\s*([0-9]+)\s*',r'\1. ',t)
    t=re.sub(r'(?m)^([0-9]+\.)\s*ً\s*$',r'\1',t)
    t=re.sub(r'(?m)^\s*ً\s*$','',t)
    t=re.sub(r'[ \t]+',' ',t); t=re.sub(r' *\n *','\n',t); t=re.sub(r'\n{2,}','\n',t)
    return t.strip()
if __name__=='__main__':
    f=sys.argv[1]
    raw=subprocess.run(['pdftotext',f,'-'],capture_output=True,text=True).stdout
    print(clean(raw))
