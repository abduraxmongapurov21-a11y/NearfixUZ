import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Headphones, TriangleAlert } from "lucide-react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function WorkerSupportCard({ onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Headphones size={iconSizes.md} color={colors.primary} strokeWidth={2.6} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Operatsion yordam</Text>
        <Text style={styles.text}>Mijoz, manzil yoki bekor qilish muammosi bo'lsa yordam bo'limiga xabar bering.</Text>
      </View>
      <TriangleAlert size={iconSizes.md} color={colors.warning} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 78,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontWeight: "900"
  },
  text: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
