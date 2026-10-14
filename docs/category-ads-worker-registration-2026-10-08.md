# Kategoriya reklamalari va mustaqil usta ro'yxatdan o'tishi

Sana: 2026-10-08 (Asia/Tashkent). Ish lokal nusxada bajarildi.

## Boshlang'ich holat

- Branch: `handoff/mac-xcode-f1-f4-20260919`; HEAD: `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`.
- Oldingi auditdan qolgan ko'p o'zgarishlar mavjud edi. Ular saqlandi; ish boshidagi diff `artifacts/category-worker-baseline.patch` fayliga yozildi.
- Sabab: `submitOwnWorkerApplication` faqat `submittedAt` yozgan; `PROVIDER` roli va `APPROVED` holati faqat admin tasdig'ida berilgan. Mobil forma `SUBMITTED` holatida qulflangan va adminni kutish matnini ko'rsatgan.

## Amalga oshirilgan natija

1. Kategoriya sahifasidagi qidiruv maydoni olib tashlandi. Oddiy kategoriya sahifasiga boshqa qidiruv filtri o'tib qolmaydi. Bosh sahifadagi umumiy qidiruvdan ochiladigan katalog natijalari saqlandi.
2. Reklama karuseli kategoriya sahifasida SORT tugmalaridan keyin, ustalar ro'yxatidan oldin turadi. Tasma 64 px baland; aylanish ko'rsatkichlari va pauza uning ichida. Bir nechta reklama navbat bilan almashadi; rasm 6 soniya, video 12 soniya ko'rsatiladi. Video ovozsiz takrorlanadi. Pauza, ekran fokusidan chiqish, ilova fonga o'tishi va kamaytirilgan animatsiya sozlamasi hisobga olindi. Faol reklama bo'lmasa bo'sh blok ko'rsatilmaydi.
3. Admin → Bannerlar formasi reklamani `CATEGORY` joylashuviga saqlaydi. JPG/PNG/WebP (10 MB) yoki MP4 (30 MB), kategoriya/havola/yo'naltirishsiz variantlari, tartiblash va faollik boshqaruvi mavjud. Kategoriya reklamasi barcha kategoriya sahifalariga tegishli. Tavsiya etilgan o'lcham: 1200 × 240 px; forma preview'i 5:1 nisbatda.
4. `Banner` modeliga `placement` va `mediaType` qo'shildi. Backenddagi eski `HOME / IMAGE` kontrakti moslik uchun saqlandi; joriy mobil bosh sahifa reklama so'ramaydi va ko'rsatmaydi. `imageUrl` maydoni moslik uchun saqlandi va media URL manzilini tutadi.
5. To'liq usta formasi yuborilganda profil va rol bitta tranzaksiyada avtomatik faollashadi. Sessiya saqlanadi, mobil ilova uni yangilab usta rejimiga o'tadi. Parallel/takroriy yuborish bitta profilni qaytaradi.
6. Eski kutayotgan ariza qayta yuborilishi mumkin; eski provider qoralamasi profilni to'ldirib faollashadi. To'liq bo'lmagan forma, bloklangan foydalanuvchi va to'xtatilgan profil orqali cheklovni chetlab o'tishga yo'l qo'yilmaydi. Usta boshlang'ich holatda OFFLINE; buyurtma olish uchun onlayn holatni tanlaydi.

## Foydalanuvchi rasmlari bo'yicha joylashuv tuzatishi

