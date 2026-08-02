import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Camera,
  ClipboardList,
  Home,
  Image as ImageIcon,
  Info,
  MessageCircle,
  Plus,
  Send,
  UserRound
} from "lucide-react-native";
import { ROUTES } from "../../constants/routes";
import { fetchChatMessagesApi, markChatRoomReadApi, sendChatMessageApi } from "../../services/chats/chatService";
import { uploadMediaApi } from "../../services/media/mediaService";
import { useAuthStore } from "../../store/authStore";
import { ReportModal } from "../../components/moderation/ReportModal";
import { blockUserApi } from "../../services/moderation/moderationService";
import { Alert, Text, TextInput } from "../../i18n/native";

const font = {
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold"
};

const initialMessages = [];
const MIN_MESSAGE_INPUT_HEIGHT = 24;
const MAX_MESSAGE_INPUT_HEIGHT = 96;
const MESSAGE_INPUT_VERTICAL_PADDING = 10;
const MESSAGE_INPUT_LINE_HEIGHT = 20;
const APPROX_MESSAGE_CHAR_WIDTH = 7.4;

function estimateInputLines(text, textWidth) {
  if (!text) return 1;

  const charsPerLine = Math.max(12, Math.floor((textWidth || 220) / APPROX_MESSAGE_CHAR_WIDTH));
  return String(text)
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function inputHeightForLines(lines) {
  return Math.min(MAX_MESSAGE_INPUT_HEIGHT, Math.max(MIN_MESSAGE_INPUT_HEIGHT, lines * MESSAGE_INPUT_LINE_HEIGHT));
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "Hozir";
}

function mapApiMessageToThread(message) {
  return {
    id: message.id,
    direction: message.outgoing ? "out" : "in",
    senderName: message.senderName,
    time: formatTime(message.createdAt),
    type: message.type === "image" ? "image" : "text",
    body: message.body,
    media: message.media?.url ? { uri: message.media.url } : null,
    readByOthers: Boolean(message.readByOthers)
  };
}

async function optimizeImage(asset) {
  const extension = asset.fileName?.split(".").pop() || asset.uri?.split(".").pop()?.split("?")[0] || "jpg";
  return {
    uri: asset.uri,
    name: asset.fileName || `nearfix-chat-${Date.now()}.${extension}`,
    mimeType: asset.mimeType || "image/jpeg"
  };
}

function waitForAttachmentSheetToClose() {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === "ios" ? 220 : 80);
    });
  });
}

