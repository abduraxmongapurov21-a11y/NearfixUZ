import i18n, { LANGUAGES, normalizeLocale } from "./index";

export { LANGUAGES };

const legacyKeys = {
  home: "Uy",
  orders: "Buyurtmalar",
  notifications: "Bildirishnomalar",
  chats: "Chatlar",
  profile: "Profil",
  add: "Qo'shish",
  settings: "Sozlamalar",
  personalInfo: "Shaxsiy ma'lumotlar",
  fullName: "Ism",
  phone: "Telefon raqam",
  security: "Xavfsizlik",
  addresses: "Manzillar",
  language: "Til",
  help: "Yordam",
  logout: "Chiqish",
  logoutTitle: "Hisobdan chiqish",
  logoutMessage: "Akkauntingizdan chiqmoqchimisiz?",
  cancel: "Bekor qilish",
  confirmLogout: "Chiqish"
};

export function translate(locale, key) {
  return i18n.getFixedT(normalizeLocale(locale))(legacyKeys[key] || key);
}
