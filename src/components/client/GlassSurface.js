import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { colors } from "../../theme/clientTheme";

// Existing custom binaries can continue with a solid material until rebuilt.
// Android uses the material fallback instead of SDK 54's experimental blur.
const BlurView =
  Platform.OS === "web" || (Platform.OS === "ios" && requireOptionalNativeModule("ExpoBlurView"))
    ? require("expo-blur").BlurView
    : null;

export function GlassSurface({ children, style, intensity = 46, ...props }) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => {
        if (active) setReduceTransparency(value);
      })
      .catch(() => null);
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return (
    <View {...props} style={[styles.surface, style]}>
      {!reduceTransparency && BlurView ? (
        <BlurView
          pointerEvents="none"
          tint="systemThinMaterialLight"
          intensity={intensity}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: reduceTransparency || !BlurView ? "rgba(255,255,255,0.97)" : colors.glass }
        ]}
      />
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const childStyle = child.props.style;
        return React.cloneElement(child, {
          style:
            typeof childStyle === "function"
              ? (state) => [childStyle(state), styles.content]
              : [childStyle, styles.content]
        });
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  surface: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.95)" },
  content: { position: "relative", zIndex: 1 }
});