export function ChatThreadScreen({ navigation, route }) {
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const room = route.params?.room || {
    title: "Chat",
    participants: 0,
    color: "#17B9AD"
  };
  const isApiRoom = Boolean(room.id && session?.token);
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(MIN_MESSAGE_INPUT_HEIGHT);
  const [inputTextWidth, setInputTextWidth] = useState(220);
  const [reportTarget, setReportTarget] = useState(null);

  const currentUserId = session?.userId;
  const counterpartUserId = room.participants?.find((participant) => participant.userId !== currentUserId)?.userId;

  useEffect(() => {
    let mounted = true;

    async function loadMessages() {
      if (!isApiRoom) return;

      const result = await fetchChatMessagesApi(session.token, room.id, currentUserId);
      if (mounted && result.ok) {
        setMessages(result.messages.map(mapApiMessageToThread));
        await markChatRoomReadApi(session.token, room.id);
      }
    }

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [currentUserId, isApiRoom, room.id, session?.token]);

  async function handleRefresh() {
    setRefreshing(true);

    if (isApiRoom) {
      const result = await fetchChatMessagesApi(session.token, room.id, currentUserId);
      if (result.ok) {
        setMessages(result.messages.map(mapApiMessageToThread));
        await markChatRoomReadApi(session.token, room.id);
      }
    }

    setRefreshing(false);
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates?.height || 0;
      setKeyboardHeight(Math.max(0, height - insets.bottom));
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  const canSendText = useMemo(() => Boolean(inputText.trim()) && !uploading, [inputText, uploading]);
  const inputBoxHeight = inputHeight + MESSAGE_INPUT_VERTICAL_PADDING * 2;
  const estimatedInputLines = useMemo(() => estimateInputLines(inputText, inputTextWidth), [inputText, inputTextWidth]);

  function updateInputHeight(nextText, measuredHeight) {
    const estimatedHeight = inputHeightForLines(estimateInputLines(nextText, inputTextWidth));
    const contentHeight = measuredHeight
      ? Math.min(MAX_MESSAGE_INPUT_HEIGHT, Math.max(MIN_MESSAGE_INPUT_HEIGHT, measuredHeight))
      : MIN_MESSAGE_INPUT_HEIGHT;
    const nextHeight = Math.max(estimatedHeight, contentHeight);

    setInputHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight));
  }

  function handleInputTextChange(nextText) {
    setInputText(nextText);
    updateInputHeight(nextText);
  }

  function handleInputBoxLayout(event) {
    const nextWidth = Math.max(120, event.nativeEvent.layout.width - 25);
    setInputTextWidth((current) => (Math.abs(current - nextWidth) < 1 ? current : nextWidth));
    if (inputText) {
      const nextHeight = inputHeightForLines(estimateInputLines(inputText, nextWidth));
      setInputHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight));
    }
  }

  function handleInputContentSizeChange(event) {
    const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height);
    updateInputHeight(inputText, measuredHeight);
  }

  function openAttachmentSheet() {
    Keyboard.dismiss();
    setSheetVisible(true);
  }

  async function sendTextMessage() {
    const body = inputText.trim();
    if (!body) return;

    setInputText("");
    setInputHeight(MIN_MESSAGE_INPUT_HEIGHT);

    if (!isApiRoom) {
      Alert.alert("Chat mavjud emas", "Xabar yuborish uchun haqiqiy chat ochilishi kerak.");
      return;
    }

    const pendingId = `pending-text-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        direction: "out",
        time: "Hozir",
        type: "text",
        body,
        status: "sending"
      }
    ]);

    const result = await sendChatMessageApi(session.token, room.id, { type: "TEXT", body }, currentUserId);
    setMessages((current) =>
      current.map((message) =>
        message.id === pendingId
          ? result.ok
            ? mapApiMessageToThread({ ...result.message, outgoing: true })
            : { ...message, status: "failed" }
          : message
      )
    );
  }

  async function ensureGalleryPermission() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Ruxsat kerak", "Rasm tanlash uchun galereyaga ruxsat bering.");
      return false;
    }
    return true;
  }

  async function ensureCameraPermission() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Ruxsat kerak", "Rasmga olish uchun kameraga ruxsat bering.");
      return false;
    }
    return true;
  }

  async function pickImage(source) {
    Keyboard.dismiss();
    setSheetVisible(false);

    try {
      await waitForAttachmentSheetToClose();

      const hasPermission = source === "camera" ? await ensureCameraPermission() : await ensureGalleryPermission();
      if (!hasPermission) return;

      const pickerResult =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: "images",
              quality: 0.62,
              allowsEditing: false,
              presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: "images",
              quality: 0.62,
              allowsEditing: false,
              presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
            });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      await sendImageMessage(pickerResult.assets[0]);
    } catch (error) {
      Alert.alert(
        source === "camera" ? "Kamera ochilmadi" : "Galereya ochilmadi",
        error?.message || "Rasm tanlash oynasini ochishda xatolik yuz berdi."
      );
    }
  }

  async function sendImageMessage(asset) {
    if (!isApiRoom) {
      Alert.alert("Chat mavjud emas", "Rasm yuborish uchun haqiqiy chat ochilishi kerak.");
      return;
    }

    const pendingId = `pending-image-${Date.now()}`;
    setUploading(true);

    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        direction: "out",
        time: "Hozir",
        type: "image",
        media: { uri: asset.uri },
        status: "sending"
      }
    ]);

    try {
      const optimized = await optimizeImage(asset);

      const uploadResult = await uploadMediaApi(
        session.token,
        optimized,
        room.orderId
          ? {
              orderId: room.orderId,
              scope: "CHAT"
            }
          : {
              roomId: room.id,
              scope: "CHAT"
            }
      );

      if (!uploadResult.ok) throw new Error(uploadResult.message || "Rasm yuklanmadi");

      const messageResult = await sendChatMessageApi(
        session.token,
        room.id,
        {
          type: "IMAGE",
          mediaId: uploadResult.media.id
        },
        currentUserId
      );

      if (!messageResult.ok) throw new Error(messageResult.message || "Rasmli xabar yuborilmadi");

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId ? mapApiMessageToThread({ ...messageResult.message, outgoing: true }) : message
        )
      );
    } catch (error) {
      Alert.alert(
        "Rasm yuborilmadi",
        error?.message || "Internet yoki server holatini tekshirib, qayta urinib ko'ring."
      );
      setMessages((current) =>
        current.map((message) => (message.id === pendingId ? { ...message, status: "failed" } : message))
      );
    } finally {
      setUploading(false);
    }
  }

  function openChatSafetyActions() {
    if (!counterpartUserId) return;
    Alert.alert("Chat xavfsizligi", "Kerakli amalni tanlang.", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Foydalanuvchi haqida shikoyat",
        onPress: () =>
          setReportTarget({ targetType: "USER", targetId: counterpartUserId, title: "Foydalanuvchi haqida shikoyat" })
      },
      {
        text: "Foydalanuvchini bloklash",
        style: "destructive",
        onPress: async () => {
          const result = await blockUserApi(session?.token, counterpartUserId);
          Alert.alert(
            result.ok ? "Foydalanuvchi bloklandi" : "Bloklab bo‘lmadi",
            result.ok ? "Yangi chat ochish cheklanadi." : result.message || "Qayta urinib ko‘ring."
          );
        }
      }
    ]);
  }

  const keyboardBottomInset = Platform.OS === "ios" && keyboardVisible ? keyboardHeight : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <ArrowLeft size={21} color="#273248" strokeWidth={2.8} />
        </Pressable>
        <View style={[styles.roomIcon, { backgroundColor: room.color || "#17B9AD" }]}>
          <UserRound size={20} color="#FFFFFF" strokeWidth={2.3} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {room.title}
          </Text>
          <Text style={styles.subtitle}>Buyurtma chati</Text>
        </View>
        <Pressable style={styles.infoButton} onPress={openChatSafetyActions}>
          <Info size={18} color="#FFFFFF" strokeWidth={3} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={[styles.chatArea, keyboardBottomInset ? { paddingBottom: keyboardBottomInset } : null]}
        behavior={Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={scrollRef}
          style={styles.messageList}
          data={messages}
          keyExtractor={(message) => String(message.id)}
          renderItem={({ item }) =>
            item.direction === "out" ? (
              <OutgoingMessage message={item} onOpenImage={setSelectedImage} />
            ) : (
              <IncomingMessage
                message={item}
                onOpenImage={setSelectedImage}
                onReport={() =>
                  setReportTarget({ targetType: "MESSAGE", targetId: item.id, title: "Xabar haqida shikoyat" })
                }
              />
            )
          }
          ListHeaderComponent={
            <>
              <View style={styles.datePill}>
                <Text style={styles.dateText}>Bugun</Text>
              </View>

              {messages.length ? null : (
                <View style={styles.emptyMessages}>
                  <Text style={styles.emptyTitle}>Hali xabar yo'q</Text>
                  <Text style={styles.emptyText}>Birinchi xabarni yozing yoki rasm yuboring.</Text>
                </View>
              )}
            </>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messages}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0F80B7"
              colors={["#0F80B7"]}
            />
          }
        />

        <View style={styles.inputPanel}>
          <Pressable style={styles.plusButton} onPress={openAttachmentSheet} disabled={uploading}>
            <Plus size={24} color="#0F80B7" strokeWidth={2.7} />
          </Pressable>
          <View style={[styles.inputBox, { height: inputBoxHeight }]} onLayout={handleInputBoxLayout}>
            <TextInput
              value={inputText}
              onChangeText={handleInputTextChange}
              onContentSizeChange={handleInputContentSizeChange}
              placeholder="Xabar yozing..."
              placeholderTextColor="#A0A7B3"
              multiline
              blurOnSubmit={false}
              submitBehavior="newline"
              returnKeyType="default"
              keyboardType="default"
              autoCapitalize="sentences"
              autoCorrect
              scrollEnabled={estimatedInputLines > 4}
              numberOfLines={4}
              textAlignVertical="top"
              style={[styles.input, { height: inputHeight }]}
            />
          </View>
          <Pressable
            style={[styles.sendButton, !canSendText && styles.sendButtonDisabled]}
            onPress={sendTextMessage}
            disabled={!canSendText}
          >
            {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Send size={18} color="#FFFFFF" strokeWidth={2.7} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AttachmentSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onPickImage={() => pickImage("library")}
        onTakePhoto={() => pickImage("camera")}
      />

      <ImageViewer image={selectedImage} onClose={() => setSelectedImage(null)} />
      <ReportModal
        visible={Boolean(reportTarget)}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        title={reportTarget?.title}
        onClose={() => setReportTarget(null)}
        onSuccess={() => Alert.alert("Shikoyat yuborildi", "Moderatorlar murojaatingizni ko‘rib chiqadi.")}
      />

      {keyboardVisible ? null : <ScreenBottomNav navigation={navigation} role={session?.role} />}
    </View>
  );
}

function IncomingMessage({ message, onOpenImage, onReport }) {
  return (
    <Pressable style={styles.incomingRow} onLongPress={onReport} delayLongPress={450}>
      <View style={styles.avatar}>
        <UserRound size={16} color="#0F80B7" strokeWidth={2.4} />
      </View>
      <View style={styles.incomingBody}>
        <View style={styles.messageMeta}>
          <Text style={styles.senderName}>{message.senderName || "NearFIX"}</Text>
          <Text style={styles.messageTime}>{message.time}</Text>
        </View>
        <View style={styles.incomingBubble}>
          {message.body ? <Text style={styles.incomingText}>{message.body}</Text> : null}
          {message.type === "image" ? <ImageMessage message={message} onOpenImage={onOpenImage} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function OutgoingMessage({ message, onOpenImage }) {
  return (
    <View style={styles.outgoingWrap}>
      <Text style={styles.outgoingTime}>{message.status === "sending" ? "Yuborilmoqda..." : message.time}</Text>
      <View style={[styles.outgoingBubble, message.type === "image" && styles.outgoingImageBubble]}>
        {message.body ? <Text style={styles.outgoingText}>{message.body}</Text> : null}
        {message.type === "image" ? <ImageMessage message={message} outgoing onOpenImage={onOpenImage} /> : null}
        {message.status !== "failed" ? (
          <Text style={styles.readReceipt}>{message.readByOthers ? "✓✓" : "✓"}</Text>
        ) : null}
        {message.status === "failed" ? <Text style={styles.failedText}>Yuborilmadi</Text> : null}
      </View>
    </View>
  );
}

function ImageMessage({ message, outgoing, onOpenImage }) {
  const source = message.media?.uri ? message.media : null;
  if (!source) return null;

  return (
    <Pressable
      style={[styles.previewWrap, outgoing && styles.previewWrapOutgoing]}
      onPress={() => onOpenImage?.(source)}
    >
      <Image source={source} style={styles.previewImage} />
      {message.status === "sending" ? (
        <View style={styles.imageLoading}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

function ImageViewer({ image, onClose }) {
  return (
    <Modal visible={Boolean(image)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <Pressable style={styles.viewerClose} onPress={onClose}>
          <Text style={styles.viewerCloseText}>Yopish</Text>
        </Pressable>
        {image ? <Image source={image} style={styles.viewerImage} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

function AttachmentSheet({ visible, onClose, onPickImage, onTakePhoto }) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Pressable style={styles.sheetItem} onPress={onPickImage}>
            <View style={[styles.sheetIcon, styles.sheetIconPurple]}>
              <ImageIcon size={23} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.sheetTitle}>Rasm tanlash</Text>
              <Text style={styles.sheetText}>Galereyadan rasm tanlang</Text>
            </View>
          </Pressable>
          <View style={styles.sheetDivider} />
          <Pressable style={styles.sheetItem} onPress={onTakePhoto}>
            <View style={[styles.sheetIcon, styles.sheetIconGreen]}>
              <Camera size={20} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.sheetTitle}>Rasmga olish</Text>
              <Text style={styles.sheetText}>Kamera orqali surat oling</Text>
            </View>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Bekor qilish</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ScreenBottomNav({ navigation, role }) {
  function goTab(screen) {
    navigation.navigate(role === "provider" ? ROUTES.WORKER_TABS : ROUTES.CLIENT_TABS, { screen });
  }

  if (role === "provider") {
    return (
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.WORKER_DASHBOARD_TAB)}>
          <Home size={24} color="#A0A7B3" />
          <Text style={styles.navLabel}>Dashboard</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.WORKER_JOBS_TAB)}>
          <ClipboardList size={24} color="#A0A7B3" />
          <Text style={styles.navLabel}>Ishlar</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.WORKER_CHATS_TAB)}>
          <View>
            <MessageCircle size={24} color="#0F80B7" />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Chatlar</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.WORKER_PROFILE_TAB)}>
          <UserRound size={24} color="#A0A7B3" />
          <Text style={styles.navLabel}>Profil</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bottomNav}>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.HOME_TAB)}>
        <Home size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Katalog</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.ORDERS_TAB)}>
        <ClipboardList size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Buyurtmalar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.CHATS_TAB)}>
        <View>
          <MessageCircle size={24} color="#0F80B7" />
        </View>
        <Text style={[styles.navLabel, styles.navLabelActive]}>Chatlar</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => goTab(ROUTES.PROFILE_TAB)}>
        <UserRound size={24} color="#A0A7B3" />
        <Text style={styles.navLabel}>Profil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  header: {
    height: 92,
    paddingTop: 28,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F4"
  },
  headerIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  roomIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6
  },
  headerText: {
    flex: 1,
    marginLeft: 10
  },
  title: {
    color: "#273248",
    fontSize: 17,
    lineHeight: 21,
    fontFamily: font.extra
  },
  subtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.semi
  },
  infoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  messages: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 16
  },
  chatArea: {
    flex: 1
  },
  messageList: {
    flex: 1
  },
  datePill: {
    alignSelf: "center",
    height: 28,
    borderRadius: 13,
    backgroundColor: "#E4EAF2",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  },
  dateText: {
    color: "#6B7280",
    fontSize: 12,
    fontFamily: font.medium
  },
  incomingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E6F4F8",
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyMessages: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 22
  },
  emptyTitle: {
    color: "#273248",
    fontSize: 15,
    fontFamily: font.extra
  },
  emptyText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: font.medium
  },
  incomingBody: {
    flex: 1,
    marginLeft: 9
  },
  messageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 5
  },
  senderName: {
    color: "#273248",
    fontSize: 13,
    fontFamily: font.extra
  },
  messageTime: {
    color: "#A0A7B3",
    fontSize: 11,
    fontFamily: font.medium
  },
  incomingBubble: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    borderRadius: 16,
    borderTopLeftRadius: 6,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  incomingText: {
    color: "#273248",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.medium
  },
  outgoingWrap: {
    alignItems: "flex-end",
    marginBottom: 16
  },
  outgoingTime: {
    marginRight: 2,
    marginBottom: 5,
    color: "#A0A7B3",
    fontSize: 11,
    fontFamily: font.medium
  },
  outgoingBubble: {
    maxWidth: "78%",
    borderRadius: 16,
    borderBottomRightRadius: 5,
    backgroundColor: "#0F80B7",
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  outgoingImageBubble: {
    padding: 5,
    backgroundColor: "#DCEAF5"
  },
  outgoingText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.medium
  },
  failedText: {
    marginTop: 6,
    color: "#D92D20",
    fontSize: 12,
    fontFamily: font.bold
  },
  readReceipt: {
    alignSelf: "flex-end",
    marginTop: 3,
    color: "rgba(255,255,255,0.86)",
    fontSize: 11,
    fontFamily: font.bold
  },
  previewWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCE6EF",
    backgroundColor: "#DCE6EF"
  },
  previewWrapOutgoing: {
    marginTop: 0,
    borderWidth: 0
  },
  previewImage: {
    width: 176,
    height: 120,
    resizeMode: "cover"
  },
  imageLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 128, 183, 0.35)"
  },
  viewer: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    alignItems: "center",
    justifyContent: "center"
  },
  viewerImage: {
    width: "100%",
    height: "82%"
  },
  viewerClose: {
    position: "absolute",
    top: 52,
    right: 22,
    zIndex: 2,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13
  },
  viewerCloseText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: font.bold
  },
  inputPanel: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#EEF1F4"
  },
  plusButton: {
    width: 34,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 116,
    borderRadius: 18,
    backgroundColor: "#F6F8FB",
    alignItems: "stretch",
    justifyContent: "center",
    paddingLeft: 13,
    paddingRight: 12,
    paddingVertical: MESSAGE_INPUT_VERTICAL_PADDING
  },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 24,
    maxHeight: MAX_MESSAGE_INPUT_HEIGHT,
    color: "#273248",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
    fontFamily: font.medium
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F80B7",
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    opacity: 0.65
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(39,50,72,0.34)"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    marginHorizontal: 16,
    marginBottom: 22,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  sheetItem: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetIconPurple: {
    backgroundColor: "#7C3AED"
  },
  sheetIconGreen: {
    backgroundColor: "#2CCB7F"
  },
  sheetTitle: {
    color: "#273248",
    fontSize: 14,
    fontFamily: font.bold
  },
  sheetText: {
    marginTop: 4,
    color: "#7C8594",
    fontSize: 12,
    fontFamily: font.medium
  },
  sheetDivider: {
    height: 1,
    marginLeft: 66,
    backgroundColor: "#EEF1F4"
  },
  cancelButton: {
    height: 50,
    borderTopWidth: 8,
    borderTopColor: "#F3F5F8",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: "#0F80B7",
    fontSize: 14,
    fontFamily: font.bold
  },
  bottomNav: {
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
