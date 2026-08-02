import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function SettingsScreen() {
  const { logout, user } = useAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}><Text style={styles.title}>Sozlamalar</Text></View>
      <View style={styles.card}>
        <View>
          <Text style={styles.label}>Telefon raqami</Text>
          <Text style={styles.phone}>{user?.phoneNumber}</Text>
        </View>
        <Text style={styles.value}>Session faol</Text>
      </View>
      <Text style={styles.note}>Session xavfsiz storage orqali ilova qayta ochilganda avtomatik tiklanadi.</Text>
      <Pressable onPress={() => void logout()} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>Chiqish</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#F2F4F7', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#FFFFFF', height: 58, justifyContent: 'center' },
  title: { color: '#101828', fontSize: 20, fontWeight: '700' },
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 18, paddingVertical: 16 },
  label: { color: '#101828', fontSize: 15 },
  phone: { color: '#667085', fontSize: 13, marginTop: 4 },
  value: { color: '#12B76A', fontSize: 14, fontWeight: '600' },
  note: { color: '#667085', fontSize: 13, lineHeight: 19, paddingHorizontal: 18, paddingTop: 10 },
  logout: { alignItems: 'center', backgroundColor: '#FFFFFF', marginTop: 22, paddingVertical: 16 },
  logoutText: { color: '#D92D20', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
