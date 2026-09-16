import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Check, Circle } from "lucide-react-native";
import {
  OTHER_WORKER_CANCELLATION_REASON,
  resolveWorkerCancellationReason,
  WORKER_CANCELLATION_REASONS
} from "../../services/orders/workerCancellation.mjs";
import { colors, radius, strongShadow } from "../../theme";
import { Text, TextInput } from "../../i18n/native";

export function WorkerCancelReasonModal({ visible, loading = false, onClose, onSubmit }) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const finalReason = useMemo(
    () => resolveWorkerCancellationReason(selectedReason, customReason),
    [customReason, selectedReason]
  );
  const isOtherReason = selectedReason === OTHER_WORKER_CANCELLATION_REASON;

  useEffect(() => {
    if (!visible) {
      setSelectedReason("");
      setCustomReason("");
    }
  }, [visible]);

  function handleClose() {
    if (!loading) onClose();
  }

  async function handleSubmit() {
    if (!finalReason || loading) return;
    await onSubmit(finalReason);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalContainer}
      >
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Bekor qilish sababi</Text>
          <Text style={styles.subtitle}>Qabul qilingan buyurtmani nima sababdan bekor qilmoqchisiz?</Text>

          <View style={styles.reasonList}>
            {WORKER_CANCELLATION_REASONS.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: loading }}
                  disabled={loading}
                  onPress={() => setSelectedReason(reason)}
                  style={({ pressed }) => [
                    styles.reasonButton,
                    selected && styles.reasonButtonSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <Check size={14} color={colors.white} strokeWidth={3} /> : <Circle size={8} color={colors.border} />}
                  </View>
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{reason}</Text>
                </Pressable>
              );
            })}
          </View>

          {isOtherReason ? (
            <View>
              <TextInput
                autoFocus
                editable={!loading}
                maxLength={240}
                multiline
                onChangeText={setCustomReason}
                placeholder="Boshqa sababni yozing"
                style={styles.reasonInput}
                value={customReason}
              />
              <Text style={styles.inputHint}>Kamida 3 ta belgi kiriting.</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={handleClose}
              style={({ pressed }) => [styles.actionButton, styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backButtonText}>Ortga</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !finalReason || loading }}
              disabled={!finalReason || loading}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.actionButton,
                styles.cancelButton,
                (!finalReason || loading) && styles.disabledButton,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.cancelButtonText}>{loading ? "Kutilmoqda" : "Buyurtmani bekor qilish"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)"
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    ...strongShadow
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: 18
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600"
  },
  reasonList: {
    marginTop: 16,
    gap: 9
  },
  reasonButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  reasonButtonSelected: {
    borderColor: "#D92D20",
    backgroundColor: "#FFF5F5"
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  radioSelected: {
    borderColor: "#D92D20",
    backgroundColor: "#D92D20"
  },
  reasonText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  reasonTextSelected: {
    color: "#B42318"
  },
  reasonInput: {
    minHeight: 88,
    marginTop: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    textAlignVertical: "top"
  },
  inputHint: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  actions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  backButton: {
    flex: 0.7,
    backgroundColor: colors.surface
  },
  cancelButton: {
    flex: 1.3,
    backgroundColor: "#D92D20"
  },
  disabledButton: {
    opacity: 0.45
  },
  backButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  }
});
