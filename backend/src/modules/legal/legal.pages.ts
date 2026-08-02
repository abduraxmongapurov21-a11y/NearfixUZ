const lastUpdated = "2026-yil 27-iyul";

const styles = `
  :root { color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f3f8fa; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f8fa; line-height: 1.65; }
  main { width: min(760px, calc(100% - 28px)); margin: 24px auto; padding: clamp(22px, 5vw, 46px); border: 1px solid #dcecf3; border-radius: 22px; background: #fff; box-shadow: 0 16px 45px rgba(15, 113, 157, .08); }
  h1 { margin: 0; color: #0f719d; font-size: clamp(28px, 7vw, 42px); line-height: 1.2; }
  h2 { margin: 30px 0 8px; color: #172033; font-size: 20px; line-height: 1.35; }
  p, li { font-size: 16px; }
  .updated { margin: 8px 0 28px; color: #687385; font-size: 14px; }
  .notice { margin: 24px 0; padding: 16px; border-left: 4px solid #1597a9; border-radius: 10px; background: #edf9fc; }
  ul, ol { padding-left: 22px; }
  a { color: #0f719d; }
  footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #e5eef3; color: #687385; }
  @media (max-width: 520px) { main { margin: 12px auto; border-radius: 16px; } p, li { font-size: 15px; } }
`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>${title} — NearFIX</title>
  <style>${styles}</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p class="updated">Oxirgi yangilanish: ${lastUpdated}</p>
    ${body}
    <footer>NearFIX · O‘zbekiston</footer>
  </main>
