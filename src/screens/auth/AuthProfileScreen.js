import React, { useRef, useState } from "react";
import { View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { resumeAfterAuthentication } from "../../navigation/protectedActions";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme";
import { Alert, Text, TextInput } from "../../i18n/native";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage } from "./authHelpers";

export function AuthProfileScreen({ navigation, route }) {
  const registrationToken = route.params?.registrationToken;
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const completeRegistration = useAuthStore((state) => state.completeRegistration);

  async function handleContinue() {
    if (loading || submittingRef.current) return;

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      Alert.alert("Ismingizni kiriting", "Ism kamida 2 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (!registrationToken) {
      Alert.alert("Sessiya topilmadi", "Telefon raqamingizni SMS kod orqali qayta tasdiqlang.");
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const result = await completeRegistration(registrationToken, normalizedName);
      if (!result.ok) {
        Alert.alert("Ro'yxatdan o'tish yakunlanmadi", authErrorMessage(result, "Qayta urinib ko'ring."));
        return;
      }

      const resumed = await resumeAfterAuthentication(navigation, result.role);
      if (!resumed.ok) {
        Alert.alert("Usta mavjud emas", "Usta hozir buyurtma qabul qilmayapti. Boshqa ustani tanlang.");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout title="Ismingiz" copy="Profilni yakunlash uchun ismingizni kiriting.">
      <View style={authStyles.inputCard}>
        <Text style={authStyles.inputLabel}>Ismingiz</Text>
        <TextInput
          autoCapitalize="words"
          autoComplete="name"
          maxLength={80}
          placeholder="Ismingiz"
          placeholderTextColor={colors.subtle}
          style={authStyles.input}
          value={name}
          editable={!loading}
          onChangeText={setName}
          onSubmitEditing={handleContinue}
        />
      </View>

      <PrimaryButton disabled={loading} title={loading ? "Saqlanmoqda..." : "Davom etish"} onPress={handleContinue} />
      <SecondaryButton disabled={loading} title="Boshidan boshlash" onPress={() => navigation.replace(ROUTES.LOGIN)} />
    </AuthScreenLayout>
  );
}
