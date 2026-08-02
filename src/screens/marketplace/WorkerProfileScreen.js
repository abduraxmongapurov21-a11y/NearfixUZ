import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  Ban,
  ClipboardList,
  Flag,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Share2,
  Star,
  UserRound
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { WORKER_STATUS } from "../../constants/workerStatus";
import { useSelectedWorker } from "../../hooks/useSelectedWorker";
import { ensureWorkerChatRoomApi } from "../../services/chats/chatService";
import { resolveWorkerImage } from "../../services/images/imageService";
import { useAuthStore } from "../../store/authStore";
import { useClientStore } from "../../store/clientStore";
import { EmptyState } from "../../components/ui/EmptyState";
import { WorkerAvatar } from "../../components/ui/WorkerAvatar";
import { ReportModal } from "../../components/moderation/ReportModal";
import { ReviewCard } from "../../components/profile/ReviewCard";
import { blockUserApi } from "../../services/moderation/moderationService";
import { fetchWorkerReviewsApi } from "../../services/workers/workerService";
import { formatDistanceMeters } from "../../services/catalog/catalogDistance.mjs";
import { Alert, Text } from "../../i18n/native";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

export function WorkerProfileScreen({ navigation }) {
  const worker = useSelectedWorker();
  const session = useAuthStore((state) => state.session);
  const favoriteWorkerIds = useClientStore((state) => state.favoriteWorkerIds);
  const toggleFavoriteWorker = useClientStore((state) => state.toggleFavoriteWorker);
  const [openingChat, setOpeningChat] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!worker?.id) return undefined;
    fetchWorkerReviewsApi(worker.id).then((result) => {
      if (mounted && result.ok) setReviews(result.reviews);
    });
    return () => {
      mounted = false;
    };
  }, [worker?.id]);
  if (!worker) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Usta topilmadi" text="Katalogdan usta tanlang yoki keyinroq qayta urinib ko'ring." />
      </View>
    );
  }

  const isFavorite = favoriteWorkerIds.includes(worker.id);
  const heroImage = resolveWorkerImage(worker);
  const isBookable = worker.availability === WORKER_STATUS.AVAILABLE;
  const reviewCount = reviews.length || Number(worker.reviews || 0);

  async function handleChat() {
    if (openingChat) return;

    if (!session?.token) {
      Alert.alert("Login kerak", "Usta bilan yozishish uchun avval tizimga kiring.");
      return;
    }

    setOpeningChat(true);
    const result = await ensureWorkerChatRoomApi(session.token, worker.id, session.userId);
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

    navigation.navigate(ROUTES.BOOKING, { workerId: worker.id, flowId: Date.now() });
  }

  async function handleToggleFavorite() {
    if (savingFavorite) return;

    setSavingFavorite(true);
    try {
      await toggleFavoriteWorker(worker.id);
    } catch {
      Alert.alert("Saqlanmadi", "Ustani yoqtirilganlarga qo'shishda xatolik yuz berdi.");
    } finally {
      setSavingFavorite(false);
    }
  }

  async function handleShare() {
    const title = `${worker.name} - ${worker.specialty}`;

    await Share.share({
      title,
      message: `${title}\nNearFIX ilovasida ko'ring.`
    });
  }

  function confirmBlockWorker() {
    if (!worker.userId || blocking) return;
    Alert.alert(
      "Ustani bloklash",
      "Yangi chat ochish cheklanadi. Faol buyurtma bo'lsa, avval yordam orqali hal qilish kerak.",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Bloklash",
          style: "destructive",
          onPress: async () => {
            setBlocking(true);
            const result = await blockUserApi(session?.token, worker.userId);
            setBlocking(false);
            Alert.alert(
              result.ok ? "Usta bloklandi" : "Bloklab bo'lmadi",
              result.ok
                ? "Bloklangan foydalanuvchilar ro'yxatidan qayta ochishingiz mumkin."
                : result.message || "Qayta urinib ko'ring."
            );
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
              <WorkerAvatar worker={worker} size={118} radius={42} />
            </View>
          )}
          <View style={styles.heroScrim} />
          <View style={styles.topActions}>
            <Pressable onPress={() => navigation.goBack()} style={styles.roundButton}>
              <ArrowLeft size={24} color="#273248" strokeWidth={2.7} />
            </Pressable>
            <View style={styles.rightActions}>
              <Pressable onPress={handleToggleFavorite} disabled={savingFavorite} style={styles.roundButton}>
                <Heart
                  size={23}
                  color={isFavorite ? "#EF4444" : "#273248"}
                  fill={isFavorite ? "#EF4444" : "transparent"}
                  strokeWidth={2.6}
                />
              </Pressable>
              <Pressable onPress={handleShare} style={styles.roundButton}>
                <Share2 size={22} color="#273248" strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroInfo}>
            <View style={styles.badgeRow}>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{isBookable ? "Onlayn" : "Mavjud emas"}</Text>
              </View>
            </View>
            <Text style={styles.name}>{worker.name}</Text>
            <Text style={styles.profession}>
              {worker.specialty} • {worker.experience || "Tajriba ko'rsatilmagan"}
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <StatItem
              icon={<Star size={21} color="#FFB020" fill="#FFB020" />}
              value={reviewCount ? worker.rating : "-"}
              label={reviewCount ? `${reviewCount} ta sharh` : "Sharhlar hali yo'q"}
            />
            <View style={styles.divider} />
            <StatItem
              icon={<BadgeCheck size={21} color="#0F80B7" fill="#0F80B7" />}
              value={`${worker.completedOrders || 0}+`}
              label="Bajarilgan ishlar"
            />
            <View style={styles.divider} />
            <StatItem
              icon={<MapPin size={21} color="#2CD8A5" fill="#2CD8A5" />}
              value={formatDistanceMeters(worker.distanceMeters)}
              label="taxminiy masofa"
            />
          </View>

          <View style={styles.availableCard}>
            <View style={styles.availableIcon}>
              <CalendarCheck size={20} color="#0F80B7" strokeWidth={2.8} />
            </View>
            <View>
              <Text style={styles.availableTitle}>
                {isBookable ? "Bugun bo'sh vaqtlari bor" : "Hozir buyurtma qabul qilmayapti"}
              </Text>
              <Text style={styles.availableText}>
                {isBookable ? "Buyurtma berish mumkin" : "Boshqa mavjud ustani tanlang"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>Men haqimda</Text>
          <Text style={styles.aboutText}>{worker.about || "Usta hali o'zi haqida ma'lumot kiritmagan."}</Text>
        </View>

        <View style={styles.safetySection}>
          <Text style={styles.aboutTitle}>Xavfsizlik</Text>
          <View style={styles.safetyActions}>
            <Pressable
              onPress={() =>
                setReportTarget({ targetType: "WORKER", targetId: worker.id, title: "Usta haqida shikoyat" })
              }
              style={styles.safetyButton}
            >
              <Flag size={18} color="#EF4444" />
              <Text style={styles.reportText}>Usta haqida shikoyat</Text>
            </Pressable>
            <Pressable onPress={confirmBlockWorker} disabled={!worker.userId || blocking} style={styles.safetyButton}>
              <Ban size={18} color="#EF4444" />
              <Text style={styles.reportText}>{blocking ? "Bloklanmoqda..." : "Ustani bloklash"}</Text>
            </Pressable>
          </View>
        </View>

        {reviews.length ? (
          <View style={styles.reviewsSection}>
            <Text style={styles.aboutTitle}>Sharhlar</Text>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onReport={() =>
                  setReportTarget({ targetType: "REVIEW", targetId: review.id, title: "Sharh haqida shikoyat" })
                }
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          onPress={handleChat}
          disabled={openingChat}
          style={[styles.chatButton, openingChat && styles.chatButtonMuted]}
        >
          <MessageCircle size={24} color="#0F80B7" strokeWidth={2.7} />
        </Pressable>
        <Pressable onPress={handleBook} style={[styles.bookButton, !isBookable && styles.bookButtonDisabled]}>
          <Text style={styles.bookButtonText}>Buyurtma berish</Text>
        </Pressable>
      </View>
      <ScreenBottomNav navigation={navigation} />
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

function ScreenBottomNav({ navigation }) {
  function goTab(screen) {
    navigation.navigate(ROUTES.CLIENT_TABS, { screen });
  }

  return (
    <View style={styles.bottomNav}>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.HOME_TAB)}>
        <Home size={25} color="#0F80B7" fill="#0F80B7" />
        <Text style={[styles.navLabel, styles.navLabelActive]}>Uy</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.ORDERS_TAB)}>
        <ClipboardList size={25} color="#A0A7B3" />
        <Text style={styles.navLabel}>Buyurtmalar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.CHATS_TAB)}>
        <View>
          <MessageCircle size={25} color="#A0A7B3" />
        </View>
        <Text style={styles.navLabel}>Chatlar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.PROFILE_TAB)}>
        <UserRound size={25} color="#A0A7B3" />
        <Text style={styles.navLabel}>Profil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F9FB"
  },
  content: {
    paddingBottom: 174,
    backgroundColor: "#F0F9FB"
  },
  hero: {
    height: 360,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
    backgroundColor: "#BDE3ED"
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  heroFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#DDF3F8",
    alignItems: "center",
    justifyContent: "center"
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,113,157,0.20)"
  },
  topActions: {
    position: "absolute",
    top: 42,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rightActions: {
    flexDirection: "row",
    gap: 12
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 5
  },
  heroInfo: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 58
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  topBadge: {
    height: 29,
    borderRadius: 9,
    backgroundColor: "#2CD8A5",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  topBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: font.extra
  },
  onlineBadge: {
    height: 29,
    borderRadius: 9,
    backgroundColor: "rgba(45,55,72,0.55)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2CD8A5"
  },
  onlineText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: font.bold
  },
  name: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 39,
    fontFamily: font.extra
  },
  profession: {
    marginTop: 7,
    color: "rgba(255,255,255,0.86)",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: font.semi
  },
  statsCard: {
    marginTop: -42,
    marginHorizontal: 24,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 21,
    gap: 22,
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 26,
    elevation: 8
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  statItem: {
    flex: 1,
    alignItems: "center"
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statValue: {
    color: "#273248",
    fontSize: 22,
    fontFamily: font.extra
  },
  statLabel: {
    marginTop: 9,
    color: "#6B7280",
    fontSize: 13,
    fontFamily: font.semi,
    textAlign: "center"
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: "#E5E7EB"
  },
  availableCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCECF3",
    backgroundColor: "#F8FCFE",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  availableIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(44,216,165,0.20)",
    alignItems: "center",
    justifyContent: "center"
  },
  availableTitle: {
    color: "#273248",
    fontSize: 16,
    fontFamily: font.extra
  },
  availableText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 15,
    fontFamily: font.medium
  },
  aboutSection: {
    paddingHorizontal: 24,
    paddingTop: 32
  },
  safetySection: {
    paddingHorizontal: 24,
    paddingTop: 26
  },
  safetyActions: {
    marginTop: 14,
    gap: 10
  },
  safetyButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF7F7",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  reportText: {
    color: "#DC2626",
    fontFamily: font.bold
  },
  reviewsSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 10
  },
  aboutTitle: {
    color: "#273248",
    fontSize: 23,
    fontFamily: font.extra
  },
  aboutText: {
    marginTop: 18,
    color: "#4B5563",
    fontSize: 17,
    lineHeight: 28,
    fontFamily: font.medium
  },
  ctaBar: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 82,
    height: 62,
    flexDirection: "row",
    gap: 13,
    alignItems: "center"
  },
  chatButton: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 5
  },
  chatButtonMuted: {
    opacity: 0.62
  },
  bookButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#2CD8A5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2CD8A5",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 7
  },
  bookButtonDisabled: {
    opacity: 0.58
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: font.extra
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 86,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#0F719D",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -10 },
    shadowRadius: 18,
    elevation: 10
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  navLabel: {
    color: "#A0A7B3",
    fontSize: 14,
    fontFamily: font.bold
  },
  navLabelActive: {
    color: "#0F80B7"
  }
});
