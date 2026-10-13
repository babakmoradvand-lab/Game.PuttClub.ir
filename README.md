# MIS 3D Golf Simulation

شبیه‌ساز سه‌بعدی گلف با کاراکتر حرفه‌ای گلف‌باز (مدل واقعی `.glb`)، ساخته‌شده با Three.js.

**Live:** https://babakmoradvand-lab.github.io/Game.PuttClub.ir/

## ویژگی‌ها

- مدل سه‌بعدی حقیقی گلف‌باز (`pro_golfer_character.glb`) با بافت ۳۶۰ درجه، کلاه و چوب درایور
- ۵ حالت سوینگ مستقل: Full Swing، 3/4 Swing، Half Swing، Chip، Putt
- همگام‌سازی دقیق لحظه برخورد چوب با توپ و شروع فیزیک پرواز
- آفلاین / PWA (Service Worker + Manifest)
- زمین و عوارض واقعی مبتنی بر داده ماهواره‌ای

## اجرای محلی

```bash
python3 -m http.server 8080
# سپس: http://localhost:8080
```

## ساختار

| فایل | توضیح |
|---|---|
| `index.html` | هسته شبیه‌ساز (Three.js + منطق سوینگ) |
| `pro_golfer_character.glb` | مدل سه‌بعدی کاراکتر |
| `golfer_360_texture.png` | اطلس بافت ۳۶۰ درجه |
| `three.min.js` / `GLTFLoader.js` / `OrbitControls.js` | کتابخانه‌ها (لوکال، بدون CDN) |
| `sw.js` / `manifest.json` | قابلیت آفلاین و نصب PWA |
