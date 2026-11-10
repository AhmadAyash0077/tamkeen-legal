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
