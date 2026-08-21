import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requestAuthOtp } from "../../services/auth";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage, isValidOtp } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";
import { resumeAfterAuthentication } from "../../navigation/protectedActions";

export function OtpScreen({ navigation, route }) {
  const { phone, purpose = "AUTH" } = route.params || {};
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const actionRef = useRef(false);
  const verifyOtpAndLogin = useAuthStore((state) => state.verifyOtpAndLogin);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  async function handleVerify() {
    if (loading || actionRef.current) return;

    if (!phone) {
      Alert.alert("Telefon raqam topilmadi", "Qaytadan urinib ko'ring.");
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    if (!isValidOtp(code)) {
      Alert.alert("OTP kod kerak", "SMS orqali kelgan tasdiqlash kodini to'liq kiriting.");
      return;
    }

    actionRef.current = true;
    setLoading(true);
    try {
      const result = await verifyOtpAndLogin(phone, code.trim(), purpose);
      if (!result.ok) {
        Alert.alert("Kod tasdiqlanmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
      } else if (result.status === "REGISTRATION_REQUIRED") {
        navigation.navigate(ROUTES.AUTH_PROFILE, {
          registrationToken: result.registrationToken
        });
      } else {
        const resumed = await resumeAfterAuthentication(navigation, result.role);
        if (!resumed.ok) Alert.alert("Usta mavjud emas", "Usta hozir buyurtma qabul qilmayapti. Boshqa ustani tanlang.");
      }
    } finally {
      actionRef.current = false;
      setLoading(false);
    }
  }

  async function handleResend() {
    if (loading || actionRef.current || resendSeconds > 0 || !phone) return;

    actionRef.current = true;
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
      actionRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout
      title="Tasdiqlash kodi"
      copy="SMS orqali yuborilgan kodni kiriting"
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
