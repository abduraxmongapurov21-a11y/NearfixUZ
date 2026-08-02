export const WORKER_STATUS = {
  AVAILABLE: "available",
  BUSY: "busy",
  OFFLINE: "offline"
};

export const workerStatusCopy = {
  [WORKER_STATUS.AVAILABLE]: {
    label: "Hozir buyurtma qabul qilmoqda",
    helper: "Bugun tezkor chiqish mumkin",
    tone: "success"
  },
  [WORKER_STATUS.BUSY]: {
    label: "Band - 3 kundan keyin bo'sh",
    helper: "Kelajak vaqt uchun bron qilish mumkin",
    tone: "warning"
  },
  [WORKER_STATUS.OFFLINE]: {
    label: "Hozir mavjud emas",
    helper: "Chat qoldiring yoki boshqa ustani tanlang",
    tone: "danger"
  }
};