- Bosh sahifadagi pastki `Siz uchun` reklama bloki olib tashlandi. Yuqoridagi `Kerakli usta, sizga yaqin.` tanishtiruv kartasi saqlandi.
- Kategoriya karuseli manzil va SORT orasidan SORT ostiga ko'chirildi; 88 px o'rniga 64 px.
- Lokal `new` banneri (`cmqghkvki000ftnk0aej5qxqj`) admin formasida saqlanib, `HOME` dan `CATEGORY` ga o'tkazildi. API kategoriya feed'ida shu yozuv qaytishi tekshirildi; media manzili va yo'naltirish saqlandi. Boshqa bazalarga ommaviy migratsiya bajarilmadi.
- Shu yozuvning eski PNG URL'i HTTP 404 qaytaradi. Haqiqiy rasm qayta yuklanmaguncha tasma sarlavha va fon bilan ko'rinadi; yangi rasm yoki video uydirib qo'yilmadi.
- Tuzatishdan keyingi mobil ESLint, banner model testi, uchta mobil komponent Babel transform'i, admin TypeScript va ikki TSX fayl ESLint'i hamda `git diff --check` o'tdi.
- Ishlayotgan Metro Android development bundle'ini 3164 modul bilan muvaffaqiyatli yig'di.
- Admin formasidagi `Banner yangilandi` xabari va jadvaldagi `Kategoriya` joylashuvi brauzerda tekshirildi. Dalil: `artifacts/category-banner-admin-correction.jpg`.
- Native emulator ekranini tekshirish bo'yicha avvalgi ruxsat cheklovi qolgan; ushbu tuzatishning emulatordagi vizual ko'rinishi tasdiqlanmadi.

## Asosiy fayllar

- `src/components/marketplace/BannerCarousel.js`, `src/services/content/bannerModel.mjs`, `bannerService.js`.
- `src/screens/marketplace/CategoryScreen.js`, `HomeScreen.js`, `src/store/clientStore.js`.
- `admin-web/modules/banners/{components,services,types}` va bannerlar sahifasi.
- `backend/src/modules/banners/{banner.contracts,banner.routes,banner.service}.ts`.
- `backend/prisma/migrations/20261008000000_banner_placements_media/migration.sql`, `schema.prisma`.
- `backend/src/modules/workers/worker.service.ts`, `worker.routes.ts`.
- `src/screens/worker/BecomeWorkerScreen.js`, `WorkerProfileManageScreen.js`, uz/en/ru tarjimalari.
- Yangi testlar: `backend/scripts/worker-self-registration-tests.ts`, `banner-media-tests.ts`, `scripts/test-banner-model.mjs`.

Video uchun Expo SDK 54 ga mos `expo-video ~3.0.16` qo'shildi. API ishlatilishi [Expo Video hujjati](https://docs.expo.dev/versions/v54.0.0/sdk/video/) bilan tekshirildi.

## Tekshiruvlar

Quyidagi DB testlari faqat runner yaratgan vaqtinchalik PostgreSQL klaster/bazalarda o'tdi. Test ma'lumotlari va klasterlar yakunda olib tashlandi.

| Buyruq | Natija |
|---|---|
| `cd backend; npm run test:worker-self-registration` | PASS: HTTP ro'yxatdan o'tish, forma to'liqligi, rol, amaldagi sessiya/refresh, parallel yuborish, eski arizalar, provider qoralamasi, blok/suspension himoyasi; yangi ustaga buyurtma yaratish → ko'rish → qabul qilish → bekor qilish |
| `cd backend; npm run test:banner-media` | PASS: rasm/video upload transporti, MIME/rasm hajmi chegarasi, HTTP Range, HOME/CATEGORY ajratilishi, eski API mosligi, yo'naltirish, CRUD/tartiblash/faollik, autentifikatsiya |
| `cd backend; npm run test:worker-application` | PASS: eski moderatsiya mosligi, profil rasmi, mijoz tarixi va admin huquqlari |
| `cd backend; npm run test:categories:integration` | PASS |
| `npm run test:provider-client-mode` | PASS |
| `npm --prefix backend exec -- tsx scripts/test-worker-profile-isolation.mjs` | PASS |
| `node scripts/test-banner-model.mjs` | PASS: kategoriya yo'nalishi, HTTP(S) havolalar, eski banner mosligi, karusel indeks aylanishi |
| `node scripts/test-admin-api-url.mjs` | PASS: JSON/upload URL va autentifikatsiya shartlari |
| `node scripts/test-worker-application-form.mjs` | PASS |
| `node scripts/test-auth-resume-race.mjs` | PASS |
| `node scripts/test-dynamic-categories.mjs` | PASS |
| `node scripts/test-native-map-config.mjs` | PASS |
| `node scripts/verify-i18n.mjs` / `node scripts/test-i18n.mjs` | PASS: 1222 uz/en/ru kalitlari, runtime tarjimalari |
| `cd backend; npm run build` | PASS |
| Admin `tsc --noEmit` va o'zgargan TSX/TS fayllarga `eslint --no-ignore` | PASS |
| Mobil o'zgargan JS/MJS fayllariga ESLint | PASS, ogohlantirishsiz |
| Admin `NEXT_PUBLIC_API_URL=https://api.nearfix.uz node node_modules/next/dist/bin/next build --webpack` | PASS; faqat build, deploy yoki ishlab chiqarish API sinovi bajarilmagan |
| Android `gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64 -PreactNativeDevServerPort=8081 --max-workers=2` | PASS; Expo Video native moduli ro'yxatda mavjud |
| Development env bilan `expo export --platform android --output-dir artifacts/category-worker-android --max-workers 2` | PASS: 3031 modul |
| `git diff --check`, `git diff --cached --check` | PASS |

