import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function ChatBubble({ type, text, index }) {
  const outgoing = type === "out";

  return (
    <View style={[styles.bubble, outgoing ? styles.out : styles.in]}>
      <Text style={[styles.text, outgoing && styles.textOut]}>{text}</Text>
      <Text style={[styles.time, outgoing && styles.timeOut]}>10:{45 + index}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    padding: 12
  },
  in: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border
  },
  out: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary
  },
  text: {
    color: colors.text,
    fontWeight: "600",
    lineHeight: 20
  },
  textOut: {
    color: colors.white
  },
  time: {
    marginTop: 6,
    color: colors.subtle,
    fontSize: 11,
    alignSelf: "flex-end"
  },
  timeOut: {
    color: "rgba(255,255,255,0.75)"
  }
});
