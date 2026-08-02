import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { ShieldCheck } from "lucide-react-native";
import { PrimaryButton } from "../../components/ui/Button";
import { Brand } from "../../components/ui/Brand";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";
import { colors, iconSizes, radius, typography } from "../../theme";
import { Text } from "../../i18n/native";

export function SessionInvalidatedScreen() {
  const navigation = useNavigation();
  const acknowledgeInvalidation = useAuthStore((state) => state.acknowledgeInvalidation);

  function handleLoginAgain() {
    acknowledgeInvalidation();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: ROUTES.LOGIN }]
      })
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Brand />
      <View style={styles.iconWrap}>
        <ShieldCheck size={iconSizes.lg} color={colors.primary} strokeWidth={2.6} />
      </View>
      <Text style={styles.title}>Profilingiz yangilandi</Text>
      <Text style={styles.copy}>
        Xavfsizlik sababli qayta kirish talab qilinadi. Qayta kirganingizdan keyin sizga mos app ochiladi.
      </Text>
      <PrimaryButton title="Qayta kirish" onPress={handleLoginAgain} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 18,
    justifyContent: "center",
    backgroundColor: colors.background
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    ...typography.h1,
    color: colors.text
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600"
  }
});
