import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../i18n/native";
import { colors, spacing } from "../../theme";
import { MapPin } from "lucide-react-native";
import { useAuthStore } from "../../store/authStore";
import { normalizeExperienceMode } from "../../navigation/experienceMode.mjs";
import { ClientHeader } from "../../components/client/ClientHeader";
import { colors as clientColors, font as clientFont, shadow as clientShadow } from "../../theme/clientTheme";

export function MapPickerScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const isClient = normalizeExperienceMode(session?.role, session?.experienceMode) === "client";
  if (isClient) {
    return (
      <View style={clientStyles.screen}>
        <ClientHeader title="Manzil tanlang" onBack={() => navigation.goBack()} />
        <View style={clientStyles.body}>
          <View style={clientStyles.card}>
            <View style={clientStyles.icon}>
              <MapPin size={30} color={clientColors.primary} strokeWidth={1.8} />
            </View>
            <Text style={clientStyles.title}>Xarita mobil ilovada ishlaydi</Text>
            <Text style={clientStyles.text}>Manzilni xaritada tanlash uchun NearFIX mobil ilovasidan foydalaning.</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.unsupported}>
      <Text style={styles.title}>Xarita mobil ilovada ishlaydi</Text>
      <Text style={styles.text}>MapPickerScreen Yandex MapKit orqali Android va iOS uchun tayyorlangan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unsupported: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  text: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  }
});

const clientStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: clientColors.background },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, paddingBottom: 36 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: clientColors.white,
    borderWidth: 1,
    borderColor: clientColors.border,
    padding: 26,
    alignItems: "center",
    ...clientShadow
  },
  icon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: clientColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 19
  },
  title: {
    color: clientColors.text,
    fontSize: 21,
    lineHeight: 29,
    fontFamily: clientFont.bold,
    textAlign: "center",
    letterSpacing: -0.4
  },
  text: {
    marginTop: 10,
    color: clientColors.muted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: clientFont.regular,
    textAlign: "center"
  }
});
