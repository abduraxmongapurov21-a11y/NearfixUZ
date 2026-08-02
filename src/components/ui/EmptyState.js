import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function EmptyState({ title, text }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 6
  },
  title: {
    color: colors.text,
    fontWeight: "900"
  },
  text: {
    color: colors.muted,
    lineHeight: 20,
    fontWeight: "600"
  }
});
