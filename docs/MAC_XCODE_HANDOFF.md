# NearFIX — Mac / Xcode source handoff

2026-09-19 · **PASS — SOURCE_READY_FOR_MAC_XCODE_BUILD**.
Bu source topshirish holati; iOS native build, signing yoki production release PASS emas.

## Source va qabul qilingan dalil

- Branch: `handoff/mac-xcode-f1-f4-20260919`.
- F1–F4 kod commit’i: **`d1f934233018b907e476247ed186a2e3b9711a5c`**.
- Tekshirilgan candidate SHA256: `efb2d83b50ed27c4a4de2de268aed3e8b40625e19a8737311dec97f8f846c4e3`.
- Candidate asosi: `34544b338774d10fb6fd0298e603e4907c1fe5e7` + 58 tracked/untracked F1–F4 fayli. 491 fayl source baytlari oldingi manifest bilan mos; kod commit’i shu daraxtni Git’ning mavjud LF normalizatsiyasi bilan saqlaydi.
- Ushbu hujjat keyingi, faqat docs commit’ida. ZIP’ning yakuniy commit SHA va SHA256’i yonidagi `SOURCE_HANDOFF.json` hamda `.sha256` faylida qayd etiladi. ZIP’da `.git` yo‘q, shuning uchun unzip katalogida `git rev-parse` ishlashi kutilmaydi.
- Source o‘zgarmagani uchun final-release-gate’dagi F1 privacy, F2 expiry/status/concurrency, F3.1 ikki read kontrakti/history/unread/state, F4 snapshot/eski address, isolation, configured backend build, tegishli lint/typecheck, clean production export va diff-check PASS dalillari qayta ishlatildi. Umumiy test run takrorlanmadi. Production tsconfig’dan tashqari qo‘shimcha test-only type diagnostikalar oldingi hisobotda qolgan; ular tuzatilmadi yoki PASSga aylantirilmadi.
- Oldingi `final-release-gate/HISOBOT.md` **BLOCKED** tarixiy hisoboti saqlanadi. F4 asl M1 scope’ida LOCAL PASS; detail → map OUT_OF_SCOPE/BACKLOG.

## Mac uchun inputlar

Package manager **npm**, mobil lockfile root’dagi **`package-lock.json`**, lockfileVersion **3**. Locklangan Expo **54.0.37**, React Native **0.81.5**, `react-native-yamap-plus` **6.10.1**. React Native engine talabi Node **>=20.19.4**; Windows dalili Node **24.13.1**, npm **11.8.0** bilan olingan. Mac toolchain alohida tasdiqlanmagan.

Repo Xcode/Ruby/CocoaPods versiyasini pin qilmagan, Gemfile/Podfile.lock saqlamaydi. Locklangan React Native helper’i Xcode minimumini **16.1** deb belgilaydi; Mac egasi ishlatgan Xcode, Node, npm, Ruby va CocoaPods versiyalarini build daliliga yozadi. Full Xcode va uning Command Line Tools’i, CocoaPods, npm/CocoaPods/Yandex SDK resurslarini olish uchun tarmoq kerak.

ZIP’da `app.base.json`, `app.config.js`, `eas.json`, `plugins/withYamapIosLocale.js`, source, lockfile va `assets/` bor. `ios/` va `android/` Git’da saqlanmaydi: loyiha **Expo Continuous Native Generation** usulida. Ular Windows’dan ko‘chirilmaydi; iOS Mac’da generatsiya qilinadi. Mavjud Yandex locale plugin’i prebuild vaqtida dependency’ning iOS locale chaqiruvini moslashtiradi; uni chetlab o‘tmang.

Ko‘chirilmaydigan inputlar:

| Input | Holat / egasi amali |
|---|---|
| `YANDEX_MAPKIT_API_KEY` | ZIP’da qiymati yo‘q, Mac’da mavjudligi tasdiqlanmagan. Egasi `uz.nearfix.app` uchun mos Yandex **MapKit SDK** key’ni xavfsiz kanalda beradi; Geocoder key bilan almashtirmang. |
| Apple login/team, distribution certificate, provisioning profile/private key | ZIP’da yo‘q; keyingi signing bosqichida egasi hal qiladi. Team ID o‘ylab qo‘yilmagan. |
| APNs/FCM push credential va ruxsatli test account/qurilma | ZIP’da yo‘q/tasdiqlanmagan; keyingi push tekshiruvi. Hozir iOS uchun `googleServicesFile` sozlamasi yo‘q, yangi Firebase/native input o‘zboshimchalik bilan qo‘shilmaydi. |
| `google-services.json` | Git tarixida mavjud Android client config; build key materialini ko‘chirmaslik uchun source ZIP’dan ataylab chiqarilgan. iOS prebuild’da Android mod’lari bajarilmaydi. Keyingi Android ishida egasi bu faylni alohida yetkazadi. |
| `.env*`, backend DB/auth/storage/SMS secret’lari | Haqiqiy env fayllari paketda yo‘q; faqat qiymatsiz/namunaviy `.env.example` shablonlari bor. Backend secret’lari iOS kompilyatsiyasi uchun kerak emas. |

## Faqat Mac’da bajariladigan tayyorlash

ZIP SHA256’ini `.sha256` bilan tekshirib, yangi katalogga oching. Quyidagi buyruqlarni source root’da bajaring; Windows’da ular bajarilmadi.

```sh
npm ci
```

Bu root lockfile’dan o‘rnatadi. `npm update`, dependency upgrade yoki backend/admin install iOS tayyorlash uchun kerak emas.

