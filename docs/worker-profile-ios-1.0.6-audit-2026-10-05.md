# NearFIX iOS 1.0.6 — boshqa ustani bosganda Shavkat profili ochilishi

Sana: 2026-10-05, Asia/Tashkent. Foydalanuvchi ishlab turgan iPhone ilovasida har xil kategoriyadagi ustalar bosilganda Shavkat Rasulov chiqishini bildirdi. Scope: production backendni tekshirish va sababni aniqlash. Ilova kodi, backend konfiguratsiyasi va production ma’lumotlari o‘zgartirilmadi.

## Tasdiqlangan production natijasi

Host: `https://nearfix-production-backend-wvd6v.ondigitalocean.app`.

- `GET /workers/catalog`: 10 ta profil, 10 ta alohida ID.
- Barcha 10 ta `GET /workers/:id`: HTTP 200, katalogdagi aynan o‘sha ID va ism. Diyorbek so‘rovi Diyorbekni, Shavkat so‘rovi Shavkatni qaytardi.
- Santexnik, Elektrik va Konditsioner filtrlari o‘z kategoriyasini qaytardi. Elektrik va Konditsioner javoblarida Shavkat yo‘q.
- Katalog va profil javoblarida `Cache-Control: no-store` mavjud.
- Bular haqiqiy production HTTP tekshiruvlari. iPhone tarmoq so‘rovlari ushbu sessiyada ushlanmadi.

Natija yozuvi: `artifacts/worker-profile-production-audit-2026-10-05.json`.

## Kodda qayta hosil qilingan mexanizm

Branch: `handoff/mac-xcode-f1-f4-20260919`. HEAD: `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`. Bu source marketing versiyasi 1.0.4; uni Macda yig‘ilgan 1.0.6 bilan teng deb bo‘lmaydi. Katta hajmdagi avvaldan mavjud UI o‘zgarishlari saqlandi. Diagnostika aynan committed HEAD kodi bilan bajarildi.

1. `CategoryScreen` bosilgan kartaning to‘g‘ri ID’sini `selectWorker` va `route.params.workerId`ga beradi.
2. `WorkerProfileScreen` ekrandagi ustani route ID orqali tanlamaydi: `useSelectedWorker()` umumiy `selectedWorkerId`ni o‘qiydi.
3. Shu ekran profilni route ID orqali yuklaydi, lekin `upsertPublicWorker` javob kelganda umumiy `selectedWorkerId`ni ham almashtiradi.
4. Profil effekti `worker?.id`ga ham bog‘langan; ekran fokusda bo‘lmasa ham ishlashi mumkin.
5. Profil pastidagi Uy tugmasi `navigation.navigate(ClientTabs)` ishlatadi. Tekshirilgan React Navigation 7 StackRouter mavjud pastki ClientTabs’ga qaytib eski profilni olib tashlamaydi: yangi route qo‘shadi. Boshqa kategoriya va profilga kirilganda eski Shavkat profili ham stackda qoladi.
6. Eski Shavkat ekranining so‘rovi Diyorbek ekranidagi so‘rovdan keyin tugasa, umumiy tanlovni Shavkatga qaytaradi. Diyorbek route ID’si o‘zgarmasa ham, ekran Shavkatni o‘qiydi. Umumiy worker ID o‘zgarishi ikkala ekranning profil so‘rovini yana ishga tushirishi mumkin.

Dalil fayllari:

- `src/screens/marketplace/CategoryScreen.js`: `openWorker`.
- `src/screens/marketplace/WorkerProfileScreen.js`: `useSelectedWorker`, profilni yuklash effekti; committed variantdagi `ScreenBottomNav.goTab`.
- `src/hooks/useSelectedWorker.js`.
- `src/store/clientStore.js`: `upsertPublicWorker`, `getSelectedWorker`.
- `node_modules/@react-navigation/routers/src/StackRouter.tsx`: NAVIGATE route tanlash.

## Diagnostika

Buyruq:

```text
node artifacts/audit-worker-profile-production-2026-10-05.mjs
```

PASS: productiondagi 10 ta profil va 3 kategoriya to‘g‘ri. Izolyatsiyalangan committed-source tekshiruvida real StackRouter ikkita WorkerProfile route saqladi. Ko‘rinayotgan route Diyorbek ID’sida bo‘lsa ham, eski profilning javobidan keyin real store action va committed profil effekti umumiy ustani Shavkatga o‘zgartirdi.

Qo‘shimcha tekshiruvlar: committed `mapApiWorker` real production natijasidagi barcha 10 ID va ismni o‘zgartirmadi; mapperda ID to‘qnashuvi yo‘q. `node scripts/test-dynamic-categories.mjs` PASS; `node scripts/test-catalog-distance.mjs` PASS. Izolyatsiyalangan mapperning dastlabki harnessida `mapAvailability` helperi kiritilmagani uchun ReferenceError chiqdi; committed helperni ham qo‘shib qayta bajarilganda PASS. Bu harness tuzatishi, mahsulot kodi o‘zgarishi emas.

Bu lokal ilovada UI sinovi emas: committed store/effect/router mexanizmi alohida bajarildi, HTTP ma’lumotlar esa productiondan o‘qildi. Bu natija iOS 1.0.6 aynan shu kodni ishlatayotganini isbotlamaydi. Production backendni o‘zgartirishga asos topilmadi.

## Tuzatish yo‘li va qolgan tekshiruv

Mobil profil va uning amallari route’dagi `workerId`ga bog‘lanishi kerak. Profil javobini cachega qo‘shish boshqa ekran tanlovini o‘zboshimchalik bilan almashtirmasligi kerak. Fokusda bo‘lmagan ekran so‘rovlari faol profilga ta’sir qilmasligi, eski javoblar rad etilishi kerak. Pastdagi tabga qaytish eski profil routelarini stackda ko‘paytirmasligi kerak. Bu auditda patch yozilmadi, build yoki release bajarilmadi.

Foydalanuvchiga ikki diagnostik tekshiruv so‘raldi: profilni 5–10 soniya kutganda Shavkat qoladimi; profilni tark etishda pastdagi Uy yoki tepada orqaga ishlatilganmi; ilovani to‘liq yopib qayta ochgach birinchi Elektrik/Diyorbek profili to‘g‘ri ochiladimi. Natijalar hali olinmagan.

Vaqtinchalik tekshiruv: ilovani to‘liq yopib qayta ochish, ustalar orasida tepada orqaga tugmasi bilan qaytish. Natija tasdiqlanmagan.

Aniq keyingi amal: Macdagi 1.0.6 source/Archive bilan profil tanlash va navigatsiya kodini solishtirish; iPhone’da Shavkat → pastdagi Uy → Elektrik → Diyorbek oqimini va tepada orqaga oqimini tekshirish. Mobil patchdan keyin shu oqimlar, tez bosish/kechikkan javob, chat va booking ID mosligi fizik qurilmada tekshiriladi. Tuzatilgan native build TestFlight va App Store orqali tarqatiladi.

Auditning production API qismi yakunlangan. Aniq 1.0.6 bundle tasdig‘i, tuzatish va fizik iPhone tekshiruvi bajarilmagan.

BLOCKED
