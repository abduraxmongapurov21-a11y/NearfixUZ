# NearFIX — mijoz UI/UX auditi va implementatsiyasi

Sana: 2026-10-03. Baseline: `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`, branch: `handoff/mac-xcode-f1-f4-20260919`. Natija hozirgi working tree ichida.

## Qamrov

Faqat mijoz tajribasi: bosh ekran, katalog, mijoz ko'radigan usta profili, booking, buyurtmalar, mijoz profili, guest profil, chat, bildirishnoma va xarita tanlash.

Worker ekranlari, worker navigator/tab bar, admin, backend, `App.js`, umumiy theme/UI komponentlari, store va service fayllarida diff yo'q. Chat, bildirishnoma va xarita kabi umumiy ekranlarda mijoz ko'rinishi `normalizeExperienceMode(...) === "client"` orqali tanlanadi; original worker uslublari saqlangan. Uch tildagi mavjud tarjima kalitlari o'zgartirilmagan, yangi kalitlar qo'shilgan.

## Asosiy topilmalar va yechimlar

| Audit topilmasi | Amalga oshirilgan yechim |
| --- | --- |
| Ekranlar o'rtasida ranglar, shrift, ikonlar va navigatsiya turlicha | Mijoz uchun alohida theme, Inter, yupqa Lucide ikonlari, yagona header va suzuvchi glass dock |
| Katalogdagi qidiruv oddiy yozuv edi, saralash qidiruvni yo'qotardi | Haqiqiy qidiruv, tozalash, natija bo'lmaganda tushunarli holat; saralash/manzil almashtirish qidiruvni saqlaydi |
| Qaytarilgan reyting va birinchi kartadagi TOP belgi ishonchsiz edi | Reyting faqat ma'lumotdan, TOP faqat haqiqiy yuqori reytingga asoslanadi |
| Usta profili, narx va booking qarori yetarlicha ajralmagan | Xizmat/narx/xodim xulosasi, real bandlik va sharh holatlari, yakuniy narx izohi, aniq booking CTA |
| Bookingda klaviatura va pastki navigatsiya xalaqit berardi | Booking docki olib tashlandi, klaviaturaga mos layout va normal flex footer |
| Buyurtma kartalari haddan tashqari zich, ayrim media tugmalari ishlamasdi | Aniq status/narx/manzil/timeline, haqiqiy amallar, tekshirilgan telefon tugmasi |
| Profil tahriri va sozlamalar guruhlanmagan | Ism uchun aniq saqlash/bekor qilish, manzillar va sozlamalar alohida guruhlar |
| Chat composer va dock to'qnashishi, soxta Bugun belgisi | Mijoz chatida dock yo'q, o'qiladigan composer, universal Bugun belgisi olib tashlandi |
| Ilova tarjimasi chatning asl matnini ham o'zgartirishi mumkin edi | Mijoz xabari, jo'natuvchi va oxirgi xabar matni tarjimasiz ko'rsatiladi |
| Mayda matn kontrasti yetarli emas edi | Teal `#087783`, to'q teal `#075E68`, matn `#172C38`, yordamchi matn `#5A6D79`, mint aksent |
| Web xarita ekranida texnik nomlar va qaytish tugmasi yo'q edi | Mijoz uchun oddiy mobil ilova izohi va ishlaydigan Orqaga tugmasi |

iOS/web material yuzalari `expo-blur` bilan ishlaydi. Reduce Transparency yoqilganda, Androidda va blur moduli bo'lmagan eski native buildda o'qiladigan solid material ishlatiladi. iOS haqiqiy blur uchun yangi native build kerak.

Web preview oldingi Zustand `import.meta` xatosi sabab ochilmasdi. Babel transform faqat web uchun qo'shildi. ESLintdan faqat generatsiya qilingan `dist-test-client-ui` bundle katalogi chiqarildi.

## Vizual dalillar

Fayllar `artifacts/client-ui-audit/` ichida. Har biri saqlangandan keyin ochib ko'rildi.

| Ko'rinish | Dalil |
| --- | --- |
| Dastlabki Home kontenti, API mavjud bo'lmagan holat | [01-home-unavailable.png](../artifacts/client-ui-audit/01-home-unavailable.png) |
| Dastlabki katalog | [02-catalog-before.png](../artifacts/client-ui-audit/02-catalog-before.png) |
| Yakuniy Home, 390×844 | [20-home-final.png](../artifacts/client-ui-audit/20-home-final.png) |
| Katalog, 320px, English | [15-catalog-320-en.png](../artifacts/client-ui-audit/15-catalog-320-en.png) |
| Mijoz ko'radigan usta profili | [05-worker-profile-after.png](../artifacts/client-ui-audit/05-worker-profile-after.png) |
| Booking | [06-booking-after.png](../artifacts/client-ui-audit/06-booking-after.png) |
| Buyurtmalar va tafsilot | [07-orders-after.png](../artifacts/client-ui-audit/07-orders-after.png), [08-order-detail-after.png](../artifacts/client-ui-audit/08-order-detail-after.png) |
| Profil, Uzbek va Russian | [11-profile-after.png](../artifacts/client-ui-audit/11-profile-after.png), [12-profile-ru.png](../artifacts/client-ui-audit/12-profile-ru.png) |
| English interfeysida asl Uy xabari | [18-chat-raw-text-en.png](../artifacts/client-ui-audit/18-chat-raw-text-en.png) |
| Chat qidiruvida natija yo'q | [17-chat-search-empty.png](../artifacts/client-ui-audit/17-chat-search-empty.png) |
| Bildirishnomalar, yakuniy | [19-notifications-final.png](../artifacts/client-ui-audit/19-notifications-final.png) |
| Web xarita fallback | [16-map-web-fallback.png](../artifacts/client-ui-audit/16-map-web-fallback.png) |
| Home, 760px | [21-home-760.png](../artifacts/client-ui-audit/21-home-760.png) |

