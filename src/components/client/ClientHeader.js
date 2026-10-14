import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react-native";
import { Text } from "../../i18n/native";
import { colors, font } from "../../theme/clientTheme";
import { GlassSurface } from "./GlassSurface";

export function ClientHeader({ title, subtitle, onBack, right }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      {onBack ? (
        <GlassSurface style={styles.back}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Orqaga")} onPress={onBack} style={styles.button}>
            <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
          </Pressable>
        </GlassSurface>
      ) : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  back: { width: 46, height: 46, borderRadius: 17 },
  button: { flex: 1, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 25, lineHeight: 32, fontFamily: font.bold, letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: font.regular, marginTop: 3 }
});
