# Kategoriya masofasi foydalanuvchining joriy joylashuvidan

Sana: 2026-10-09, Asia/Tashkent. Lokal nusxa, branch `handoff/mac-xcode-f1-f4-20260919`, HEAD `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`. Oldingi o'zgarishlar saqlandi; tegishli fayllarning ish oldidagi nusxasi `artifacts/catalog-gps-2026-10-09-baseline.json` da.

## Natija

- Kategoriya sahifasidagi saqlangan manzil tanlash paneli olib tashlandi. Masofa va `Eng yaqin` telefonning joriy koordinatasidan hisoblanadi.
- Sahifa ochilganda foreground location ruxsati tekshiriladi va kerak bo'lsa so'raladi. Fokusga qaytish, ilova foreground'ga qaytishi va pull-to-refresh GPSni yangilaydi. GPS olish 12 soniyada cheklanadi; eskirgan koordinata natijasi fokus/yangi so'rovni almashtirmaydi.
- GPS yangilanayotganda eski masofalar ko'rsatilmaydi, tanlangan eng yaqin saralash saqlanadi. GPS rad etilgan yoki o'chirilgan bo'lsa katalog ochiladi, masofa aniqlanmagani ko'rsatiladi; saqlangan `Ofis`/`Uy` manziliga yashirin qaytish yo'q. Xatolikda qayta urinish mumkin.
- API `originLat` va `originLng` juftini qabul qiladi. Qiymatlar finite va geografik diapazonda bo'lishi kerak; yolg'iz koordinata yoki koordinata bilan manzilni aralashtirish rad etiladi. Mehmon va provider client rejimi ham joriy koordinatasidan foydalanishi mumkin.
- 100 km radius, server saralashi va eski `originAddressId` API himoyalari saqlandi. Workerning aniq xizmat koordinatasi ommaviy javobga chiqarilmaydi. Katalog xatolarining logida GPS query qiymatlari yozilmaydi.
- Bu koordinata vaqtinchalik; foydalanuvchining saqlangan manzili yoki buyurtma manzili o'zgartirilmaydi. DB migratsiyasi, seed yoki reset kerak emas.

Asosiy fayllar: `CategoryScreen.js`, `useCatalogLocation.js`, `catalogDeviceLocation.mjs`, katalog service/model va client store, worker API contract/route/service, error logger. Uz/en/ru uchun to'rtta UI matni qo'shildi.

Expo SDK 54 foreground location va current-position API'si [rasmiy Expo Location hujjati](https://docs.expo.dev/versions/v54.0.0/sdk/location/) hamda o'rnatilgan package deklaratsiyalari orqali tekshirildi.

## Tekshiruvlar

- `npm run test:catalog-device-location`: PASS — ruxsat, rad etish, services off, nol koordinata, invalid GPS, timeout, saqlangan manzildan izolyatsiya.
- `npm run test:catalog-gps-store`: PASS — haqiqiy store, GPS origin, nearest saralash, yangilanishda saralashni saqlash, ko'chgan joylashuvning kechikkan javobi va ruxsat yo'qolishi.
- `npm run test:catalog-session-refresh`: PASS — mehmon GPS query serializatsiyasi, nol qiymatlar, noto'g'ri koordinata, eski token yangilanishi va bloklangan sessiya.
- `cd backend; npm run test:catalog-distance`: PASS — vaqtinchalik disposable PostgreSQL klasterida HTTP GPS va eski manzil yo'llari, radius, saralash, ruxsat/ownership, invalid input, ommaviy DTO va GPS log redaksiyasi. Test bazasi yakunda olib tashlandi; ish bazasi o'zgarmadi. Dastlab yangi testdagi taqqoslash koordinatasi fixture'dagi manzilga mos kelmagan; shu fixture qiymatidan foydalanilgach test o'tdi.
- `cd backend; npm run test:error-handler`, `npm run build`: PASS.
- Katalog masofasi/saralashi, client address state, i18n source/runtime testlari: PASS. 1226 uz/en/ru kaliti mos.
- O'zgargan mobil JS/MJS fayllari uchun ESLint ogohlantirishsiz; mobil Babel transform'lari, `git diff --check` va staged whitespace tekshiruvi: PASS.
- Haqiqiy local store → service → backend tekshiruvida sintetik GPS nuqtasi o'zgarganda 5 ustaning masofasi 0 m dan 1267 m ga o'zgardi. GPS bo'lmagan holatda 6 usta null masofa bilan qaytdi, saqlangan manzil ishlatilmadi, katalog xatosi null. Dalillar: `artifacts/catalog-gps-live-store-results.json`, `catalog-gps-live-api.json`. Bu native GPS sensori yoki UI tekshiruvi emas.

## Qolgan gate

Metro'ni boshlash avval avtomatik ruxsat tekshiruvida `blocked by policy` bilan rad etilgan; bu cheklov aylanib o'tilmadi. Emulatorda yangilangan JavaScript, haqiqiy foreground permission dialogi va GPS oqimi tasdiqlanmadi.

Foydalanuvchi loyiha terminalida `npm start -- --dev-client --localhost --port 8081` ni boshlaydi, emulator ilovasini qayta yuklaydi va joylashuv ruxsatini beradi. Android emulator GPS nuqtasi yoqilgan bo'lishi kerak.

CONDITIONAL
