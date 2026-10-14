# NearFIX iOS 1.0.6 — Yandex manzil tanlash auditi

Sana: 2026-10-05, Asia/Tashkent. Scope: ishlab turgan iPhone ilovasida manzil tanlash paytida chiqadigan `Yandex xarita sozlanmagan` va `Native builddan oldin YANDEX_MAPKIT_API_KEY muhit o'zgaruvchisini kiriting` xabarlari. Bu read-only audit; ilova kodi, EAS o'zgaruvchilari va deploy o'zgartirilmadi. Faqat ushbu hisobot yaratildi.

## Xulosa

**P1: yangi manzilni xaritada tanlash bloklanadi.** Xabar mavjud loaderda `Constants.expoConfig.extra.yandexMapKitApiKey` yo'q yoki bo'sh bo'lganida chiqadi. Yandex native SDK hali yuklanmagan bo'ladi. Shu sabab bu xabar key rad etilganini yoki Yandex serverida nosozlik borligini isbotlamaydi.

Foydalanuvchi ta'sirlangan ilovani **iPhone, 1.0.6** deb va **Mac/Xcode orqali build qilib App Store'ga yuklanganini** tasdiqladi. App Store ham 1.0.6 ni joriy versiya sifatida ko'rsatdi: [NearFIX App Store](https://apps.apple.com/uz/app/nearfix/id6782775201).

Eng kuchli sabab: Mac/Xcode Archive vaqtida key Expo konfiguratsiyasiga kirmagan yoki embedded Expo konfiguratsiyasi o'qilmagan. Macdagi 1.0.6 source, build log va Archive ushbu Windows sessiyasida mavjud emas; bu ikki holatni aynan binar orqali ajratish hali bajarilmadi.

## Tasdiqlangan dalillar

| Dalil | Natija |
|---|---|
| `src/services/maps/yandexMapKit.js:11–14` | Kalit yo'q/blank bo'lsa `missing-key` qaytadi; native import undan keyin. |
| `src/screens/maps/MapPickerScreen.js:342–346` | Xabarning aniq matni `missing-key` branchida mavjud. HEADdagi klient oqimi ham shu xabarni ko'rsatadi. |
| `app.config.js:37,51` | Key `process.env.YANDEX_MAPKIT_API_KEY` orqali `extra.yandexMapKitApiKey` ga qo'shiladi. |
| `app.config.js:38–44` | Majburiy tekshiruv faqat `EAS_BUILD_PROFILE=production` bo'lganda ishlaydi. `EXPO_PUBLIC_APP_ENV=production` o'zi yetarli emas. |
| Windows `.env.local` | Key nomi mavjud va qiymati nonblank. Qiymat oshkor qilinmadi; Yandexdagi haqiqiyligi tekshirilmadi. Bu Macdagi holatni isbotlamaydi. |
| EAS production environment | `YANDEX_MAPKIT_API_KEY` mavjud; scope PROJECT, visibility SECRET, environment production. Faqat metadata o'qildi. |
| EAS iOS build tarixi | Repo bog'langan `cb752bd0-f6d9-4240-9215-7193ac16755a` loyihasi uchun read-only `build:list --platform ios` so'rovi bo'sh ro'yxat qaytardi. Boshqa EAS loyihasi haqida xulosa qilinmaydi. |
| `docs/MAC_XCODE_HANDOFF.md:28,44,53,59` | Key source ZIPga kiritilmaydi; Xcode EAS envni avtomatik olmaydi; Mac `.env.local` shablonidagi key bo'sh va egasi to'ldirishi kerak. |
| Joriy repo | Branch `handoff/mac-xcode-f1-f4-20260919`, HEAD `7207fbee5cba03e93e1d5498b38ffddb1aa5e03d`, source marketing version 1.0.4. Uni 1.0.6 binariga teng deb bo'lmaydi. |

EAS SECRET qiymatlari lokal konfiguratsiya hisoblash paytida mavjud bo'lmaydi; lokal Mac buildga key alohida berilishi kerak. Bu xatti-harakat [Expo rasmiy hujjatida](https://docs.expo.dev/eas/environment-variables/usage/) tasdiqlangan. Hozir EASda key mavjudligi uning Xcode buildiga kirganini anglatmaydi.

O'rnatilgan `expo-constants` native kodi `EXConstants.bundle/app.config` ni o'qiydi (`node_modules/expo-constants/ios/EXConstantsService.m:111`). Xcode build skripti ushbu faylni project rootdagi dotenv va dinamik konfiguratsiyadan generatsiya qiladi (`node_modules/expo-constants/scripts/build/getAppConfig.js:25`). Tekshiriladigan yakuniy artefakt shu embedded konfiguratsiya hisoblanadi.

## Qayta ishlab ko'rish va tekshiruvlar

Haqiqiy key ishlatmasdan, `app.config.js` factorysi sintetik audit qiymatlari bilan tekshirildi. Process env shu jarayon tugaganda tiklandi, fayllar o'zgarmadi.

