import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requestAuthOtp } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage, isValidOtp } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";

export function OtpScreen({ navigation, route }) {
  const { phone, purpose = "AUTH" } = route.params || {};
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const verifyOtpAndLogin = useAuthStore((state) => state.verifyOtpAndLogin);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  async function handleVerify() {
    if (loading) return;

    if (!phone) {
      Alert.alert("Telefon raqam topilmadi", "Qaytadan urinib ko'ring.");
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    if (!isValidOtp(code)) {
      Alert.alert("OTP kod kerak", "SMS orqali kelgan tasdiqlash kodini to'liq kiriting.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtpAndLogin(phone, code.trim(), purpose);
      if (!result.ok) {
        Alert.alert("Kod tasdiqlanmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (loading || resendSeconds > 0 || !phone) return;

    setLoading(true);
    try {
      const result = await requestAuthOtp(phone, purpose);
      if (!result.ok) {
        if (result.code === "OTP_COOLDOWN" && result.retryAfter) {
          setResendSeconds(result.retryAfter);
        }
        Alert.alert("SMS yuborilmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
        return;
      }

      setCode("");
      setResendSeconds(result.resendIn || 0);
      Alert.alert("Kod yuborildi", "Yangi tasdiqlash kodi SMS orqali yuborildi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout
      title="SMS kodni kiriting"
      copy={`${phone || "Telefon raqam"} raqamiga yuborilgan kodni kiriting.`}
    >
      <View style={authStyles.inputCard}>
        <Text style={authStyles.inputLabel}>OTP kod</Text>
        <TextInput
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={12}
          placeholder="SMS kodi"
          placeholderTextColor={colors.subtle}
          style={authStyles.input}
          value={code}
          editable={!loading}
          onChangeText={setCode}
          onSubmitEditing={handleVerify}
        />
        <Pressable disabled={loading || resendSeconds > 0} onPress={handleResend}>
          <Text style={[authStyles.resendText, (loading || resendSeconds > 0) && authStyles.resendTextDisabled]}>
            {resendSeconds > 0 ? `Qayta yuborish (${resendSeconds})` : "Qayta yuborish"}
          </Text>
        </Pressable>
      </View>

      <PrimaryButton disabled={loading} title={loading ? "Tekshirilmoqda..." : "Davom etish"} onPress={handleVerify} />
      <SecondaryButton disabled={loading} title="Orqaga" onPress={() => navigation.goBack()} />
    </AuthScreenLayout>
  );
}
