import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Brand } from "../../components/ui/Brand";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { onboardingImages } from "../../services/images/imageService";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function OnboardingBookingScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.onboarding}>
      <View style={styles.topBar}>
        <Brand />
        <View style={styles.placeholder} />
      </View>
      <View style={styles.heroPanel}>
        <View style={styles.ringLarge} />
        <View style={styles.ringSmall} />
        <Image source={onboardingImages.booking} style={styles.heroImage} />
      </View>
      <View style={styles.contentCard}>
        <Text style={styles.title}>Oson bron{"\n"}qilish</Text>
        <Text style={styles.copy}>
          Muammoni yozing, rasm qo'shing va tasdiqlangan ustani bir necha bosqichda chaqiring.
        </Text>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dotActive} />
        </View>
        <PrimaryButton title="Kirish" onPress={() => navigation.replace(ROUTES.LOGIN)} />
        <SecondaryButton title="Orqaga" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  onboarding: {
    minHeight: "100%",
    padding: 24,
    gap: 18,
    justifyContent: "space-between",
    backgroundColor: colors.background
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  placeholder: {
    width: 40,
    height: 40
  },
  heroPanel: {
    height: 360,
    borderRadius: 34,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  heroImage: {
    width: "92%",
    height: "92%",
    borderRadius: 34,
    resizeMode: "cover",
    ...shadow
  },
  ringLarge: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(15,113,157,0.14)",
    transform: [{ rotate: "6deg" }]
  },
  ringSmall: {
    position: "absolute",
    width: 276,
    height: 276,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "rgba(44,216,165,0.32)",
    transform: [{ rotate: "-7deg" }]
  },
  contentCard: {
    gap: 16
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600"
  },
  dots: {
    flexDirection: "row",
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: "#CBD5E1"
  },
  dotActive: {
    width: 32,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary
  }
});
