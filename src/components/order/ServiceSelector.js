import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Grid2X2, Hammer, Sparkles, Wrench, Zap } from "lucide-react-native";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

const icons = {
  wrench: Wrench,
  zap: Zap,
  hammer: Hammer,
  sparkles: Sparkles,
  grid: Grid2X2
};

export function ServiceSelector({ categories, selectedId, onSelect }) {
  return (
    <View style={styles.grid}>
      {categories.map((service) => {
        const Icon = icons[service.icon] || Grid2X2;
        const selected = selectedId === service.id;

        return (
          <Pressable
            key={service.id}
            onPress={() => onSelect(service.id)}
            style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, selected && styles.iconSelected]}>
              <Icon size={iconSizes.lg} color={selected ? colors.white : colors.primary} strokeWidth={2.6} />
            </View>
            <Text style={[styles.title, selected && styles.titleSelected]}>{service.title}</Text>
            <Text style={styles.caption}>{service.id === "more" ? "Boshqa xizmatlar" : "Tez tanlash"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  card: {
    width: "48%",
    minHeight: 126,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: "space-between",
    ...shadow
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: "#F7FCFD"
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: "#E6F4F8",
    alignItems: "center",
    justifyContent: "center"
  },
  iconSelected: {
    backgroundColor: colors.primary
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  titleSelected: {
    color: colors.primary
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
