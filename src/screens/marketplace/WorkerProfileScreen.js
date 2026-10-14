import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  Ban,
  ChevronRight,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Star
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useWorkerById } from "../../hooks/useWorkerById";
import { ensureWorkerChatRoomApi } from "../../services/chats/chatService";
import { resolveWorkerImage } from "../../services/images/imageService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { EmptyState } from "../../components/ui/EmptyState";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { ReportModal } from "../../components/moderation/ReportModal";
import { blockUserApi } from "../../services/moderation/moderationService";
import { fetchWorkerReviewsApi } from "../../services/workers/workerService";
import { fetchPublicWorker } from "../../services/catalog/catalogService";
import { requireAuthentication } from "../../navigation/protectedActions";
import { formatDistanceMeters } from "../../services/catalog/catalogDistance.mjs";
import { Alert, Text } from "../../i18n/native";
import { useTranslation } from "react-i18next";
import { workerCategoryLabel } from "../../services/content/categoryService";
import { formatWorkerPhone, normalizeWorkerPhone } from "../../utils/workerPhone.mjs";
import { workerExperienceLabel } from "../../utils/workerExperience.mjs";

import { ClientDock } from "../../components/client/ClientDock";
import { GlassSurface } from "../../components/client/GlassSurface";
import { colors, font, radius, shadow } from "../../theme/clientTheme";

