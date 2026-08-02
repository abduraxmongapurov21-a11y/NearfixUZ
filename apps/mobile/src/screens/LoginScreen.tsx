import { useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuth } from '../auth/AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!phoneNumber.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(phoneNumber);
    } catch (loginError) {
      setError(
        loginError instanceof ApiError && loginError.status === 400
          ? 'Telefon raqamini to‘g‘ri formatda kiriting.'
          : 'Kirish amalga oshmadi. API ishlayotganini tekshiring.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.logo}><Text style={styles.logoText}>A</Text></View>
          <Text style={styles.title}>Analog’ga kirish</Text>
          <Text style={styles.subtitle}>
            Development auth yoqilgan lokal muhitda telefon raqamingizni kiriting. Production’da bu kirish usuli o‘chirilgan.
          </Text>
          <Text style={styles.label}>Telefon raqami</Text>
          <TextInput
            autoComplete="tel"
            autoFocus
            editable={!submitting}
            keyboardType="phone-pad"
            onChangeText={setPhoneNumber}
            onSubmitEditing={() => void submit()}
            placeholder="+998 90 123 45 67"
            placeholderTextColor="#98A2B3"
            returnKeyType="done"
            style={styles.input}
            value={phoneNumber}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={!phoneNumber.trim() || submitting}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.button,
              (!phoneNumber.trim() || submitting) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Davom etish</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1 },
  keyboardView: { flex: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 28 },
  logo: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#1677FF', borderRadius: 22, height: 72, justifyContent: 'center', marginBottom: 28, width: 72 },
  logoText: { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  title: { color: '#101828', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#667085', fontSize: 15, lineHeight: 22, marginBottom: 32, marginTop: 10, textAlign: 'center' },
  label: { color: '#344054', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderColor: '#D0D5DD', borderRadius: 12, borderWidth: 1, color: '#101828', fontSize: 18, paddingHorizontal: 16, paddingVertical: 14 },
  error: { color: '#D92D20', fontSize: 13, marginTop: 8 },
  button: { alignItems: 'center', backgroundColor: '#1677FF', borderRadius: 12, height: 52, justifyContent: 'center', marginTop: 18 },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