</body>
</html>`;
}

export const privacyPolicyHtml = page(
  "Maxfiylik siyosati",
  `
    <p>Ushbu siyosat NearFIX mobil ilovasi va xizmatlaridan foydalanganda shaxsiy ma’lumotlar qanday yig‘ilishi, ishlatilishi va saqlanishini tushuntiradi.</p>
    <h2>1. Yig‘iladigan ma’lumotlar</h2>
    <ul>
      <li>telefon raqami, ism va foydalanuvchi roli;</li>
      <li>profil, saqlangan manzil, buyurtma manzili va foydalanuvchi ruxsati bilan lokatsiya;</li>
      <li>buyurtmalar tarixi, chat, yordam murojaatlari va sharhlar;</li>
      <li>foydalanuvchi yuklagan rasm yoki boshqa media;</li>
      <li>bildirishnomalar uchun push token va qurilma platformasi.</li>
    </ul>
    <h2>2. Ma’lumotlardan foydalanish</h2>
    <p>Ma’lumotlar akkauntni tasdiqlash, mijoz va ustalarni bog‘lash, buyurtma hamda chatlarni yuritish, xavfsizlik, yordam ko‘rsatish va xizmat sifatini yaxshilash uchun ishlatiladi.</p>
    <h2>3. Xizmat ko‘rsatuvchi hamkorlar</h2>
    <ul>
      <li><strong>Eskiz</strong> — tasdiqlash SMS xabarlarini yuborish uchun;</li>
      <li><strong>Cloudflare R2</strong> — yuklangan media fayllarini saqlash uchun;</li>
      <li><strong>Railway</strong> — backend va ma’lumotlar bazasi infratuzilmasi uchun.</li>
    </ul>
    <h2>4. To‘lov ma’lumotlari</h2>
    <div class="notice">NearFIX ilovasida hozircha ichki to‘lov mavjud emas. Ilova to‘lovga oid ma’lumotlarni yig‘maydi va saqlamaydi.</div>
    <h2>5. Saqlash muddati</h2>
    <p>Profil ma’lumotlari akkaunt faol bo‘lgan davrda saqlanadi. Buyurtma, chat va sharh yozuvlari operatsion, nizolarni ko‘rib chiqish yoki qonuniy majburiyatlar sababli akkaunt o‘chirilganidan keyin ham anonimlashtirilgan shaklda saqlanishi mumkin.</p>
    <h2>6. Akkauntni o‘chirish</h2>
    <p>Foydalanuvchi ilovadagi Profil → Sozlamalar → Hisobni o‘chirish orqali akkauntini o‘chirishi mumkin. Batafsil tartib <a href="/legal/account-deletion">akkauntni o‘chirish sahifasida</a> berilgan.</p>
    <h2>7. Reklama va kuzatuv</h2>
    <p>NearFIX foydalanuvchilarni reklama maqsadida kuzatmaydi va shaxsiy ma’lumotlarni reklama tarmoqlariga sotmaydi.</p>
    <h2>8. Aloqa</h2>
    <p>Maxfiylik bo‘yicha savollar uchun ilovadagi Yordam bo‘limidan foydalaning.</p>
  `
);

export const termsHtml = page(
  "Foydalanish shartlari va ommaviy oferta",
  `
    <p>Ushbu shartlar NearFIX ilovasidan mijoz yoki usta sifatida foydalanish qoidalarini belgilaydi.</p>
    <h2>1. Platformaning vazifasi</h2>
    <p>NearFIX xizmatga muhtoj mijozlar bilan mustaqil xizmat ko‘rsatuvchi ustalarni bog‘laydigan marketplace platformadir. NearFIX, alohida ko‘rsatilmagan bo‘lsa, xizmat ishining bevosita bajaruvchisi emas.</p>
    <h2>2. Foydalanuvchi ma’lumotlari</h2>
    <p>Foydalanuvchilar telefon, ism, profil, manzil va buyurtma ma’lumotlarini to‘g‘ri va dolzarb kiritishi kerak. Boshqa shaxs nomidan ruxsatsiz foydalanish taqiqlanadi.</p>
    <h2>3. Ustaning majburiyatlari</h2>
    <p>Usta o‘z malakasi, xizmat sifati, xavfsizligi, zarur ruxsatlari va mijoz bilan kelishilgan ish natijasi uchun javob beradi.</p>
    <h2>4. Mijozning majburiyatlari</h2>
    <p>Mijoz muammoni va buyurtma tafsilotlarini aniq bayon qilishi, to‘g‘ri manzil ko‘rsatishi hamda kelishilgan vaqtda xizmat joyiga kirishni ta’minlashi kerak.</p>
    <h2>5. Narx va to‘lov</h2>
    <div class="notice">NearFIX hozircha ilova ichida to‘lovlarni qayta ishlamaydi. Xizmat narxi va to‘lov tartibi mijoz bilan usta o‘rtasida kelishiladi va ilovadan tashqarida amalga oshiriladi.</div>
    <h2>6. Bekor qilish, yordam va nizolar</h2>
    <p>Buyurtma tegishli bosqichda ilova orqali bekor qilinishi mumkin. Muammo yoki nizo bo‘lsa, foydalanuvchi ilovadagi Yordam bo‘limi orqali murojaat yuborishi kerak.</p>
    <h2>7. Taqiqlangan foydalanish</h2>
    <ul>
      <li>firibgarlik, tahdid, haqorat yoki noqonuniy xizmatlar;</li>
      <li>yolg‘on profil, sharh yoki buyurtma yaratish;</li>
      <li>boshqa foydalanuvchining ma’lumotlari va kontentiga ruxsatsiz kirish;</li>
      <li>platforma xavfsizligi yoki ishlashiga zarar yetkazish.</li>
    </ul>
    <h2>8. Akkaunt choralar</h2>
    <p>Qoidabuzarlik, xavfsizlik xavfi yoki qonuniy talab bo‘lsa, NearFIX akkauntni cheklashi, bloklashi yoki kontentni olib tashlashi mumkin.</p>
    <h2>9. Javobgarlik chegarasi</h2>
    <p>NearFIX platformaning texnik ishlashi va vositachilik funksiyasini taqdim etadi. Qonun ruxsat bergan doirada, mustaqil usta bajargan ish sifati, tomonlar kelishgan narx yoki ilovadan tashqaridagi to‘lov uchun NearFIX bevosita javobgar emas.</p>
    <h2>10. Shartlarni o‘zgartirish</h2>
    <p>NearFIX ushbu shartlarni xizmat yoki qonunchilik talablari o‘zgarganda yangilashi mumkin. Yangilangan sana sahifaning yuqori qismida ko‘rsatiladi.</p>
    <h2>11. Aloqa</h2>
    <p>Shartlar yoki xizmat bo‘yicha savollar uchun ilovadagi Yordam bo‘limidan foydalaning.</p>
  `
);

export const accountDeletionHtml = page(
  "NearFIX akkauntini o‘chirish",
  `
    <p>NearFIX akkauntingizni va unga bog‘langan shaxsiy ma’lumotlarni ilovaning o‘zida o‘chirishingiz mumkin.</p>
    <h2>O‘chirish tartibi</h2>
    <ol>
      <li>NearFIX ilovasiga kiring.</li>
      <li><strong>Profil</strong> bo‘limini oching.</li>
      <li><strong>Hisobni o‘chirish</strong> tugmasini bosing.</li>
      <li>Ogohlantirishni o‘qib, o‘chirishni tasdiqlang.</li>
    </ol>
    <h2>Darhol o‘chiriladigan ma’lumotlar</h2>
    <p>Faol sessiyalar, push tokenlar, saqlangan manzillar, sevimlilar, shaxsiy bildirishnomalar va faol tasdiqlash so‘rovlari o‘chiriladi. Telefon raqami, ism va profil ma’lumotlari anonimlashtiriladi.</p>
    <h2>Saqlanib qoladigan ma’lumotlar</h2>
    <p>Buyurtmalar, chat va yordam tarixi, sharhlar hamda qonuniy yoki nizolarni ko‘rib chiqish uchun zarur operatsion yozuvlar anonimlashtirilgan foydalanuvchi identifikatori bilan saqlanishi mumkin.</p>
    <div class="notice">Ilovaga kira olmasangiz, ilovadagi kirish/tiklash vositalaridan foydalaning yoki NearFIX Yordam bo‘limi orqali murojaat yuboring.</div>
  `
);
