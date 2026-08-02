import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { X } from "lucide-react-native";
import { cancellationReasons } from "../../constants/orderTracking";
import { colors, iconSizes, radius, strongShadow } from "../../theme";
import { Text } from "../../i18n/native";

export function CancelReasonSheet({ visible, onClose, onSelectReason }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Bekor qilish sababi</Text>
            <Text style={styles.subtitle}>Bu operatorlarga jarayonni yaxshilashga yordam beradi.</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={iconSizes.md} color={colors.text} strokeWidth={2.5} />
          </Pressable>
        </View>
        {cancellationReasons.map((reason) => (
          <Pressable
            key={reason}
            onPress={() => onSelectReason(reason)}
            style={({ pressed }) => [styles.reason, pressed && styles.pressed]}
          >
            <Text style={styles.reasonText}>{reason}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.28)"
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.white,
    padding: 20,
    gap: 12,
    ...strongShadow
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  reason: {
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  reasonText: {
    color: colors.text,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  }
});
