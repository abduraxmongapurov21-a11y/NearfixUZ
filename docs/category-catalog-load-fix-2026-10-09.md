# Kategoriya va katalog yuklash xatolari

Sana: 2026-10-09, Asia/Tashkent. Lokal nusxa, branch `handoff/mac-xcode-f1-f4-20260919`, HEAD `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`.

## Tasdiqlangan sabablar

- Ish boshida 4000, 3000 va 8081 portlarida server ishlamagan; PostgreSQL 5432 ishlagan. `/content/categories` va `/workers/catalog` so'rovlari `ECONNREFUSED` qaytargan. Rasmdagi saqlangan kategoriya ogohlantirishi va katalog xatosi shu uzilishga mos.
- Kategoriya sahifasidagi pull-to-refresh kategoriyalarni yangilamagan; kategoriya ogohlantirishidagi qayta urinish esa katalogni qayta yuklamagan.
- Token yuboriladigan katalog so'rovi oddiy `httpRequest` ishlatgan. Backend Authorization mavjud bo'lsa sessiyani tekshiradi. Muddati tugagan tokenni tiklash testi tuzatishdan oldin `catalog must recover from an expired access token` bilan yiqildi.

## Tuzatish

- Backend 4000 va admin 3000 portlarida qayta ishga tushirildi. Database reset, seed va migratsiya bajarilmadi.
- `src/screens/marketplace/CategoryScreen.js`: pull-to-refresh va kategoriya ogohlantirishidagi qayta urinish kategoriyalar, katalog va reklamalarni birga yangilaydi.
- `src/services/catalog/catalogService.js`: token mavjud bo'lsa amaldagi `httpAuthRequest` ishlatiladi. Token yangilanishi, account almashishi va bloklangan sessiya himoyalari saqlandi. Mehmon katalogi ochiq qoladi.
- `scripts/test-catalog-session-refresh.mjs`: muddati tugagan sessiya, mehmon katalogi, tarmoq tiklanishi va bloklangan sessiya uchun regressiya testi. Package script va lokal audit runner'iga qo'shildi.
- Oldingi o'zgarishlar saqlandi. Shu ish oldidan ikki tegishli fayl nusxasi `artifacts/category-load-2026-10-09-baseline.json` ga yozildi.

## Dalil

- Haqiqiy lokal HTTP: health 200; kategoriyalar 200, 10 yozuv; Santexnik katalogi 200, 6 usta; admin 200.
- `node backend/node_modules/tsx/dist/cli.mjs artifacts/category-load-recovery-check.mjs`: haqiqiy mobile store'da tarmoq uzilishi taqlid qilindi, ikkala xato holati paydo bo'ldi; tarmoq tiklangach haqiqiy local backend javoblari bilan `categoryError=null`, `catalogError=null`, 10 kategoriya va 6 Santexnik ustasi qaytdi. Bu emulator ekranining isboti emas.
- `npm run test:catalog-session-refresh`: PASS, shu test patchdan oldin yiqilgan.
- Amaldagi authenticated-client account race, dinamik kategoriyalar, katalog masofasi/saralash va worker-profile isolation testlari: PASS.
- O'zgargan JS/MJS fayllar uchun ESLint, mobil fayllar Babel transform'i va `git diff --check`: PASS.

## Qolgan cheklov

Metro'ni development API `http://10.0.2.2:4000` bilan 8081 portida boshlash buyrug'i avtomatik ruxsat tekshiruvida `blocked by policy` bilan rad etildi. Boshqa buyruq yoki vosita orqali aylanib o'tilmadi. Yangilangan JavaScript'ning emulatorda yuklanishi va ko'rinishi tasdiqlanmadi; backend ulanishi va kodning tiklanish yo'li yuqoridagi tekshiruvlar bilan tasdiqlandi.

Keyingi amal: Metro'ni foydalanuvchi local terminalda ishga tushirib, emulator sahifasini qayta yuklaydi. Root `.env.local` development va Android host bridge manziliga sozlangan.
