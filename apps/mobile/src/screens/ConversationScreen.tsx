import { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/AppStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export function ConversationScreen({ navigation, route }: Props) {
  const { conversations, history, loadMessages, loadOlderMessages, messages, retryMessage, sendMessage } = useAppStore();
  const [draft, setDraft] = useState('');
  const conversationId = route.params.conversationId;
  const conversation = conversations.find((item) => item.id === conversationId);
  const conversationMessages = messages[conversationId] ?? [];
  const historyState = history[conversationId];

  useEffect(() => {
    void loadMessages(conversationId, true);
  }, [conversationId, loadMessages]);

  if (!conversation) {
    return (
      <SafeAreaView style={styles.missingScreen}>
        <Text style={styles.missingTitle}>Chat topilmadi</Text>
        <Pressable onPress={() => navigation.goBack()}><Text style={styles.missingBack}>Orqaga qaytish</Text></Pressable>
      </SafeAreaView>
    );
  }

  const identityDetail = conversation.peer.displayName
    ? conversation.peer.phoneNumber
    : conversation.peer.username
      ? `@${conversation.peer.username}`
      : null;

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void sendMessage(conversationId, text);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={14} accessibilityLabel="Orqaga"><Text style={styles.back}>‹</Text></Pressable>
          <Avatar initials={conversation.initials} color={conversation.avatarColor} url={conversation.avatarUrl} size={38} />
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{conversation.title}</Text>
            {identityDetail ? <Text numberOfLines={1} style={styles.status}>{identityDetail}</Text> : null}
          </View>
        </View>

        <FlatList
          data={conversationMessages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.messages, conversationMessages.length === 0 && styles.emptyMessages]}
          ListHeaderComponent={
            historyState?.error || historyState?.nextCursor ? (
              <View>
                {historyState.error ? (
                  <Pressable onPress={() => void loadMessages(conversationId, true)} style={styles.errorBanner}>
                    <Text style={styles.errorText}>{historyState.error} Qayta urinish</Text>
                  </Pressable>
                ) : null}
                {historyState.nextCursor ? (
                  <Pressable disabled={historyState.loading} onPress={() => void loadOlderMessages(conversationId)} style={styles.loadOlder}>
                    {historyState.loading ? <ActivityIndicator color="#1677FF" /> : <Text style={styles.loadOlderText}>Oldingi xabarlar</Text>}
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            historyState?.loading ? (
              <ActivityIndicator color="#1677FF" />
            ) : historyState?.error ? (
              <Pressable onPress={() => void loadMessages(conversationId, true)} style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{historyState.error}</Text>
                <Text style={styles.emptyText}>Qayta urinish</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Yangi suhbat</Text>
                <Text style={styles.emptyText}>Birinchi xabarni yuborib suhbatni boshlang.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <Text style={styles.messageText}>{item.text}</Text>
              <View style={styles.meta}>
                <Text style={styles.messageTime}>{item.time}</Text>
                {item.mine && item.status === 'sending' ? <Text style={styles.sending}> · yuborilmoqda</Text> : null}
                {item.mine && item.status === 'failed' ? (
                  <Pressable onPress={() => void retryMessage(conversationId, item.clientMessageId)}>
                    <Text style={styles.failed}> · yuborilmadi, qayta urinish</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />

        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} placeholder="Xabar" placeholderTextColor="#98A2B3" multiline style={styles.input} />
          <Pressable onPress={send} disabled={!draft.trim()} style={[styles.send, !draft.trim() && styles.sendDisabled]}>
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#EEF3F7', flex: 1 },
  missingScreen: { alignItems: 'center', backgroundColor: '#FFFFFF', flex: 1, justifyContent: 'center' },
  missingTitle: { color: '#101828', fontSize: 20, fontWeight: '700' },
  missingBack: { color: '#1677FF', fontSize: 15, marginTop: 12 },
  header: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#EAECF0', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', height: 58, paddingHorizontal: 12 },
  back: { color: '#1677FF', fontSize: 38, fontWeight: '300', lineHeight: 40, marginRight: 7 },
  heading: { flex: 1, marginLeft: 10 },
  title: { color: '#101828', fontSize: 16, fontWeight: '700' },
  status: { color: '#667085', fontSize: 12, marginTop: 2 },
  errorBanner: { backgroundColor: '#FEF3F2', borderRadius: 10, marginBottom: 10, padding: 10 },
  errorText: { color: '#B42318', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  messages: { padding: 14, paddingTop: 16 },
  emptyMessages: { flexGrow: 1, justifyContent: 'center' },
  emptyCard: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14, maxWidth: 280, paddingHorizontal: 18, paddingVertical: 14 },
  emptyTitle: { color: '#101828', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#667085', fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' },
  loadOlder: { alignItems: 'center', paddingBottom: 14 },
  loadOlderText: { color: '#1677FF', fontSize: 13, fontWeight: '600' },
  bubble: { borderRadius: 16, marginBottom: 8, maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#D9FDD3', borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 5 },
  messageText: { color: '#101828', fontSize: 15, lineHeight: 21 },
  meta: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', marginLeft: 16, marginTop: 3 },
  messageTime: { color: '#667085', fontSize: 10 },
  sending: { color: '#667085', fontSize: 10 },
  failed: { color: '#D92D20', fontSize: 10, fontWeight: '600' },
  composer: { alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderTopColor: '#EAECF0', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 58, paddingHorizontal: 10, paddingVertical: 8 },
  input: { backgroundColor: '#F2F4F7', borderRadius: 20, color: '#101828', flex: 1, fontSize: 15, maxHeight: 100, minHeight: 40, paddingHorizontal: 15, paddingVertical: 9 },
  send: { alignItems: 'center', backgroundColor: '#1677FF', borderRadius: 20, height: 40, justifyContent: 'center', marginLeft: 8, width: 40 },
  sendDisabled: { backgroundColor: '#B2CCFF' },
  sendText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700' },
});