| Holat | Kuzatilgan natija |
|---|---|
| Production app env, EAS profile yo'q, key yo'q | Qabul qilindi; `extra` da key yo'q. |
| EAS production profile, key yo'q | Build config xato bilan to'xtadi. |
| EAS production profile, key faqat whitespace | Qabul qilindi; runtime loader buni blank deb rad etadi. |
| EAS production profile, sintetik nonblank key | Qabul qilindi; `extra` da nonblank key bor. |

`node scripts/test-yandex-map-adapter.mjs` — PASS.

`node scripts/test-ios-yandex-locale.mjs` — PASS.

Bu testlar source konfiguratsiyasi va locale lifecycle uchun; 1.0.6 iPhone runtime, haqiqiy Yandex avtorizatsiyasi yoki tuzatilgan release isboti emas.

## Release tekshiruvidagi bo'shliq va ta'sir

`scripts/run-production-release-verify.mjs:22–25` production public envni beradi, lekin `EAS_BUILD_PROFILE` ni o'rnatmaydi. `scripts/verify-mobile-release.mjs` Yandex key mavjudligini tekshirmaydi. `scripts/test-yandex-map-adapter.mjs:53` esa faqat config source ichida env nomi borligini tekshiradi. Shu sabab kalitsiz local production konfiguratsiyasi mavjud tekshiruvdan chetlab o'tishi mumkin.

Yangi saqlanadigan manzil koordinata va o'qiladigan manzilni talab qiladi (`ClientProfileScreen.js:297–315`); manzili yo'q klient bookingdan map pickerga o'tadi (`BookingScreen.js:241–244`). Map fallback faqat ortga qaytish imkonini beradi. Oldindan manzili saqlangan klient source oqimida shu manzilni tanlashi mumkin. Joriy lokal UI o'zgarishlari klient xabarini umumiy matn bilan almashtirgan, ammo yo'q keyni tiklamagan; bu mavjud ish saqlandi.

## Aniq keyingi amal

1. **1.0.6 ni build qilgan Macda** project rootdagi `.env.local` va Xcode Archive muhitini tekshirish. `YANDEX_MAPKIT_API_KEY` haqiqiy MapKit Mobile SDK key bo'lishi kerak; Geocoder key bilan almashtirilmaydi. Key qiymatini log, chat, Git yoki auditga yozmaslik.
2. Production public envni ham ta'minlash va mavjud tekshiruvni yoqish uchun `EAS_BUILD_PROFILE=production` ni o'rnatish. Kelajakdagi minimal code fix: production **app environment** uchun trimmed keyni majburiy qilish va release gatega shu tekshiruvni qo'shish. Auditda bu patch bajarilmadi.
3. Builddan oldin faqat mavjudlikni xavfsiz tekshirish:

   ```sh
   node <<'NODE'
   require('@expo/env').load(process.cwd());
   const { exp } = require('@expo/config').getConfig(process.cwd(), { isPublicConfig: true });
   const key = exp.extra?.yandexMapKitApiKey;
   const present = typeof key === 'string' && Boolean(key.trim());
   console.log(JSON.stringify({ mapKitKeyPresent: present }));
   if (!present) process.exitCode = 1;
   NODE
   ```

4. Yangi Archive ichidagi `EXConstants.bundle/app.config` da ham `extra.yandexMapKitApiKey` nonblank ekanini **qiymatini chiqarmasdan** tekshirish. Kalit borligini source tekshiruvi bilangina cheklamaslik.
5. Yangi native iOS buildni TestFlightda haqiqiy iPhone orqali tekshirish: xarita renderi, qidirish/geocoding, yangi manzil tanlash va saqlash, bookingga shu manzil uzatilishi. So'ng odatdagi release jarayoni.

Backend deployiga env qo'shish o'rnatilgan ilovadagi konfiguratsiyani almashtirmaydi. Joriy source OTA sozlamalarini tasdiqlamaydi; server orqali darhol tuzatish da'vo qilinmaydi.

Audit sababi va release tekshiruvdagi bo'shliq dalil bilan topildi. **1.0.6 Archive inspeksiyasi, native rebuild va iPhone runtime tekshiruvi ochiq; ishlab turgan versiya hali tuzatilmagan.**

## Backend orqali aylanib o'tish — qo'shimcha tekshiruv

Foydalanuvchining so'roviga ko'ra backend orqali hozirgi ilovaga yordam beradigan yo'llar alohida tekshirildi. **Manzil tanlash va buyurtma berish uchun amaliy yo'l topildi: serverda saqlangan manzil.** Bu native Yandex renderini tiklashdan alohida natija.

### Mavjud ilova oqimidan foydalanish

1. Foydalanuvchining o'z autentifikatsiyasi bilan `POST /addresses` orqali u tasdiqlagan haqiqiy manzil saqlanadi.
2. Ilovadagi booking mount va pull-to-refreshda `GET /addresses`ni oladi.
3. Saqlangan manzil bo'lsa xarita o'rniga manzillar ro'yxati ochiladi.
4. `POST /orders`ga `addressId` yuboriladi; backend egasini tekshiradi va manzilni orderga snapshot qiladi. Bu yo'lda Yandex chaqiruvi yo'q.

