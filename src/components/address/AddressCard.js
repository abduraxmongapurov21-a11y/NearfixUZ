import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Edit3, MapPin, Trash2 } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function AddressCard({ address, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.mapPreview}>
        <MapPin size={iconSizes.md} color={colors.primary} strokeWidth={2.6} />
        <View style={styles.mapLine} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{address.label}</Text>
        <Text style={styles.address} numberOfLines={2}>
          {address.address}
        </Text>
        <Text style={styles.district}>{address.district}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onEdit} style={styles.iconButton}>
          <Edit3 size={iconSizes.sm} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.iconButton}>
          <Trash2 size={iconSizes.sm} color={colors.danger} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  mapPreview: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  mapLine: {
    position: "absolute",
    left: 9,
    right: 9,
    bottom: 12,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(15,113,157,0.16)"
  },
  body: {
    flex: 1
  },
  label: {
    color: colors.text,
    fontWeight: "900"
  },
  address: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  district: {
    marginTop: 5,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },
  actions: {
    gap: 8
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  }
});
