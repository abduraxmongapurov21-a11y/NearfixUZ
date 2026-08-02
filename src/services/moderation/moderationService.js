import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

export async function createReportApi(token, report) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/reports", {
      method: "POST",
      token,
      body: report
    });
    return { ok: true, report: payload.report };
  });
}

export async function blockUserApi(token, blockedUserId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/blocks", {
      method: "POST",
      token,
      body: { blockedUserId }
    });
    return { ok: true, block: payload.block };
  });
}

export async function unblockUserApi(token, blockedUserId) {
  return apiRequest(async () => {
    await httpAuthRequest(`/blocks/${blockedUserId}`, {
      method: "DELETE",
      token
    });
    return { ok: true };
  });
}

export async function fetchBlockedUsersApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/blocks", { token });
    return { ok: true, blocks: payload.blocks || [] };
  });
}
