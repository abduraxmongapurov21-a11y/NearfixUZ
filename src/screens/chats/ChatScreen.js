import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArrowRight, MessageCircle, MoreVertical, Phone, RefreshCw, Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";
import { useChatRefresh } from "../../hooks/useChatRefresh";
import { refreshChatRooms, useChatStore } from "../../store/chatStore";
import { chatUnreadCount } from "../../services/chats/chatSync.mjs";
import { Alert, Text, TextInput } from "../../i18n/native";
import { normalizeExperienceMode } from "../../navigation/experienceMode.mjs";
import { normalizeWorkerPhone } from "../../utils/workerPhone.mjs";
import { ClientHeader } from "../../components/client/ClientHeader";
import { GlassSurface } from "../../components/client/GlassSurface";
import { colors as clientColors, font as clientFont, CLIENT_CONTENT_BOTTOM, shadow as clientShadow } from "../../theme/clientTheme";

const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const avatarPalette = [
  { avatarBg: "#D5F9DF", avatarColor: "#159A50" },
  { avatarBg: "#DDEBFF", avatarColor: "#2868D8" },
  { avatarBg: "#FFF0B8", avatarColor: "#D98300" },
  { avatarBg: "#EFE0FF", avatarColor: "#7C3DFF" },
  { avatarBg: "#1F1E42", avatarColor: "#FFFFFF" }
];

function resolvePrivateRoom(room, currentUserId, index) {
  const otherParticipant = currentUserId
    ? room.participants?.find((participant) => participant.userId !== currentUserId)
    : null;
  const otherUser = otherParticipant?.user;
  const palette = avatarPalette[index % avatarPalette.length];
  const title = otherUser?.name || otherUser?.phone || room.title || "NearFIX chat";

  return {
    ...room,
    title,
    phone: normalizeWorkerPhone(otherUser?.phone),
    subtitle: room.subtitle || room.serviceType || (room.orderId ? "Buyurtma suhbati" : "Shaxsiy chat"),
    time: room.time || "hozir",
    avatarBg: palette.avatarBg,
    avatarColor: palette.avatarColor,
    online: Boolean(room.online),
    unread: room.unread || 0
  };
}

