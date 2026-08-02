import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Camera, ImagePlus } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function UploadBox({ photos = [], onAddPhoto }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onAddPhoto("camera")}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Camera size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.actionText}>Kamera</Text>
        </Pressable>
        <Pressable
          onPress={() => onAddPhoto("gallery")}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <ImagePlus size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.actionText}>Galereya</Text>
        </Pressable>
      </View>
      <View style={styles.previewRow}>
        {photos.length ? (
          photos.map((photo) => (
            <View key={photo.id} style={styles.preview}>
              <Text style={styles.previewText}>{photo.source === "camera" ? "CAM" : "IMG"}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyPreview}>
            <ImagePlus size={iconSizes.md} color={colors.subtle} strokeWidth={2.3} />
            <Text style={styles.emptyText}>Rasm qo'shsangiz, usta muammoni tezroq baholaydi.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  actionText: {
    color: colors.primary,
    fontWeight: "900"
  },
  previewRow: {
    minHeight: 74
  },
  preview: {
    width: 74,
    height: 74,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  previewText: {
    color: colors.primary,
    fontWeight: "900"
  },
  emptyPreview: {
    minHeight: 74,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 6
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
