import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { Profile, searchProfiles } from '@/lib/social';
import { isAdminAccessEnabled } from '@/lib/admin';

export default function AdminUsers() {
  const { colors: theme } = useAppTheme();
  const { user } = useUser();
  const { light } = useHaptics();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [localSuspended, setLocalSuspended] = useState<Record<string, boolean>>({});

  if (!isAdminAccessEnabled(user)) return <AccessDenied />;

  async function search() {
    if (!user || !query.trim()) {
      setUsers([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setUsers(await searchProfiles(query, user.id));
    setLoading(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Admin Users</Text>
        <View style={styles.backButton} />
      </View>
      <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="Caută nume sau username"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.textPrimary }]}
        />
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.green500} style={styles.center} /> : searched ? <Text style={[styles.empty, { color: theme.textSecondary }]}>Nu au fost găsiți utilizatori.</Text> : <Text style={[styles.empty, { color: theme.textSecondary }]}>Caută un utilizator pentru a începe.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Avatar uri={item.avatar_url} name={item.name} size={44} fontSize={17} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.username, { color: theme.textSecondary }]}>@{item.username}</Text>
              <Text style={[styles.verified, { color: item.verified ? theme.accent : theme.textSecondary }]}>
                {item.verified ? 'Verified' : 'Neverified'}
              </Text>
            </View>
            <View style={styles.actions}>
              <AnimatedPressable onPress={() => router.push(`/user/${item.id}`)} hitSlop={8}>
                <Text style={[styles.actionText, { color: theme.accent }]}>Profil</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  light();
                  setLocalSuspended((current) => ({ ...current, [item.id]: !current[item.id] }));
                }}
                hitSlop={8}
              >
                <Text style={[styles.actionText, { color: '#E5484D' }]}>{localSuspended[item.id] ? 'Deblochează' : 'Suspendă'}</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function AccessDenied() {
  const { colors: theme } = useAppTheme();
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}><Text style={[styles.empty, { color: theme.textPrimary }]}>Nu ai acces la Admin Users.</Text><AnimatedPressable onPress={() => router.back()} style={styles.deniedBack}><Text style={[styles.actionText, { color: theme.accent }]}>Înapoi</Text></AnimatedPressable></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  input: { flex: 1, height: 44, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: 50 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 10 },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800' },
  username: { fontSize: 11, marginTop: 2 },
  verified: { fontSize: 10, marginTop: 5 },
  actions: { alignItems: 'flex-end', gap: 9 },
  actionText: { fontSize: 11, fontWeight: '800' },
  empty: { textAlign: 'center', padding: spacing.xl, fontSize: 14 },
  center: { marginTop: spacing.xl },
  deniedBack: { alignSelf: 'center', padding: spacing.md },
});
