import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ShieldCheck, Smartphone } from "lucide-react-native";
import { PrimaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requestAuthOtp } from "../../services/auth";
import { colors, iconSizes, radius } from "../../theme";
import { openPrivacyPolicy, openTerms } from "../../utils/legalLinks";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage, isValidUzPhone, normalizeUzPhone } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";

export function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;

    const normalizedPhone = normalizeUzPhone(phone);
    if (!isValidUzPhone(normalizedPhone)) {
      Alert.alert("Telefon raqam noto'g'ri", "Telefon raqamni to'liq kiriting: masalan 90 123 45 67.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestAuthOtp(normalizedPhone, "AUTH");
      if (!result.ok) {
        Alert.alert("SMS yuborilmadi", authErrorMessage(result, "Backend bilan ulanishda xatolik yuz berdi."));
        return;
      }

      if (result.nextStep === "APP_REVIEW_PASSWORD_REQUIRED") {
        navigation.navigate(ROUTES.DEMO_PASSWORD, {
          phone: normalizedPhone
        });
        return;
      }

      navigation.navigate(ROUTES.AUTH_OTP, {
        phone: normalizedPhone,
        purpose: "AUTH"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout title="Telefon raqamingiz bilan davom eting" copy="SMS kod yuboramiz.">
      <View style={styles.trustRow}>
        <View style={styles.trustPill}>
          <ShieldCheck size={iconSizes.sm} color={colors.secondary} strokeWidth={2.6} />
          <Text style={styles.trustText}>Xavfsiz kirish</Text>
        </View>
        <View style={styles.trustPill}>
          <Smartphone size={iconSizes.sm} color={colors.primary} strokeWidth={2.6} />
          <Text style={styles.trustText}>Telefon orqali</Text>
        </View>
      </View>

      <View style={authStyles.inputCard}>
        <Text style={authStyles.inputLabel}>Telefon raqam</Text>
        <View style={authStyles.phoneRow}>
          <View style={authStyles.countryCode}>
            <Text style={authStyles.countryText}>+998</Text>
          </View>
          <TextInput
            autoComplete="tel"
            keyboardType="phone-pad"
            placeholder="90 123 45 67"
            placeholderTextColor={colors.subtle}
            style={[authStyles.input, authStyles.phoneInput]}
            value={phone}
            editable={!loading}
            onChangeText={setPhone}
            onSubmitEditing={handleLogin}
          />
        </View>
      </View>

      <PrimaryButton disabled={loading} title={loading ? "Yuborilmoqda..." : "Kodni yuborish"} onPress={handleLogin} />

      <View style={styles.legalConsent}>
        <Text style={styles.terms}>Davom etish orqali </Text>
        <Pressable onPress={openTerms}>
          <Text style={styles.legalLink}>Foydalanish shartlari</Text>
        </Pressable>
        <Text style={styles.terms}> va </Text>
        <Pressable onPress={openPrivacyPolicy}>
          <Text style={styles.legalLink}>Maxfiylik siyosati</Text>
        </Pressable>
        <Text style={styles.terms}>ga rozilik bildirasiz.</Text>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  trustRow: {
    flexDirection: "row",
    gap: 10
  },
  trustPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  trustText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  terms: {
    color: colors.subtle,
    fontSize: 12,
    lineHeight: 18
  },
  legalConsent: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center"
  },
  legalLink: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    textDecorationLine: "underline"
  }
});
