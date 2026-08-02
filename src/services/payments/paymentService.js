import { apiRequest } from "../api/client";

const paymentProviders = {
  click: {
    id: "click",
    label: "Click"
  },
  payme: {
    id: "payme",
    label: "Payme"
  },
  uzum: {
    id: "uzum",
    label: "Uzum"
  }
};

export function getPaymentProviders() {
  return Object.values(paymentProviders);
}

export async function createPaymentIntent(orderId, amount, providerId = "click") {
  return apiRequest(async () => ({
    ok: false,
    orderId,
    amount,
    provider: paymentProviders[providerId] || paymentProviders.click,
    message: "Payment integration is planned for the next stage."
  }));
}
