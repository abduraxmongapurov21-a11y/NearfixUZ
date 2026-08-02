import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Brand } from "../../components/ui/Brand";
import { PrimaryButton } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { onboardingImages } from "../../services/images/imageService";
import { colors, radius, shadow } from "../../theme";
import { Text } from "../../i18n/native";

export function OnboardingTrustScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.onboarding}>
      <View style={styles.topBar}>
        <Brand />
        <Pressable onPress={() => navigation.replace(ROUTES.LOGIN)}>
          <Text style={styles.skip}>O'tkazib yuborish</Text>
        </Pressable>
      </View>
      <View style={styles.heroPanel}>
        <View style={styles.ringLarge} />
        <View style={styles.ringSmall} />
        <Image source={onboardingImages.trust} style={styles.heroImage} />
      </View>
      <View style={styles.contentCard}>
        <Text style={styles.title}>Ishonchli{"\n"}ustalar</Text>
        <Text style={styles.copy}>
          Tekshirilgan mutaxassislar, reytinglar va NearFIX kafolati bilan xavfsiz xizmat buyurtma qiling.
        </Text>
        <View style={styles.dots}>
          <View style={styles.dotActive} />
          <View style={styles.dot} />
        </View>
        <PrimaryButton title="Davom etish" onPress={() => navigation.navigate(ROUTES.ONBOARDING_BOOKING)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  onboarding: {
    minHeight: "100%",
    padding: 24,
    gap: 12,
    justifyContent: "space-between",
    backgroundColor: colors.background
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  skip: {
    color: colors.muted,
    fontWeight: "700"
  },
  heroPanel: {
    height: 326,
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
    transform: [{ rotate: "-6deg" }]
  },
  ringSmall: {
    position: "absolute",
    width: 276,
    height: 276,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "rgba(44,216,165,0.32)",
    transform: [{ rotate: "7deg" }]
  },
  contentCard: {
    gap: 12
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
