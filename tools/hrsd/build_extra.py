import re,json,sys
sys.path.insert(0,'/home/claude/laws')
TASH=re.compile('[ً-ْـ]')
exec(open('/home/claude/laws/conv.py').read().split("bad=collections")[0].split("d=json.load(gzip.open('boe.json.gz'))")[1].replace('',''),globals()) if False else None
src=open('/home/claude/laws/conv.py').read()
ns={}
exec("import re\nTASH=re.compile('[\\u064B-\\u0652\\u0640]')\n"+src[src.index('def norm'):src.index('bad=collections')],ns)
num=ns['num']
NOISE=re.compile(r'^(\d+|صفحة ?\d+|\d+ ?صفحة|www\.hrsd\.gov\.sa|.*Classi.*|.*[A-Za-z]{4,}.*)$')
HEAD=re.compile(r'^(ال)?ماد[ةه]\s*(\(|[0-9]|ال|رقم)')
def split(text,title_noise=(),stop=None,lawq=False):
    if stop and stop in text: text=text[:text.index(stop)]
    lines=[l.strip() for l in text.split('\n')]
    arts=[];cur=None;pre=[];sec=''
    for l in lines:
        if not l or NOISE.match(l) or l in title_noise: continue
        if re.match(r'^(الباب|الفصل)\s',l) and len(l)<80 and not re.search(r'_{3,}',l):
            sec=l if not re.match(r'^الفصل',l) or not sec.startswith('الباب') else sec.split(' — ')[0]+' — '+l; continue
        if re.search(r'_{4,}',l): continue
        if HEAD.match(l) and len(l)<90:
            m=re.match(r'^(.{0,70}?)\s*[:：]\s*(.*)$',l)
            head=(m.group(1) if m else l).strip(); rest=m.group(2) if m else ''
            n=num(head)
            if lawq and n and not re.search(r'[0-9]',head):  # مادة النظام المنقولة داخل اللائحة
                head=head+' (من النظام)'; n=None
            cur={'h':head,'n':n,'t':rest,'s':sec};arts.append(cur);continue
        if cur: cur['t']+=('\n' if cur['t'] else '')+l
        else: pre.append(l)
    from collections import Counter
    hc=Counter(a['h'] for a in arts)
    arts=[a for a in arts if not (hc[a['h']]>1 and len(a['t'].strip())<3)]
    out=[]
    if pre: out.append([None,'الديباجة','\n'.join(pre)])
    for a in arts:
        row=[a['n'],a['h'],a['t'].strip()]
        if a['s']: row.append(a['s'])
        out.append(row)
    return out