Bu oqim joriy lokal UI o'zgarishlaridan oldingi HEADda ham mavjud. Dalillar: `BookingScreen.js:85,128,157,176,242–246`, `clientStore.js:300–322`, `address.routes.ts:9,20–23`, `order.service.ts:241–294`.

`POST /addresses` uchun title/label va o'qiladigan address/addressText majburiy. **Koordinatalar majburiy emas:** lat/lng ikkalasi ham berilmasligi mumkin yoki ikkalasi haqiqiy qiymatlar bilan beriladi. Haqiqiy cityIdni aniq yuborish kerak; schema defaulti tashkent. Backend koordinatasiz saved address bilan orderni ham qabul qiladi. Soxta koordinata kerak emas; koordinatasiz manzil masofa bo'yicha saralash uchun origin bo'la olmaydi.

Admin tokeni bilan boshqa foydalanuvchiga oddiy `/addresses` orqali manzil qo'shib bo'lmaydi: row egasi request.user.id bo'ladi. Shu sabab mavjud foydalanuvchi API/session oqimi ishlatilishi kerak. Auditda hech kimga manzil qo'shilmadi va production DBga yozilmadi.

### Hamma foydalanuvchi uchun backend bilan chiqariladigan yechim

Mavjud Home banneri `targetType: URL` orqali brauzerni ochadi. Backendda kichik manzil yordamchi sahifasini chiqarish mumkin:

`Home banner → web sahifa → shu telefon raqami bilan OTP login → haqiqiy manzilni POST /addresses orqali saqlash → ilovaga qaytish → bookingni yangilash`.

Native build chiqarish bu manzil oqimi uchun kerak bo'lmasligi mumkin, chunki banner va saved-address kontraktlari HEADda mavjud. Yordamchi sahifa hozir yo'q; uni implement/deploy qilish va banner URLni sozlash kerak. Brauzer native tokenni olmaydi, shuning uchun odatdagi `/auth/otp/request` va `/auth/otp/verify` orqali alohida login talab qilinadi. Bu yangi session mavjud native sessionni bekor qilmaydi. Brauzer sahifasining aniq HTTPS origini backend CORS_ORIGINSda ruxsatli bo'lishi kerak. 1.0.6 binarida oqimni real iPhone bilan tekshirish hali ochiq.

Shoshilinch operatsion alternativa: tasdiqlangan usta ilovadagi qo'lda manzil yoziladigan telefon buyurtmasini `POST /workers/orders` orqali yaratishi mumkin. Bu odatdagi klient buyurtmasidan farqli WORKER_PHONE oqimi; usta ruxsati, aktiv taklif qiladigan kategoriya va band emasligi shart.

### Native mapni backenddan yoqish imkoniyati

Joriy source API javobidan MapKit keyni olmaydi. Missing-key natijasi modulda cache bo'ladi. Izolyatsiyalangan VM tekshiruvida key keyinroq sintetik tarzda kiritilsa ham oldingi missing-key obyekti qaytdi va native load soni 0 bo'ldi. Push va bannerlar Expo Constantsni o'zgartirmaydi.

Joriy sourceda expo-updates engine, updates URL va runtimeVersion yo'q. Expo dev launcher iOSda faqat Debug uchun; oddiy Xcode Release Archivega remote JavaScript yuklash yo'li bermaydi. **Shartli imkoniyat:** aynan 1.0.6 Archive oldindan sozlangan ExpoUpdates bilan yig'ilgan bo'lsa, mos OTA update orqali key/config yetkazish mumkin. Buni Archive ichidagi Expo.plist, EXUpdatesURL, EXUpdatesRuntimeVersion va ExpoUpdates mavjudligi bilan tasdiqlash kerak; hozir bunga dalil yo'q. [Expo OTA talablari](https://docs.expo.dev/eas-update/getting-started/).

### Qo'shimcha dalillar va chegaralar

- Production DigitalOcean host: `/health` 200, `/content/banners` 200 (bitta aktiv banner, targetType NONE), tokensiz `/addresses` 401. Faqat read-only so'rovlar.
- Eski Railway host: shu uch route 404 qaytardi. Bu o'rnatilgan ilovaning haqiqiy API hostini aniqlamaydi.
- Booking va client address state mavjud testlari PASS.
- Sintetik, DBsiz tekshiruv: text-only address schema → backend DTO → mobil mapper → saved-address booking draft → backend order schema PASS. Native map chaqirilmadi, production write 0. Birinchi fixtureda mobil selectedWorkerId backend workerId bilan aralashgani uchun schema tekshiruvi yiqildi; to'g'ri backend payload bilan tekshiruv o'tdi.
- Bu tekshiruvlar deployed authenticated HTTP create/order yoki iPhone 1.0.6 end-to-end isboti emas.

**Natija:** backend bilan manzil/buyurtma oqimini aylanib o'tish yo'li source va kontrakt darajasida tasdiqlandi. Native Yandex aktivatsiyasi va deployed qurilma tekshiruvi hanuz ochiq.

BLOCKED
