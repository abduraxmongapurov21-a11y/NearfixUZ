# NearFIX 1.0.7 — Mac’da shu yerdan boshlang

Windows’da kod/test/push/server deploy ishlari bajariladi; Mac’da native build, signing, qurilma sinovi va store upload davom ettiriladi. **Aniq bajarilgan actionlar va commit SHA ZIP ichidagi `HANDOFF_RECORD.md` / `SOURCE_HANDOFF.json`da.** Bu yo‘riqnoma o‘zidan-o‘zi deploy yoki store release bajarilganini bildirmaydi.

## 1. ZIP va manbani tekshirish

ZIP yonidagi `.sha256` fayl bilan macOS Terminal’da ZIP hashini solishtiring:

```sh
shasum -a 256 NearFIX-1.0.7-Mac-20261014-r3.zip
```

ZIP’ni yangi katalogga oching. Terminal’da ichidagi `NearFIX-1.0.7` katalogiga kiring. `.git`, `node_modules`, Windows native/build kataloglari va maxfiy credentiallar paketga kiritilmagan. Mobil, backend, admin, testlar, migrationlar, lockfile va assets to‘liq source sifatida kiritiladi. Android uchun zarur **ommaviy** `google-services.json` ham bor.

Node versiyasi `.nvmrc`da: **24.13.1** (Windows’da tekshirilgan npm **11.8.0**). Agar nvm o‘rnatilgan bo‘lsa:

```sh
nvm install
nvm use
node scripts/verify-handoff.mjs
npm ci
npm --prefix backend ci
```

`verify-handoff` npm dependency o‘rnatmasdan source fayllarni manifest bilan solishtiradi. Backend dependency’lari umumiy `release:verify`dagi state testlari uchun kerak; production DB credentiallari native build uchun kerak emas. Adminni Mac’da yig‘ish kerak bo‘lsa, `npm --prefix admin-web ci`ni alohida bajaring.

## 2. Mavjud Expo loyihasi va kalit

EAS loyiha: `@oybekdev/nearfix-mobile`, ID `cb752bd0-f6d9-4240-9215-7193ac16755a`. Yangi project yaratish yoki `eas init` kerak emas.

```sh
npx --yes eas-cli@24.13.0 login
npx --yes eas-cli@24.13.0 env:pull production --path .env.local
```

Bu buyruq EAS’dagi ruxsatli production qiymatlarini Mac’dagi lokal faylga oladi. Windows’dan `.env.local` yoki signing credentiallarini ZIP orqali ko‘chirmang. `YANDEX_MAPKIT_API_KEY` secret visibility sabab olinmasa, loyiha egasi o‘sha SDK kalitini Mac’dagi `.env.local`ga xavfsiz editor orqali kiritadi. Kalitni terminalga chiqarish/sharing kerak emas. Android public Firebase faylini service-account JSON bilan almashtirmang.

Production public qiymatlarini `.env.local`ga bir marta qo‘shing. Bu snippet kalit qiymatini o‘qimaydi yoki chop etmaydi:

```sh
node <<'NODE'
const fs = require('node:fs');
if (!fs.existsSync('.env.local')) throw new Error('First pull the EAS environment.');
const env = require('./eas.json').build.production.env;
const existing = fs.readFileSync('.env.local', 'utf8');
const keys = new Set([...Object.keys(env), 'EAS_BUILD_PROFILE']);
const retained = existing.split(/\r?\n/).filter(line => !keys.has(line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/)?.[1]));
const publicLines = Object.entries({...env, EAS_BUILD_PROFILE: 'production'}).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
fs.writeFileSync('.env.local', retained.join('\n') + '\n' + publicLines.join('\n') + '\n', {mode: 0o600});
fs.chmodSync('.env.local', 0o600);
console.log('Production public profile configured; private values were not printed.');
NODE
npm run release:preflight
npm run release:verify
```

Asosiy build/submit npm buyruqlari kerakli environmentni parent jarayonga o‘zlari yuklaydi. Production muhit bilan lokal emulator URL ishlatilmasligi preflightda tekshiriladi.

## 3. Tavsiya etilgan build yo‘li — Mac’dan EAS

