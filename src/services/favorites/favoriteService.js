import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

export async function fetchFavoritesApi(token) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest("/favorites", { token });
    return {
      ok: true,
      favoriteWorkerIds: (payload.favorites || []).map((favorite) => favorite.workerId)
    };
  });
}

export async function addFavoriteApi(token, workerId) {
  return apiRequest(async () => {
    await httpAuthRequest("/favorites", {
      method: "POST",
      token,
      body: { workerId }
    });
    return { ok: true };
  });
}

export async function removeFavoriteApi(token, workerId) {
  return apiRequest(async () => {
    await httpAuthRequest(`/favorites/${workerId}`, {
      method: "DELETE",
      token
    });
    return { ok: true };
  });
}
