import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MapPinned, Plus } from "lucide-react-native";
import { AddressCard } from "./AddressCard";
import { SectionHeader } from "../ui/SectionHeader";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function SavedAddressesSection({ addresses, onAdd, onEdit, onDelete }) {
  return (
    <View style={styles.wrap}>
      <SectionHeader title="Manzillar" action="Yangi" onPress={onAdd} />
      <View style={styles.mapFlow}>
        <MapPinned size={iconSizes.md} color={colors.primary} strokeWidth={2.6} />
        <Text style={styles.mapFlowText}>Yandex Maps orqali manzilni tanlash va tasdiqlash uchun tayyor UX.</Text>
        <Pressable onPress={onAdd} style={styles.addSmall}>
          <Plus size={iconSizes.sm} color={colors.white} strokeWidth={2.8} />
        </Pressable>
      </View>
      {addresses.map((address) => (
        <AddressCard
          key={address.id}
          address={address}
          onEdit={() => onEdit(address)}
          onDelete={() => onDelete(address.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  mapFlow: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: "#E6F4F8",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  mapFlowText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  addSmall: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  }
});
