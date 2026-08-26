import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../i18n/native";

export function CategoryAvailabilityState({ status, error, hasData = false, onRetry }) {
  if (hasData && !error) return null;
  if (hasData && error) {
    return <View style={styles.notice}><Text style={styles.noticeText}>Kategoriyalar yangilanmadi. Saqlangan ro'yxat ko'rsatilmoqda.</Text><Retry onRetry={onRetry} /></View>;
  }
  if (status === "idle" || status === "loading") {
    return <View style={styles.state}><ActivityIndicator color="#0F80B7" /><Text style={styles.text}>Kategoriyalar yuklanmoqda...</Text></View>;
  }
  if (status === "empty") {
    return <View style={styles.state}><Text style={styles.title}>Hozircha faol kategoriya yo'q</Text><Text style={styles.text}>Yangi xizmatlar qo'shilganda shu yerda ko'rinadi.</Text><Retry onRetry={onRetry} /></View>;
  }
  return <View style={styles.state}><Text style={styles.title}>Kategoriyalar yuklanmadi</Text><Text style={styles.text}>{error || "Internet aloqasini tekshirib qayta urinib ko'ring."}</Text><Retry onRetry={onRetry} /></View>;
}

function Retry({ onRetry }) {
  return onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Qayta urinish</Text></Pressable> : null;
}

const styles = StyleSheet.create({
  state: { marginHorizontal: 24, marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: "#DCE7EC", backgroundColor: "#FFFFFF", padding: 18, alignItems: "center", gap: 8 },
  notice: { marginHorizontal: 24, marginTop: 12, borderRadius: 14, backgroundColor: "#FFF7E6", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { color: "#273248", fontWeight: "900", textAlign: "center" },
  text: { color: "#6B7280", textAlign: "center", lineHeight: 20 },
  noticeText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 17 },
  retry: { borderRadius: 12, backgroundColor: "#EAF8FC", paddingHorizontal: 13, paddingVertical: 9 },
  retryText: { color: "#0F80B7", fontWeight: "900" }
});
