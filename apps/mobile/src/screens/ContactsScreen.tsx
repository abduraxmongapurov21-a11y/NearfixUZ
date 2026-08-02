import { useState } from 'react';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../auth/api';
import { Avatar } from '../components/Avatar';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/AppStore';
import type { UserIdentity } from '../types';
import { identityInitials, identityTitle } from '../utils/identity';

type ContactsContentProps = {
  onBack?: () => void;
  onOpenConversation: (conversationId: string) => void;
};

type ContactsTabProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Contacts'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

type ContactSelectionProps = NativeStackScreenProps<RootStackParamList, 'ContactSelection'>;

export function ContactsTabScreen({ navigation }: ContactsTabProps) {
  return <ContactsContent onOpenConversation={(conversationId) => navigation.navigate('Conversation', { conversationId })} />;
}

export function ContactSelectionScreen({ navigation }: ContactSelectionProps) {
  return (
    <ContactsContent
      onBack={() => navigation.goBack()}
      onOpenConversation={(conversationId) => navigation.replace('Conversation', { conversationId })}
    />
  );
}

function ContactsContent({ onBack, onOpenConversation }: ContactsContentProps) {
  const { createDirectConversation, discoverUsers } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserIdentity[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await discoverUsers(normalized));
      setSearched(true);
    } catch {
      setError('Foydalanuvchilarni qidirib bo‘lmadi.');
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function openUser(user: UserIdentity) {
    if (openingUserId) return;
    setOpeningUserId(user.id);
    try {
      onOpenConversation(await createDirectConversation(user));
    } catch (openError) {
      Alert.alert(
        'Suhbatni ochib bo‘lmadi',
        openError instanceof ApiError ? openError.message : 'Server bilan bog‘lanishda xatolik yuz berdi.',
      );
    } finally {
      setOpeningUserId(null);
    }
  }

  const emptyState = loading
    ? null
    : error
      ? { title: error, action: 'Qayta urinish' }
      : searched
        ? { title: 'Foydalanuvchi topilmadi', action: null }
        : { title: 'Telefon raqami, ism yoki username bo‘yicha qidiring', action: null };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹ Chatlar</Text></Pressable>
          ) : <View style={styles.headerSide} />}
          <Text style={styles.title}>Foydalanuvchilar</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setSearched(false);
                setError(null);
                setResults([]);
              }}
              onSubmitEditing={() => void search()}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Telefon, ism yoki @username"
              placeholderTextColor="#98A2B3"
              returnKeyType="search"
              style={styles.search}
            />
          </View>
          <Pressable
            disabled={query.trim().length < 2 || loading}
            onPress={() => void search()}
            style={[styles.searchButton, (query.trim().length < 2 || loading) && styles.searchButtonDisabled]}
          >
            <Text style={styles.searchButtonText}>Qidirish</Text>
          </Pressable>
        </View>

        <FlatList
          data={results}
          keyExtractor={(user) => user.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={results.length === 0 && styles.emptyList}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color="#1677FF" />
            ) : emptyState ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                {emptyState.action ? (
                  <Pressable onPress={() => void search()}><Text style={styles.retry}>{emptyState.action}</Text></Pressable>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              disabled={openingUserId !== null}
              onPress={() => void openUser(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar initials={identityInitials(item)} color="#667085" url={item.avatarUrl} />
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={styles.name}>{identityTitle(item)}</Text>
                <Text numberOfLines={1} style={styles.detail}>
                  {openingUserId === item.id ? 'Suhbat ochilmoqda…' : item.username ? `@${item.username} · ${item.phoneNumber}` : item.phoneNumber}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', height: 58, paddingHorizontal: 16 },
  headerSide: { width: 68 },
  back: { color: '#1677FF', fontSize: 15, width: 68 },
  title: { color: '#101828', flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8, paddingHorizontal: 16 },
  searchWrap: { alignItems: 'center', backgroundColor: '#F2F4F7', borderRadius: 12, flex: 1, flexDirection: 'row', height: 42, paddingHorizontal: 12 },
  searchIcon: { color: '#667085', fontSize: 22, marginRight: 8 },
  search: { color: '#101828', flex: 1, fontSize: 15, padding: 0 },
  searchButton: { backgroundColor: '#1677FF', borderRadius: 10, justifyContent: 'center', minHeight: 42, paddingHorizontal: 12 },
  searchButtonDisabled: { opacity: 0.45 },
  searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 70, paddingHorizontal: 16, paddingVertical: 9 },
  pressed: { backgroundColor: '#F9FAFB' },
  rowBody: { borderBottomColor: '#EAECF0', borderBottomWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', marginLeft: 12, minHeight: 52 },
  name: { color: '#101828', fontSize: 16, fontWeight: '600' },
  detail: { color: '#667085', fontSize: 13, marginTop: 4 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#667085', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { color: '#1677FF', fontSize: 14, fontWeight: '700', marginTop: 10 },
});
