import React from "react";
import { Check, Languages } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { LANGUAGES, SUPPORTED_LOCALES } from "../../i18n";
import { Text } from "../../i18n/native";
import { useUiStore } from "../../store/uiStore";
import { colors, radius } from "../../theme";

export function LanguageSelector() {
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <Languages size={20} color={colors.primary} strokeWidth={2.5} />
        </View>
        <View style={styles.titleBody}>
          <Text style={styles.title}>Til</Text>
          <Text style={styles.subtitle}>Ilova tilini tanlang</Text>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {SUPPORTED_LOCALES.map((language) => {
          const selected = locale === language;
          return (
            <Pressable
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={LANGUAGES[language]}
              onPress={() => setLocale(language)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
            >
              <Text translate={false} style={[styles.optionText, selected && styles.optionTextSelected]}>
                {LANGUAGES[language]}
              </Text>
              {selected ? <Check size={17} color={colors.white} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}12`
  },
  titleBody: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold"
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontFamily: "Inter_500Medium"
  },
  options: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8
  },
  option: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.white
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  optionPressed: { opacity: 0.8 },
  optionText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: "Inter_700Bold"
  },
  optionTextSelected: { color: colors.white }
});