docs=[
 ('hrsd-exec','اللائحة التنفيذية لنظام العمل','exec.txt',dict(stop='والله ولي التوفيق',lawq=True),'2025-04/%D8%A7%D9%84%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%A7%D9%84%D8%AA%D9%86%D9%81%D9%8A%D8%B0%D9%8A%D8%A9%20%D9%84%D9%86%D8%B8%D8%A7%D9%85%20%D8%A7%D9%84%D8%B9%D9%85%D9%84%20%D9%88%D9%85%D9%84%D8%AD%D9%82%D8%A7%D8%AA%D9%87%D8%A7.pdf','الصادرة بالقرار الوزاري رقم 115921 وتاريخ 1443/8/19هـ وتعديلاتها. الملاحق (النموذج الموحد للائحة تنظيم العمل، ونماذج العقود) في الملف الرسمي.'),
 ('hrsd-domestic','لائحة العمالة المنزلية ومن في حكمهم','domestic.txt',dict(),'2023-10/%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B9%D9%85%D8%A7%D9%84%D8%A9%20%D8%A7%D9%84%D9%85%D9%86%D8%B2%D9%84%D9%8A%D8%A9%20%D9%88%D9%85%D9%86%20%D9%81%D9%8A%20%D8%AD%D9%83%D9%85%D9%87%D9%85.pdf',''),
 ('hrsd-ajeer','القواعد المنظمة لتعهيد خدمات العمالة غير السعودية بين المنشآت (برنامج أجير)','ajeer.txt',dict(),'2026-01/alqwa-d-almnzmt-lt-hyd-khdmat-al-malt-ghyr-als-wdyt-byn-almnshat-mn-khlal-brnamj-ajyr_0.pdf','الصادرة بالقرار الوزاري رقم 60339 وتاريخ 1447/5/6هـ.'),
 ('hrsd-marine','لائحة تنظيم عقد العمل البحري','marine.txt',dict(),'2025-04/%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%AA%D9%86%D8%B8%D9%8A%D9%85%C2%A0%D8%B9%D9%82%D8%AF%20%D8%A7%D9%84%D8%B9%D9%85%D9%84%20%D8%A7%D9%84%D8%A8%D8%AD%D8%B1%D9%8A_5.pdf',''),
 ('hrsd-agri','لائحة عمال الزراعة والرعاة الخاصون ومن في حكمهم','agri.txt',dict(),'2026-03/lay-ht--mal-alzra-t-walr-at-alkhaswn-wmn-fy-hkmhm2025.pdf',''),
 ('hrsd-recruit','قواعد ممارسة نشاط الاستقدام وتقديم الخدمات العمالية','recruit.txt',dict(),'2021-03/31032021.pdf','يُقرأ مع قرار التعديل رقم 212875.'),
]
scans=[
 ('hrsd-viol','جدول المخالفات والعقوبات لنظام العمل ولائحته التنفيذية','viol','2026-02/qrar-wzary---112377.pdf','قرار وزاري رقم 112377 — 1447هـ'),
 ('hrsd-settle','شروط طلبات تسوية مخالفات نظام العمل الواردة بجدول المخالفات','settle','2026-01/qrar-wzary.pdf',''),
 ('hrsd-support-viol','المخالفات والعقوبات الخاصة بقطاع العمالة المساندة (الاستقدام)','support_viol','2026-09/almkhalfat-wal-qwbat-alkhast-bqta--al-malt-almsandt--alastqdam-.pdf',''),
 ('hrsd-ads','ضوابط الإعلان عن خدمات العمالة المساندة','ads','2025-10/dwabt-ala-lan--n-khdmat-al-malt-almsandt--v4--1-.pdf',''),
 ('hrsd-recruit-amend','قرار تعديل قواعد نشاط الاستقدام وتقديم الخدمات العمالية رقم 212875','recruit_amend','2022-09/212875.pdf',''),
 ('hrsd-fee','قواعد عمل حساب المقابل المالي في رخص العمل','fee','2021-11/24112021.pdf',''),
]
B='https://www.hrsd.gov.sa/sites/default/files/'
laws=[]
for id_,t,f,opt,u,note in docs:
    arts=split(open(f).read(),title_noise=(t,),**opt)
    laws.append({'id':id_,'t':t,'st':'ساري','k':'لائحة','date':'','pub':'','u':B+u,'b':'المصدر: وزارة الموارد البشرية والتنمية الاجتماعية (hrsd.gov.sa).'+(' '+note if note else '')+'\nالنص مستخرج من ملف PDF الرسمي؛ عند الاستناد على مادة راجعها في الملف الرسمي.','src':'hrsd','a':arts})
    print(id_,len(arts),sum(1 for a in arts if a[0]))
for id_,t,f,u,note in scans:
    raw=open(f'ocr/{f}.txt').read()
    pages=[p for p in re.split(r'=====PAGE [^\n]+\n',raw) if p.strip()]
    arts=[[None,f'صفحة {i+1}',re.sub(r'\n{2,}','\n',p.strip())] for i,p in enumerate(pages)]
    laws.append({'id':id_,'t':t,'st':'ساري','k':'وثيقة مصورة','date':'','pub':'','u':B+u,'b':'المصدر: وزارة الموارد البشرية والتنمية الاجتماعية. '+(note+'. ' if note else '')+'⚠ الملف الرسمي صورة ممسوحة؛ النص هنا مقروء آليًا (OCR) للبحث فقط وقد يحتوي أخطاء خصوصًا في الأرقام والمبالغ — اعتمد الملف الرسمي.','src':'hrsd','ocr':1,'a':arts})
    print(id_,len(arts),'pages')
json.dump({'v':'hrsd-20261104','src':'وزارة الموارد البشرية والتنمية الاجتماعية','at':'2026-11-04','laws':laws},open('/home/claude/tamkeen-legal/laws/extra.json','w'),ensure_ascii=False,separators=(',',':'))