Dastlabki Home dalili dock implementatsiyasi boshlanganidan keyin olingan; uni butun ilovaning o'zgarmagan baseline skrinshoti deb talqin qilish kerak emas. Oraliq skrinshotlarda yakuniy kontrast/kompozitsiya tuzatishlaridan oldingi holatlar ham bor; yakuniy Home va bildirishnoma fayllari yuqorida alohida belgilangan.

## Ishlaydigan oqimlar tekshiruvi

Brauzerda 390×844, 320×740 va 760×900 o'lchamlar ishlatildi. 320px va 760px Home/katalog tekshiruvlarida document kengligi viewportdan oshmadi.

Quyidagilar UI orqali bajarildi:

1. Home → Santexnik → Sardor qidiruvi → Reyting saralashi; qidiruv saqlandi → tozalash.
2. Usta profili → guest autentifikatsiya → tanlangan ustaning booking ekraniga qaytish.
3. Boshqa xizmat, izoh va saqlangan manzil tanlandi → yangi buyurtma → buyurtma ro'yxati/tafsilot.
4. Chat xabari yuborildi → ro'yxatdagi oxirgi xabar va unread holati yangilandi.
5. Profil ismi saqlandi va boshlang'ich namuna ismiga qaytarildi.
6. Uzbek/Russian/English almashtirildi; ism va chat matnlari asl holatda saqlandi.
7. Chat qidiruvi natijasiz holati → tozalash orqali tiklanish.
8. Profil → yangi manzil → web xarita fallback → Orqaga.

Brauzer ma'lumotlari `scripts/preview-client-ui.mjs` lokal xotira fixtureidan. Ismlar, telefon, manzillar, sharhlar, buyurtmalar va xabarlar namuna ma'lumotlaridir. SMS, production API yoki real buyurtma ishlatilmagan. Backend, database va `.env` o'zgarmagan.

## Avtomatik tekshiruvlar

- `npm run lint` — PASS.
- `npm run i18n:verify` — PASS, 1199 sinxron kalit, 1098 source copy candidate.
- `npm run i18n:test` — PASS, uz/en/ru.
- `npm run test:categories`, `node scripts/test-category-icon-contract.mjs`, `node scripts/test-catalog-sorting.mjs` — PASS.
- `npm run test:auth-intent`, `npm run test:notification-navigation`, `npm run test:app-startup` — PASS.
- `npm run test:booking-location`, `node scripts/test-client-address-state.mjs`, `node scripts/test-country-selector.mjs`, `node scripts/test-worker-phone-dialer.mjs` — PASS.
- `npm run test:yandex-map-adapter`, `npm run test:reverse-geocoding` — PASS.
- `npx expo export --platform all --output-dir dist-test-client-ui` — PASS, Android/iOS/web. Process environment faqat lokal fixturega yo'naltirilgan; bu release artifact emas.
- `git diff --check` — PASS.
- Worker/admin/backend/global theme/UI/logic scope tekshiruvi — PASS, diff yo'q.

## Previewni qayta ochish

Hozirgi preview: `http://localhost:8088`, lokal fixture: `127.0.0.1:4501`.

Fixture qayta ishga tushirilsa in-memory namuna holati tiklanadi:

```powershell
node scripts/preview-client-ui.mjs
```

Alohida terminalda test bundle:

```powershell
$env:EXPO_PUBLIC_APP_ENV='development'
$env:EXPO_PUBLIC_API_BASE_URL='http://localhost:4501'
npx expo export --platform all --output-dir dist-test-client-ui
```

Bundle katalogini lokal HTTP server bilan 8088 portda ko'rsatish kerak. Hozir Codex bundled Python HTTP serveri shu vazifani bajaryapti. Demo login: `90 000 00 01`, parol: `NearfixPreview!2026` (faqat shu fixture).

## Tekshiruv chegarasi

Haqiqiy iPhone/Android qurilmasida native rendering, klaviatura, safe area, Reduce Transparency va GPS/Yandex MapKit vizual tekshiruvi bajarilmagan. Native bundle exporti qurilmadagi ishga tushirish tekshiruvi o'rnini bosmaydi. Real backend, push, upload, qo'ng'iroq va haqiqiy buyurtma oqimi bu vizual fixture tekshiruviga kirmaydi.

Deploy yoki store submit bajarilmagan.
