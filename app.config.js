const { expo } = require("./app.base.json");

const LOCAL_DEVELOPMENT_HOSTS = new Set(["10.0.2.2", "127.0.0.1", "localhost", "::1"]);

function resolveMobileRuntimeConfig(source = process.env) {
  const appEnvironment = source.EXPO_PUBLIC_APP_ENV?.trim();
  const configuredApiBaseUrl = source.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");

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

  if (appEnvironment === "development" && !LOCAL_DEVELOPMENT_HOSTS.has(parsedApiUrl.hostname)) {
    throw new Error("Development API must use localhost, loopback, or the Android emulator host bridge.");
  }

  if (appEnvironment === "production" && parsedApiUrl.protocol !== "https:") {
    throw new Error("Production API must use HTTPS.");
  }

  return { appEnvironment, apiBaseUrl: configuredApiBaseUrl };
}

module.exports = () => {
  const runtimeConfig = resolveMobileRuntimeConfig();
  const yandexMapKitApiKey = process.env.YANDEX_MAPKIT_API_KEY;
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === "production";

  if (isProductionBuild && !yandexMapKitApiKey) {
    throw new Error(
      "YANDEX_MAPKIT_API_KEY is required for a production native build. Configure a Yandex MapKit SDK key in the EAS production environment."
    );
  }

  return {
    ...expo,
    extra: {
      ...expo.extra,
      ...runtimeConfig,
      ...(yandexMapKitApiKey ? { yandexMapKitApiKey } : {})
    }
  };
};

module.exports.resolveMobileRuntimeConfig = resolveMobileRuntimeConfig;
