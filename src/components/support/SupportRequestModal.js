import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { createSupportTicketApi } from "../../services/support/supportService";
import { useAuthStore } from "../../store/authStore";
import { Text, TextInput } from "../../i18n/native";

export function SupportRequestModal({ visible, orderId, initialReason = "", onClose, onSuccess }) {
  const token = useAuthStore((state) => state.session?.token);
  const [reason, setReason] = useState(initialReason);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReason(initialReason);
    setMessage("");
    setError("");
  }, [initialReason, orderId, visible]);

  async function submit() {
    if (!token || reason.trim().length < 3 || submitting) {
      if (reason.trim().length < 3) setError("Murojaat sababini kiriting.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await createSupportTicketApi(token, {
      reason: reason.trim(),
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(orderId ? { orderId } : {})
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message || "Murojaat yuborilmadi.");
      return;
    }
    onSuccess?.(result.ticket);
    onClose?.();
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>NearFIX yordam</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Murojaat sababi"
            placeholderTextColor="#94A3B8"
            maxLength={120}
            style={styles.input}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Muammoni batafsil yozing"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
            style={[styles.input, styles.message]}
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
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCECF3",
    paddingHorizontal: 12,
    color: "#273248"
  },
  message: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
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
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  submitText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.65 }
});