export function ChatScreen({ navigation, route }) {
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const isClient = normalizeExperienceMode(session?.role, session?.experienceMode) === "client";
  const rooms = useChatStore((state) => state.rooms);
  const apiRooms = useMemo(() => rooms.map((room, index) => resolvePrivateRoom(room, session?.userId, index)), [rooms, session?.userId]);
  const refreshRooms = useChatRefresh(refreshChatRooms);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const openedRoomId = useRef(null);

  useEffect(() => {
    const targetRoomId = route?.params?.roomId;
    if (!targetRoomId) { openedRoomId.current = null; return; }
    if (openedRoomId.current === targetRoomId) return;
    const targetRoom = apiRooms.find((room) => room.id === targetRoomId);
    if (!targetRoom) return;
    openedRoomId.current = targetRoomId;
    navigation.setParams({ roomId: undefined });
    navigation.navigate(ROUTES.CHAT_THREAD, { room: targetRoom });
  }, [apiRooms, navigation, route?.params?.roomId]);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshRooms();
    setRefreshing(false);
  }

  function openThread(room) {
    navigation.navigate(ROUTES.CHAT_THREAD, { room });
  }

  const visibleRooms = apiRooms;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRooms = normalizedQuery
    ? visibleRooms.filter((room) => room.title?.toLowerCase().includes(normalizedQuery))
    : visibleRooms;
  const unreadCount = useMemo(
    () => chatUnreadCount(visibleRooms),
    [visibleRooms]
  );

  if (isClient) {
    return (
      <View style={clientStyles.screen}>
        <ClientHeader
          title="Xabarlar"
          subtitle={unreadCount ? t("{{value0}} ta o'qilmagan xabar", { value0: unreadCount, count: unreadCount }) : "Usta bilan barcha suhbatlar bir joyda"}
          right={
            <GlassSurface style={clientStyles.headerAction}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Suhbatlarni yangilash")}
                onPress={handleRefresh}
                disabled={refreshing}
                style={({ pressed }) => [clientStyles.iconButton, pressed && clientStyles.pressed]}
              >
                <RefreshCw size={20} color={clientColors.primary} strokeWidth={1.8} />
              </Pressable>
            </GlassSurface>
          }
        />
        <View style={clientStyles.searchWrap}>
          <View style={clientStyles.searchBox}>
            <Search size={20} color={clientColors.muted} strokeWidth={1.8} />
            <TextInput
              accessibilityLabel="Suhbatlarni qidirish"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Suhbatlarni qidirish..."
              placeholderTextColor={clientColors.subtle}
              returnKeyType="search"
              style={clientStyles.searchInput}
            />
            {searchQuery ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("Qidiruvni tozalash")} onPress={() => setSearchQuery("")} style={clientStyles.clearButton}>
                <X size={18} color={clientColors.muted} strokeWidth={1.8} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={clientStyles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={clientColors.primary} colors={[clientColors.primary]} />}
        >
          {filteredRooms.length ? filteredRooms.map((room) => (
            <ClientChatRow key={room.id} room={room} onPress={() => openThread(room)} />
          )) : (
            <GlassSurface style={clientStyles.emptyState}>
              <View style={clientStyles.emptyIcon}><MessageCircle size={29} color={clientColors.primary} strokeWidth={1.6} /></View>
              <Text style={clientStyles.emptyTitle}>{normalizedQuery ? "Suhbat topilmadi" : "Suhbatlar hali yo'q"}</Text>
              <Text style={clientStyles.emptyText}>{normalizedQuery ? "Boshqa nom bilan qidirib ko'ring." : "Ustani tanlang va xizmat tafsilotlarini chatda kelishib oling."}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => normalizedQuery ? setSearchQuery("") : navigation.navigate(ROUTES.HOME_TAB)}
                style={({ pressed }) => [clientStyles.emptyButton, pressed && clientStyles.pressed]}
              >
                <Text style={clientStyles.emptyButtonText}>{normalizedQuery ? "Qidiruvni tozalash" : "Usta topish"}</Text>
                <ArrowRight size={18} color={clientColors.white} strokeWidth={1.8} />
              </Pressable>
            </GlassSurface>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentHeader}>
        <View>
          <Text style={styles.title}>Xabarlar</Text>
          <Text translate={false} style={styles.subtitle}>{t("{{value0}} ta o'qilmagan xabar", { value0: unreadCount, count: unreadCount })}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
          <MoreVertical size={20} color="#1F385E" strokeWidth={2.3} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={17} color="#8EA1BA" strokeWidth={2.4} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Suhbatlarni qidirish..."
          placeholderTextColor="#8EA1BA"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1F1E42" colors={["#1F1E42"]} />
        }
      >
        {filteredRooms.length ? (
          filteredRooms.map((room, index) => (
            <ChatRow key={room.id} room={room} index={index} onPress={() => openThread(room)} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Suhbat topilmadi</Text>
            <Text style={styles.emptyText}>Boshqa nom bilan qidirib ko'ring.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ClientChatRow({ room, onPress }) {
  const { t } = useTranslation();

  async function callWorker() {
    if (!room.phone) return;
    try {
      await Linking.openURL(`tel:${room.phone}`);
    } catch {
      Alert.alert("Xatolik", "Telefon ilovasini ochib bo'lmadi.");
    }
  }

  return (
    <View style={clientStyles.chatCard}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [clientStyles.chatContent, pressed && clientStyles.pressed]}>
        <View style={clientStyles.avatar}>
          <Text translate={false} style={clientStyles.avatarText}>{getInitials(room.title)}</Text>
          {room.online ? <View style={clientStyles.onlineDot} /> : null}
        </View>
        <View style={clientStyles.roomBody}>
          <View style={clientStyles.roomTop}>
            <Text translate={false} style={clientStyles.roomTitle} numberOfLines={1}>{room.title}</Text>
            <Text style={clientStyles.roomTime}>{room.time}</Text>
          </View>
          {room.orderId ? <Text style={clientStyles.orderLabel} numberOfLines={1}>Buyurtma · {room.orderCode || room.orderId.slice(-6)}</Text> : null}
          <View style={clientStyles.roomBottom}>
            <Text translate={!room.lastMessage?.body} style={clientStyles.roomSubtitle} numberOfLines={1}>{room.subtitle}</Text>
            {room.unread ? <View style={clientStyles.unreadBadge}><Text translate={false} style={clientStyles.unreadText}>{room.unread > 99 ? "99+" : room.unread}</Text></View> : null}
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Ustaga qo'ng'iroq qilish: {{name}}", { name: room.title })}
        accessibilityState={{ disabled: !room.phone }}
        disabled={!room.phone}
        onPress={callWorker}
        style={({ pressed }) => [clientStyles.callButton, !room.phone && clientStyles.callDisabled, pressed && clientStyles.pressed]}
      >
        <Phone size={20} color={room.phone ? clientColors.primary : clientColors.subtle} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

function ChatRow({ room, index, onPress }) {
  const palette = avatarPalette[index % avatarPalette.length];
  const avatarBg = room.avatarBg || palette.avatarBg;
  const avatarColor = room.avatarColor || palette.avatarColor;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chatCard, pressed && styles.pressed]}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text translate={false} style={[styles.avatarText, { color: avatarColor }]}>{getInitials(room.title)}</Text>
        {room.online ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.roomBody}>
        <View style={styles.roomTop}>
          <Text translate={false} style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          <Text style={styles.roomTime}>{room.time}</Text>
        </View>
        {room.orderId ? <Text style={styles.roomSubtitle} numberOfLines={1}>Buyurtma · {room.orderCode || room.orderId.slice(-6)}</Text> : null}
        <View style={styles.roomBottom}>
          <Text translate={!room.lastMessage?.body} style={styles.roomSubtitle} numberOfLines={1}>
            {room.subtitle}
          </Text>
          {room.unread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{room.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function getInitials(name) {
  return String(name || "NF")
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
    backgroundColor: "#F6F8FC",
    paddingHorizontal: 20
  },
  contentHeader: {
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#17213D",
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3
  },
  searchBox: {
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#17213D",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 3
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: "#07122B",
    fontSize: 13,
    fontFamily: font.medium,
    paddingVertical: 0
  },
  listContent: {
    paddingTop: 15,
    paddingBottom: 112,
    gap: 10
  },
  chatCard: {
    minHeight: 73,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5EF",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#17213D",
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 13,
    fontFamily: font.extra
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#18A850"
  },
  roomBody: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0
  },
  roomTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  roomTitle: {
    flex: 1,
    color: "#15213A",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.extra
  },
  roomTime: {
    color: "#8EA1BA",
    fontSize: 11,
    fontFamily: font.medium
  },
  roomBottom: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  roomSubtitle: {
    flex: 1,
    color: "#667894",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: font.medium
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF6B1A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: font.extra
  },
  emptyState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: "#07122B",
    fontSize: 15,
    fontFamily: font.extra
  },
  emptyText: {
    marginTop: 6,
    color: "#667894",
    fontSize: 12,
    fontFamily: font.medium
  },
  pressed: {
    opacity: 0.78
  }
});

const clientStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: clientColors.background },
  headerAction: { width: 46, height: 46, borderRadius: 17 },
  iconButton: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: 22 },
  searchBox: { minHeight: 52, borderRadius: 18, backgroundColor: clientColors.white, borderWidth: 1, borderColor: clientColors.border, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, gap: 11 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, color: clientColors.text, fontSize: 15, fontFamily: clientFont.regular },
  clearButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  listContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: CLIENT_CONTENT_BOTTOM, gap: 12 },
  chatCard: { borderRadius: 22, backgroundColor: clientColors.white, borderWidth: 1, borderColor: clientColors.border, ...clientShadow },
  chatContent: { minHeight: 100, padding: 16, borderRadius: 22, flexDirection: "row", alignItems: "center" },
  callButton: { position: "absolute", right: 8, bottom: 8, width: 44, height: 44, borderRadius: 16, backgroundColor: clientColors.primarySoft, alignItems: "center", justifyContent: "center" },
  callDisabled: { opacity: 0.5 },
  avatar: { width: 48, height: 48, borderRadius: 18, backgroundColor: clientColors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: clientColors.primaryDark, fontSize: 16, fontFamily: clientFont.semi },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: clientColors.white, backgroundColor: clientColors.success },
  roomBody: { flex: 1, minWidth: 0, marginLeft: 14 },
  roomTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  roomTitle: { flex: 1, color: clientColors.text, fontSize: 15, lineHeight: 21, fontFamily: clientFont.semi },
  roomTime: { color: clientColors.subtle, fontSize: 11, fontFamily: clientFont.regular },
  orderLabel: { marginTop: 3, paddingRight: 44, color: clientColors.primary, fontSize: 11, lineHeight: 16, fontFamily: clientFont.medium },
  roomBottom: { marginTop: 5, paddingRight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  roomSubtitle: { flex: 1, color: clientColors.muted, fontSize: 13, lineHeight: 19, fontFamily: clientFont.regular },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: clientColors.primary, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  unreadText: { color: clientColors.white, fontSize: 11, fontFamily: clientFont.semi },
  emptyState: { marginTop: 12, borderRadius: 28, alignItems: "center", paddingHorizontal: 24, paddingVertical: 32 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: clientColors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: clientColors.text, fontSize: 20, lineHeight: 27, fontFamily: clientFont.semi, textAlign: "center" },
  emptyText: { marginTop: 8, color: clientColors.muted, fontSize: 14, lineHeight: 22, fontFamily: clientFont.regular, textAlign: "center" },
  emptyButton: { minHeight: 48, marginTop: 22, borderRadius: 16, backgroundColor: clientColors.primary, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  emptyButtonText: { color: clientColors.white, fontSize: 14, fontFamily: clientFont.semi },
  pressed: { opacity: 0.78 }
});
