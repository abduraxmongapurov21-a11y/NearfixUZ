import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n/native";
import { colors, spacing } from "../../theme";

export function MapPickerScreen() {
  return (
    <View style={styles.unsupported}>
      <Text style={styles.title}>Xarita mobil ilovada ishlaydi</Text>
      <Text style={styles.text}>MapPickerScreen Yandex MapKit orqali Android va iOS uchun tayyorlangan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupported: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  text: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  }
});
