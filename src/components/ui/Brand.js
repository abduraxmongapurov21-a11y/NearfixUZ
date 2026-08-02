import React from "react";
import { StyleSheet, View } from "react-native";
import { Wrench } from "lucide-react-native";
import { colors } from "../../theme";
import { Text } from "../../i18n/native";

export function Brand({ small = false, tagline = false }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, small && styles.markSmall]}>
        <Wrench size={small ? 14 : 16} color={colors.white} strokeWidth={3} />
      </View>
      <View>
        <Text style={[styles.text, small && styles.textSmall]}>
          Near<Text style={styles.accent}>FIX</Text>
        </Text>
        {tagline ? <Text style={styles.tagline}>Sizga yaqin yordam</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(44,216,165,0.28)"
  },
  markSmall: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  text: {
    fontSize: 21,
    color: colors.text,
    fontWeight: "900"
  },
  textSmall: {
    fontSize: 18
  },
  accent: {
    color: colors.secondary
  },
  tagline: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700"
  }
});
