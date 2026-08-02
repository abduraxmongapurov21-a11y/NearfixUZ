import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from "react-native";
import { WorkerSupportCard } from "../../components/executor/WorkerSupportCard";
import { Card } from "../../components/marketplace/ServiceCard";
import { createSupportTicketApi } from "../../services/support/supportService";
import { useAuthStore } from "../../store/authStore";
import { Header } from "../../components/ui/Header";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { colors, radius } from "../../theme";
import { Alert, Text, TextInput } from "../../i18n/native";

export function WorkerSupportScreen() {
  const token = useAuthStore((state) => state.session?.token);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateTicket() {
    if (!token) {
      Alert.alert("Tizimga kiring", "Yordam bo'limiga murojaat qilish uchun qayta tizimga kiring.");
      return;
    }

    if (reason.trim().length < 3) {
      Alert.alert("Sabab kerak", "Murojaat sababini tanlang yoki yozing.");
      return;
    }

    setSubmitting(true);
    const result = await createSupportTicketApi(token, {
      reason: reason.trim(),
      ...(message.trim() ? { message: message.trim() } : {})
    });
    setSubmitting(false);

    Alert.alert(
      result.ok ? "Murojaat yaratildi" : "Murojaat yuborilmadi",
      result.ok ? "Yordam jamoasi murojaatingizni ko'rib chiqadi." : result.message || "Qayta urinib ko'ring."
    );
    if (result.ok) {
      setReason("");
      setMessage("");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Header title="Yordam" />
      <WorkerSupportCard onPress={handleCreateTicket} />
      <Card>
        <SectionHeader title="Tezkor sabablar" />
        {["Mijoz javob bermayapti", "Manzil topilmadi", "Bekor qilish muammosi"].map((item) => (
          <Pressable
            key={item}
            onPress={() => setReason(item)}
            style={[styles.reason, reason === item && styles.reasonActive]}
          >
            <Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>{item}</Text>
          </Pressable>
        ))}
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Murojaat sababi"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Muammoni batafsil yozing"
          placeholderTextColor="#94A3B8"
          multiline
          style={[styles.input, styles.message]}
        />
        <Pressable
          onPress={handleCreateTicket}
          disabled={submitting}
          style={[styles.submit, submitting && styles.submitDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Murojaat yuborish</Text>
          )}
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 112,
    gap: 16,
    backgroundColor: colors.background
  },
  reason: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  reasonText: {
    color: colors.text,
    fontWeight: "900"
  },
  reasonActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#EAF8FC"
  },
  reasonTextActive: {
    color: colors.primary
  },
  input: {
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    color: colors.text
  },
  message: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  submit: {
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  submitText: {
    color: colors.white,
    fontWeight: "900"
  },
  submitDisabled: {
    opacity: 0.65
  }
});
