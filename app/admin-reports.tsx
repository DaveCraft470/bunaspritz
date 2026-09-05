import { useMemo, useState } from 'react';
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
import { ReportStatus, ReportTargetType, updateReportStatus, useReports } from '@/lib/reports';

const STATUS_FILTERS: Array<{ label: string; value: ReportStatus | 'all' }> = [
  { label: 'Toate', value: 'all' },
  { label: 'Noi', value: 'new' },
  { label: 'În verificare', value: 'reviewing' },
  { label: 'Rezolvate', value: 'resolved' },
  { label: 'Respins', value: 'dismissed' },
];

export default function AdminReports() {
  const { colors: theme } = useAppTheme();
  const { user } = useUser();
  const reports = useReports();
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [targetType, setTargetType] = useState<ReportTargetType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) =>
      (status === 'all' || report.status === status) &&
      (targetType === 'all' || report.targetType === targetType) &&
      (!normalized || `${report.reason} ${report.description} ${report.targetLabel} ${report.reporterLabel}`.toLowerCase().includes(normalized)),
    );
  }, [reports, status, targetType, query]);
  const selected = reports.find((report) => report.id === selectedId) ?? null;

  if (!isAdminAccessEnabled(user)) return <AccessDenied />;

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
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{item.reporterLabel} → {item.targetLabel} · {new Date(item.createdAt).toLocaleString('ro-RO')}</Text>
          </AnimatedPressable>
        )}
      />
      <ReportDetail report={selected} onClose={() => setSelectedId(null)} />
    </SafeAreaView>
  );
}

function ReportDetail({ report, onClose }: { report: ReturnType<typeof useReports>[number] | null; onClose: () => void }) {
  const { colors: theme } = useAppTheme();
  if (!report) return null;
  const currentReport = report;
  function statusAction(next: ReportStatus) {
    updateReportStatus(currentReport.id, next);
    onClose();
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Detalii report</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Reporter: {currentReport.reporterLabel}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Țintă: {currentReport.targetLabel}</Text>
          <Text style={[styles.reason, { color: theme.textPrimary }]}>{currentReport.reason}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{currentReport.description || 'Fără descriere'}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>Creat: {new Date(currentReport.createdAt).toLocaleString('ro-RO')}</Text>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => statusAction('reviewing')} style={styles.modalButton}><Text style={styles.modalButtonText}>Începe verificarea</Text></AnimatedPressable>
            <AnimatedPressable onPress={() => statusAction('resolved')} style={[styles.modalButton, { backgroundColor: colors.green500 }]}><Text style={[styles.modalButtonText, { color: colors.white }]}>Rezolvă</Text></AnimatedPressable>
            <AnimatedPressable onPress={() => statusAction('dismissed')} style={styles.modalButton}><Text style={styles.modalButtonText}>Respinge</Text></AnimatedPressable>
          </View>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => currentReport.targetType === 'user' ? router.push(`/user/${currentReport.targetId}`) : router.push(`/event/${currentReport.targetId}`)} style={styles.modalButton}><Text style={styles.modalButtonText}>Vezi {currentReport.targetType === 'user' ? 'profilul' : 'evenimentul'}</Text></AnimatedPressable>
            <AnimatedPressable onPress={onClose} style={styles.modalButton}><Text style={styles.modalButtonText}>Închide</Text></AnimatedPressable>
          </View>
          <Text style={[styles.local, { color: theme.textSecondary }]}>Statusurile sunt locale și nu sunt persistate în backend.</Text>
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
  local: { fontSize: 10, fontStyle: 'italic', marginTop: spacing.md },
  deniedBack: { alignSelf: 'center', padding: spacing.md },
});
