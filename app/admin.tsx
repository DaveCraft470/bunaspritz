import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useEvents } from '@/contexts/EventsContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { isAdminAccessEnabled } from '@/lib/admin';
import { useReports, seedDevelopmentReports } from '@/lib/reports';

export default function Admin() {
  const { colors: theme } = useAppTheme();
  const { events } = useEvents();
  const { user } = useUser();
  const reports = useReports();
  const newReports = reports.filter((report) => report.status === 'new').length;
  const reviewingReports = reports.filter((report) => report.status === 'reviewing').length;
  const resolvedReports = reports.filter((report) => report.status === 'resolved').length;
  const allowed = isAdminAccessEnabled(user);
  const upcoming = useMemo(() => events.filter((event) => !event.startsAt || new Date(event.startsAt).getTime() >= Date.now()).length, [events]);

  if (!allowed) {
    return <AccessDenied />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Admin Panel</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.stats}>
          <Stat label="Evenimente" value={events.length} theme={theme} />
          <Stat label="Viitoare" value={upcoming} theme={theme} />
          <Stat label="Utilizatori" value="Căutare" theme={theme} />
          <Stat label="Reports noi" value={newReports} theme={theme} />
          <Stat label="În verificare" value={reviewingReports} theme={theme} />
          <Stat label="Rezolvate" value={resolvedReports} theme={theme} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Management</Text>
        <AdminLink icon="people-outline" title="Users" detail="Caută utilizatori și deschide profilurile lor." onPress={() => router.push('/admin-users')} theme={theme} />
        <AdminLink icon="calendar-outline" title="Events" detail="Vezi și marchează evenimente pentru moderare." onPress={() => router.push('/admin-events')} theme={theme} />
        <AdminLink icon="flag-outline" title="Reports" detail="Analizează raportările locale și statusurile lor." onPress={() => router.push('/admin-reports')} theme={theme} />
        {__DEV__ && (
          <AnimatedPressable onPress={seedDevelopmentReports} style={[styles.devButton, { borderColor: theme.border }]}>
            <Text style={[styles.linkDetail, { color: theme.textSecondary }]}>Developer tools · Adaugă reports de test</Text>
          </AnimatedPressable>
        )}
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Accesul și acțiunile admin sunt doar pentru development local. Persistența securizată necesită roluri și politici backend.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AccessDenied() {
  const { colors: theme } = useAppTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <Text style={[styles.denied, { color: theme.textPrimary }]}>Nu ai acces la Admin Panel.</Text>
      <AnimatedPressable onPress={() => router.back()} style={styles.deniedBack}>
        <Text style={[styles.linkDetail, { color: theme.accent }]}>Înapoi</Text>
      </AnimatedPressable>
    </SafeAreaView>
  );
}

function Stat({ label, value, theme }: { label: string; value: number | string; theme: ReturnType<typeof useAppTheme>['colors'] }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function AdminLink({ icon, title, detail, onPress, theme }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void; theme: ReturnType<typeof useAppTheme>['colors'] }) {
  return (
    <AnimatedPressable onPress={onPress} style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name={icon} size={23} color={theme.accent} />
      <View style={styles.linkText}>
        <Text style={[styles.linkTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.linkDetail, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  content: { padding: spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  stat: { width: '31%', minHeight: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  statValue: { fontSize: 21, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  linkText: { flex: 1 },
  linkTitle: { fontSize: 15, fontWeight: '800' },
  linkDetail: { fontSize: 11, marginTop: 3 },
  note: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', marginTop: spacing.lg },
  devButton: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: spacing.sm },
  denied: { textAlign: 'center', padding: spacing.xl, fontSize: 16, fontWeight: '700' },
  deniedBack: { alignSelf: 'center', padding: spacing.md },
});