Build buyruqlari kerakli process environment qiymatlari bilan qayta bajarilgan: ilk environment'siz Expo/admin buildlari konfiguratsiya himoyasi sabab to'xtagan. Birinchi buyurtma test fixture'iga talab etilgan `cityId` qo'shilgach, to'liq sikl o'tdi. Bu himoyalar yumshatilmadi.

## Lokal ishlayotgan holat va dalil chegarasi

- Yangi migratsiya lokal `nearfix` bazasiga qo'llandi; mavjud foydalanuvchilar/buyurtmalar qayta seed/reset qilinmadi.
- Backend `http://127.0.0.1:4000`, admin `http://127.0.0.1:3000/content/banners`, Metro `http://127.0.0.1:8081` — HTTP 200.
- Yangi APK `NearFIX_Client:5554` va `NearFIX_Worker:5556` emulatorlariga ma'lumotlarni saqlagan holda o'rnatildi. Ikkala ilovaning MainActivity holati va jarayoni ADB orqali tasdiqlandi; tekshirilgan yangi loglarda AndroidRuntime/ReactNativeJS xatolari yo'q.
- Admin banner formasining haqiqiy lokal brauzer ko'rinishi, kategoriya ro'yxati va havola maydoni tekshirildi. Test banneri lokal ish bazasida yaratilmagan.
- MP4 testi transport/saqlash/Range javobini tekshiradi; bu dekoderda video ijrosi yoki native karusel ko'rinishining isboti emas.
- Avtomatik ruxsat tekshiruvi emulator ekranini olishni rad etdi: `qemu-system-x86_64` uchun Computer Use tasdiqlanmagan.
- Brauzer test MP4 faylini yuklashni rad etdi: vosita foydalanuvchi ruxsatni rad etganini bildirdi. Yuklash boshqa yo'l orqali aylanib o'tilmadi.
- Alohida Expo web serverini boshlash buyrug'i policy tomonidan rad etildi; bu server ishga tushirilmadi.
- Faqat shu ish uchun yaratilgan `artifacts/category-banner-runtime-tools/` ichidagi test MP4 va FFmpeg yordamchi paketini tozalash ham `blocked by policy` bilan rad etildi. Fayllar shu papkada qoldi; ilova dependency'lariga qo'shilmagan. Kerak bo'lmasa foydalanuvchi shu vaqtinchalik papkani qo'lda olib tashlashi mumkin.
- Qolgan qo'lda tekshiruv: admin paneldan haqiqiy rasm/MP4 qo'shib, kategoriya karuselida aylanishi, pauzasi va yo'nalishlarini Android ekranida ko'rish. iOS native build bu Windows muhitida bajarilmadi.

Kod va mavjud avtomatik tekshiruvlar tayyor. UI media ijrosi bo'yicha yuqoridagi ruxsat chegarasi qolgan.

CONDITIONAL
