import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import type { DbGroupPoll, PollResult } from '@/lib/eventMessaging';

// Rendered inside a chat bubble in place of plain text whenever a message
// carries a poll_id (see event_group_messages.poll_id in the migration).
// Bar widths come straight from vote_count / total — no client-side
// aggregation, since get_poll_results() already returns exactly that.
export function PollCard({
  poll,
  results,
  mine,
  canClose,
  onVote,
  onClose,
}: {
  poll: DbGroupPoll;
  results: PollResult[];
  mine: boolean;
  canClose: boolean;
  onVote: (optionId: string) => void;
  onClose: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const totalVotes = results.reduce((sum, r) => sum + r.voteCount, 0);
  const isClosed = !!poll.closed_at;
  const textColor = mine ? colors.white : theme.textPrimary;
  const secondaryColor = mine ? 'rgba(255,255,255,0.75)' : theme.textSecondary;
  const trackColor = mine ? 'rgba(255,255,255,0.25)' : theme.surfaceMuted;
  const fillColor = mine ? colors.white : colors.green500;

  return (
    <View style={styles.card}>
      <Text style={[styles.question, { color: textColor }]}>📊 {poll.question}</Text>
      {results.map((option) => {
        const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
        return (
          <Pressable
            key={option.optionId}
            onPress={() => !isClosed && onVote(option.optionId)}
            disabled={isClosed}
            style={[styles.optionTrack, { backgroundColor: trackColor }]}
          >
            <View style={[styles.optionFill, { width: `${pct}%`, backgroundColor: fillColor, opacity: option.myVote ? 0.35 : 0.18 }]} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]} numberOfLines={1}>
                {option.myVote ? '✓ ' : ''}
                {option.label}
              </Text>
              <Text style={[styles.optionPct, { color: secondaryColor }]}>{pct}%</Text>
            </View>
          </Pressable>
        );
      })}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: secondaryColor }]}>
          {totalVotes} {totalVotes === 1 ? 'vot' : 'voturi'}
          {isClosed ? ' · Închis' : ''}
        </Text>
        {canClose && !isClosed && (
          <Pressable onPress={onClose}>
            <Text style={[styles.closeLink, { color: secondaryColor }]}>Închide sondajul</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 220, gap: 8 },
  question: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  optionTrack: { borderRadius: 10, overflow: 'hidden', minHeight: 34, justifyContent: 'center' },
  optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  optionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  optionLabel: { flex: 1, fontSize: 13, fontWeight: '700', marginRight: 8 },
  optionPct: { fontSize: 11, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  footerText: { fontSize: 10, fontWeight: '700' },
  closeLink: { fontSize: 10, fontWeight: '800', textDecorationLine: 'underline' },
});
