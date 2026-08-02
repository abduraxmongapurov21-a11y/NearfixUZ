import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LocateFixed, MapPin } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
import { Text, TextInput } from "../../i18n/native";

export function AddressCard({ address, onChangeAddress, useCurrentLocation, onUseCurrentLocation }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onUseCurrentLocation}
        style={({ pressed }) => [
          styles.locationButton,
          useCurrentLocation && styles.locationActive,
          pressed && styles.pressed
        ]}
      >
        <LocateFixed size={iconSizes.md} color={useCurrentLocation ? colors.white : colors.primary} strokeWidth={2.5} />
        <View style={styles.locationTextBlock}>
          <Text style={[styles.locationTitle, useCurrentLocation && styles.light]}>Joriy joylashuvdan foydalanish</Text>
          <Text style={[styles.locationMeta, useCurrentLocation && styles.lightMuted]}>Tezroq va aniqroq matching</Text>
        </View>
      </Pressable>

      <View style={styles.mapPreview}>
        <MapPin size={iconSizes.lg} color={colors.primary} strokeWidth={2.6} />
        <View style={styles.mapLines}>
          <View style={styles.mapLine} />
          <View style={[styles.mapLine, styles.mapLineShort]} />
        </View>
        <Text style={styles.mapBadge}>Yunusobod</Text>
      </View>

      <View>
        <Text style={styles.label}>Manzil</Text>
        <TextInput
          value={address}
          onChangeText={onChangeAddress}
          placeholder="Ko'cha, uy, mo'ljal"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12
  },
  locationButton: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  locationActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  locationTextBlock: {
    flex: 1
  },
  locationTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  locationMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  light: {
    color: colors.white
  },
  lightMuted: {
    color: "rgba(255,255,255,0.78)"
  },
  mapPreview: {
    height: 118,
    borderRadius: radius.xl,
    backgroundColor: "#E6F4F8",
    overflow: "hidden",
    padding: 16,
    justifyContent: "space-between"
  },
  mapLines: {
    position: "absolute",
    left: 62,
    right: 16,
    top: 28,
    gap: 18
  },
  mapLine: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: "rgba(15,113,157,0.12)"
  },
  mapLineShort: {
    width: "68%"
  },
  mapBadge: {
    alignSelf: "flex-end",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    color: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900"
  },
  label: {
    marginBottom: 8,
    color: colors.text,
    fontWeight: "900"
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.78
  }
});
