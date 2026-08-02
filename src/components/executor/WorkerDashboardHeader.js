import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function WorkerDashboardHeader({ workerName }) {
  const initials = workerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.nameBlock}>
        <Text style={styles.caption}>Xayrli tong,</Text>
        <Text style={styles.name}>{workerName}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || "AT"}</Text>
        <View style={styles.badgeDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  nameBlock: {
    flex: 1
  },
  name: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: "#FF6B1A",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900"
  },
  badgeDot: {
    position: "absolute",
    right: -1,
    top: 1,
    width: 13,
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: "#FF6B1A",
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  }
});
