import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';

// Profile design by raulnitu8 — ported from App.tsx's ProfileScreen onto its
// own Expo Router screen, matching how app/messages.tsx was ported.

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <ScrollView
        style={[styles.profile, { backgroundColor: theme.page }]}
        contentContainerStyle={[styles.profileContent, { paddingBottom: insets.bottom + 116 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={[styles.profileAvatar, { borderColor: theme.surface }]}>
            <Text style={styles.profileAvatarText}>A</Text>
          </View>
          <View style={styles.profileTitleBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: theme.textPrimary }]}>Andrei Pop</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </View>
            <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>@andrei.brasov · Brașov</Text>
            <View style={styles.hostPill}>
              <Text style={styles.hostPillText}>HOST APROBAT</Text>
            </View>
          </View>
          <Pressable style={[styles.editButton, { borderColor: theme.border }]}>
            <Text style={[styles.editText, { color: theme.accent }]}>Editează</Text>
          </Pressable>
        </View>

        <Text style={[styles.bio, { color: theme.textSecondary }]}>
          Ieșiri bune, oameni faini și seri de ținut minte. ✨
        </Text>

        <View style={styles.scoreCard}>
          <View>
            <Text style={styles.sectionKicker}>RELIABILITY SCORE</Text>
            <Text style={styles.scoreTitle}>Foarte de încredere</Text>
            <Text style={styles.scoreDetail}>Bazat pe prezențe, răspunsuri și feedback.</Text>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>92</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>14</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Grupuri</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>28</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Evenimente</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: theme.textPrimary }]}>46</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Momente</Text>
          </View>
        </View>

        <View style={[styles.levelCard, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={styles.levelEmoji}>🍀</Text>
          <View style={styles.levelCopy}>
            <Text style={[styles.levelTitle, { color: theme.textPrimary }]}>Nivel 7 · Spritz Local</Text>
            <Text style={[styles.levelDetail, { color: theme.textSecondary }]}>
              Mai ai 120 puncte până la următorul nivel.
            </Text>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Medalii</Text>
          <Text style={[styles.seeAll, { color: theme.accent }]}>Vezi toate</Text>
        </View>
        <View style={styles.medalsRow}>
          <View style={[styles.medal, styles.momentOne, { borderColor: theme.surface }]}>
            <Text style={styles.medalEmoji}>🌲</Text>
            <Text style={styles.medalCaption}>Local</Text>
          </View>
          <View style={[styles.medal, styles.momentTwo, { borderColor: theme.surface }]}>
            <Text style={styles.medalEmoji}>🍹</Text>
            <Text style={styles.medalCaption}>Spriț</Text>
          </View>
          <View style={[styles.medal, styles.momentThree, { borderColor: theme.surface }]}>
            <Text style={styles.medalEmoji}>🎿</Text>
            <Text style={styles.medalCaption}>Activ</Text>
          </View>
        </View>

        <View style={[styles.verifyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.verifyIcon, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.verifyIconText, { color: theme.accent }]}>✓</Text>
          </View>
          <View style={styles.verifyCopy}>
            <Text style={[styles.verifyTitle, { color: theme.textPrimary }]}>Verificare identitate</Text>
            <Text style={[styles.verifyDetail, { color: theme.textSecondary }]}>
              În curând: verificare securizată pentru conturile 18+.
            </Text>
          </View>
          <Text style={[styles.verifyArrow, { color: theme.accent }]}>›</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  profile: { flex: 1 },
  profileContent: { padding: 22 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 74, height: 74, borderRadius: 27, backgroundColor: '#12C854', justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  profileAvatarText: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  profileTitleBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  profileName: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  verifiedBadge: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  profileHandle: { fontSize: 12, marginTop: 3 },
  hostPill: { alignSelf: 'flex-start', marginTop: 7, backgroundColor: '#0B3D20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  hostPillText: { color: '#BFFFD3', fontSize: 9, letterSpacing: 0.8, fontWeight: '900' },
  editButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  editText: { fontSize: 11, fontWeight: '800' },
  bio: { fontSize: 14, lineHeight: 20, marginTop: 20, marginBottom: 18 },
  scoreCard: { backgroundColor: '#0B3D20', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionKicker: { color: '#7DEB9C', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  scoreTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 5 },
  scoreDetail: { color: '#B7D7C0', fontSize: 11, maxWidth: 190, lineHeight: 16, marginTop: 5 },
  scoreCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  scoreNumber: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', lineHeight: 28 },
  scoreOutOf: { color: '#E1FFEA', fontSize: 9, fontWeight: '800' },
  statsRow: { flexDirection: 'row', marginVertical: 16, borderRadius: 16, borderWidth: 1 },
  stat: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statNumber: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 3, fontWeight: '700' },
  levelCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18 },
  levelEmoji: { fontSize: 30 },
  levelCopy: { flex: 1 },
  levelTitle: { fontSize: 14, fontWeight: '800' },
  levelDetail: { fontSize: 11, marginTop: 3 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#BCECCB', overflow: 'hidden', marginTop: 9 },
  progressFill: { width: '63%', height: '100%', backgroundColor: '#12C854', borderRadius: 3 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  seeAll: { fontSize: 11, fontWeight: '800' },
  medalsRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 4 },
  medal: { width: 68, height: 68, borderRadius: 34, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  momentOne: { backgroundColor: '#7DEB9C' },
  momentTwo: { backgroundColor: '#25D960' },
  momentThree: { backgroundColor: '#BDEBCB' },
  medalEmoji: { fontSize: 24, marginBottom: 3 },
  medalCaption: { color: '#0B3D20', fontSize: 9, fontWeight: '900' },
  verifyCard: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 1 },
  verifyIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  verifyIconText: { fontSize: 19, fontWeight: '900' },
  verifyCopy: { flex: 1 },
  verifyTitle: { fontSize: 13, fontWeight: '800' },
  verifyDetail: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  verifyArrow: { fontSize: 26, fontWeight: '300' },
});
