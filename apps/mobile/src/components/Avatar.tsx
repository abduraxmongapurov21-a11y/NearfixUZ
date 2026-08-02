import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  initials: string;
  color: string;
  url?: string | null;
  size?: number;
};

export function Avatar({ initials, color, url, size = 52 }: Props) {
  return (
    <View style={[styles.avatar, { backgroundColor: color, height: size, width: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image accessibilityLabel="Profil rasmi" source={{ uri: url }} style={{ height: size, width: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.34 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '700' },
});
