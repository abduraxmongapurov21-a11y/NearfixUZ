import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowRight, CheckCircle2, Clock3, MapPin, SlidersHorizontal, Star } from "lucide-react-native";
import { ActiveJobCard } from "../../components/executor/ActiveJobCard";
import { OrderResponseTimer } from "../../components/executor/OrderResponseTimer";
import { ROUTES } from "../../constants/routes";
import { ensureOrderChatRoomApi } from "../../services/chats/chatService";
import { useAuthStore } from "../../store/authStore";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useWorkerStore } from "../../store/workerStore";
import { colors, radius } from "../../theme";
import { Alert, Text } from "../../i18n/native";

const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const avatarPalette = [
  { avatarBg: "#DDEBFF", avatarColor: "#3272E5" },
  { avatarBg: "#FFF0B8", avatarColor: "#D98300" },
  { avatarBg: "#EFE0FF", avatarColor: "#7C3DFF" }
];

export function WorkerJobsScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const incomingRequests = useWorkerStore((state) => state.incomingRequests);
  const activeJob = useWorkerStore((state) => state.activeJob);
  const completedOrders = useWorkerStore((state) => state.completedOrders);
  const status = useWorkerStore((state) => state.operationalStatus);
  const acceptIncomingRequest = useWorkerStore((state) => state.acceptIncomingRequest);
  const updateActiveJobStatus = useWorkerStore((state) => state.updateActiveJobStatus);
  const completeActiveJob = useWorkerStore((state) => state.completeActiveJob);
  const syncWorkerFromApi = useWorkerStore((state) => state.syncWorkerFromApi);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("new");
  const canAccept = status === WORKER_STATUS.AVAILABLE && !activeJob;

  useEffect(() => {
    syncWorkerFromApi();
  }, [syncWorkerFromApi]);

  const newJobs = useMemo(() => {
    if (!incomingRequests.length) return [];
    return incomingRequests.map((request, index) => ({
      ...request,
      avatarBg: avatarPalette[index % avatarPalette.length].avatarBg,
      avatarColor: avatarPalette[index % avatarPalette.length].avatarColor
    }));
  }, [incomingRequests]);

  const activeJobs = activeJob ? [activeJob] : [];
  const doneJobs = completedOrders.length ? completedOrders : [];

  async function handleRefresh() {
    setRefreshing(true);
    await syncWorkerFromApi();
    setRefreshing(false);
  }

  async function handleAccept(job) {
    if (!incomingRequests.length) return;
    const result = await acceptIncomingRequest(job.id);
    if (result?.ok) {
      setSelectedTab("active");
      return;
    }

    if (!result?.ok) {
      Alert.alert("Buyurtma qabul qilinmadi", result?.message || "Qayta urinib ko'ring.");
    }
  }

  async function handleComplete() {
    const result = await completeActiveJob();
    if (result?.ok) {
      Alert.alert("Ish yakunlandi", "Keyingi buyurtma uchun tayyorsiz.");
      return;
    }

    Alert.alert("Status yangilanmadi", result?.message || "Qayta urinib ko'ring.");
  }

  async function handleUpdateStatus(nextStatus) {
    const result = await updateActiveJobStatus(nextStatus);
    if (!result?.ok) {
      Alert.alert("Status yangilanmadi", result?.message || "Qayta urinib ko'ring.");
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

    Alert.alert("Chat ochilmadi", result.message || "Mijoz bilan chatni ochib bo'lmadi.");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1F1E42" colors={["#1F1E42"]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Ishlar</Text>
        <Text style={styles.subtitle}>Ish buyurtmalarini boshqaring</Text>
      </View>

      <View style={styles.segment}>
        <SegmentButton
          active={selectedTab === "new"}
          icon={SlidersHorizontal}
          label="Yangi"
          count={newJobs.length}
          onPress={() => setSelectedTab("new")}
        />
        <SegmentButton
          active={selectedTab === "active"}
          icon={Clock3}
          label="Faol"
          count={activeJobs.length}
          onPress={() => setSelectedTab("active")}
        />
        <SegmentButton
          active={selectedTab === "done"}
          icon={CheckCircle2}
          label="Tugagan"
          count={doneJobs.length}
          onPress={() => setSelectedTab("done")}
        />
      </View>

      <View style={styles.list}>
        {selectedTab === "new"
          ? newJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                disabled={!canAccept && incomingRequests.length > 0}
                onAccept={() => handleAccept(job)}
                index={index}
                showResponseTimer
              />
            ))
          : null}

        {selectedTab === "active" ? (
          activeJobs.length ? (
            activeJobs.map((job) => (
              <ActiveJobCard
                key={job.id}
                job={job}
                onChat={handleOpenJobChat}
                onUpdateStatus={handleUpdateStatus}
                onComplete={handleComplete}
              />
            ))
          ) : (
            <EmptyPanel title="Faol ish yo'q" text="Qabul qilingan ishlar shu yerda ko'rinadi." />
          )
        ) : null}

        {selectedTab === "done" ? (
          doneJobs.length ? (
            doneJobs.map((job, index) => (
              <JobCard key={job.id} job={job} index={index} statusLabel="Tugagan" disabled />
            ))
          ) : (
            <EmptyPanel title="Yakunlangan ishlar yo'q" text="Yakunlangan buyurtmalar shu yerda ko'rinadi." />
          )
        ) : null}
      </View>
    </ScrollView>
  );
}

