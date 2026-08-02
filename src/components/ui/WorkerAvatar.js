import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { getInitials, resolveWorkerImage } from "../../services/images/imageService";
import { colors } from "../../theme";
import { Text } from "../../i18n/native";

export function WorkerAvatar({ worker, size = 56, radius = 18, style }) {
  const image = resolveWorkerImage(worker);
  const dimensionStyle = {
    width: size,
    height: size,
    borderRadius: radius
  };

  if (image) {
    return <Image source={image} style={[styles.image, dimensionStyle, style]} />;
  }

  return (
    <View style={[styles.fallback, dimensionStyle, style]}>
      <Text style={[styles.initials, { fontSize: Math.max(12, Math.round(size * 0.34)) }]}>
        {getInitials(worker?.name || worker?.specialty)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surface
  },
  fallback: {
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    color: colors.primary,
    fontWeight: "900"
  }
});
