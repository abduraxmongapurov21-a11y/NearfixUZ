import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { MoreVertical, Search } from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";
import { fetchChatRoomsApi } from "../../services/chats/chatService";
import { Text, TextInput } from "../../i18n/native";

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
  const otherParticipant = room.participants?.find((participant) => participant.userId !== currentUserId);
  const otherUser = otherParticipant?.user;
  const palette = avatarPalette[index % avatarPalette.length];
  const title = otherUser?.name || otherUser?.phone || room.title || "NearFIX chat";

  return {
    ...room,
    title,
    subtitle: room.subtitle || room.serviceType || "Buyurtma suhbati",
    time: room.time || "hozir",
    avatarBg: palette.avatarBg,
    avatarColor: palette.avatarColor,
    online: Boolean(room.online),
    unread: room.unread || 0
  };
}

function uniqueRoomsByCounterpart(rooms, currentUserId) {
  const seen = new Set();

  return rooms.filter((room) => {
    const otherParticipant = room.participants?.find((participant) => participant.userId !== currentUserId);
    const key = otherParticipant?.userId || room.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ChatScreen({ navigation }) {
  const session = useAuthStore((state) => state.session);
  const [apiRooms, setApiRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function loadRooms() {
    if (!session?.token) {
      return;
    }

    const result = await fetchChatRoomsApi(session.token, undefined, session.userId);
    if (result.ok) {
      const privateRooms = result.rooms.filter((room) => ["direct", "order"].includes(room.type));
      setApiRooms(
        uniqueRoomsByCounterpart(privateRooms, session.userId).map((room, index) =>
          resolvePrivateRoom(room, session.userId, index)
        )
      );
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadMountedRooms() {
      if (!session?.token) {
        return;
      }

      const result = await fetchChatRoomsApi(session.token, undefined, session.userId);
      if (mounted && result.ok) {
        const privateRooms = result.rooms.filter((room) => ["direct", "order"].includes(room.type));
        setApiRooms(
          uniqueRoomsByCounterpart(privateRooms, session.userId).map((room, index) =>
            resolvePrivateRoom(room, session.userId, index)
          )
        );
      }
    }

    loadMountedRooms();

    return () => {
      mounted = false;
    };
  }, [session?.token, session?.userId]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadRooms();
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
    () => visibleRooms.reduce((sum, room) => sum + (Number(room.unread) || 0), 0),
    [visibleRooms]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.contentHeader}>
        <View>
          <Text style={styles.title}>Xabarlar</Text>
          <Text style={styles.subtitle}>{unreadCount} ta o'qilmagan suhbat</Text>
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

function ChatRow({ room, index, onPress }) {
  const palette = avatarPalette[index % avatarPalette.length];
  const avatarBg = room.avatarBg || palette.avatarBg;
  const avatarColor = room.avatarColor || palette.avatarColor;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chatCard, pressed && styles.pressed]}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={[styles.avatarText, { color: avatarColor }]}>{getInitials(room.title)}</Text>
        {room.online ? <View style={styles.onlineDot} /> : null}
      </View>
      <View style={styles.roomBody}>
        <View style={styles.roomTop}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          <Text style={styles.roomTime}>{room.time}</Text>
        </View>
        <View style={styles.roomBottom}>
          <Text style={styles.roomSubtitle} numberOfLines={1}>
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