Xcode `eas.json` env’ini o‘zidan-o‘zi olmaydi. Quyidagi buyruq mavjud **production** profildan public qiymatlarni lokal, paketga kirmaydigan `.env.local`ga yozadi; mavjud faylni bosib ketmaydi:

```sh
node <<'NODE'
const fs = require('node:fs');
const env = {
  ...require('./eas.json').build.production.env,
  EXPO_PUBLIC_ENABLE_MOCK_DATA: 'false',
  EAS_BUILD_PROFILE: 'production',
  YANDEX_MAPKIT_API_KEY: ''
};
fs.writeFileSync('.env.local', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
NODE
```

`.env.local`dagi bo‘sh `YANDEX_MAPKIT_API_KEY`ni egasi xavfsiz lokal editor orqali to‘ldiradi. Secret qiymatini hujjat, terminal log yoki Git’ga yozmang. `EAS_BUILD_PROFILE=production` bu yerda faqat mavjud app-config key tekshiruvini yoqadi; EAS build boshlamaydi.

Profil qiymatlari: `EXPO_PUBLIC_APP_ENV=production`; API `https://nearfix-production-backend-wvd6v.ondigitalocean.app`; `EXPO_PUBLIC_AUTH_ENABLED=true`; `EXPO_PUBLIC_PAYMENTS_ENABLED=false`; privacy va terms shu host’dagi `/legal/privacy` va `/legal/terms`. Bular `app.config.js` va `src/constants/env.js` ishlatadigan kalitlar. `.env.example`dagi emulator URL’larini release uchun ko‘chirmang. Shell’dagi eski `EXPO_PUBLIC_*` override yoki `EXPO_NO_DOTENV=1` fayldagi qiymatlarni buzmasin. Expo prebuild va Xcode’ning Expo bundle bosqichi `.env.local`ni yuklaydi.

Key tayyor bo‘lgach, faqat yangi Mac nusxasida:

```sh
npx --no-install expo prebuild --platform ios --no-install --npm --skip-dependency-update react,react-native
(cd ios && pod install)
printf 'export NODE_BINARY="%s"\n' "$(command -v node)" > ios/.xcode.env.local
```

Bu locklangan lokal Expo CLI’ni ishlatadi; `--no-install` JS/CocoaPods avtomatik install’ini ajratadi. `pod install` native dependency’larni o‘rnatadi va workspace yaratadi. `--clean` talab qilinmaydi: ZIP’da native katalog yo‘q. Prebuild package/lockfile’da kutilmagan o‘zgarish chiqarsa, sababini ko‘rib chiqmasdan dependency versiyasini yangilamang. `ios/.xcode.env.local` Mac’dagi Node executable yo‘lini Xcode uchun saqlaydi; uni boshqa mashinadan ko‘chirmang.

Workspace/scheme hozir source’da mavjud emas, shuning uchun generatsiya qilinmagan nom fakt sifatida berilmaydi. `expo.name=NearFIX`, URL scheme esa `nearfix` — URL scheme Xcode scheme degani emas. Mac’da yaratilgan **`.xcworkspace`**ni quyidagicha aniqlang:

```sh
find ios -maxdepth 1 -name '*.xcworkspace' -print
WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -print)"
test -n "$WORKSPACE"
xcodebuild -list -workspace "$WORKSPACE"
open "$WORKSPACE"
```

Bir nechta workspace chiqsa, bitta app workspace’ini tanlang. `xcodebuild -list` qaytargan app scheme’ni Xcode’da tanlab, target bundle ID **`uz.nearfix.app`** ekanini tekshiring; nomlarni rename qilmang. Repo’dagi marketing version **1.0.4**, iOS buildNumber **2026072607**, `supportsTablet=true`. Keyingi upload uchun buildNumber mosligini egasi tekshiradi; EAS remote autoIncrement lokal Xcode Archive’ga avtomatik tatbiq bo‘lmaydi.

## Keyingi Mac / release bosqichi

Mac’da Apple team/signing tanlash, Archive action’ni **Release** konfiguratsiyasida va tegishli iOS device destination’da bajarish, Organizer’dagi archive hamda fizik qurilma tekshiruvlari **DEFERRED / NOT RUN**. Xcode’dagi native build muvaffaqiyati ushbu Windows handoff’da da’vo qilinmaydi. Metro/dev-client yoki Hermes export release binary testi emas.

Android/iOS signed runtime, booking → accept/status → chat/send/read → cancel, keyboard/foreground/coordinate-only booking, release Firebase initialization → token → backend registration → haqiqiy delivery ham **DEFERRED / NOT RUN**. Faqat oldindan ruxsatli test account/qurilma va guarded disposable DB bilan; production profilga test order/push yubormang. Tarqatilgan eski klientning `/read` shakli **DEFERRED / NOT VERIFIED**. F2.1 tarixiy DB hodisasi **OWNER_DECISION_REQUIRED**; egasi nomidan xavf qabul qilinmagan. Bular source handoff’ni bloklamaydi, ammo release’da ochiq qoladi.

Backend tartibi: **avval `/read` + `/read-through` kontraktli backend, keyin yangi mobil**. Yangi mobil tarqalgach **strict endpointsiz backendga rollback yo‘q**; rollback target strict boundary/writer-cursor himoyalarini va eski klientlar uchun legacy kontraktni saqlashi shart.

Ushbu topshirishda yangi audit/feature/refactor/dependency upgrade, native generation/build, signing, push/SMS, deploy, store submission, OTA yoki GitHub push bajarilmadi.
