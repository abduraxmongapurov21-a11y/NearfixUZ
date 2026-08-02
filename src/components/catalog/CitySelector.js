import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronDown, MapPin } from "lucide-react-native";
import { CITIES } from "../../constants/catalog";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function CitySelector({ selectedCityId, onSelectCity }) {
  return (
    <View style={styles.wrap}>
      {CITIES.map((city) => {
        const active = city.id === selectedCityId;
        return (
          <Pressable
            key={city.id}
            onPress={() => onSelectCity(city.id)}
            style={({ pressed }) => [
              styles.city,
              active && styles.active,
              !city.supported && styles.unsupported,
              pressed && styles.pressed
            ]}
          >
            <MapPin size={iconSizes.sm} color={active ? colors.white : colors.primary} strokeWidth={2.4} />
            <Text style={[styles.cityText, active && styles.cityTextActive]}>{city.name}</Text>
            {active ? <ChevronDown size={iconSizes.sm} color={colors.white} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8
  },
  city: {
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  unsupported: {
    opacity: 0.72
  },
  cityText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  cityTextActive: {
    color: colors.white
  },
  pressed: {
    opacity: 0.78
  }
});
