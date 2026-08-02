import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requestAuthOtp } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage, passwordValidationMessage } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";

const passwordScreenConfig = {
  PASSWORD_REQUIRED: {
    title: "Parolni kiriting",
    copy: "SMS tasdiqlandi. Hisobingiz parolini kiriting.",
    buttonTitle: "Kirish"
  },
  PASSWORD_SETUP_REQUIRED: {
    title: "Parol yarating",
    copy: "Hisobingiz uchun xavfsiz parol yarating.",
    buttonTitle: "Davom etish"
  },
  PASSWORD_RESET_REQUIRED: {
    title: "Parol yarating",
    copy: "Hisobingiz uchun yangi parol yarating.",
    buttonTitle: "Davom etish"
  }
};

export function PasswordEntryScreen({ navigation, route }) {
  const { phone, otpSessionToken, nextStep } = route.params || {};
  const config = passwordScreenConfig[nextStep] || passwordScreenConfig.PASSWORD_REQUIRED;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const setupPassword = useAuthStore((state) => state.setupPassword);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const requiresConfirmation = nextStep !== "PASSWORD_REQUIRED";

  async function handleSubmit() {
    if (loading) return;

    if (!otpSessionToken || !nextStep) {
      Alert.alert("Sessiya topilmadi", "Qaytadan SMS kod orqali tasdiqlang.");
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    const passwordError = passwordValidationMessage(password);
    if (passwordError) {
      Alert.alert("Parol noto'g'ri", passwordError);
      return;
    }

    if (requiresConfirmation && password !== confirmPassword) {
      Alert.alert("Parollar mos emas", "Yangi parol va tasdiqlash maydonlari bir xil bo'lishi kerak.");
      return;
    }

    setLoading(true);
    try {
      const result =
        nextStep === "PASSWORD_REQUIRED"
          ? await login(otpSessionToken, password)
          : nextStep === "PASSWORD_RESET_REQUIRED"
            ? await resetPassword(otpSessionToken, password, confirmPassword)
            : await setupPassword(otpSessionToken, password, confirmPassword);

      if (!result.ok) {
        Alert.alert("Kirish amalga oshmadi", authErrorMessage(result, "Backend bilan ulanishda xatolik yuz berdi."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (loading || !phone) return;

    setLoading(true);
    try {
      const result = await requestAuthOtp(phone, "PASSWORD_RESET");
      if (!result.ok) {
        Alert.alert("SMS yuborilmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
        return;
      }

      navigation.navigate(ROUTES.AUTH_OTP, {
        phone,
        purpose: "PASSWORD_RESET"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout title={config.title} copy={config.copy}>
      <View style={authStyles.inputCard}>
        <Text style={authStyles.inputLabel}>{nextStep === "PASSWORD_REQUIRED" ? "Parolingiz" : "Yangi parol"}</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete={nextStep === "PASSWORD_REQUIRED" ? "current-password" : "new-password"}
          placeholder={nextStep === "PASSWORD_REQUIRED" ? "Parolingiz" : "Yangi parol"}
          placeholderTextColor={colors.subtle}
          secureTextEntry
          style={authStyles.input}
          value={password}
          editable={!loading}
          onChangeText={setPassword}
          onSubmitEditing={requiresConfirmation ? undefined : handleSubmit}
        />

        {requiresConfirmation ? (
          <>
            <Text style={authStyles.inputLabel}>Parolni takrorlang</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Parolni takrorlang"
              placeholderTextColor={colors.subtle}
              secureTextEntry
              style={authStyles.input}
              value={confirmPassword}
              editable={!loading}
              onChangeText={setConfirmPassword}
              onSubmitEditing={handleSubmit}
            />
          </>
        ) : (
          <Pressable disabled={loading} onPress={handleForgotPassword}>
            <Text style={styles.forgotLink}>Parolni unutdingizmi?</Text>
          </Pressable>
        )}
      </View>

      <PrimaryButton
        disabled={loading}
        title={loading ? "Tekshirilmoqda..." : config.buttonTitle}
        onPress={handleSubmit}
      />
      <SecondaryButton disabled={loading} title="Orqaga" onPress={() => navigation.goBack()} />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  forgotLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
    paddingVertical: 4
  }
});