function SegmentButton({ active, icon: Icon, label, count, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}
    >
      <Icon size={13} color={active ? "#FFFFFF" : "#7588A3"} strokeWidth={2.4} />
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
      <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
        <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function JobCard({
  job,
  disabled,
  onAccept,
  index = 0,
  statusLabel = "Yangi",
  actionLabel = "Qabul qilish",
  footerActionLabel,
  onFooterAction,
  showResponseTimer = false
}) {
  const clientName = job.clientName || "Mijoz";
  const initials = getInitials(clientName);
  const service = job.service || job.problemTitle || job.title;
  const summary = job.problemSummary || job.problemDescription;
  const scheduledAt = job.createdAt || job.date;
  const price = job.estimatedPayment || job.amount || job.price;
  const avatarBg = job.avatarBg || avatarPalette[index % avatarPalette.length].avatarBg;
  const avatarColor = job.avatarColor || avatarPalette[index % avatarPalette.length].avatarColor;

  return (
    <View style={[styles.card, disabled && styles.cardDisabled]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
        </View>
        <View style={styles.customerBlock}>
          <Text style={styles.customerName} numberOfLines={1}>
            {clientName}
          </Text>
          {job.rating && job.jobs ? (
            <View style={styles.ratingRow}>
              <Star size={11} color="#FFC331" fill="#FFC331" strokeWidth={2.2} />
              <Text style={styles.ratingText}>
                {job.rating} - {job.jobs} ish
              </Text>
            </View>
          ) : null}
        </View>
        {price ? (
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{price}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {service ? <Text style={styles.serviceTitle}>{service}</Text> : null}
      {summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}

      {job.address ? (
        <View style={styles.addressRow}>
          <MapPin size={13} color="#FF6B1A" strokeWidth={2.4} />
          <Text style={styles.addressText} numberOfLines={1}>
            {job.address}
          </Text>
        </View>
      ) : null}

      {showResponseTimer ? <OrderResponseTimer deadlineAt={job.responseDeadlineAt} /> : null}

      <View style={styles.cardFooter}>
        <View style={styles.metaGroup}>
          {scheduledAt ? <MetaPill icon={Clock3} label={scheduledAt} /> : null}
          {job.distance ? <MetaPill icon={MapPin} label={job.distance} /> : null}
        </View>
        <View style={styles.actionsRow}>
          {footerActionLabel ? (
            <Pressable
              onPress={onFooterAction}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>{footerActionLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={disabled}
            onPress={onAccept}
            style={({ pressed }) => [
              styles.acceptButton,
              disabled && styles.acceptButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.acceptText}>{actionLabel}</Text>
            <ArrowRight size={13} color="#FFFFFF" strokeWidth={2.8} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MetaPill({ icon: Icon, label }) {
  return (
    <View style={styles.metaPill}>
      <Icon size={11} color="#7F90A9" strokeWidth={2.3} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function EmptyPanel({ title, text }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function getInitials(name) {
  return String(name || "Mijoz")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FC"
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 112
  },
  header: {
    marginBottom: 15
  },
  title: {
    color: "#07122B",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: font.extra
  },
  subtitle: {
    marginTop: 2,
    color: "#667894",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.medium
  },
  segment: {
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#17213D",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 3
  },
  segmentButton: {
    flex: 1,
    height: 35,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  segmentButtonActive: {
    backgroundColor: "#1F1E42"
  },
  segmentLabel: {
    color: "#5D708C",
    fontSize: 12,
    fontFamily: font.bold
  },
  segmentLabelActive: {
    color: "#FFFFFF"
  },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5
  },
  segmentBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  segmentBadgeText: {
    color: "#5D708C",
    fontSize: 10,
    fontFamily: font.extra
  },
  segmentBadgeTextActive: {
    color: "#FFFFFF"
  },
  list: {
    marginTop: 14,
    gap: 14
  },
  card: {
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    padding: 16,
    shadowColor: "#17213D",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3
  },
  cardDisabled: {
    opacity: 0.74
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 13,
    fontFamily: font.extra
  },
  customerBlock: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0
  },
  customerName: {
    color: "#07122B",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.extra
  },
  ratingRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    color: "#667894",
    fontSize: 11,
    fontFamily: font.medium
  },
  priceBlock: {
    alignItems: "flex-end",
    marginLeft: 10
  },
  price: {
    color: "#07122B",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: font.extra
  },
  statusRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#246BFF"
  },
  statusText: {
    color: "#246BFF",
    fontSize: 11,
    fontFamily: font.bold
  },
  serviceTitle: {
    marginTop: 15,
    color: "#07122B",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.extra
  },
  summary: {
    marginTop: 5,
    color: "#667894",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.medium
  },
  addressRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  addressText: {
    flex: 1,
    color: "#667894",
    fontSize: 11,
    fontFamily: font.medium
  },
  cardFooter: {
    marginTop: 14,
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  metaGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  metaPill: {
    maxWidth: 112,
    height: 25,
    borderRadius: radius.pill,
    backgroundColor: "#F3F6FA",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaText: {
    color: "#667894",
    fontSize: 11,
    fontFamily: font.medium
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  acceptButton: {
    minWidth: 90,
    height: 29,
    borderRadius: radius.pill,
    backgroundColor: "#18A850",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  acceptButtonDisabled: {
    backgroundColor: colors.subtle
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: font.extra
  },
  secondaryButton: {
    height: 29,
    borderRadius: radius.pill,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#1F1E42",
    fontSize: 12,
    fontFamily: font.extra
  },
  emptyPanel: {
    minHeight: 142,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    alignItems: "center",
    justifyContent: "center",
    padding: 22
  },
  emptyTitle: {
    color: "#07122B",
    fontSize: 15,
    fontFamily: font.extra
  },
  emptyText: {
    marginTop: 7,
    color: "#667894",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.medium
  },
  pressed: {
    opacity: 0.76
  }
});
