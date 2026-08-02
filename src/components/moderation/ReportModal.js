import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { createReportApi } from "../../services/moderation/moderationService";
import { useAuthStore } from "../../store/authStore";
import { Text, TextInput } from "../../i18n/native";

const reasons = [
  ["SPAM", "Spam"],
  ["ABUSE", "Haqorat"],
  ["HARASSMENT", "Tazyiq"],
  ["FRAUD", "Firibgarlik"],
  ["INAPPROPRIATE_CONTENT", "Nomaqbul kontent"],
  ["SAFETY_RISK", "Xavfsizlik xavfi"],
  ["OTHER", "Boshqa"]
];

export function ReportModal({ visible, targetType, targetId, title = "Shikoyat yuborish", onClose, onSuccess }) {
  const token = useAuthStore((state) => state.session?.token);
  const [reason, setReason] = useState("ABUSE");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReason("ABUSE");
    setDetails("");
    setError("");
  }, [visible, targetId]);

  async function submit() {
    if (!token || !targetType || !targetId || submitting) return;
    setSubmitting(true);
    setError("");
    const result = await createReportApi(token, {
      targetType,
      targetId,
      reason,
      ...(details.trim() ? { details: details.trim() } : {})
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message || "Shikoyat yuborilmadi.");
      return;
    }
    onSuccess?.(result.report);
    onClose?.();
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>Sababni tanlang. Shikoyat moderatorlar tomonidan ko'rib chiqiladi.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reasons}>
            {reasons.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setReason(value)}
                style={[styles.reason, reason === value && styles.reasonActive]}
              >
                <Text style={[styles.reasonText, reason === value && styles.reasonTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Qo'shimcha ma'lumot (ixtiyoriy)"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>Bekor qilish</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={submitting} style={[styles.submit, submitting && styles.disabled]}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Yuborish</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.42)" },
  sheet: { margin: 16, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 18, gap: 12 },
  title: { color: "#273248", fontSize: 20, fontWeight: "900" },
  hint: { color: "#64748B", lineHeight: 19, fontWeight: "600" },
  reasons: { gap: 8 },
  reason: { borderRadius: 999, borderWidth: 1, borderColor: "#DCECF3", paddingHorizontal: 12, paddingVertical: 8 },
  reasonActive: { borderColor: "#0F80B7", backgroundColor: "#EAF8FC" },
  reasonText: { color: "#64748B", fontWeight: "800" },
  reasonTextActive: { color: "#0F80B7" },
  input: {
    minHeight: 94,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DCECF3",
    padding: 12,
    textAlignVertical: "top",
    color: "#273248"
  },
  error: { color: "#DC2626", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  cancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCECF3",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: { color: "#64748B", fontWeight: "900" },
  submit: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center"
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.65 }
});
