import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { CheckCircle2, Navigation, Wrench } from "lucide-react-native";
import { TRACKING_STATUSES } from "../../constants/orderTracking";
import { colors, iconSizes, radius } from "../../theme";
import { Text } from "../../i18n/native";

const nextActionByStatus = {
  [TRACKING_STATUSES.ACCEPTED]: {
    status: TRACKING_STATUSES.ON_THE_WAY,
    label: "Yo'lga chiqish",
    icon: Navigation
  },
  [TRACKING_STATUSES.ON_THE_WAY]: {
    status: TRACKING_STATUSES.IN_PROGRESS,
    label: "Ishni boshlash",
    icon: Wrench
  },
  [TRACKING_STATUSES.IN_PROGRESS]: {
    status: TRACKING_STATUSES.COMPLETED,
    label: "Ishni yakunlash",
    icon: CheckCircle2
  }
};

const confirmationText = {
  [TRACKING_STATUSES.ON_THE_WAY]: "Yo'lga chiqqaningizni tasdiqlaysizmi?",
  [TRACKING_STATUSES.IN_PROGRESS]: "Ish boshlaganingizni tasdiqlaysizmi?",
  [TRACKING_STATUSES.COMPLETED]: "Ishni tugatganingizni tasdiqlaysizmi?"
};

export function OrderActions({ currentStatus, onUpdateStatus, onComplete }) {
  const [pendingAction, setPendingAction] = useState(null);
  const nextAction = nextActionByStatus[currentStatus];
  const NextIcon = nextAction?.icon;

  function confirmPendingAction() {
    if (!pendingAction) return;

    const nextStatus = pendingAction.status;
    setPendingAction(null);

    if (nextStatus === TRACKING_STATUSES.COMPLETED) {
      onComplete();
      return;
    }

    onUpdateStatus(nextStatus);
  }

  return (
    <>
      <View style={styles.row}>
        {nextAction ? (
          <Pressable
            onPress={() => setPendingAction(nextAction)}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
          >
            <NextIcon size={iconSizes.md} color={colors.white} strokeWidth={2.7} />
            <Text style={styles.primaryText}>{nextAction.label}</Text>
          </Pressable>
        ) : (
          <View style={styles.idleAction}>
            <Text style={styles.idleText}>Status yangilangan</Text>
          </View>
        )}
      </View>

      <Modal
        transparent
        visible={Boolean(pendingAction)}
        animationType="fade"
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tasdiqlash</Text>
            <Text style={styles.modalText}>
              {confirmationText[pendingAction?.status] || "Statusni o'zgartirishni tasdiqlaysizmi?"}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setPendingAction(null)}>
                <Text style={styles.cancelText}>Bekor qilish</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.confirmButton]} onPress={confirmPendingAction}>
                <Text style={styles.confirmText}>Tasdiqlash</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row"
  },
  primaryAction: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "900"
  },
  idleAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  idleText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: 18
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  modalText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700"
  },
  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelButton: {
    backgroundColor: colors.surface
  },
  confirmButton: {
    backgroundColor: colors.primary
  },
  cancelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  confirmText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900"
  }
});
