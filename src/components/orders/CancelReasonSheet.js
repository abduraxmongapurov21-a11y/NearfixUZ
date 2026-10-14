import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { cancellationReasons } from "../../constants/orderTracking";
import { colors, font, iconSizes, radius, strongShadow } from "../../theme/clientTheme";
import { Text } from "../../i18n/native";

export function CancelReasonSheet({ visible, onClose, onSelectReason }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [submittingReason, setSubmittingReason] = useState(null);
  async function selectReason(reason) {
    if (submittingReason) return;
    setSubmittingReason(reason);
    try {
      await onSelectReason(reason);
    } finally {
      setSubmittingReason(null);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Bekor qilish sababi</Text>
            <Text style={styles.subtitle}>Bu operatorlarga jarayonni yaxshilashga yordam beradi.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Yopish")}
            onPress={onClose}
            style={styles.closeButton}
          >
            <X size={iconSizes.md} color={colors.text} strokeWidth={1.8} />
          </Pressable>
        </View>
        {cancellationReasons.map((reason) => (
          <Pressable
            key={reason}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(submittingReason), busy: submittingReason === reason }}
            disabled={Boolean(submittingReason)}
            onPress={() => selectReason(reason)}
            style={({ pressed }) => [styles.reason, pressed && styles.pressed]}
          >
            <Text style={styles.reasonText}>{reason}</Text>
            {submittingReason === reason ? <ActivityIndicator color={colors.primary} size="small" /> : null}
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
  headerCopy: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 20,
    fontFamily: font.bold
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.regular
  },
  closeButton: {
    width: 44,
    height: 44,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14
  },
  reasonText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.medium
  },
  pressed: {
    opacity: 0.78
  }
});
