const { expo } = require("./app.base.json");

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const isProductionAndroidBuild =
    process.env.EAS_BUILD_PROFILE === "production" && process.env.EAS_BUILD_PLATFORM === "android";
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === "production";

  if (isProductionBuild && !easProjectId) {
    throw new Error(
      "EXPO_PUBLIC_EAS_PROJECT_ID is required for production push notifications. Configure it in the EAS production environment."
    );
  }

  if (isProductionAndroidBuild && !googleMapsApiKey) {
    throw new Error(
      "GOOGLE_MAPS_ANDROID_API_KEY is required for a production Android build. Configure it in the EAS production environment."
    );
  }

  return {
    ...expo,
    android: {
      ...expo.android,
      ...(googleMapsApiKey
        ? {
            config: {
              ...expo.android?.config,
              googleMaps: { apiKey: googleMapsApiKey }
            }
          }
        : {})
    },
    extra: {
      ...expo.extra,
      ...(easProjectId
        ? {
            eas: {
              ...expo.extra?.eas,
              projectId: easProjectId
            }
          }
        : {})
    }
  };
};
