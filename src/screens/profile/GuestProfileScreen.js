import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ArrowRight, BriefcaseBusiness, ClipboardList, LogIn, MapPin, UserRound } from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { requireAuthentication } from "../../navigation/protectedActions";
import { colors, font, shadow, CLIENT_CONTENT_BOTTOM } from "../../theme/clientTheme";
import { ClientHeader } from "../../components/client/ClientHeader";
import { GlassSurface } from "../../components/client/GlassSurface";
import { Text } from "../../i18n/native";

export function GuestProfileScreen({ navigation }) {
  const root = navigation.getParent();
  return (
    <View style={styles.screen}>
      <ClientHeader title="Profil" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.accent} />
          <GlassSurface style={styles.icon}>
            <LogIn color={colors.primary} size={28} strokeWidth={1.8} />
          </GlassSurface>
          <Text style={styles.title}>Shaxsiy kabinet</Text>
          <Text style={styles.copy}>
            Buyurtmalar, saqlangan manzillar va profilingiz uchun yagona hisobdan foydalaning.
          </Text>
          <View style={styles.benefits}>
            {[
              [ClipboardList, "Buyurtmalar"],
              [MapPin, "Mening manzillarim"],
              [UserRound, "Profil"]
            ].map(([Icon, label]) => (
              <View key={label} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Icon size={19} color={colors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.benefitText}>{label}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => requireAuthentication(root, { kind: "PROTECTED_ROUTE", routeName: ROUTES.PROFILE_TAB })}
            style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
          >
            <Text style={styles.loginText}>Kirish yoki ro'yxatdan o'tish</Text>
            <ArrowRight size={19} color={colors.white} strokeWidth={1.8} />
          </Pressable>
        </View>
        <View style={styles.workerRow}>
          <BriefcaseBusiness color={colors.muted} size={19} strokeWidth={1.8} />
          <Text style={styles.workerText}>
            Hisobga kirgach, profilingizdan usta bo'lish uchun ariza topshirishingiz mumkin.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: CLIENT_CONTENT_BOTTOM,
    justifyContent: "center",
    gap: 22
  },
  card: {
    overflow: "hidden",
    borderRadius: 28,
    padding: 24,
    gap: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  accent: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.mintSoft
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  title: { color: colors.text, fontSize: 27, lineHeight: 34, letterSpacing: -0.8, fontFamily: font.bold },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22, fontFamily: font.regular },
  benefits: { gap: 12, marginVertical: 6 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  benefitText: { color: colors.text, fontSize: 13, fontFamily: font.medium },
  loginButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  loginText: { flex: 1, color: colors.white, fontSize: 13, lineHeight: 19, fontFamily: font.semi },
  pressed: { opacity: 0.75 },
  workerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 8 },
  workerText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19, fontFamily: font.regular }
});
