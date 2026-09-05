import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, glassButton, shadows, spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { isAdminAccessEnabled } from '@/lib/admin';
import { getReports, Report, ReportStatus, ReportTargetType, updateReportStatus } from '@/lib/reports';
import { getProfiles } from '@/lib/social';
import { supabase } from '@/lib/supabase';

const STATUS_FILTERS: Array<{ label: string; value: ReportStatus | 'all' }> = [
  { label: 'Toate', value: 'all' },
  { label: 'Noi', value: 'pending' },
  { label: 'În verificare', value: 'reviewing' },
  { label: 'Rezolvate', value: 'resolved' },
  { label: 'Respins', value: 'rejected' },
];

// reports only stores ids — labels for the reporter and the target are
// resolved here in two batched queries (one for every user id involved,
// one for event titles) instead of one lookup per row.
async function resolveLabels(reports: Report[]): Promise<Record<string, string>> {
  const userIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const report of reports) {
    userIds.add(report.reporterId);
    if (report.targetType === 'user') userIds.add(report.targetId);
    else eventIds.add(report.targetId);
  }

  const [profiles, events] = await Promise.all([
    getProfiles([...userIds]),
    eventIds.size
      ? supabase.from('events').select('id, title').in('id', [...eventIds]).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const labels: Record<string, string> = {};
  for (const profile of profiles) labels[profile.id] = `@${profile.username}`;
  for (const event of events) labels[event.id] = event.title;
  return labels;
}

export default function AdminReports() {
  const { colors: theme } = useAppTheme();
  const { user } = useUser();
  const allowed = isAdminAccessEnabled(user);
  const [reports, setReports] = useState<Report[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [targetType, setTargetType] = useState<ReportTargetType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    getReports().then(async (list) => {
      setReports(list);
      setLabels(await resolveLabels(list));
    });
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) =>
      (status === 'all' || report.status === status) &&
      (targetType === 'all' || report.targetType === targetType) &&
      (!normalized ||
        `${report.reason} ${report.description} ${labels[report.targetId] ?? ''} ${labels[report.reporterId] ?? ''}`
          .toLowerCase()
          .includes(normalized)),
    );
  }, [reports, status, targetType, query, labels]);
  const selected = reports.find((report) => report.id === selectedId) ?? null;

  if (!allowed) return <AccessDenied />;

  async function statusAction(report: Report, next: Exclude<ReportStatus, 'pending'>) {
    setSelectedId(null);
    const ok = await updateReportStatus(report.id, next);
    if (ok) setReports((current) => current.map((r) => (r.id === report.id ? { ...r, status: next } : r)));
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.topBar}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={10} style={[styles.backButton, shadows.soft, { borderColor: glassButton.border }]}>
          <Ionicons name="chevron-back" size={20} color={glassButton.icon} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Reports</Text>
        <View style={styles.backButton} />
      </View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Caută motiv, reporter sau țintă" placeholderTextColor={theme.textSecondary} style={[styles.search, { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border }]} />
      <View style={styles.filters}>
        {STATUS_FILTERS.map((filter) => <AnimatedPressable key={filter.value} onPress={() => setStatus(filter.value)} style={[styles.filter, { borderColor: status === filter.value ? colors.green500 : theme.border, backgroundColor: status === filter.value ? theme.surfaceMuted : theme.surface }]}><Text style={[styles.filterText, { color: theme.textPrimary }]}>{filter.label}</Text></AnimatedPressable>)}
      </View>
      <View style={styles.filters}>
        {(['all', 'user', 'event'] as const).map((filter) => <AnimatedPressable key={filter} onPress={() => setTargetType(filter)} style={[styles.filter, { borderColor: targetType === filter ? colors.green500 : theme.border }]}><Text style={[styles.filterText, { color: theme.textPrimary }]}>{filter === 'all' ? 'Toate țintele' : filter === 'user' ? 'User' : 'Event'}</Text></AnimatedPressable>)}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.textSecondary }]}>Nu există report-uri pentru filtrele selectate.</Text>}
        renderItem={({ item }) => (
          <AnimatedPressable onPress={() => setSelectedId(item.id)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.type, { color: theme.accent }]}>{item.targetType === 'user' ? 'User' : 'Event'}</Text>
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>{item.status}</Text>
            </View>
            <Text style={[styles.reason, { color: theme.textPrimary }]}>{item.reason}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={2}>{item.description || 'Fără descriere'}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{labels[item.reporterId] ?? '…'} → {labels[item.targetId] ?? '…'} · {new Date(item.createdAt).toLocaleString('ro-RO')}</Text>
          </AnimatedPressable>
        )}
      />
      <ReportDetail report={selected} labels={labels} onClose={() => setSelectedId(null)} onStatus={statusAction} />
    </SafeAreaView>
  );
}

function ReportDetail({
  report,
  labels,
  onClose,
  onStatus,
}: {
  report: Report | null;
  labels: Record<string, string>;
  onClose: () => void;
  onStatus: (report: Report, next: Exclude<ReportStatus, 'pending'>) => void;
}) {
  const { colors: theme } = useAppTheme();
  if (!report) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Detalii report</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Reporter: {labels[report.reporterId] ?? '…'}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Țintă: {labels[report.targetId] ?? '…'}</Text>
          <Text style={[styles.reason, { color: theme.textPrimary }]}>{report.reason}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{report.description || 'Fără descriere'}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Creat: {new Date(report.createdAt).toLocaleString('ro-RO')}</Text>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => onStatus(report, 'reviewing')} style={styles.modalButton}><Text style={styles.modalButtonText}>Începe verificarea</Text></AnimatedPressable>
            <AnimatedPressable onPress={() => onStatus(report, 'resolved')} style={[styles.modalButton, { backgroundColor: colors.green500 }]}><Text style={[styles.modalButtonText, { color: colors.white }]}>Rezolvă</Text></AnimatedPressable>
            <AnimatedPressable onPress={() => onStatus(report, 'rejected')} style={styles.modalButton}><Text style={styles.modalButtonText}>Respinge</Text></AnimatedPressable>
          </View>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => report.targetType === 'user' ? router.push(`/user/${report.targetId}`) : router.push(`/event/${report.targetId}`)} style={styles.modalButton}><Text style={styles.modalButtonText}>Vezi {report.targetType === 'user' ? 'profilul' : 'evenimentul'}</Text></AnimatedPressable>
            <AnimatedPressable onPress={onClose} style={styles.modalButton}><Text style={styles.modalButtonText}>Închide</Text></AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AccessDenied() {
  const { colors: theme } = useAppTheme();
  return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}><Text style={[styles.empty, { color: theme.textPrimary }]}>Nu ai acces la Reports.</Text><AnimatedPressable onPress={() => router.back()} style={styles.deniedBack}><Text style={[styles.modalButtonText, { color: theme.accent }]}>Înapoi</Text></AnimatedPressable></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  search: { marginHorizontal: spacing.lg, borderWidth: 1, borderRadius: 14, height: 44, paddingHorizontal: 12, fontSize: 13 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, marginTop: 8 },
  filter: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  filterText: { fontSize: 10, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.md, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { fontSize: 10, fontWeight: '900' },
  statusText: { fontSize: 10, fontWeight: '700' },
  reason: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  detail: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  empty: { textAlign: 'center', padding: spacing.xl, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.xl, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  modalButton: { flex: 1, minHeight: 42, borderRadius: 11, backgroundColor: '#EAFBF0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  modalButtonText: { fontSize: 10, fontWeight: '800', color: '#0E9A3D', textAlign: 'center' },
  deniedBack: { alignSelf: 'center', padding: spacing.md },
});
