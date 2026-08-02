export const ORDER_STATES = {
  CREATED: "CREATED",
  SEARCHING: "SEARCHING",
  OFFER_RECEIVED: "OFFER_RECEIVED",
  WORKER_SELECTED: "WORKER_SELECTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

export const ORDER_STEPS = {
  SERVICE: 0,
  DETAILS: 1,
  LOCATION: 2,
  OFFERS: 3,
  CONFIRMATION: 4
};

export const urgencyOptions = [
  {
    id: "normal",
    label: "Oddiy",
    eta: "Bugun",
    tone: "Rejali"
  },
  {
    id: "fast",
    label: "Tez",
    eta: "1-2 soat",
    tone: "Tezroq"
  },
  {
    id: "urgent",
    label: "Shoshilinch",
    eta: "30 min",
    tone: "Hozir"
  }
];
