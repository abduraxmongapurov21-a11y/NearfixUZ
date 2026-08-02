import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { PrimaryButton } from "../ui/Button";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { colors, iconSizes, radius, strongShadow } from "../../theme";
import { Text } from "../../i18n/native";

export function StickyBookingBar({ worker, onChat, onBook }) {
  const isOffline = worker.availability === WORKER_STATUS.OFFLINE;
  const isBusy = worker.availability === WORKER_STATUS.BUSY;

  return (
    <View style={styles.bar}>
      <Pressable onPress={onChat} style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
        <MessageCircle size={iconSizes.md} color={colors.primary} strokeWidth={2.5} />
        <Text style={styles.chatText}>Chat</Text>
      </Pressable>
      <View style={styles.ctaWrap}>
        <Text style={styles.meta}>
          {isBusy ? "Kelajak vaqt uchun bron" : isOffline ? "Xabar qoldirish mumkin" : worker.price}
        </Text>
        <PrimaryButton title={isBusy ? "Bron qilish" : "Buyurtma berish"} onPress={onBook} style={styles.cta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 104,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...strongShadow
  },
  chatButton: {
    width: 74,
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  chatText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  ctaWrap: {
    flex: 1
  },
  meta: {
    marginBottom: 6,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  cta: {
    minHeight: 54
  },
  pressed: {
    opacity: 0.75
  }
});
