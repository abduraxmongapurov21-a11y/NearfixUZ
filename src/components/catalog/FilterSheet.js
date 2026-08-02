import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { X } from "lucide-react-native";
import { DISTRICTS, PRICE_RANGES } from "../../constants/catalog";
import { PrimaryButton, SecondaryButton } from "../ui/Button";
import { colors, iconSizes, radius, strongShadow } from "../../theme";
import { Text } from "../../i18n/native";

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function FilterSheet({ visible, filters, onChange, onReset, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Filterlar</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={iconSizes.md} color={colors.text} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Holat</Text>
          <FilterChip
            label="Hozir bo'sh"
            active={filters.availableNow}
            onPress={() => onChange({ availableNow: !filters.availableNow })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Reyting</Text>
          <FilterChip
            label="4.8+"
            active={filters.minRating}
            onPress={() => onChange({ minRating: !filters.minRating })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Tuman</Text>
          <View style={styles.wrapRow}>
            {DISTRICTS.map((district) => (
              <FilterChip
                key={district}
                label={district}
                active={filters.district === district}
                onPress={() => onChange({ district })}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Narx</Text>
          <View style={styles.wrapRow}>
            {PRICE_RANGES.map((range) => (
              <FilterChip
                key={range.id}
                label={range.label}
                active={filters.priceRange === range.id}
                onPress={() => onChange({ priceRange: range.id })}
              />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <SecondaryButton title="Tozalash" onPress={onReset} style={styles.actionButton} />
          <PrimaryButton title="Ko'rsatish" onPress={onClose} style={styles.actionButton} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.28)"
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.white,
    padding: 20,
    gap: 16,
    ...strongShadow
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  section: {
    gap: 10
  },
  label: {
    color: colors.text,
    fontWeight: "900"
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  chipTextActive: {
    color: colors.white
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  pressed: {
    opacity: 0.78
  }
});
