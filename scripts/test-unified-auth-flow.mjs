import assert from "node:assert/strict";
import fs from "node:fs";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const guestProfile = source("src/screens/profile/GuestProfileScreen.js");
const login = source("src/screens/auth/LoginScreen.js");
const otp = source("src/screens/auth/OtpScreen.js");
const profile = source("src/screens/auth/AuthProfileScreen.js");
const navigator = source("src/navigation/AuthNavigator.js");
const authStore = source("src/store/authStore.js");

assert.match(guestProfile, /title="Kirish yoki ro'yxatdan o'tish"/);
assert.equal((guestProfile.match(/<PrimaryButton/g) || []).length, 1, "guest profile must expose one primary auth CTA");
assert.doesNotMatch(guestProfile, /SecondaryButton|title="Usta bo'lish"/);

assert.match(navigator, /initialRouteName=\{invalidation \? ROUTES\.SESSION_INVALIDATED : ROUTES\.LOGIN\}/);
assert.match(navigator, /ROUTES\.AUTH_PROFILE/);
assert.doesNotMatch(navigator, /RegisterScreen|PasswordEntryScreen|ROUTES\.REGISTER|ROUTES\.AUTH_PASSWORD/);

assert.match(login, /requestAuthOtp\(normalizedPhone, "AUTH"\)/);
assert.match(login, /if \(loading \|\| submittingRef\.current\) return/);
assert.match(login, /editable=\{!loading\}/);
assert.doesNotMatch(login, /secureTextEntry|password|Parol/);

assert.match(otp, /result\.status === "REGISTRATION_REQUIRED"/);
assert.match(otp, /navigation\.navigate\(ROUTES\.AUTH_PROFILE/);
assert.match(otp, /resumeAfterAuthentication/);
assert.match(otp, /if \(loading \|\| actionRef\.current \|\| resendSeconds > 0 \|\| !phone\) return/);
assert.match(otp, /disabled=\{loading \|\| resendSeconds > 0\}/);

assert.match(profile, /completeRegistration\(registrationToken, normalizedName\)/);
assert.match(profile, /resumeAfterAuthentication/);
assert.match(profile, /if \(loading \|\| submittingRef\.current\) return/);
assert.doesNotMatch(profile, /secureTextEntry|password|USER_ROLES|setRole|role:/);

assert.match(authStore, /if \(apiResult\.status === "REGISTRATION_REQUIRED"\) return apiResult/);
assert.match(authStore, /completeRegistration: async/);
assert.match(authStore, /pendingIntent: previousUserId/);
assert.match(authStore, /pendingIntent: null/);

console.log("Unified mobile OTP flow source-contract tests passed.");
