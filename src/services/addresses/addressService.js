import { apiRequest, httpRequest } from "../api/client";
import { mapApiAddress, toAddressPayload } from "./addressMapper.mjs";

export { mapApiAddress, toAddressPayload } from "./addressMapper.mjs";

export async function getAddressesApi(token) {
  return apiRequest(async () => {
    const payload = await httpRequest("/addresses", { token });
    return { ok: true, addresses: (payload.addresses || []).map(mapApiAddress) };
  });
}

export async function createAddressApi(token, address) {
  return apiRequest(async () => {
    const payload = await httpRequest("/addresses", {
      method: "POST",
      token,
      body: toAddressPayload(address)
    });
    return { ok: true, address: mapApiAddress(payload.address) };
  });
}

export async function updateAddressApi(token, addressId, patch) {
  return apiRequest(async () => {
    const payload = await httpRequest(`/addresses/${addressId}`, {
      method: "PATCH",
      token,
      body: toAddressPayload(patch)
    });
    return { ok: true, address: mapApiAddress(payload.address) };
  });
}

export async function deleteAddressApi(token, addressId) {
  return apiRequest(async () => {
    await httpRequest(`/addresses/${addressId}`, { method: "DELETE", token });
    return { ok: true };
  });
}

export const fetchAddressesApi = getAddressesApi;