Store’dagi eng katta `versionCode`/`buildNumber`ni EAS remote raqamlari bilan solishtiring. Windows tekshiruvida EAS Android **5**, iOS **2026072610** edi; store konsolidagi eng katta raqamlar alohida tekshiriladi. Marketing version **1.0.7**. EAS remote auto-increment yoqilgan.

```sh
npm run release:build:android
npm run release:build:ios
```

Android `.aab`, iOS `.ipa` cloud’da yaratiladi. Apple team/provisioning va mavjud Android upload key tanlanadi; yangi app yoki yangi upload key yaratib yubormang. Build natijasining ID, version/buildNumber va signing holatini yozib oling.

Release qurilma sinovlaridan keyin aynan tekshirilgan build ID’ni kiriting:

```sh
npm run release:submit:android -- --id <ANDROID_EAS_BUILD_ID>
npm run release:submit:ios -- --id <IOS_EAS_BUILD_ID>
```

Android internal/draftga, iOS App Store Connect/TestFlight’ga yuboriladi. Ommaviy promotion va App Review alohida bosqich.

## 4. Agar lokal Xcode Archive kerak bo‘lsa

Full Xcode **26 yoki yangiroq**, Command Line Tools va CocoaPods kerak. Production `.env.local` avval tayyorlangan bo‘lsin. Faqat yangi Mac nusxasida:

```sh
node <<'NODE'
const {spawnSync} = require('node:child_process');
Object.assign(process.env, require('./eas.json').build.production.env, {NODE_ENV: 'production'});
require('@expo/env').load(process.cwd());
const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'ios', '--no-install', '--npm', '--skip-dependency-update', 'react,react-native'], {stdio: 'inherit', env: process.env});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
NODE
(cd ios && pod install)
printf 'export NODE_BINARY="%s"\n' "$(command -v node)" > ios/.xcode.env.local
find ios -maxdepth 1 -name '*.xcworkspace' -print
```

Topilgan app `.xcworkspace`ni Xcode’da oching. Bundle ID `uz.nearfix.app`, version `1.0.7`, Release configuration, kerakli Apple team va iOS device destination’ni tanlang. **Lokal Xcode Archive EAS remote auto-incrementni bajarmaydi**: uploaddan avval native target build number’ini store’dagidan katta qiymatga belgilang. `--clean` bilan mavjud native ishni o‘chirish kerak emas.

## 5. Store’ga yuborishdan oldin

- Production admin: **https://nearfix-admin-k8mxo.ondigitalocean.app**.
- Mobil va admin API: **https://nearfix-production-backend-wvd6v.ondigitalocean.app**. Privacy, terms va account deletion shu host’dagi `/legal/privacy`, `/legal/terms`, `/legal/account-deletion` sahifalari.
- Domen sotib olinmagan; DigitalOcean bergan URL’lar loyiha egasi tanlagan asosiy production manzillaridir. Alohida custom domain yoki DNS sozlash talab qilinmaydi.
- Backend/adminning aynan qaysi commitlari live ekanini `HANDOFF_RECORD.md`dan tekshiring.
- Public support: **possibleuz@gmail.com**, mavjud Google Play listingidan 2026-10-14 kuni tekshirildi.
- Google Play listingida **No data collected** ko‘rsatilgan. Telefon/profil/manzil/chat ishlatilgani uchun Data safety formni haqiqiy oqimlar va SDKlar asosida yangilang. Bu deklaratsiya hali avtomatik tasdiqlanmagan.
- Phone/iPad screenshots, App Privacy, age/content/ads/encryption va reviewer credentiallarini tekshiring.
- OTP, usta arizasi/approval, order create/cancel/complete, chat/media, xarita/permission, push background/cold-start va account deletion’ni haqiqiy release buildda sinang.
- Android AAB’dagi native kutubxonalar uchun 16 KB page compatibility va iOS processing natijasini tekshiring.

Tafsilotlar: `docs/mobile-store-release.md`, `docs/store-submission-1.0.7.md`, `docs/app-review-notes-template.md`. ZIP’dagi `handoff-evidence/` Windows test va rollout dalillarini saqlaydi.
