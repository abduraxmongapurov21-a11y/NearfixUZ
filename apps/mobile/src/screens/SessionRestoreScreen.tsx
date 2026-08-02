import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function SessionRestoreScreen() {
  const { error, restore, status } = useAuth();
  const failed = status === 'error';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {failed ? (
          <>
            <Text style={styles.title}>Sessionni tiklab bo‘lmadi</Text>
            <Text style={styles.message}>{error}</Text>
            <Pressable onPress={() => void restore()} style={styles.button}>
              <Text style={styles.buttonText}>Qayta urinish</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color="#1677FF" size="large" />
            <Text style={styles.message}>Session tiklanmoqda…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { color: '#101828', fontSize: 22, fontWeight: '700' },
  message: { color: '#667085', fontSize: 15, lineHeight: 22, marginTop: 14, textAlign: 'center' },
  button: { backgroundColor: '#1677FF', borderRadius: 10, marginTop: 22, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
