import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { colors, iconSizes, radius } from "../../theme";
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

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Clock3 size={iconSizes.md} color={colors.warning} strokeWidth={2.6} />
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
    backgroundColor: "rgba(255,176,32,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,176,32,0.22)",
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
    fontWeight: "900"
  },
  text: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  time: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  }
});
