import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

export async function createSupportTicketApi(token, ticket) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/support/tickets", {
      method: "POST",
      token,
      body: ticket
    });

    return {
      ok: true,
      ticket: payload.ticket
    };
  });
}

export async function fetchSupportTicketsApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/support/tickets", { token });

    return {
      ok: true,
      tickets: payload.tickets || []
    };
  });
}