export function WorkerProfileScreen({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const workerId = route.params?.workerId;
  const focused = useIsFocused();
  const worker = useWorkerById(workerId);
  const requestGeneration = useRef(0);
  const session = useAuthStore((state) => state.session);
  const favoriteWorkerIds = useClientStore((state) => state.favoriteWorkerIds);
  const toggleFavoriteWorker = useClientStore((state) => state.toggleFavoriteWorker);
  const upsertPublicWorker = useClientStore((state) => state.upsertPublicWorker);
  const syncCatalogFromApi = useClientStore((state) => state.syncCatalogFromApi);
  const [openingChat, setOpeningChat] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [reviewsReload, setReviewsReload] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [workerUnavailable, setWorkerUnavailable] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(Boolean(workerId));

  useFocusEffect(useCallback(() => {
    let active = true;
    requestGeneration.current += 1;
    setOpeningChat(false);
    setBlocking(false);
    setWorkerUnavailable(false);
    setWorkerLoading(Boolean(workerId));
    if (!workerId) return undefined;
    fetchPublicWorker(workerId).then((result) => {
      if (!active) return;
      if (result.ok && result.worker?.id === workerId) {
        upsertPublicWorker(result.worker);
        setWorkerUnavailable(false);
      } else {
        setWorkerUnavailable(true);
      }
      setWorkerLoading(false);
    });
    return () => {
      active = false;
      requestGeneration.current += 1;
    };
  }, [upsertPublicWorker, workerId]));

  useEffect(() => {
    let mounted = true;
    if (!focused) return undefined;
    setReviews([]);
    setReviewsLoading(Boolean(workerId));
    setReviewsFailed(false);
    if (!workerId) return undefined;
    fetchWorkerReviewsApi(workerId).then((result) => {
      if (!mounted) return;
      if (result.ok) setReviews(result.reviews);
      else setReviewsFailed(true);
      setReviewsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [focused, reviewsReload, workerId]);

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack();
  }

  if (!worker && workerLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.unavailableHeader}>
          <WorkerProfileBackButton onPress={handleBack} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!worker || workerUnavailable) {
    return (
      <View style={styles.screen}>
        <View style={styles.unavailableHeader}>
          <WorkerProfileBackButton onPress={handleBack} />
        </View>
        <EmptyState title="Usta topilmadi" text="Katalogdan usta tanlang yoki keyinroq qayta urinib ko'ring." />
      </View>
    );
  }

  const isFavorite = favoriteWorkerIds.includes(worker.id);
  const heroImage = resolveWorkerImage(worker);
  const isBookable = worker.availability === WORKER_STATUS.AVAILABLE;
  const reviewCount = reviews.length;
  const statusLabel = isBookable
    ? "Hozir buyurtma qabul qilmoqda"
    : worker.availability === WORKER_STATUS.BUSY
      ? "Hozir band"
      : "Hozir mavjud emas";
  const statusColor = isBookable
    ? colors.success
    : worker.availability === WORKER_STATUS.BUSY
      ? colors.warning
      : colors.muted;
  const basePrice = Number(worker.basePriceValue);
  const displayedPrice =
    Number.isFinite(basePrice) && basePrice > 0
      ? `${basePrice.toLocaleString(i18n.language === "en" ? "en-US" : i18n.language === "ru" ? "ru-RU" : "uz-UZ")} ${t("so'm")}`
      : t("Kelishiladi");
  const displayPhone = formatWorkerPhone(worker.phone);

  async function handleCall() {
    const phone = normalizeWorkerPhone(worker.phone);
    if (!phone) {
      const phoneMissing = typeof worker.phone !== "string" || !worker.phone.trim();
      Alert.alert("Xatolik", phoneMissing ? "Telefon raqam topilmadi" : "Telefon raqam noto'g'ri");
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert("Xatolik", "Telefon ilovasini ochib bo'lmadi.");
    }
  }

  async function handleChat() {
    if (openingChat) return;

    if (!session?.token) {
      requireAuthentication(navigation, {
        kind: "PROTECTED_ROUTE",
        routeName: ROUTES.WORKER_PROFILE,
        workerId: worker.id,
        categoryId: route.params?.categoryId
      });
      return;
    }

    const identity = useAuthStore.getState().captureAuthRequest(session.token);
    const generation = requestGeneration.current;
    setOpeningChat(true);
    const result = await ensureWorkerChatRoomApi(session.token, worker.id, session.userId);
    if (!useAuthStore.getState().isAuthRequestCurrent(identity) || generation !== requestGeneration.current) return;
    setOpeningChat(false);

    if (result.ok) {
      navigation.navigate(ROUTES.CHAT_THREAD, { room: result.room });
      return;
    }

    Alert.alert("Chat ochilmadi", result.message || "Usta bilan chatni ochishda xatolik yuz berdi.");
  }

  function handleBook() {
    if (!isBookable) {
      Alert.alert("Usta hozir mavjud emas", "Iltimos, buyurtma uchun boshqa mavjud ustani tanlang.");
      return;
    }

    if (!session?.token) {
      requireAuthentication(navigation, { kind: "BOOKING", workerId: worker.id, categoryId: route.params?.categoryId });
      return;
    }
    navigation.navigate(ROUTES.BOOKING, { workerId: worker.id, categoryId: route.params?.categoryId });
  }

  async function handleToggleFavorite() {
    if (savingFavorite) return;
    if (!session?.token) {
      requireAuthentication(navigation, {
        kind: "PROTECTED_ROUTE",
        routeName: ROUTES.WORKER_PROFILE,
        workerId: worker.id,
        categoryId: route.params?.categoryId
      });
      return;
    }

    setSavingFavorite(true);
    try {
      const result = await toggleFavoriteWorker(worker.id);
      if (!result.ok && !result.stale) {
        Alert.alert("Saqlanmadi", result.message || "Ustani yoqtirilganlarga qo'shishda xatolik yuz berdi.");
      }
    } catch (error) {
      Alert.alert("Saqlanmadi", error?.message || "Ustani yoqtirilganlarga qo'shishda xatolik yuz berdi.");
    } finally {
      setSavingFavorite(false);
    }
  }

  async function handleShare() {
    const title = `${worker.name} - ${workerCategoryLabel(worker, i18n.language).label}`;

    await Share.share({
      title,
      message: `${title}\nNearFIX ilovasida ko'ring.`
    });
  }

  function confirmBlockWorker() {
    if (blocking) return;
    if (!session?.token) {
      requireAuthentication(navigation, {
        kind: "PROTECTED_ROUTE",
        routeName: ROUTES.WORKER_PROFILE,
        workerId: worker.id,
        categoryId: route.params?.categoryId
      });
      return;
    }
    Alert.alert(
      "Ustani bloklash",
      "Yangi chat ochish cheklanadi. Faol buyurtma bo'lsa, avval yordam orqali hal qilish kerak.",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Bloklash",
          style: "destructive",
          onPress: async () => {
            const identity = useAuthStore.getState().captureAuthRequest(session.token);
            const generation = requestGeneration.current;
            setBlocking(true);
            const result = await blockUserApi(session.token, undefined, worker.id);
            if (!useAuthStore.getState().isAuthRequestCurrent(identity) || generation !== requestGeneration.current) return;
            if (result.ok) {
              await syncCatalogFromApi(route.params?.categoryId);
              if (!useAuthStore.getState().isAuthRequestCurrent(identity) || generation !== requestGeneration.current) return;
            }
            setBlocking(false);
            Alert.alert(
              result.ok ? "Usta bloklandi" : "Bloklab bo'lmadi",
              result.ok
                ? "Bloklangan foydalanuvchilar ro'yxatidan qayta ochishingiz mumkin."
                : result.message || "Qayta urinib ko'ring."
            );
            if (result.ok && navigation.canGoBack()) navigation.goBack();
          }
        }
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={heroImage} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <WorkerAvatar worker={worker} size={112} radius={38} />
            </View>
          )}
          <View pointerEvents="none" style={styles.heroScrim} />
          <View style={styles.topActions}>
            <WorkerProfileBackButton onPress={handleBack} />
            <View style={styles.rightActions}>
              <GlassSurface style={styles.roundButton}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(isFavorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo'shish")}
                  accessibilityState={{ selected: isFavorite, disabled: savingFavorite, busy: savingFavorite }}
                  onPress={handleToggleFavorite}
                  disabled={savingFavorite}
                  style={styles.roundButtonInner}
                >
                  {savingFavorite ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Heart
                      size={21}
                      color={isFavorite ? colors.danger : colors.text}
                      fill={isFavorite ? colors.danger : "transparent"}
                      strokeWidth={1.8}
                    />
                  )}
                </Pressable>
              </GlassSurface>
              <GlassSurface style={styles.roundButton}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Usta profilini ulashish")}
                  onPress={handleShare}
                  style={styles.roundButtonInner}
                >
                  <Share2 size={21} color={colors.text} strokeWidth={1.8} />
                </Pressable>
              </GlassSurface>
            </View>
          </View>
        </View>
        <View style={styles.identityCard}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text translate={false} style={styles.name}>
            {worker.name}
          </Text>
          <Text translate={false} style={styles.profession}>
            {workerCategoryLabel(worker, i18n.language).label}
          </Text>
          {worker.experience && worker.experience !== "Tasdiqlangan" ? (
            <Text translate={false} style={styles.experience}>{workerExperienceLabel(worker.experience, t)}</Text>
          ) : null}
          <View style={styles.statsRow}>
            <StatItem
              icon={<Star size={17} color={colors.warning} strokeWidth={1.8} />}
              value={reviewCount ? worker.rating : "—"}
              label={
                reviewCount
                  ? `${reviewCount} ta sharh`
                  : reviewsLoading || reviewsFailed
                    ? "Sharhlar"
                    : "Sharhlar hali yo'q"
              }
            />
            <View style={styles.divider} />
            <StatItem
              icon={<BadgeCheck size={18} color={colors.primary} strokeWidth={1.8} />}
              value={String(worker.completedOrders || 0)}
              label="Bajarilgan ishlar"
            />
            <View style={styles.divider} />
            <StatItem
              icon={<MapPin size={17} color={colors.primary} strokeWidth={1.8} />}
              value={formatDistanceMeters(worker.distanceMeters)}
              label="taxminiy masofa"
            />
          </View>
        </View>
        <View style={styles.detailCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Boshlang'ich narx</Text>
            <Text translate={false} style={styles.priceValue}>
              {displayedPrice}
            </Text>
          </View>
          <Text style={styles.priceNote}>Yakuniy narx ish hajmiga qarab usta bilan kelishiladi.</Text>
          <View style={styles.availableCard}>
            <View style={styles.availableIcon}>
              <CalendarCheck size={20} color={statusColor} strokeWidth={1.8} />
            </View>
            <View style={styles.availableCopy}>
              <Text style={styles.availableTitle}>{statusLabel}</Text>
              <Text style={styles.availableText}>
                {isBookable ? "Buyurtma berish mumkin" : "Boshqa mavjud ustani tanlang"}
              </Text>
            </View>
          </View>
          <View style={styles.phoneRow}>
            <Text style={[styles.phoneText, !displayPhone && styles.phoneTextUnavailable]} translate={!displayPhone}>
              {displayPhone || "Telefon raqami mavjud emas"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Ustaga qo'ng'iroq qilish")}
              onPress={handleCall}
              style={styles.callButton}
            >
              <Phone size={20} color={colors.primary} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>Men haqimda</Text>
          <Text translate={!worker.about} style={styles.aboutText}>
            {worker.about || "Usta hali o'zi haqida ma'lumot kiritmagan."}
          </Text>
        </View>
        <View style={styles.reviewsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sharhlar</Text>
            {reviews.length ? (
              <Text translate={false} style={styles.reviewCount}>
                {reviews.length}
              </Text>
            ) : null}
          </View>
          {reviewsLoading ? (
            <View style={styles.reviewState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.reviewStateText}>Sharhlar yuklanmoqda...</Text>
            </View>
          ) : reviewsFailed ? (
            <View style={styles.reviewState}>
              <Text style={styles.reviewStateText}>Sharhlar yuklanmadi.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReviewsReload((value) => value + 1)}
                style={styles.reviewRetry}
              >
                <Text style={styles.reviewRetryText}>Qayta urinish</Text>
              </Pressable>
            </View>
          ) : reviews.length ? (
            reviews.map((review) => (
              <ClientReviewCard
                key={review.id}
                review={review}
                onReport={() =>
                  session?.token
                    ? setReportTarget({ targetType: "REVIEW", targetId: review.id, title: "Sharh haqida shikoyat" })
                    : requireAuthentication(navigation, {
                        kind: "PROTECTED_ROUTE",
                        routeName: ROUTES.WORKER_PROFILE,
                        workerId: worker.id,
                        categoryId: route.params?.categoryId
                      })
                }
              />
            ))
          ) : (
            <Text style={styles.emptyReviews}>Sharhlar hali yo'q</Text>
          )}
        </View>
        <View style={styles.safetySection}>
          <Text style={styles.sectionTitle}>Xavfsizlik</Text>
          <View style={styles.safetyActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                session?.token
                  ? setReportTarget({ targetType: "WORKER", targetId: worker.id, title: "Usta haqida shikoyat" })
                  : requireAuthentication(navigation, {
                      kind: "PROTECTED_ROUTE",
                      routeName: ROUTES.WORKER_PROFILE,
                      workerId: worker.id,
                      categoryId: route.params?.categoryId
                    })
              }
              style={styles.safetyButton}
            >
              <Flag size={18} color={colors.danger} strokeWidth={1.8} />
              <Text style={styles.reportText}>Usta haqida shikoyat</Text>
              <ChevronRight size={16} color={colors.subtle} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: blocking, busy: blocking }}
              onPress={confirmBlockWorker}
              disabled={blocking}
              style={styles.safetyButton}
            >
              <Ban size={18} color={colors.danger} strokeWidth={1.8} />
              <Text style={styles.reportText}>{blocking ? "Bloklanmoqda..." : "Ustani bloklash"}</Text>
              <ChevronRight size={16} color={colors.subtle} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <View style={styles.ctaBar}>
        <GlassSurface style={styles.chatSurface}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Ustaga yozish")}
            accessibilityState={{ disabled: openingChat, busy: openingChat }}
            onPress={handleChat}
            disabled={openingChat}
            style={[styles.chatButton, openingChat && styles.chatButtonMuted]}
          >
            {openingChat ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MessageCircle size={23} color={colors.primary} strokeWidth={1.8} />
            )}
          </Pressable>
        </GlassSurface>
        <Pressable
          accessibilityRole="button"
          onPress={handleBook}
          style={({ pressed }) => [
            styles.bookButton,
            !isBookable && styles.bookButtonDisabled,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.bookButtonText}>{isBookable ? "Buyurtma berish" : "Hozir mavjud emas"}</Text>
        </Pressable>
      </View>
      <ClientDock navigation={navigation} activeRoute={ROUTES.HOME_TAB} />
      <ReportModal
        visible={Boolean(reportTarget)}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        title={reportTarget?.title}
        onClose={() => setReportTarget(null)}
        onSuccess={() => Alert.alert("Shikoyat yuborildi", "Moderatorlar murojaatingizni ko'rib chiqadi.")}
      />
    </View>
  );
}

