import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

const restartModule = Platform.OS === "android"
  ? requireOptionalNativeModule("NearfixProcessRestart")
  : null;

export function restartAndroidProcess() {
  if (Platform.OS !== "android") return false;

  if (typeof restartModule?.restart !== "function") return false;

  restartModule.restart();
  return true;
}
