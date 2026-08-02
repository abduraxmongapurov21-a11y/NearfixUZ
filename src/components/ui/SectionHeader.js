import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../../theme";
import { Text } from "../../i18n/native";

export function SectionHeader({ title, action, onPress }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onPress}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  action: {
    color: "#1F5CFF",
    fontSize: 12,
    fontWeight: "900"
  }
});