function WorkerProfileBackButton({ onPress }) {
  const { t } = useTranslation();
  return (
    <GlassSurface style={styles.roundButton}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Orqaga")}
        onPress={onPress}
        style={styles.roundButtonInner}
      >
        <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
      </Pressable>
    </GlassSurface>
  );
}

function StatItem({ icon, value, label }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statTop}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ClientReviewCard({ review, onReport }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewAuthorCopy}>
          <Text translate={false} style={styles.reviewAuthor}>
            {review.author}
          </Text>
          <Text translate={false} style={styles.reviewDate}>
            {review.date}
          </Text>
        </View>
        <View style={styles.reviewRating}>
          <Star size={15} color={colors.warning} strokeWidth={1.8} />
          <Text translate={false} style={styles.reviewRatingText}>
            {review.rating}
          </Text>
        </View>
      </View>
      <Text translate={review.text === "Izoh qoldirilmagan."} style={styles.reviewText}>
        {review.text}
      </Text>
      <Pressable accessibilityRole="button" onPress={onReport} style={styles.reviewReport}>
        <Flag size={15} color={colors.muted} strokeWidth={1.8} />
        <Text style={styles.reviewReportText}>Sharh haqida shikoyat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 186, backgroundColor: colors.background },
  hero: {
    height: 250,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: radius.xxl,
    overflow: "hidden",
    backgroundColor: colors.primarySoft
  },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heroFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(23,44,56,0.03)" },
  unavailableHeader: { minHeight: 86, paddingTop: 22, paddingHorizontal: 22, alignItems: "flex-start" },
  topActions: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rightActions: { flexDirection: "row", gap: 9 },
  roundButton: { width: 46, height: 46, borderRadius: 23, ...shadow },
  roundButtonInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  identityCard: {
    marginTop: -20,
    marginHorizontal: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...shadow
  },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", marginBottom: 11 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, lineHeight: 17, fontFamily: font.semi, flexShrink: 1 },
  name: { color: colors.text, fontSize: 28, lineHeight: 35, fontFamily: font.bold, letterSpacing: -0.8 },
  profession: { marginTop: 4, color: colors.primary, fontSize: 15, lineHeight: 22, fontFamily: font.medium },
  experience: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular },
  statsRow: {
    marginTop: 21,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center"
  },
  statItem: { flex: 1, alignItems: "center", paddingHorizontal: 3 },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, flexWrap: "wrap" },
  statValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: font.bold },
  statLabel: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: font.regular,
    textAlign: "center"
  },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
  detailCard: {
    marginHorizontal: 22,
    marginTop: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 11,
    ...shadow
  },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  priceLabel: { color: colors.muted, fontSize: 13, fontFamily: font.medium, flex: 1 },
  priceValue: { color: colors.text, fontSize: 19, lineHeight: 27, fontFamily: font.bold, flexShrink: 1 },
  priceNote: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: font.regular, marginBottom: 4 },
  availableCard: {
    minHeight: 68,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  availableIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  availableCopy: { flex: 1, minWidth: 0 },
  availableTitle: { color: colors.text, fontSize: 12, lineHeight: 18, fontFamily: font.semi },
  availableText: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 17, fontFamily: font.regular },
  phoneRow: {
    minHeight: 58,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingLeft: 13,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  phoneText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.semi },
  phoneTextUnavailable: { color: colors.muted, fontSize: 12 },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  aboutSection: {
    marginHorizontal: 22,
    marginTop: 22,
    padding: 18,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  sectionTitle: { color: colors.text, fontSize: 19, lineHeight: 26, fontFamily: font.bold, letterSpacing: -0.4 },
  aboutText: { marginTop: 11, color: colors.muted, fontSize: 14, lineHeight: 24, fontFamily: font.regular },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  reviewCount: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontFamily: font.semi,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10
  },
  reviewsSection: { marginHorizontal: 22, marginTop: 24, gap: 12 },
  reviewState: {
    minHeight: 80,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  reviewStateText: { color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: font.regular, flex: 1 },
  reviewRetry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 5 },
  reviewRetryText: { color: colors.primary, fontSize: 12, fontFamily: font.semi },
  reviewCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 18,
    gap: 11
  },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  reviewAuthorCopy: { flex: 1 },
  reviewAuthor: { color: colors.text, fontFamily: font.semi, fontSize: 14, lineHeight: 21 },
  reviewDate: { marginTop: 3, color: colors.muted, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFF8E9"
  },
  reviewRatingText: { color: colors.text, fontFamily: font.semi, fontSize: 12 },
  reviewText: { color: colors.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 22 },
  reviewReport: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 },
  reviewReportText: { color: colors.muted, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  emptyReviews: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: font.regular,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border
  },
  safetySection: { marginHorizontal: 22, marginTop: 24 },
  safetyActions: { marginTop: 12, gap: 9 },
  safetyButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  reportText: { color: colors.muted, fontFamily: font.medium, fontSize: 12, lineHeight: 18, flex: 1 },
  ctaBar: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 96,
    minHeight: 56,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  chatSurface: { width: 56, height: 56, borderRadius: radius.lg, borderColor: colors.border, ...shadow },
  chatButton: { flex: 1, alignItems: "center", justifyContent: "center" },
  chatButtonMuted: { opacity: 0.62 },
  bookButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  bookButtonDisabled: { backgroundColor: colors.muted },
  bookButtonText: { color: colors.white, fontSize: 15, lineHeight: 22, fontFamily: font.semi },
  pressed: { opacity: 0.78 }
});
