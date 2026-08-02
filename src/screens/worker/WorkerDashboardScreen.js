import React, { useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react-native";
import { ActiveJobCard } from "../../components/executor/ActiveJobCard";
import { EarningsSummary } from "../../components/executor/EarningsSummary";
import { IncomingOrderCard } from "../../components/executor/IncomingOrderCard";
import { WorkerDashboardHeader } from "../../components/executor/WorkerDashboardHeader";
import { WorkerStatusCard } from "../../components/executor/WorkerStatusCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { trackingStatusCopy } from "../../constants/orderTracking";
import { ROUTES } from "../../constants/routes";
import { ensureOrderChatRoomApi } from "../../services/chats/chatService";
import { useAuthStore } from "../../store/authStore";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useWorkerStore } from "../../store/workerStore";
import { colors, iconSizes, radius, shadow } from "../../theme";
import { Alert, Text } from "../../i18n/native";

const REJECTION_REASONS = [
  "Hozir bandman",
  "Manzil uzoq",
  "Kerakli asbob yo'q",
  "Bu xizmatni bajarmayman",
  "Vaqt to'g'ri kelmaydi",
  "Boshqa sabab"
];

export function WorkerDashboardScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const worker = useWorkerStore((state) => state.workerProfile);
  const incomingRequests = useWorkerStore((state) => state.incomingRequests);
  const activeJob = useWorkerStore((state) => state.activeJob);
  const status = useWorkerStore((state) => state.operationalStatus);
  const earnings = useWorkerStore((state) => state.earnings);
  const completedOrders = useWorkerStore((state) => state.completedOrders);
  const setOperationalStatus = useWorkerStore((state) => state.setOperationalStatus);
  const acceptIncomingRequest = useWorkerStore((state) => state.acceptIncomingRequest);
  const rejectIncomingRequest = useWorkerStore((state) => state.rejectIncomingRequest);
  const updateActiveJobStatus = useWorkerStore((state) => state.updateActiveJobStatus);
  const completeActiveJob = useWorkerStore((state) => state.completeActiveJob);
  const syncWorkerFromApi = useWorkerStore((state) => state.syncWorkerFromApi);
  const canAccept = status === WORKER_STATUS.AVAILABLE && !activeJob;
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    syncWorkerFromApi();
  }, [syncWorkerFromApi]);

  async function handleAccept(requestId) {
    const result = await acceptIncomingRequest(requestId);
    if (result?.ok) {
      Alert.alert("Buyurtma qabul qilindi", "Siz band holatiga o'tdingiz. Yangi buyurtmalar vaqtincha to'xtatildi.");
      return;
    }

    Alert.alert("Buyurtma qabul qilinmadi", result?.message || "Qayta urinib ko'ring.");
  }

  async function handleReject(reason) {
    if (!rejectTarget?.id || rejecting) return;

    setRejecting(true);
    const result = await rejectIncomingRequest(rejectTarget.id, reason);
    setRejecting(false);

    if (result?.ok) {
      setRejectTarget(null);
      Alert.alert("Buyurtma bekor qilindi", "Sabab mijozga yuborildi.");
      return;
    }

    Alert.alert("Buyurtma bekor qilinmadi", result?.message || "Qayta urinib ko'ring.");
  }

  async function handleComplete() {
    const result = await completeActiveJob();
    if (result?.ok) {
      Alert.alert("Ish yakunlandi", "Statusingiz mavjud holatiga qaytdi.");
      return;
    }

    Alert.alert("Status o'zgarmadi", result?.message || "Qayta urinib ko'ring.");
  }

  async function handleUpdateStatus(nextStatus) {
    const result = await updateActiveJobStatus(nextStatus);
    if (!result?.ok) {
      Alert.alert("Status o'zgarmadi", result?.message || "Qayta urinib ko'ring.");
    }
  }

  async function handleOpenJobChat() {
    if (!activeJob?.id || !session?.token) {
      navigation.navigate(ROUTES.WORKER_CHATS_TAB);
      return;
    }

    const result = await ensureOrderChatRoomApi(session.token, activeJob.id, session.userId);
    if (result.ok) {
      navigation.navigate(ROUTES.CHAT_THREAD, { room: result.room });
      return;
    }

    Alert.alert("Chat ochilmadi", result.message || "Mijoz bilan chatni ochishda xatolik yuz berdi.");
  }

  async function handleRefresh() {
    setRefreshing(true);
    await syncWorkerFromApi();
    setRefreshing(false);
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0F80B7" colors={["#0F80B7"]} />
        }
      >
        <View style={styles.headerBlock}>
          <WorkerDashboardHeader workerName={worker?.name || "Usta"} />
        </View>

        <WorkerStatusCard status={status} activeJob={activeJob} onChangeStatus={setOperationalStatus} />
        <EarningsSummary earnings={earnings} worker={worker} />

        <View style={styles.sectionBlock}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Faol ish</Text>
            {activeJob ? <StatusPill label={trackingStatusCopy[activeJob.statusKey]?.title || "Faol"} /> : null}
          </View>
          {activeJob ? (
            <ActiveJobCard
              job={activeJob}
              onChat={handleOpenJobChat}
              onUpdateStatus={handleUpdateStatus}
              onComplete={handleComplete}
            />
          ) : (
            <EmptyState
              title="Faol ish yo'q"
              text="Keyingi buyurtmaga tayyorsiz. Yangi buyurtma kelganda shu yerda qabul qiling."
            />
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeader title="Kelgan buyurtmalar" action="Barchasi" />
          <View style={styles.stack}>
            {incomingRequests.length ? (
              incomingRequests
                .slice(0, 2)
                .map((request, index) => (
                  <IncomingOrderCard
                    key={request.id}
                    request={request}
                    disabled={!canAccept}
                    index={index}
                    onAccept={() => handleAccept(request.id)}
                    onReject={() => setRejectTarget(request)}
                  />
                ))
            ) : (
              <EmptyState
                title="Kelgan buyurtmalar yo'q"
                text="Onlayn bo'ling. Mijozlar yuborgan yaqin buyurtmalar shu yerda ko'rinadi."
              />
            )}
          </View>
        </View>

        <WeeklyPerformanceSummary earnings={earnings} worker={worker} completedOrders={completedOrders} />
      </ScrollView>

      <RejectReasonModal
        visible={Boolean(rejectTarget)}
        request={rejectTarget}
        loading={rejecting}
        onClose={() => {
          if (!rejecting) setRejectTarget(null);
        }}
        onSelectReason={handleReject}
      />
    </>
  );
}

