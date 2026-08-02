import fs from "node:fs/promises";
import path from "node:path";
import { extractCopy } from "./i18n-copy-tools.mjs";

const MANUAL_OVERRIDES = {
  "{{value0}} manzili ilova konfiguratsiyasida ko'rsatilmagan.": [
    "{{value0}} URL is not configured in the app.",
    "Ссылка {{value0}} не настроена в приложении."
  ],
  "{{value0}} manzilini ochib bo'lmadi.": ["Could not open {{value0}}.", "Не удалось открыть {{value0}}."],
  "{{value0}} raqamiga yuborilgan kodni kiriting.": [
    "Enter the code sent to {{value0}}.",
    "Введите код, отправленный на номер {{value0}}."
  ],
  "{{value0}} ta manzil": ["{{value0}} addresses", "{{value0}} адреса"],
  "{{value0}} ta o'qilmagan": ["{{value0}} unread", "{{value0}} непрочитанных"],
  "{{value0}} ta sharh": ["{{value0}} reviews", "{{value0}} отзывов"],
  Barchasi: ["All", "Все"],
  Bekor: ["Cancel", "Отмена"],
  "Bekor qilish": ["Cancel", "Отмена"],
  Bosh: ["Home", "Главная"],
  "Bu oy": ["This month", "В этом месяце"],
  Buyurtma: ["Order", "Заказ"],
  "Buyurtma suhbati": ["Order chat", "Чат по заказу"],
  "Buyurtma chati": ["Order chat", "Чат по заказу"],
  Chilonzor: ["Chilonzor", "Чиланзар"],
  Chiqish: ["Sign out", "Выйти"],
  Elektrik: ["Electrician", "Электрик"],
  "Faol ish": ["Active job", "Активный заказ"],
  "Faol ish yo'q": ["No active job", "Нет активного заказа"],
  "Faol soat": ["Active hours", "Активные часы"],
  "Hali xabar yo'q": ["No messages yet", "Сообщений пока нет"],
  "Hozir bo'sh": ["Available now", "Сейчас свободен"],
  Ishlar: ["Jobs", "Работы"],
  "Ishni boshlash": ["Start job", "Начать работу"],
  "Ishni yakunlash": ["Complete job", "Завершить работу"],
  Kelishilgan: ["Agreed", "Согласовано"],
  Kirish: ["Sign in", "Войти"],
  "Ko'cha, uy, mo'ljal": ["Street, house, landmark", "Улица, дом, ориентир"],
  "Mening ustalarim": ["My professionals", "Мои специалисты"],
  "Murojaat sababi": ["Request reason", "Причина обращения"],
  "Murojaat yaratildi": ["Request created", "Обращение создано"],
  "NearFIX usta": ["NearFIX professional", "Специалист NearFIX"],
  "O'chirish": ["Delete", "Удалить"],
  "Qabul": ["Accept", "Принять"],
  "Qabul qilish": ["Accept", "Принять"],
  "Qanday usta kerak?": ["What kind of professional do you need?", "Какой специалист вам нужен?"],
  "Rasmga olish": ["Take photo", "Сделать фото"],
  Sharhlar: ["Reviews", "Отзывы"],
  "Sharhlar hali yo'q": ["No reviews yet", "Отзывов пока нет"],
  "Tezkor sabablar": ["Quick reasons", "Быстрый выбор причины"],
  Tuman: ["District", "Район"],
  "Top Usta": ["Top professional", "Топ-специалист"],
  "TOP USTA": ["TOP PROFESSIONAL", "ТОП-СПЕЦИАЛИСТ"],
  Tozalash: ["Cleaning", "Уборка"],
  Usta: ["Professional", "Специалист"],
  "Usta haqida shikoyat": ["Report professional", "Пожаловаться на специалиста"],
  "Usta profili": ["Professional profile", "Профиль специалиста"],
  "Usta javobi uchun vaqt": ["Time for the professional to respond", "Время на ответ специалиста"],
  "Usta tanlanmagan": ["No professional selected", "Специалист не выбран"],
  "Usta tanlanmagan.": ["No professional selected.", "Специалист не выбран."],
  "Usta topilmadi": ["Professional not found", "Специалист не найден"],
  Ustalar: ["Professionals", "Специалисты"],
  "Ustalar topilmadi": ["No professionals found", "Специалисты не найдены"],
  "Ustani bloklash": ["Block professional", "Заблокировать специалиста"],
  Uy: ["Home", "Главная"],
  "Yopish": ["Close", "Закрыть"],
  "Yordam so'rash": ["Request help", "Обратиться за помощью"],
  Yuborish: ["Send", "Отправить"],
  Tasdiqlash: ["Confirm", "Подтвердить"],
  Tahrirlash: ["Edit", "Редактировать"],
  "/dan": ["/", "/"]
};

const root = process.cwd();
const outputDirectory = path.join(root, "src", "i18n", "locales");
const entries = [...extractCopy({ root }).keys()].sort((left, right) => left.localeCompare(right, "uz"));

async function translateBatch(values, language) {
  const protectedValues = values.map((value) => value.replace(/\{\{value(\d+)\}\}/g, "__NF_VALUE_$1__"));
  const query = protectedValues.join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", language);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation request failed (${response.status})`);
  const payload = await response.json();
  const translated = payload[0]
    .map((part) => part[0])
    .join("")
    .split("\n");
  if (translated.length !== values.length) {
    throw new Error(
      `Translation line count mismatch for ${language}: expected ${values.length}, received ${translated.length}`
    );
  }
  return translated.map((value) => value.replace(/__NF_VALUE_(\d+)__/g, "{{value$1}}"));
}

async function translate(values, language) {
  const translated = [];
  for (let index = 0; index < values.length; index += 40) {
    translated.push(...(await translateBatch(values.slice(index, index + 40), language)));
  }
  return translated;
}

await fs.mkdir(outputDirectory, { recursive: true });
const uz = Object.fromEntries(entries.map((entry) => [entry, entry]));
const [englishValues, russianValues] = await Promise.all([translate(entries, "en"), translate(entries, "ru")]);
const en = Object.fromEntries(entries.map((entry, index) => [entry, englishValues[index]]));
const ru = Object.fromEntries(entries.map((entry, index) => [entry, russianValues[index]]));

for (const [key, [english, russian]] of Object.entries(MANUAL_OVERRIDES)) {
  if (!Object.prototype.hasOwnProperty.call(uz, key)) continue;
  en[key] = english;
  ru[key] = russian;
}

for (const [language, resource] of Object.entries({ uz, en, ru })) {
  await fs.writeFile(path.join(outputDirectory, `${language}.json`), `${JSON.stringify(resource, null, 2)}\n`, "utf8");
}

console.log(`Generated ${entries.length} translation entries for uz, en and ru.`);
