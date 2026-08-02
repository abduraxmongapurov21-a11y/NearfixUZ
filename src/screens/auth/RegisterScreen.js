import React, { useState } from "react";
import { View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requestAuthOtp } from "../../services/auth";
import { colors } from "../../theme";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage, isValidUzPhone, normalizeUzPhone } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";

export function RegisterScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
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
        Alert.alert("SMS yuborilmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
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
    <AuthScreenLayout title="Ro'yxatdan o'tish" copy="Telefon raqamingizni kiriting, SMS kod yuboramiz.">
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
            onSubmitEditing={handleContinue}
          />
        </View>
      </View>

      <PrimaryButton
        disabled={loading}
        title={loading ? "Yuborilmoqda..." : "Kodni yuborish"}
        onPress={handleContinue}
      />
      <SecondaryButton disabled={loading} title="Orqaga" onPress={() => navigation.goBack()} />
    </AuthScreenLayout>
  );
}
