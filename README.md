## إدارة قيود البنوك (RTL, Vanilla JS, IndexedDB)

- واجهة عربية حديثة، تخزين محلي IndexedDB، تصدير Excel (SheetJS)، مخططات (Chart.js)

### تشغيل كتطبيق ويب محلي

1) افتح `index.html` مباشرة في المتصفح (Chrome/Edge).

### التغليف كملف exe عبر Electron

المتطلبات: Node.js 18+

أوامر:

```bash
npm install
npm run start
```

لإنشاء مثبت ويندوز (.exe):

```bash
npm run build:exe
```

يتم إنشاء المثبت داخل مجلد `dist/`.

### ملاحظات
- كل البيانات محلياً داخل IndexedDB على نفس الجهاز/المتصفح.
- النسخ الاحتياطي/الاستعادة عبر JSON من داخل الواجهة.

# Bank
