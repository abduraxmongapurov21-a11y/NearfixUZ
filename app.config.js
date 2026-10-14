const { expo } = require("./app.base.json");
const { resolveMobileRuntimeConfig } = require("./src/constants/mobileRuntimeConfig");

module.exports = () => {
  const runtimeConfig = resolveMobileRuntimeConfig();
  const yandexMapKitApiKey = process.env.YANDEX_MAPKIT_API_KEY?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || expo.android.googleServicesFile;
  const isProductionBuild = runtimeConfig.appEnvironment === "production" || process.env.EAS_BUILD_PROFILE === "production";

  if (isProductionBuild && !yandexMapKitApiKey) {
    throw new Error(
      "YANDEX_MAPKIT_API_KEY is required for a production native build. Configure a Yandex MapKit SDK key in the build environment, including local Xcode archives."
    );
  }

  return {
    ...expo,
    android: {
      ...expo.android,
      googleServicesFile
    },
    extra: {
      ...expo.extra,
      ...runtimeConfig,
      ...(yandexMapKitApiKey ? { yandexMapKitApiKey } : {})
    }
  };
};

module.exports.resolveMobileRuntimeConfig = resolveMobileRuntimeConfig;
