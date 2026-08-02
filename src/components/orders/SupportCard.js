import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Headphones, ShieldCheck } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function SupportCard({ onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Headphones size={iconSizes.md} color={colors.primary} strokeWidth={2.6} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>NearFIX support</Text>
        <Text style={styles.text}>Yordam kerakmi? Operator buyurtma jarayonini nazorat qilishga yordam beradi.</Text>
      </View>
      <ShieldCheck size={iconSizes.md} color={colors.success} strokeWidth={2.5} />
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
    gap: 12
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
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
