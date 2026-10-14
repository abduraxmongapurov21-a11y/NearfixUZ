const LOCAL_DEVELOPMENT_HOSTS = new Set(["10.0.2.2", "localhost", "::1"]);

function isLocalDevelopmentHost(hostname) {
  // URL.hostname keeps brackets around IPv6 addresses.
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return LOCAL_DEVELOPMENT_HOSTS.has(host) || /^127\./.test(host) || host.endsWith(".localhost");
}

function isPrivateLanHost(hostname) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function resolveMobileRuntimeConfig(source = process.env) {
  const appEnvironment = source.EXPO_PUBLIC_APP_ENV?.trim();
  const configuredApiBaseUrl = source.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

  if (!appEnvironment || !["development", "production"].includes(appEnvironment)) {
    throw new Error("EXPO_PUBLIC_APP_ENV must be explicitly set to development or production.");
  }
  if (!configuredApiBaseUrl) {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is required for ${appEnvironment}. Production fallback is disabled.`);
  }

  let parsedApiUrl;
  try {
    parsedApiUrl = new URL(configuredApiBaseUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.");
  }

  if (appEnvironment === "production" && parsedApiUrl.protocol !== "https:") {
    throw new Error("Production API must use HTTPS.");
  }
  if (appEnvironment === "development" && !["http:", "https:"].includes(parsedApiUrl.protocol)) {
    throw new Error("Development API must use HTTP or HTTPS.");
  }
  // Requests append a path to this value; query/fragment delimiters would turn
  // that path into query/fragment content. Credentials are never API config.
  if (configuredApiBaseUrl.includes("?") || configuredApiBaseUrl.includes("#") || parsedApiUrl.username || parsedApiUrl.password) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must not contain credentials, a query, or a fragment.");
  }
  const localHost = isLocalDevelopmentHost(parsedApiUrl.hostname);
  if (appEnvironment === "development" && !localHost && !isPrivateLanHost(parsedApiUrl.hostname)) {
    throw new Error("Development API must use localhost, loopback, the Android emulator host bridge, or a private LAN address.");
  }
  if (appEnvironment === "production" && localHost) {
    throw new Error("Production API must not use localhost, loopback, or the Android emulator host bridge.");
  }

  return { appEnvironment, apiBaseUrl: configuredApiBaseUrl };
}

module.exports = { resolveMobileRuntimeConfig };