function StatusPill({ label }) {
  return (
    <View style={styles.statusPill}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function WeeklyPerformanceSummary({ earnings, worker, completedOrders }) {
  const totalJobs = completedOrders.length || worker?.completedOrders || earnings.completedJobs || 0;
  const hours = `${earnings.activeHours ?? 0}h`;
  const weekEarnings = `${Number(earnings.weekEarnings || 0).toLocaleString("uz-UZ")} so'm`;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Bu hafta</Text>
      <View style={styles.weeklyGrid}>
        <WeeklyMetric icon="jobs" label="Ishlar" value={totalJobs} />
        <WeeklyMetric icon="earned" label="Daromad" value={weekEarnings} />
        <WeeklyMetric icon="hours" label="Soat" value={hours} />
      </View>
    </View>
  );
}

function WeeklyMetric({ icon, label, value }) {
  return (
    <View style={styles.weeklyMetric}>
      <View
        style={[
          styles.weeklyIcon,
          icon === "earned" && styles.weeklyIconBlue,
          icon === "hours" && styles.weeklyIconOrange
        ]}
      >
        {icon === "jobs" ? (
          <CheckCircle2 size={iconSizes.sm} color={colors.success} strokeWidth={2.5} />
        ) : icon === "earned" ? (
          <ArrowUpRight size={iconSizes.sm} color="#3D79FF" strokeWidth={2.5} />
        ) : (
          <Clock3 size={iconSizes.sm} color="#FF6B1A" strokeWidth={2.5} />
        )}
      </View>
      <Text style={styles.weeklyValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.weeklyLabel}>{label}</Text>
    </View>
  );
}

function RejectReasonModal({ visible, request, loading, onClose, onSelectReason }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <View style={styles.reasonSheet}>
          <Text style={styles.reasonTitle}>Bekor qilish sababi</Text>
          <Text style={styles.reasonSubtitle} numberOfLines={2}>
            {request?.clientName || "Mijoz"} buyurtmasini bekor qilish uchun sabab tanlang.
          </Text>
          <View style={styles.reasonList}>
            {REJECTION_REASONS.map((reason) => (
              <Pressable
                key={reason}
                disabled={loading}
                onPress={() => onSelectReason(reason)}
                style={({ pressed }) => [
                  styles.reasonButton,
                  pressed && styles.pressed,
                  loading && styles.reasonDisabled
                ]}
              >
                <Text style={styles.reasonButtonText}>{reason}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={loading}
            onPress={onClose}
            style={({ pressed }) => [styles.closeReasonButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeReasonText}>Ortga</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 16,
    backgroundColor: "#F8FAFC"
  },
  headerBlock: {
    paddingTop: 3
  },
  sectionBlock: {
    gap: 11
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  statusPill: {
    minHeight: 25,
    borderRadius: radius.pill,
    backgroundColor: "#FFF3EA",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: "#FF8B35"
  },
  statusText: {
    color: "#FF6B1A",
    fontSize: 11,
    fontWeight: "800"
  },
  stack: {
    gap: 11
  },
  weeklyGrid: {
    flexDirection: "row",
    gap: 11
  },
  weeklyMetric: {
    flex: 1,
    minHeight: 105,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 13,
    ...shadow
  },
  weeklyIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "#DDFBE8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  weeklyIconBlue: {
    backgroundColor: "#DDEBFF"
  },
  weeklyIconOrange: {
    backgroundColor: "#FFF1E6"
  },
  weeklyValue: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900"
  },
  weeklyLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    justifyContent: "flex-end"
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject
  },
  reasonSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 12
  },
  reasonTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  reasonSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600"
  },
  reasonList: {
    gap: 9
  },
  reasonButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3B4AF",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  reasonDisabled: {
    opacity: 0.55
  },
  reasonButtonText: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  closeReasonButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center"
  },
  closeReasonText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.78
  }
});
