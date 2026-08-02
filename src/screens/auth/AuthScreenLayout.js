import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Wrench } from "lucide-react-native";
import { Brand } from "../../components/ui/Brand";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function AuthScreenLayout({ title, copy, children }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandWrap}>
          <Brand />
        </View>
        <View style={styles.heroIcon}>
          <Wrench size={34} color={colors.white} strokeWidth={3} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{copy}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const authStyles = StyleSheet.create({
  inputCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    ...shadow
  },
  inputLabel: {
    color: colors.text,
    fontWeight: "800"
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  phoneRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  countryCode: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  countryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  phoneInput: {
    flex: 1
  },
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  resendText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 6
  },
  resendTextDisabled: {
    color: colors.subtle
  },
  stepText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 18,
    justifyContent: "center",
    alignItems: "stretch"
  },
  brandWrap: {
    alignItems: "center",
    marginBottom: 6
  },
  heroIcon: {
    alignSelf: "center",
    width: 82,
    height: 82,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "rgba(44,216,165,0.22)",
    ...shadow
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center"
  }
});
