import React, { useState } from "react";
import { View } from "react-native";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme";
import { AuthScreenLayout, authStyles } from "./AuthScreenLayout";
import { authErrorMessage } from "./authHelpers";
import { Alert, Text, TextInput } from "../../i18n/native";

export function DemoPasswordScreen({ navigation, route }) {
  const { phone } = route.params || {};
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const loginWithDemoPassword = useAuthStore((state) => state.loginWithDemoPassword);

  async function handleLogin() {
    if (loading) return;

    if (!phone) {
      Alert.alert("Telefon raqam topilmadi", "Qaytadan urinib ko'ring.");
      navigation.replace(ROUTES.LOGIN);
      return;
    }

    if (!password) {
      Alert.alert("Parol kerak", "App Review uchun berilgan parolni kiriting.");
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithDemoPassword(phone, password);
      if (!result.ok) {
        Alert.alert("Kirish amalga oshmadi", authErrorMessage(result, "Parol yoki demo hisob noto'g'ri."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout title="Demo hisobga kirish" copy="App Review uchun berilgan parolni kiriting.">
      <View style={authStyles.inputCard}>
        <Text style={authStyles.inputLabel}>Parol</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          placeholder="Parol"
          placeholderTextColor={colors.subtle}
          secureTextEntry
          style={authStyles.input}
          value={password}
          editable={!loading}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />
      </View>

      <PrimaryButton disabled={loading} title={loading ? "Tekshirilmoqda..." : "Kirish"} onPress={handleLogin} />
      <SecondaryButton disabled={loading} title="Orqaga" onPress={() => navigation.goBack()} />
    </AuthScreenLayout>
  );
}
