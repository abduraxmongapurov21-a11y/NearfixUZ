import React from "react";
import { StyleSheet, View } from "react-native";
import { BriefcaseBusiness, LogIn } from "lucide-react-native";
import { PrimaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { requireAuthentication } from "../../navigation/protectedActions";
import { colors, radius } from "../../theme";
import { Text } from "../../i18n/native";

export function GuestProfileScreen({ navigation }) {
  const root = navigation.getParent();
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}><LogIn color={colors.primary} size={30} /></View>
        <Text style={styles.title}>Shaxsiy kabinet</Text>
        <Text style={styles.copy}>Buyurtmalar, saqlangan manzillar va profilingiz uchun yagona hisobdan foydalaning.</Text>
        <PrimaryButton title="Kirish yoki ro'yxatdan o'tish" onPress={() => requireAuthentication(root, { kind: "PROTECTED_ROUTE", routeName: ROUTES.PROFILE_TAB })} />
        <View style={styles.workerRow}><BriefcaseBusiness color={colors.secondary} size={18} /><Text style={styles.workerText}>Hisobga kirgach, profilingizdan usta bo'lish uchun ariza topshirishingiz mumkin.</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 22, paddingBottom: 108, backgroundColor: colors.background },
  card: { borderRadius: radius.xl, padding: 22, gap: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF8FC" },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  workerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  workerText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "600" }
});
