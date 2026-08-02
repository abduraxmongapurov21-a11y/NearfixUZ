import { apiRequest, httpRequest } from "../api/client";

function authSessionResult(payload) {
  return {
    ok: true,
    token: payload.token,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user
  };
}

function otpRequestResult(payload) {
  return {
    ok: true,
    expiresIn: payload.expiresIn,
    resendIn: payload.resendIn,
    nextStep: payload.nextStep
  };
}

export async function requestAuthOtp(phone, purpose = "AUTH") {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/otp/request", {
      method: "POST",
      body: { phone, purpose }
    });

    return otpRequestResult(payload);
  });
}

export async function requestRegisterOtp(phone) {
  return requestAuthOtp(phone, "AUTH");
}

export async function verifyAuthOtp(phone, code, purpose = "AUTH") {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/otp/verify", {
      method: "POST",
      body: { phone, code, purpose }
    });

    return authSessionResult(payload);
  });
}

export async function loginWithAppReviewDemo(phone, password) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/app-review/login", {
      method: "POST",
      body: { phone, password }
    });

    return authSessionResult(payload);
  });
}

export async function loginWithPassword(otpSessionToken, password) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/password/login", {
      method: "POST",
      body: { otpSessionToken, password }
    });

    return authSessionResult(payload);
  });
}

export async function requestForgotPasswordOtp(phone) {
  return requestAuthOtp(phone, "PASSWORD_RESET");
}

export async function setupPassword(otpSessionToken, password, confirmPassword) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/password/setup", {
      method: "POST",
      body: { otpSessionToken, password, confirmPassword }
    });

    return authSessionResult(payload);
  });
}

export async function resetPassword(otpSessionToken, password, confirmPassword) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/password/reset", {
      method: "POST",
      body: { otpSessionToken, password, confirmPassword }
    });

    return authSessionResult(payload);
  });
}

export async function updateCurrentUserApi(token, profile) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/me", {
      method: "PATCH",
      token,
      body: profile
    });

    return {
      ok: true,
      user: payload.user
    };
  });
}

export async function getCurrentUserApi(token) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/me", { token });

    return {
      ok: true,
      user: payload.user
    };
  });
}

export async function refreshAccessTokenApi(refreshToken) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/refresh", {
      method: "POST",
      body: { refreshToken }
    });

    return {
      ok: true,
      token: payload.token,
      accessToken: payload.accessToken,
      user: payload.user
    };
  });
}

export async function logoutApi(token, pushToken) {
  return apiRequest(async () => {
    if (pushToken) {
      await httpRequest("/notifications/push-token", {
        method: "DELETE",
        token,
        body: { token: pushToken }
      }).catch(() => null);
    }

    await httpRequest("/auth/logout", {
      method: "POST",
      token
    });

    return { ok: true };
  });
}

export async function deleteCurrentUserApi(token) {
  return apiRequest(async () => {
    const payload = await httpRequest("/auth/me", {
      method: "DELETE",
      token
    });

    return {
      ok: true,
      deleted: payload.deleted,
      deletedAt: payload.deletedAt
    };
  });
}
