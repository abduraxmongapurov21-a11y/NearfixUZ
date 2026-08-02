export const TRACKING_STATUSES = {
  REQUEST_SENT: "REQUEST_SENT",
  ACCEPTED: "ACCEPTED",
  ON_THE_WAY: "ON_THE_WAY",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

export const trackingStatusCopy = {
  [TRACKING_STATUSES.REQUEST_SENT]: {
    title: "Buyurtma yuborildi",
    subtitle: "Usta javobi kutilmoqda",
    tone: "warning"
  },
  [TRACKING_STATUSES.ACCEPTED]: {
    title: "Buyurtma tasdiqlandi",
    subtitle: "Usta ishga tayyorlanmoqda",
    tone: "success"
  },
  [TRACKING_STATUSES.ON_THE_WAY]: {
    title: "Usta yo'lda",
    subtitle: "Kelish vaqti yangilanmoqda",
    tone: "success"
  },
  [TRACKING_STATUSES.IN_PROGRESS]: {
    title: "Ish boshlandi",
    subtitle: "Usta xizmatni bajarmoqda",
    tone: "primary"
  },
  [TRACKING_STATUSES.COMPLETED]: {
    title: "Buyurtma yakunlandi",
    subtitle: "Xizmat bajarildi",
    tone: "success"
  },
  [TRACKING_STATUSES.CANCELLED]: {
    title: "Buyurtma bekor qilindi",
    subtitle: "Kerak bo'lsa boshqa usta tanlang",
    tone: "danger"
  }
};

export const timelineSteps = [
  {
    key: TRACKING_STATUSES.REQUEST_SENT,
    label: "Buyurtma yuborildi"
  },
  {
    key: TRACKING_STATUSES.ACCEPTED,
    label: "Usta qabul qildi"
  },
  {
    key: TRACKING_STATUSES.ON_THE_WAY,
    label: "Yo'lda"
  },
  {
    key: TRACKING_STATUSES.IN_PROGRESS,
    label: "Ish boshlandi"
  },
  {
    key: TRACKING_STATUSES.COMPLETED,
    label: "Yakunlandi"
  }
];

export const cancellationReasons = ["Usta javob bermadi", "Rejalar o'zgardi", "Boshqa usta topildi"];

export const activeStatusKeys = [
  TRACKING_STATUSES.REQUEST_SENT,
  TRACKING_STATUSES.ACCEPTED,
  TRACKING_STATUSES.ON_THE_WAY,
  TRACKING_STATUSES.IN_PROGRESS
];
