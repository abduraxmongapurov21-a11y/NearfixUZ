import React, { useState } from "react";
import { Check, ChevronRight, Globe2, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Alert, Text } from "../../i18n/native";
import { colors, radius } from "../../theme";
import {
  applyCountrySelection,
  COUNTRIES,
  OPERATIONAL_COUNTRY_CODE
} from "./countrySelectorModel.mjs";

export function CountrySelector() {
  const [selectorOpen, setSelectorOpen] = useState(false);

  function handleSelect(countryCode) {
    applyCountrySelection(countryCode, {
      closeSelector: () => setSelectorOpen(false),
      showUnavailable: () =>
        Alert.alert("Tez orada", "NearFIX bu mamlakatda hali mavjud emas.")
    });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mamlakat yoki hudud"
        accessibilityHint="NearFIX ishlaydigan hududni ko'ring"
        onPress={() => setSelectorOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <View style={styles.iconWrap}>
            <Globe2 size={20} color={colors.primary} strokeWidth={2.5} />
          </View>
          <View style={styles.titleBody}>
            <Text style={styles.title}>Mamlakat yoki hudud</Text>
            <View style={styles.currentCountryRow}>
              <Text translate={false} style={styles.flag}>🇺🇿</Text>
              <Text style={styles.currentCountry}>O'zbekiston</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Mavjud</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={20} color={colors.subtle} strokeWidth={2.5} />
        </View>
      </Pressable>

      <Modal transparent visible={selectorOpen} animationType="slide" onRequestClose={() => setSelectorOpen(false)}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yopish"
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectorOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBody}>
                <Text style={styles.sheetTitle}>Mamlakat yoki hudud</Text>
                <Text style={styles.sheetSubtitle}>NearFIX ishlaydigan hududni ko'ring</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yopish"
                hitSlop={8}
                onPress={() => setSelectorOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <X size={20} color={colors.text} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View accessibilityRole="radiogroup" style={styles.countryList}>
              {COUNTRIES.map((country) => {
                const active = country.code === OPERATIONAL_COUNTRY_CODE;
                return (
                  <Pressable
                    key={country.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => handleSelect(country.code)}
                    style={({ pressed }) => [
                      styles.countryRow,
                      active && styles.countryRowActive,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text translate={false} style={styles.countryFlag}>{country.flag}</Text>
                    <View style={styles.countryBody}>
                      <Text style={[styles.countryName, !country.available && styles.countryNameUnavailable]}>
                        {country.nameKey}
                      </Text>
                      <Text style={[styles.countryStatus, active ? styles.activeStatus : styles.comingSoonStatus]}>
                        {country.statusKey}
                      </Text>
                    </View>
                    {active ? (
                      <View style={styles.checkCircle}>
                        <Check size={16} color={colors.white} strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonBadgeText}>{country.statusKey}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white
  },
  pressed: { opacity: 0.82 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}12`
  },
  titleBody: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontFamily: "Inter_800ExtraBold" },
  currentCountryRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  flag: { fontSize: 16 },
  currentCountry: { color: colors.muted, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: `${colors.success}16`
  },
  activeBadgeText: { color: colors.success, fontSize: 10, fontFamily: "Inter_800ExtraBold" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.42)" },
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.white
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    marginBottom: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.border
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitleBody: { flex: 1 },
  sheetTitle: { color: colors.text, fontSize: 20, fontFamily: "Inter_800ExtraBold" },
  sheetSubtitle: { marginTop: 3, color: colors.muted, fontSize: 13, fontFamily: "Inter_500Medium" },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface
  },
  countryList: { marginTop: 18, gap: 10 },
  countryRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface
  },
  countryRowActive: { borderColor: `${colors.primary}80`, backgroundColor: `${colors.primary}0A` },
  countryFlag: { width: 38, fontSize: 25 },
  countryBody: { flex: 1 },
  countryName: { color: colors.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  countryNameUnavailable: { color: colors.muted },
  countryStatus: { marginTop: 3, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activeStatus: { color: colors.success },
  comingSoonStatus: { color: colors.subtle },
  checkCircle: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary
  },
  comingSoonBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: `${colors.warning}18`
  },
  comingSoonBadgeText: { color: "#9A6200", fontSize: 10, fontFamily: "Inter_800ExtraBold" }
});
