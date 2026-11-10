const {test}=require('node:test');const assert=require('node:assert/strict');
const W=require('../whatsapp-intake.js');
test('labelled case message',()=>{
  const p=W.parseText('القضية رقم ٤٤٧٠١٢٣٤٥٦\nالمدعي: شركة اختبار للتجارة\nالمدعى عليه: مؤسسة النموذج\nموضوع الدعوى: مطالبة مالية\nالمحكمة التجارية بالرياض\nالدائرة التجارية الثالثة\nبمبلغ 120,000 ريال');
  assert.equal(p.plaintiff,'شركة اختبار للتجارة');assert.equal(p.defendant,'مؤسسة النموذج');assert.equal(p.subject,'مطالبة مالية');
  assert.equal(p.court,'المحكمة التجارية بالرياض');assert.equal(p.circuit,'الدائرة التجارية الثالثة');assert.equal(p.claimAmount,120000);
});
test('sentence style: filed by X against Y, remote session',()=>{
  const p=W.parseText('تم قيد الدعوى المقامة من شركة تمكين ضد مؤسسة الاختبار، لدى المحكمة العمالية بجدة، وموعد الجلسة عن بعد عبر منصة ناجز');
  assert.equal(p.plaintiff,'شركة تمكين');assert.equal(p.defendant,'مؤسسة الاختبار');assert.equal(p.court,'المحكمة العمالية بجدة');assert.equal(p.place,'جلسة مرئية');
});
test('taradi labels and nothing invented from unrelated text',()=>{
  const p=W.parseText('طالب الصلح: خالد الاختبار\nالطرف الآخر: شركة تمكين\nموضوع النزاع: أجور متأخرة');
  assert.equal(p.plaintiff,'خالد الاختبار');assert.equal(p.defendant,'شركة تمكين');assert.equal(p.subject,'أجور متأخرة');
  assert.deepEqual(W.parseText('مرحبا، تم استلام طلبك'),{});
});
test('Najiz style addressed to the ID holder',()=>{
  const a=W.parseText('صاحب الهوية: ******6009\nنفيدكم بقيد الدعوى رقم (4470555555) المقامة ضدكم من (خالد عبدالله الاختبار) لدى المحكمة العمالية بالرياض');
  assert.equal(a.plaintiff,'خالد عبدالله الاختبار');assert.equal(a.defendant,'شركة تمكين الدولية');assert.equal(a.side,'مدعى عليها');assert.equal(a.court,'المحكمة العمالية بالرياض');
  const b=W.parseText('تم قيد الدعوى المقامة منكم ضد «مؤسسة النموذج» لدى المحكمة التجارية بجدة');
  assert.equal(b.plaintiff,'شركة تمكين الدولية');assert.equal(b.defendant,'مؤسسة النموذج');assert.equal(b.side,'مدعية');
  assert.equal(W.parseText('المدعي: (سالم الاختبار)').plaintiff,'سالم الاختبار');
});
test('Najiz video-session activation (real format, synthetic names)',()=>{
  const msg='صاحب الهوية:\n******1234\nنبلغكم بتفعيل الجلسة المرئية للقضية رقم:\n4870000001\nالمقامة من: سالم بن خالد الاختبار\n ضد: شركة تمكين الدولية للاجهزة المنزلية\nالمحددة بتاريخ:\n08/06/1448\nالساعة: 12:05 مساءً\nويمكنكم حضور الجلسة عبر ناجز\nكما يمكنكم مشاهدة آلية حضور الجلسات عبر الرابط التالي:\nhttps://youtu.be/xxxx';
  const p=W.parseText(msg);
  assert.equal(p.plaintiff,'سالم بن خالد الاختبار');assert.equal(p.defendant,'شركة تمكين الدولية للاجهزة المنزلية');
  assert.equal(p.side,'مدعى عليها');assert.equal(p.place,'جلسة مرئية');assert.equal(p.caseNo,'4870000001');
});
