import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { colors, font, iconSizes, radius } from "../../theme/clientTheme";
import { Text } from "../../i18n/native";

function formatRemaining(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function CountdownCard({ deadlineAt }) {
  const [now, setNow] = useState(Date.now());
  const remaining = useMemo(() => formatRemaining((deadlineAt || now) - now), [deadlineAt, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!Number.isFinite(deadlineAt) || deadlineAt <= 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Clock3 size={iconSizes.md} color={colors.warning} strokeWidth={1.8} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Usta javobi uchun vaqt</Text>
        <Text style={styles.text}>Agar 1 soat ichida javob bo'lmasa buyurtma avtomatik bekor qilinadi.</Text>
      </View>
      <Text style={styles.time}>{remaining}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    borderRadius: radius.xl,
    backgroundColor: "#FFF8EE",
    borderWidth: 1,
    borderColor: "#F0E3CA",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  body: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: font.semi
  },
  text: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: font.regular
  },
  time: {
    color: colors.text,
    fontSize: 17,
    fontFamily: font.bold,
    fontVariant: ["tabular-nums"]
  }
});
