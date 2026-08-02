import { useMemo, useState } from 'react';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/AppStore';
import type { ConversationKind } from '../types';

type Filter = 'all' | ConversationKind;
type ChatsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Chats'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Barchasi' },
  { id: 'direct', label: 'Shaxsiy' },
];

export function HomeScreen() {
  const navigation = useNavigation<ChatsNavigation>();
  const { conversations, conversationsError, conversationsLoading, refreshConversations } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...conversations]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .filter(
        (item) =>
          (filter === 'all' || item.kind === filter) &&
          (!normalized || item.title.toLocaleLowerCase().includes(normalized) || item.subtitle.toLocaleLowerCase().includes(normalized)),
      );
  }, [conversations, filter, query]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12} accessibilityLabel="Sozlamalar">
          <Text style={styles.headerAction}>⚙</Text>
        </Pressable>
        <Text style={styles.title}>Chatlar</Text>
        <Pressable onPress={() => navigation.navigate('ContactSelection')} hitSlop={12} accessibilityLabel="Yangi chat">
          <Text style={styles.compose}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Qidirish" placeholderTextColor="#98A2B3" style={styles.search} />
      </View>

      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, filter === item.id && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {conversationsError && conversations.length > 0 ? (
        <Pressable onPress={() => void refreshConversations()} style={styles.errorBanner}>
          <Text style={styles.errorText}>{conversationsError} Qayta urinish</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={visibleItems.length === 0 && styles.emptyList}
        ListEmptyComponent={
          conversationsLoading ? (
            <ActivityIndicator color="#1677FF" />
          ) : conversationsError ? (
            <Pressable onPress={() => void refreshConversations()}>
              <Text style={styles.empty}>{conversationsError} Qayta urinish</Text>
            </Pressable>
          ) : (
            <Text style={styles.empty}>Hozircha chatlar yo‘q</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('Conversation', { conversationId: item.id })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Avatar initials={item.initials} color={item.avatarColor} url={item.avatarUrl} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text numberOfLines={1} style={styles.name}>{item.title}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text numberOfLines={1} style={styles.preview}>{item.subtitle}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { alignItems: 'center', flexDirection: 'row', height: 58, justifyContent: 'space-between', paddingHorizontal: 18 },
  headerAction: { color: '#344054', fontSize: 22 },
  title: { color: '#101828', fontSize: 20, fontWeight: '700' },
  compose: { color: '#1677FF', fontSize: 28, fontWeight: '400' },
  searchWrap: { alignItems: 'center', backgroundColor: '#F2F4F7', borderRadius: 12, flexDirection: 'row', height: 42, marginHorizontal: 16, paddingHorizontal: 12 },
  searchIcon: { color: '#667085', fontSize: 22, marginRight: 8 },
  search: { color: '#101828', flex: 1, fontSize: 16, padding: 0 },
  filters: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingVertical: 12 },
  filter: { backgroundColor: '#F2F4F7', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
  filterActive: { backgroundColor: '#E8F2FF' },
  filterText: { color: '#667085', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#1677FF' },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  pressed: { backgroundColor: '#F9FAFB' },
  rowBody: { borderBottomColor: '#EAECF0', borderBottomWidth: StyleSheet.hairlineWidth, flex: 1, marginLeft: 12, paddingBottom: 10 },
  rowTop: { alignItems: 'center', flexDirection: 'row' },
  name: { color: '#101828', flex: 1, fontSize: 16, fontWeight: '600' },
  time: { color: '#98A2B3', fontSize: 12, marginLeft: 8 },
  preview: { color: '#667085', fontSize: 14, marginTop: 5 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { color: '#98A2B3', paddingHorizontal: 24, textAlign: 'center' },
  errorBanner: { backgroundColor: '#FEF3F2', marginBottom: 4, marginHorizontal: 16, padding: 10, borderRadius: 10 },
  errorText: { color: '#B42318', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
