import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { useEvents } from '@/contexts/EventsContext';
import { Avatar } from '@/components/common/Avatar';
import { FriendsHubTabs } from '@/components/friends/FriendsHubTabs';
import { Profile, getBlockedIds } from '@/lib/social';
import { getFriends } from '@/lib/friendRequests';
import { extensionAndTypeForImage } from '@/lib/media';
import { alertPermissionDenied } from '@/lib/permissions';
import { showAlert, showConfirm } from '@/lib/alert';
import { getUserJoinedEventIds } from '@/lib/events';
import { getEventInvites, respondEventInvitation, subscribeToEventInvites, type EventInvite } from '@/lib/eventInvitations';
import {
  DbMessage,
  MediaTooLargeError,
  MediaType,
  getLastMessage,
  getSignedMediaUrl,
  getThread,
  getUnreadCount,
  markMessageViewed,
  markThreadRead,
  sendDirectMessage,
  sendGifMessage,
  sendMediaMessage,
  subscribeToIncoming,
  subscribeToReadReceipts,
} from '@/lib/messaging';
import {
  DbGroupMessage,
  DbGroupPoll,
  MessageReaction,
  PollResult,
  closeGroupPoll,
  createGroupPoll,
  deleteGroupMessage,
  editGroupMessage,
  getGroupLastRead,
  getGroupThread,
  getPinnedMessages,
  getPoll,
  getPollResults,
  getReactions,
  getSenderProfiles,
  markGroupRead,
  pinGroupMessage,
  reactToMessage,
  sendEventGroupGifMessage,
  sendEventGroupImageMessage,
  sendEventGroupMessage,
  subscribeToEventGroupMessages,
  subscribeToPollVotes,
  subscribeToReactions,
  unpinGroupMessage,
  voteGroupPoll,
} from '@/lib/eventMessaging';
import { GifPickerModal } from '@/components/messaging/GifPickerModal';
import { MessageActionsSheet, type MessageAction } from '@/components/messaging/MessageActionsSheet';
import { PollComposerModal } from '@/components/messaging/PollComposerModal';
import { PollCard } from '@/components/messaging/PollCard';
import { EventInviteCard } from '@/components/messaging/EventInviteCard';
import { PinnedMessagesBar } from '@/components/messaging/PinnedMessagesBar';
import { SharedMediaModal } from '@/components/messaging/SharedMediaModal';
import { GroupSearchModal } from '@/components/messaging/GroupSearchModal';
import { SafetyMenu } from '@/components/social/SafetyMenu';

// Sentinel playingMessageId for the not-yet-sent recording preview — no real
// message has this id, so it can share the shared voicePlayer/playingMessageId
// state with the sent-message bubbles without colliding.
const MESSAGE_MAX_LENGTH = 500;

const VOICE_PREVIEW_ID = '__voice-preview__';

// Longest a single voice message is allowed to run before it's auto-stopped
// into the preview step — without this someone could hold the mic open
// indefinitely and produce a multi-hour attachment.
const MAX_RECORDING_MS = 5 * 60 * 1000;

// How many bars the live recording waveform scrolls through.
const RECORDING_WAVE_BARS = 24;

// expo-audio's recorder metering is a dBFS reading — 0 is the loudest the
// input can go without clipping, and it falls off fast from there. Normal
// speech mostly lands in the upper end of this window, so clamping to
// [-60, 0] (instead of the full theoretical range down to -160) is what
// actually makes a waveform that moves for talking instead of sitting flat.
function normalizedMeteringLevel(metering: number | undefined): number {
  if (metering === undefined || Number.isNaN(metering)) return 0.05;
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}

// How many bars a sent voice message's stored waveform has — fixed so every
// bubble renders the same width regardless of how long the recording was.
const SENT_WAVEFORM_BARS = 32;

// Bucket-averages the full per-recording sample history (see fullWaveformRef)
// down to a fixed bar count at send time, so a 3-second and a 30-second note
// both render as one consistent-width shape.
function downsampleWaveform(samples: number[], barCount: number): number[] {
  if (samples.length === 0) return Array(barCount).fill(0.1);
  const result: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor((i / barCount) * samples.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / barCount) * samples.length));
    const bucket = samples.slice(start, end);
    result.push(bucket.reduce((sum, v) => sum + v, 0) / bucket.length);
  }
  return result;
}

// Deterministic placeholder shape for messages sent before waveform capture
// existed (or if it somehow came back empty) — a real bubble should almost
// never hit this, but it keeps old messages from rendering as a dead flat line.
const FALLBACK_WAVEFORM = Array.from({ length: SENT_WAVEFORM_BARS }, (_, i) => 0.35 + 0.35 * Math.abs(Math.sin(i * 0.9)));

let webAudioUnlocked = false;

// Browsers only allow HTMLMediaElement.play() unprompted within a narrow
// window of an actual user gesture. voicePlayer.play() below always runs
// after an `await` (a signed-URL fetch, or at least a promise tick) — if a
// browser's autoplay policy decides that gap disqualifies the gesture, the
// call fails by rejecting a promise that expo-audio's web player never
// checks or exposes anywhere, so it's entirely silent: playing:true, no
// error, no sound. Playing a real (if inaudible) clip synchronously inside
// the very first gesture handler establishes "user activation" for audio on
// this page for the rest of the session, so later async-triggered play()
// calls are then allowed. Native platforms don't have this restriction.
function unlockWebAudioPlayback() {
  if (Platform.OS !== 'web' || webAudioUnlocked) return;
  webAudioUnlocked = true;
  try {
    const unlock = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    );
    unlock.play().catch(() => {});
  } catch {
    // Best-effort — worst case playback falls back to whatever the
    // browser's own gesture heuristics allow.
  }
}

// Chat list / message bubble design by nituraul8 — ported from App.tsx onto
// its own Expo Router screen so it lives alongside the rest of the app.
// Group chats are backed by event_group_messages (see lib/eventMessaging.ts)
// — one per event, membership == event_attendees — alongside the separate
// 1:1 friend DM capability.

type DisplayMessage = {
  id: string;
  text: string;
  time: string;
  createdAt?: string;
  sender: string;
  senderId?: string;
  senderAvatarUrl?: string | null;
  mine: boolean;
  read: boolean;
  mediaType?: MediaType | null;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  viewOnce?: boolean;
  viewedAt?: string | null;
  durationMs?: number | null;
  waveform?: number[] | null;
  isSystem?: boolean;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  pollId?: string | null;
  eventInviteId?: string | null;
};

// One emoji's aggregated reaction count on a message, plus whether the
// current user is the one behind it (for the tap-to-toggle highlight).
type ReactionGroup = { emoji: string; count: number; mine: boolean };

function groupReactions(reactions: MessageReaction[], myId: string | undefined): ReactionGroup[] {
  const byEmoji = new Map<string, ReactionGroup>();
  reactions.forEach((r) => {
    const existing = byEmoji.get(r.emoji);
    if (existing) {
      existing.count += 1;
      if (r.user_id === myId) existing.mine = true;
    } else {
      byEmoji.set(r.emoji, { emoji: r.emoji, count: 1, mine: r.user_id === myId });
    }
  });
  return [...byEmoji.values()];
}
type ActiveChat = { kind: 'group'; id: string } | { kind: 'friend'; id: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// What the chat-list row shows for a thread's last message — media has no
// text (see lib/messaging.sendMediaMessage), so it needs its own preview.
function messagePreview(message: DbMessage): string {
  if (message.media_type === 'image') return message.view_once ? '👁 Poză (vizualizare unică)' : '📷 Poză';
  if (message.media_type === 'gif') return '🎞 GIF';
  if (message.media_type === 'audio') return '🎤 Mesaj vocal';
  if (message.event_invite_id) return '🎉 Invitație la eveniment';
  return message.text;
}

function formatDuration(ms: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// One bubble's photo/GIF. A private Storage attachment (path) is resolved
// to a signed URL on demand; a GIF (url) is already a public CDN link and
// needs no resolution. View-once is client-enforced only — hidden until
// tapped, then hidden again on any later render once viewed_at is set.
function ImageBubble({
  path,
  url,
  viewOnce,
  alreadyViewed,
  onReveal,
}: {
  path?: string | null;
  url?: string | null;
  viewOnce?: boolean;
  alreadyViewed?: boolean;
  onReveal?: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url ?? null);
  // Bumped to force a fresh signed URL if the current one fails to load —
  // e.g. a thread left open past the 1-hour signed-URL TTL. Without this,
  // an expired URL just showed a permanently broken image.
  const [retryCount, setRetryCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (url) {
      setResolvedUrl(url);
      return;
    }
    if (!path) return;
    let cancelled = false;
    setResolvedUrl(null);
    getSignedMediaUrl(path).then((signed) => {
      if (!cancelled) setResolvedUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path, url, retryCount]);

  if (viewOnce && alreadyViewed && !revealed) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleLoading, { backgroundColor: theme.surfaceMuted }]}>
        <Ionicons name="eye-off-outline" size={20} color={theme.textSecondary} />
        <Text style={[styles.viewOnceLabel, { color: theme.textSecondary }]}>Vizualizat</Text>
      </View>
    );
  }

  if (viewOnce && !alreadyViewed && !revealed) {
    return (
      <Pressable
        onPress={() => {
          setRevealed(true);
          onReveal?.();
        }}
        style={[styles.imageBubble, styles.imageBubbleLoading, { backgroundColor: theme.surfaceMuted }]}
      >
        <Ionicons name="eye-outline" size={22} color={theme.textSecondary} />
        <Text style={[styles.viewOnceLabel, { color: theme.textSecondary }]}>Atinge pentru a vedea</Text>
      </Pressable>
    );
  }

  if (!resolvedUrl) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleLoading, { backgroundColor: theme.surfaceMuted }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolvedUrl }}
      style={styles.imageBubble}
      resizeMode="cover"
      onError={() => setRetryCount((n) => (n < 1 ? n + 1 : n))}
    />
  );
}

// One bubble's voice note. Playback is driven by the single shared player
// owned by the screen (see Messages()) — this just renders the button/state
// for whichever message id is currently loaded into it. While playing, the
// duration counts down from the stored length using the shared player's live
// currentTime, instead of just sitting on the static recorded length.
function VoiceBubble({
  isPlaying,
  isMine,
  durationMs,
  elapsedMs,
  waveform,
  onToggle,
}: {
  isPlaying: boolean;
  isMine: boolean;
  durationMs: number | null | undefined;
  elapsedMs: number;
  waveform: number[] | null | undefined;
  onToggle: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const remainingMs = isPlaying ? Math.max(0, (durationMs ?? 0) - elapsedMs) : durationMs;
  const progress = isPlaying && durationMs ? Math.min(1, elapsedMs / durationMs) : 0;
  const bars = waveform && waveform.length > 0 ? waveform : FALLBACK_WAVEFORM;
  const playedColor = isMine ? colors.white : colors.green500;
  const unplayedColor = isMine ? 'rgba(255,255,255,0.45)' : 'rgba(37,201,96,0.4)';
  return (
    <Pressable onPress={onToggle} style={styles.voiceBubbleRow} hitSlop={6}>
      <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={isMine ? colors.white : colors.green500} />
      <View style={styles.voiceWaveformRow}>
        {bars.map((level, index) => {
          const played = progress > 0 && index / bars.length <= progress;
          return (
            <View
              key={index}
              style={[
                styles.voiceWaveformBar,
                { height: 3 + level * 15, backgroundColor: played ? playedColor : unplayedColor },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.voiceDuration, { color: isMine ? colors.white : theme.textPrimary }]}>
        {formatDuration(remainingMs)}
      </Text>
    </Pressable>
  );
}

// Live mic-level waveform shown in the composer while recording — a rolling
// window of recent metering samples (see the effect in Messages() that
// pushes into it), most recent bar on the right.
function RecordingWaveform({ levels }: { levels: number[] }) {
  return (
    <View style={styles.waveformRow}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[styles.waveformBar, { height: 6 + level * 26, opacity: 0.4 + level * 0.6 }]}
        />
      ))}
    </View>
  );
}

// The recorded-but-unsent preview's waveform — same shape as RecordingWaveform,
// but a static array (the just-finished recording) with a played/unplayed
// progress split instead of a scrolling live level.
function PreviewWaveform({ waveform, progress }: { waveform: number[]; progress: number }) {
  const playedColor = colors.green500;
  const unplayedColor = 'rgba(37,201,96,0.35)';
  return (
    <View style={styles.waveformRow}>
      {waveform.map((level, index) => {
        const played = progress > 0 && index / waveform.length <= progress;
        return (
          <View
            key={index}
            style={[styles.waveformBar, { height: 6 + level * 26, backgroundColor: played ? playedColor : unplayedColor }]}
          />
        );
      })}
    </View>
  );
}

// The list row's timestamp: a time for anything from today, a date otherwise
// — matches the reference design's mix of "18:41" vs "19/08/2026".
function formatListTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Shared chat-list row for friend DMs (event groups use GroupCard instead),
// matching the reference design: avatar, name + timestamp on top, preview
// (with a read-receipt tick when it's your own last message) and an unread
// badge on the bottom line.
function ChatListRow({
  avatarNode,
  avatarColor,
  name,
  timestamp,
  preview,
  mine,
  read,
  unreadCount,
  onPress,
}: {
  avatarNode: ReactNode;
  avatarColor: string;
  name: string;
  timestamp: string | null;
  preview: string;
  mine: boolean;
  read: boolean;
  unreadCount: number;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.chatRow}>
      <View style={[styles.chatAvatar, { backgroundColor: avatarColor }]}>{avatarNode}</View>
      <View style={styles.chatBody}>
        <View style={styles.chatTopLine}>
          <Text numberOfLines={1} style={[styles.chatName, { color: theme.textPrimary }]}>
            {name}
          </Text>
          {timestamp && <Text style={[styles.chatTime, { color: theme.accent }]}>{timestamp}</Text>}
        </View>
        <View style={styles.chatBottomLine}>
          <View style={styles.chatPreviewRow}>
            {mine && (
              <Ionicons
                name={read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={read ? colors.green500 : theme.textSecondary}
                style={styles.chatTick}
              />
            )}
            <Text numberOfLines={1} style={[styles.chatPreview, { color: theme.textSecondary }]}>
              {preview}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Groups get a bigger, distinct "communities" style card in a horizontal
// row up top — individual friend DMs stay the compact WhatsApp-style row
// (ChatListRow) they already had, per the requested distinction. One card
// per event the user is in (joined or hosting) — see joinedEventIds below.
function GroupCard({
  emoji,
  color,
  title,
  detail,
  onPress,
}: {
  emoji: string;
  color: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.groupCard}>
      <View style={[styles.groupCardAvatar, { backgroundColor: color }]}>
        <Text style={styles.groupCardEmoji}>{emoji}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.groupCardTitle, { color: theme.textPrimary }]}>
        {title}
      </Text>
      <Text numberOfLines={1} style={[styles.groupCardDetail, { color: theme.textSecondary }]}>
        {detail}
      </Text>
    </Pressable>
  );
}

// A quoted snippet of the message being replied to — shown inside the reply-
// er's bubble, and (as a live preview) above the composer while composing.
function ReplyQuote({ sender, text, mine, onPress }: { sender: string; text: string; mine: boolean; onPress?: () => void }) {
  const { colors: theme } = useAppTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.replyQuote,
        { borderLeftColor: mine ? 'rgba(255,255,255,0.6)' : colors.green500, backgroundColor: mine ? 'rgba(255,255,255,0.12)' : 'rgba(37,201,96,0.08)' },
      ]}
    >
      <Text numberOfLines={1} style={[styles.replyQuoteSender, { color: mine ? '#D6FFE2' : colors.green500 }]}>{sender}</Text>
      <Text numberOfLines={1} style={[styles.replyQuoteText, { color: mine ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>{text}</Text>
    </Wrapper>
  );
}

function ReactionChipsRow({ groups, onPress }: { groups: ReactionGroup[]; onPress: (emoji: string) => void }) {
  const { colors: theme } = useAppTheme();
  if (!groups.length) return null;
  return (
    <View style={styles.reactionsRow}>
      {groups.map((group) => (
        <Pressable
          key={group.emoji}
          onPress={() => onPress(group.emoji)}
          style={[styles.reactionChip, { backgroundColor: group.mine ? colors.green100 : theme.surfaceMuted, borderColor: group.mine ? colors.green500 : theme.border }]}
        >
          <Text style={styles.reactionChipText}>{group.emoji} {group.count}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Messages() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  const { light } = useHaptics();
  const { user } = useUser();
  const { events } = useEvents();
  const { friendId } = useLocalSearchParams<{ friendId?: string }>();

  // null = showing the list; a chat only opens once the user taps it, or
  // this screen was opened directly on a friend's thread (?friendId=...).
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(friendId ? { kind: 'friend', id: friendId } : null);

  useEffect(() => {
    if (friendId) {
      setActiveChat({ kind: 'friend', id: friendId });
      setHidden(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  // Every event the user is in (joined or hosting — createEvent already
  // inserts the host into event_attendees) doubles as a group chat: the
  // group "exists" the moment the event does, no separate join step.
  const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set());
  const loadJoinedEvents = useCallback(async () => {
    if (!user) return;
    try {
      setJoinedEventIds(new Set(await getUserJoinedEventIds(user.id)));
    } catch {
      // Best-effort — the groups row just stays empty/stale until the next focus.
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      loadJoinedEvents();
    }, [loadJoinedEvents])
  );
  const groupEvents = useMemo(() => events.filter((event) => joinedEventIds.has(event.id)), [events, joinedEventIds]);

  const [groupMessages, setGroupMessages] = useState<DbGroupMessage[]>([]);
  const [groupSenderProfiles, setGroupSenderProfiles] = useState<Record<string, { name: string; avatarUrl: string | null }>>({});
  const [friends, setFriends] = useState<Profile[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState(false);
  const [friendsReloadKey, setFriendsReloadKey] = useState(0);
  const [friendLast, setFriendLast] = useState<Record<string, DbMessage | null>>({});
  const [friendUnread, setFriendUnread] = useState<Record<string, number>>({});
  const [friendMessages, setFriendMessages] = useState<DbMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  // A stopped-but-unsent recording, waiting for the user to preview-listen
  // to it and either send or discard it. Reuses the same voicePlayer/
  // playingMessageId machinery as the message bubbles, under this sentinel id.
  const [recordedVoice, setRecordedVoice] = useState<{ uri: string; durationMs: number; waveform: number[] } | null>(
    null
  );
  const messagesScrollRef = useRef<ScrollView>(null);
  const restingComposerOffset = insets.bottom + 16;
  const composerOffset = useRef(new Animated.Value(restingComposerOffset)).current;

  // ---- Sprint 2: group chat reactions / reply / edit / delete / pin / -----
  // ---- polls / search / unread / shared media -----------------------------
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, MessageReaction[]>>({});
  const [pinnedMessages, setPinnedMessages] = useState<DbGroupMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<DbGroupMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DbGroupMessage | null>(null);
  const [actionSheetMessage, setActionSheetMessage] = useState<DbGroupMessage | null>(null);
  const [pollComposerVisible, setPollComposerVisible] = useState(false);
  const [polls, setPolls] = useState<Record<string, DbGroupPoll>>({});
  const [pollResults, setPollResults] = useState<Record<string, PollResult[]>>({});
  const [invites, setInvites] = useState<Record<string, EventInvite>>({});
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [groupOptionsVisible, setGroupOptionsVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [sharedMediaVisible, setSharedMediaVisible] = useState(false);
  const [unreadDivider, setUnreadDivider] = useState<{ messageId: string; count: number } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messagePositionsRef = useRef<Map<string, number>>(new Map());

  function jumpToMessage(messageId: string) {
    const y = messagePositionsRef.current.get(messageId);
    if (y !== undefined) {
      messagesScrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
    }
    light();
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId((current) => (current === messageId ? null : current)), 1600);
  }

  function messageById(id: string | null | undefined): DbGroupMessage | undefined {
    if (!id) return undefined;
    return groupMessages.find((m) => m.id === id);
  }

  function senderDisplayName(senderId: string): string {
    if (senderId === user?.id) return 'Tu';
    return groupSenderProfiles[senderId]?.name ?? 'Cineva';
  }

  async function refreshReactions(messageIds: string[]) {
    const rows = await getReactions(messageIds);
    const grouped: Record<string, MessageReaction[]> = {};
    rows.forEach((row) => {
      (grouped[row.message_id] ??= []).push(row);
    });
    setReactionsByMessage(grouped);
  }

  async function refreshPinned(eventId: string) {
    setPinnedMessages(await getPinnedMessages(eventId));
  }

  // Refetches every invite id currently referenced by the loaded thread —
  // same "just refetch, don't try to patch from the raw payload" idiom as
  // loadPollAndResults below. Runs whenever friendMessages changes (a new
  // invite message arrives) and on any event_invites change for this user
  // (accepted/declined from here or from the notifications screen).
  const loadInvites = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const rows = await getEventInvites(ids);
    setInvites((current) => {
      const next = { ...current };
      rows.forEach((invite) => {
        next[invite.id] = invite;
      });
      return next;
    });
  }, []);

  // Read from a ref in the subscription callback below (mirrors activeChatRef
  // above) — the callback is only ever set up once per user.id, so closing
  // over friendMessages directly would freeze it at whatever the thread was
  // (usually []) when the subscription was first created.
  const friendMessageInviteIdsRef = useRef<string[]>([]);
  friendMessageInviteIdsRef.current = [...new Set(friendMessages.map((m) => m.event_invite_id).filter((id): id is string => !!id))];

  useEffect(() => {
    loadInvites(friendMessageInviteIdsRef.current);
  }, [friendMessages, loadInvites]);

  useEffect(() => {
    if (!user) return;
    return subscribeToEventInvites(user.id, () => {
      loadInvites(friendMessageInviteIdsRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleRespondInvite(invitationId: string, accept: boolean) {
    if (respondingInviteId) return;
    light();
    setRespondingInviteId(invitationId);
    const ok = await respondEventInvitation(invitationId, accept);
    setRespondingInviteId(null);
    if (!ok) {
      showAlert('A apărut o eroare', 'Nu am putut răspunde la invitație. Încearcă din nou.');
      return;
    }
    loadInvites([invitationId]);
  }

  async function loadPollAndResults(pollId: string) {
    const [poll, results] = await Promise.all([getPoll(pollId), getPollResults(pollId)]);
    if (poll) setPolls((current) => ({ ...current, [pollId]: poll }));
    setPollResults((current) => ({ ...current, [pollId]: results }));
  }

  function handleLongPressMessage(message: DisplayMessage) {
    if (message.isSystem || activeChat?.kind !== 'group') return;
    const source = messageById(message.id);
    if (!source) return;
    light();
    setActionSheetMessage(source);
  }

  // Optimistic toggle so the tap feels instant; the reactions subscription
  // (subscribeToReactions) reconciles with the server shortly after.
  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return;
    setReactionsByMessage((current) => {
      const existing = current[messageId] ?? [];
      const mine = existing.find((r) => r.user_id === user.id);
      let next: MessageReaction[];
      if (mine && mine.emoji === emoji) {
        next = existing.filter((r) => r.user_id !== user.id);
      } else if (mine) {
        next = existing.map((r) => (r.user_id === user.id ? { ...r, emoji } : r));
      } else {
        next = [...existing, { message_id: messageId, user_id: user.id, emoji }];
      }
      return { ...current, [messageId]: next };
    });
    await reactToMessage(messageId, emoji);
  }

  function handleReply(message: DbGroupMessage) {
    setEditingMessage(null);
    setReplyTarget(message);
  }

  function handleStartEdit(message: DbGroupMessage) {
    setReplyTarget(null);
    setEditingMessage(message);
    setDraft(message.text);
  }

  function confirmDeleteMessage(message: DbGroupMessage) {
    showConfirm('Ștergi mesajul?', 'Această acțiune nu poate fi anulată.', 'Șterge', 'Anulează', async () => {
      const ok = await deleteGroupMessage(message.id);
      if (ok) {
        setGroupMessages((current) => current.map((m) => (m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m)));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut șterge mesajul. Încearcă din nou.');
      }
    });
  }

  async function handleTogglePin(message: DbGroupMessage) {
    if (activeChat?.kind !== 'group') return;
    const ok = message.pinned_at ? await unpinGroupMessage(message.id) : await pinGroupMessage(message.id);
    if (ok) refreshPinned(activeChat.id);
  }

  async function handleCreatePoll(question: string, options: string[]) {
    if (!user || activeChat?.kind !== 'group') return;
    setPollComposerVisible(false);
    const sent = await createGroupPoll(activeChat.id, question, options);
    if (sent) {
      setGroupMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]));
      if (sent.poll_id) loadPollAndResults(sent.poll_id);
    } else {
      showAlert('A apărut o eroare', 'Nu am putut crea sondajul. Încearcă din nou.');
    }
  }

  async function handleVotePoll(pollId: string, optionId: string) {
    const ok = await voteGroupPoll(pollId, optionId);
    if (ok) loadPollAndResults(pollId);
  }

  async function handleClosePoll(pollId: string) {
    const ok = await closeGroupPoll(pollId);
    if (ok) loadPollAndResults(pollId);
  }

  const activeFriend = activeChat?.kind === 'friend' ? friends.find((f) => f.id === activeChat.id) : undefined;
  const selectedGroup = activeChat?.kind === 'group' ? events.find((e) => e.id === activeChat.id) : undefined;
  const friendBlocked = !!(user && activeFriend) && blockedIds.has(activeFriend.id);
  const visibleFriends = friends.filter((friend) => !blockedIds.has(friend.id));

  // One shared player for every voice bubble in the thread — swapping its
  // source on tap instead of mounting a player per bubble.
  const voicePlayer = useAudioPlayer();
  const voicePlayerStatus = useAudioPlayerStatus(voicePlayer);
  // isMeteringEnabled feeds the live recording waveform below (recorderState.metering).
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Polled twice as fast as the 500ms default so the waveform reads as live
  // motion instead of visibly stepping.
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const [waveLevels, setWaveLevels] = useState<number[]>(() => Array(RECORDING_WAVE_BARS).fill(0));
  // Every metering sample from the current recording, start to finish (unlike
  // waveLevels, which only keeps a fixed-size rolling window for the live
  // composer view) — downsampled at stop time into the fixed-length waveform
  // stored with the message, for a real per-message shape instead of a flat bar.
  const fullWaveformRef = useRef<number[]>([]);
  // Auto-stops a recording once it hits MAX_RECORDING_MS — cleared on every
  // manual stop so it never fires against a recording that already ended.
  const recordingLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (voicePlayerStatus.didJustFinish) setPlayingMessageId(null);
  }, [voicePlayerStatus.didJustFinish]);

  // Playback errors (bad codec, failed decode, network hiccup on a signed
  // URL, ...) used to fail completely silently — the icon would flip to
  // "playing" with no sound and no visible signal anything went wrong.
  useEffect(() => {
    if (!voicePlayerStatus.error) return;
    setPlayingMessageId(null);
    showAlert('Nu am putut reda mesajul vocal', voicePlayerStatus.error);
  }, [voicePlayerStatus.error]);

  // Scrolling history of recent mic levels while actively recording, for the
  // waveform in the composer — reset to flat whenever recording isn't live.
  useEffect(() => {
    if (!recorderState.isRecording) {
      setWaveLevels((current) => (current.some((v) => v !== 0) ? Array(RECORDING_WAVE_BARS).fill(0) : current));
      return;
    }
    const level = normalizedMeteringLevel(recorderState.metering);
    fullWaveformRef.current.push(level);
    setWaveLevels((current) => [...current.slice(1), level]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.isRecording, recorderState.metering]);

  // A playing voice note used to keep going with no visible "now playing"
  // indicator once you left the thread it started in — closing a thread,
  // switching to a different friend, or going back to the list all change
  // activeChat, so this is the one place that catches all three.
  useEffect(() => {
    voicePlayer.pause();
    setPlayingMessageId(null);
    setRecordedVoice(null);
    setReplyTarget(null);
    setEditingMessage(null);
    setDraft('');
    setUnreadDivider(null);
    setPinnedMessages([]);
    setReactionsByMessage({});
    messagePositionsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat]);

  useEffect(() => {
    // interruptionMode defaults to 'mixWithOthers', which on Android means no
    // audio focus is requested at all — some devices/emulators then play
    // voice notes back genuinely silently (no error, playing:true, just no
    // audible output) since nothing ever told the OS this app wants focus.
    // 'duckOthers' requests real focus while still just lowering (not
    // stopping) whatever else might be playing.
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: 'duckOthers' }).catch(() => {});
  }, []);

  async function toggleVoicePlayback(messageId: string, mediaPath: string) {
    unlockWebAudioPlayback();
    light();
    if (playingMessageId === messageId) {
      voicePlayer.pause();
      setPlayingMessageId(null);
      return;
    }
    const url = await getSignedMediaUrl(mediaPath);
    if (!url) return;
    voicePlayer.replace({ uri: url });
    voicePlayer.play();
    setPlayingMessageId(messageId);
  }

  function clearRecordingLimitTimer() {
    if (recordingLimitTimerRef.current) {
      clearTimeout(recordingLimitTimerRef.current);
      recordingLimitTimerRef.current = null;
    }
  }

  async function startRecording() {
    if (!activeFriend || sendingMedia) return;
    unlockWebAudioPlayback();

    // Checking with getRecordingPermissionsAsync first and only calling
    // requestRecordingPermissionsAsync when actually needed matters on web:
    // that request opens a mic stream just to probe permission, then closes
    // it immediately, right before prepareToRecordAsync() below opens a new
    // one for real. Doing that open-close-reopen back to back on every
    // recording (not just the first) is a known trigger for some Windows
    // audio drivers to hand back a "live" stream that's actually silent.
    let permission = await AudioModule.getRecordingPermissionsAsync();
    if (!permission.granted) {
      permission = await AudioModule.requestRecordingPermissionsAsync();
    }
    if (!permission.granted) {
      // canAskAgain is false once the user has denied it before — Android
      // then answers this instantly without ever showing the system dialog
      // again, which used to fail completely silently here.
      alertPermissionDenied(permission.canAskAgain, 'Activează microfonul pentru Spritz din Setările telefonului ca să poți trimite mesaje vocale.');
      return;
    }

    try {
      light();
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      clearRecordingLimitTimer();
      recordingLimitTimerRef.current = setTimeout(() => {
        recordingLimitTimerRef.current = null;
        // Stop first, alert after — showAlert's web fallback is a blocking
        // window.alert(), and the mic would otherwise keep recording for as
        // long as that dialog sits unacknowledged.
        stopRecordingToPreview();
        showAlert('Limită atinsă', 'Mesajele vocale sunt limitate la 5 minute.');
      }, MAX_RECORDING_MS);
    } catch {
      showAlert('A apărut o eroare', 'Nu am putut porni înregistrarea. Încearcă din nou.');
    }
  }

  // Shared by both the quick-send-while-recording path and sending after a
  // preview listen — the only difference between them is what stops first.
  async function sendVoiceUri(uri: string, durationMs: number, waveform: number[]) {
    if (!user || !activeFriend) return;

    // expo-audio records audio/webm on web (the HIGH_QUALITY preset's native
    // formats are m4a) — tagging a webm blob as m4a uploads fine but breaks
    // playback, since the container doesn't match the extension/content-type.
    const [audioExtension, audioContentType] =
      Platform.OS === 'web' ? ['.webm', 'audio/webm'] : ['.m4a', 'audio/m4a'];

    setSendingMedia(true);
    try {
      const sent = await sendMediaMessage(
        user.id,
        activeFriend.id,
        uri,
        'audio',
        audioExtension,
        audioContentType,
        durationMs,
        waveform
      );
      if (sent) {
        setFriendMessages((current) => [...current, sent]);
        setFriendLast((current) => ({ ...current, [activeFriend.id]: sent }));
        setRecordedVoice(null);
        if (playingMessageId === VOICE_PREVIEW_ID) {
          voicePlayer.pause();
          setPlayingMessageId(null);
        }
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite mesajul vocal. Încearcă din nou.');
      }
    } catch (err) {
      if (err instanceof MediaTooLargeError) {
        showAlert('Fișier prea mare', 'Mesajul vocal depășește dimensiunea maximă admisă.');
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite mesajul vocal. Încearcă din nou.');
      }
    } finally {
      setSendingMedia(false);
    }
  }

  // The send button, pressed mid-recording: stop and upload straight away,
  // skipping the preview step.
  async function stopRecordingAndSend() {
    light();
    clearRecordingLimitTimer();
    const durationMs = Math.round(recorderState.durationMillis);
    const waveform = downsampleWaveform(fullWaveformRef.current, SENT_WAVEFORM_BARS);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) return;
    await sendVoiceUri(uri, durationMs, waveform);
  }

  // The mic/stop button, pressed mid-recording: stop but hold the recording
  // for a preview listen instead of sending immediately.
  async function stopRecordingToPreview() {
    light();
    clearRecordingLimitTimer();
    const durationMs = Math.round(recorderState.durationMillis);
    const waveform = downsampleWaveform(fullWaveformRef.current, SENT_WAVEFORM_BARS);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) return;
    setRecordedVoice({ uri, durationMs, waveform });
  }

  function togglePreviewPlayback() {
    if (!recordedVoice) return;
    light();
    if (playingMessageId === VOICE_PREVIEW_ID) {
      voicePlayer.pause();
      setPlayingMessageId(null);
      return;
    }
    voicePlayer.replace({ uri: recordedVoice.uri });
    voicePlayer.play();
    setPlayingMessageId(VOICE_PREVIEW_ID);
  }

  function discardRecordedVoice() {
    light();
    if (playingMessageId === VOICE_PREVIEW_ID) {
      voicePlayer.pause();
      setPlayingMessageId(null);
    }
    setRecordedVoice(null);
  }

  // The send button: sends whatever's active right now — a mid-recording
  // stop+send, a previewed recording, or the typed draft.
  function handleSendPress() {
    if (recorderState.isRecording) {
      stopRecordingAndSend();
    } else if (recordedVoice) {
      sendVoiceUri(recordedVoice.uri, recordedVoice.durationMs, recordedVoice.waveform);
    } else {
      sendMessage();
    }
  }

  async function sendPickedImage(asset: ImagePicker.ImagePickerAsset, viewOnce: boolean) {
    if (!user || !activeFriend) return;
    const { extension, contentType } = extensionAndTypeForImage(asset);
    light();
    setSendingMedia(true);
    try {
      const sent = await sendMediaMessage(
        user.id,
        activeFriend.id,
        asset.uri,
        'image',
        extension,
        contentType,
        undefined,
        undefined,
        viewOnce
      );
      if (sent) {
        setFriendMessages((current) => [...current, sent]);
        setFriendLast((current) => ({ ...current, [activeFriend.id]: sent }));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite fotografia. Încearcă din nou.');
      }
    } catch (err) {
      if (err instanceof MediaTooLargeError) {
        showAlert('Fișier prea mare', 'Fotografia depășește dimensiunea maximă admisă.');
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite fotografia. Încearcă din nou.');
      }
    } finally {
      setSendingMedia(false);
    }
  }

  async function sendPickedGroupImage(asset: ImagePicker.ImagePickerAsset) {
    if (!user || activeChat?.kind !== 'group') return;
    const { extension, contentType } = extensionAndTypeForImage(asset);
    light();
    setSendingMedia(true);
    try {
      const sent = await sendEventGroupImageMessage(activeChat.id, user.id, asset.uri, extension, contentType);
      if (sent) {
        setGroupMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite fotografia. Încearcă din nou.');
      }
    } finally {
      setSendingMedia(false);
    }
  }

  async function pickAndSendImage() {
    if (!user || !activeChat || sendingMedia) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează accesul la poze din Setările telefonului ca să poți trimite fotografii.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (activeChat.kind === 'group') {
      sendPickedGroupImage(asset);
      return;
    }

    // View-once only makes sense 1:1 — "viewed by whom" is ambiguous in a
    // group, so the group composer never offers this choice.
    //
    // Alert.alert is a no-op stub on react-native-web (see lib/alert.ts) —
    // a 3-button Alert here would silently swallow every DM photo send on
    // web. window.confirm is the real cross-browser 2-choice primitive.
    if (Platform.OS === 'web') {
      sendPickedImage(asset, window.confirm('Trimite ca vizualizare unică (dispare după ce e văzută)?'));
      return;
    }

    Alert.alert('Cum trimiți poza?', undefined, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Trimite normal', onPress: () => sendPickedImage(asset, false) },
      { text: 'Vizualizare unică', onPress: () => sendPickedImage(asset, true) },
    ]);
  }

  async function handleSelectGif(gifUrl: string) {
    if (!user || !activeChat) return;
    setGifPickerVisible(false);
    light();

    if (activeChat.kind === 'group') {
      const sent = await sendEventGroupGifMessage(activeChat.id, user.id, gifUrl);
      if (sent) {
        setGroupMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite GIF-ul. Încearcă din nou.');
      }
      return;
    }

    const sent = await sendGifMessage(user.id, activeChat.id, gifUrl);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendLast((current) => ({ ...current, [activeChat.id]: sent }));
    } else {
      showAlert('A apărut o eroare', 'Nu am putut trimite GIF-ul. Încearcă din nou.');
    }
  }

  // Load your mutual friends + their last message and unread count, for the
  // "PRIETENI" section of the list screen.
  useEffect(() => {
    if (!user) {
      setFriendsLoading(false);
      return;
    }
    setFriendsLoading(true);
    setFriendsError(false);
    getBlockedIds(user.id)
      .then((ids) => setBlockedIds(new Set(ids)))
      .catch(() => {});
    getFriends(user.id)
      .then(async (list) => {
        setFriends(list);
        const [lastMessages, unreadCounts] = await Promise.all([
          Promise.all(list.map((f) => getLastMessage(user.id, f.id))),
          Promise.all(list.map((f) => getUnreadCount(user.id, f.id))),
        ]);
        const lastMap: Record<string, DbMessage | null> = {};
        const unreadMap: Record<string, number> = {};
        list.forEach((f, i) => {
          lastMap[f.id] = lastMessages[i];
          unreadMap[f.id] = unreadCounts[i];
        });
        setFriendLast(lastMap);
        setFriendUnread(unreadMap);
      })
      .catch(() => setFriendsError(true))
      .finally(() => setFriendsLoading(false));
  }, [user, friendsReloadKey]);

  // Load the full thread whenever a friend conversation is opened, and clear
  // their unread badge — mirrors the "opening a chat marks it read" behavior
  // the rest of the list is showing via the read-receipt ticks.
  useEffect(() => {
    if (!user || activeChat?.kind !== 'friend') return;
    const friendId = activeChat.id;
    getThread(user.id, friendId).then(setFriendMessages);
    markThreadRead(user.id, friendId).then(() => {
      setFriendUnread((prev) => ({ ...prev, [friendId]: 0 }));
    });
  }, [user, activeChat]);

  // Live-append messages that land while a friend thread is open. Subscribed
  // once per user, not per activeChat — the channel topic is keyed only on
  // the user's id, so re-subscribing on every open/close of a thread just
  // churned the same Realtime topic and could drop delivery. activeChat is
  // read from a ref so the callback still sees whichever thread is current.
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  useEffect(() => {
    if (!user) return;
    return subscribeToIncoming(user.id, (message) => {
      const current = activeChatRef.current;
      const isOpenThread = current?.kind === 'friend' && message.sender_id === current.id;
      if (isOpenThread) {
        setFriendMessages((prev) => [...prev, message]);
        markThreadRead(user.id, message.sender_id);
      } else {
        setFriendUnread((prev) => ({ ...prev, [message.sender_id]: (prev[message.sender_id] ?? 0) + 1 }));
      }
      setFriendLast((prev) => ({ ...prev, [message.sender_id]: message }));
    });
  }, [user]);

  // Flips a sent message's tick from single- to double-check the moment the
  // recipient reads it, instead of only after the thread list next reloads.
  useEffect(() => {
    if (!user) return;
    return subscribeToReadReceipts(user.id, (message) => {
      setFriendMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      setFriendLast((prev) =>
        prev[message.recipient_id]?.id === message.id ? { ...prev, [message.recipient_id]: message } : prev
      );
    });
  }, [user]);

  // Load an event group's full thread whenever it's opened, and resolve
  // sender names/avatars from profiles (not visible_event_attendees — that
  // view drops anyone who's hidden their activity from the viewer, which
  // would render their messages with a blank name). Subscribed per-event
  // (unlike the friend-DM subscription, which is per-user) since group
  // membership is scoped to the event, not the viewer's own inbox.
  useEffect(() => {
    if (!user || activeChat?.kind !== 'group') return;
    const eventId = activeChat.id;
    let cancelled = false;

    // Snapshot the previous last-read marker *before* overwriting it, so the
    // unread divider still has something to point at — markGroupRead below
    // (fired right after, same as friend DMs' "opening a chat marks it
    // read") would otherwise erase the very timestamp the divider needs.
    getGroupLastRead(eventId, user.id).then((previousLastRead) => {
      if (cancelled) return;
      getGroupThread(eventId).then((thread) => {
        if (cancelled) return;
        setGroupMessages(thread);
        getSenderProfiles(thread.map((m) => m.sender_id)).then((profiles) => {
          if (!cancelled) setGroupSenderProfiles((prev) => ({ ...prev, ...profiles }));
        });
        refreshReactions(thread.map((m) => m.id));
        thread.filter((m) => m.poll_id).forEach((m) => loadPollAndResults(m.poll_id!));

        if (previousLastRead) {
          const unread = thread.filter(
            (m) => !m.is_system && m.sender_id !== user.id && new Date(m.created_at).getTime() > new Date(previousLastRead).getTime(),
          );
          if (unread.length > 0) setUnreadDivider({ messageId: unread[0].id, count: unread.length });
        }
        markGroupRead(eventId, user.id);
      });
    });

    refreshPinned(eventId);

    const unsubscribe = subscribeToEventGroupMessages(eventId, (message) => {
      // The event_id=eq filter can't exclude your own inserts (unlike the
      // friend-DM subscription's recipient_id filter) — dedupe against the
      // optimistic append already done in sendMessage below.
      setGroupMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      getSenderProfiles([message.sender_id]).then((profiles) => {
        setGroupSenderProfiles((prev) => ({ ...prev, ...profiles }));
      });
    });
    const unsubscribeReactions = subscribeToReactions(eventId, () => {
      setGroupMessages((current) => {
        refreshReactions(current.map((m) => m.id));
        return current;
      });
    });
    const unsubscribePolls = subscribeToPollVotes(eventId, () => {
      setPolls((current) => {
        Object.keys(current).forEach((pollId) => loadPollAndResults(pollId));
        return current;
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeReactions();
      unsubscribePolls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeChat]);

  const displayedMessages: DisplayMessage[] = useMemo(() => {
    if (activeChat?.kind === 'group' && user) {
      return groupMessages.map((m) => ({
        id: m.id,
        text: m.text,
        time: formatTime(m.created_at),
        createdAt: m.created_at,
        sender: m.is_system ? '' : m.sender_id === user.id ? 'Tu' : groupSenderProfiles[m.sender_id]?.name ?? '',
        senderId: m.sender_id,
        senderAvatarUrl: groupSenderProfiles[m.sender_id]?.avatarUrl,
        mine: !m.is_system && m.sender_id === user.id,
        read: false,
        isSystem: m.is_system,
        mediaType: m.media_type,
        mediaPath: m.media_path,
        mediaUrl: m.media_url,
        replyToId: m.reply_to_id,
        editedAt: m.edited_at,
        deletedAt: m.deleted_at,
        pinnedAt: m.pinned_at,
        pollId: m.poll_id,
      }));
    }
    if (activeChat?.kind === 'friend' && user) {
      return friendMessages.map((m) => ({
        id: m.id,
        text: m.text,
        time: formatTime(m.created_at),
        sender: m.sender_id === user.id ? 'Tu' : activeFriend?.name ?? '',
        mine: m.sender_id === user.id,
        read: !!m.read_at,
        mediaType: m.media_type,
        mediaPath: m.media_path,
        mediaUrl: m.media_url,
        viewOnce: m.view_once,
        viewedAt: m.viewed_at,
        durationMs: m.duration_ms,
        waveform: m.waveform,
        eventInviteId: m.event_invite_id,
      }));
    }
    return [];
  }, [activeChat, groupMessages, groupSenderProfiles, friendMessages, user, activeFriend]);

  // Track the keyboard ourselves instead of KeyboardAvoidingView — it kept
  // over-shooting (resize windowSoftInputMode plus its own height-shrinking
  // stacked on top of each other). Just float the composer to sit a little
  // above wherever the keyboard's top edge actually is.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const KEYBOARD_GAP = 10;

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(composerOffset, {
        toValue: e.endCoordinates.height + KEYBOARD_GAP,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(composerOffset, {
        toValue: restingComposerOffset,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [composerOffset, restingComposerOffset]);

  // Hide the floating home/messages/profile nav while a chat is open, so it
  // doesn't float over the composer — bring it back on returning to the grid
  // or leaving this screen entirely.
  useEffect(() => {
    setHidden(activeChat !== null);
    return () => setHidden(false);
  }, [activeChat, setHidden]);

  // Jump to the latest message whenever the thread grows (sending a message)
  // or a chat is first opened, instead of leaving the user scrolled wherever
  // they were.
  useEffect(() => {
    if (!activeChat) return;
    const timer = setTimeout(() => messagesScrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [activeChat, displayedMessages.length]);

  async function sendMessage() {
    const text = draft.trim();
    if (text.length > MESSAGE_MAX_LENGTH) return;
    if (!text || !activeChat) return;
    if (!user) return;

    if (activeChat.kind === 'group' && editingMessage) {
      light();
      setDraft('');
      const messageId = editingMessage.id;
      setEditingMessage(null);
      const updated = await editGroupMessage(messageId, text);
      if (updated) {
        setGroupMessages((current) => current.map((m) => (m.id === messageId ? updated : m)));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut edita mesajul. Încearcă din nou.');
      }
      return;
    }

    light();
    setDraft('');

    if (activeChat.kind === 'group') {
      const replyToId = replyTarget?.id ?? null;
      setReplyTarget(null);
      const sent = await sendEventGroupMessage(activeChat.id, user.id, text, replyToId);
      if (sent) {
        setGroupMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]));
      } else {
        setDraft(text);
        showAlert('A apărut o eroare', 'Nu am putut trimite mesajul. Încearcă din nou.');
      }
      return;
    }

    const sent = await sendDirectMessage(user.id, activeChat.id, text);
    if (sent) {
      setFriendMessages((current) => [...current, sent]);
      setFriendLast((current) => ({ ...current, [activeChat.id]: sent }));
    } else {
      // Restore the draft — it was cleared optimistically above, and losing
      // typed text on a failed send (instead of just letting the user retry)
      // is the same silent-failure shape already fixed for follow()/photos.
      setDraft(text);
      showAlert('A apărut o eroare', 'Nu am putut trimite mesajul. Încearcă din nou.');
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <View style={[styles.page, { backgroundColor: theme.page }]}>
        {!activeChat ? (
          <>
            <View style={styles.topBar}>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>BUNĂ {(user?.name || '').toUpperCase()}, SPRITZ?</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Mesaje</Text>
              </View>
              <Pressable
                onPress={() => {
                  light();
                  router.push('/friends');
                }}
                style={styles.roundButton}
                accessibilityLabel="Mesaj nou"
              >
                <Text style={styles.roundButtonText}>+</Text>
              </Pressable>
            </View>

            <FriendsHubTabs active="messages" />

            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 116 }}
              showsVerticalScrollIndicator={false}
            >
              {groupEvents.length > 0 && (
                <View style={styles.groupsSection}>
                  <Text style={[styles.sectionLabel, styles.groupsSectionLabel, { color: theme.textSecondary }]}>GRUPURI</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
                    {groupEvents.map((event) => (
                      <GroupCard
                        key={event.id}
                        emoji={event.emoji}
                        color={event.color}
                        title={event.title}
                        detail={event.hostId === user?.id ? 'Găzduiești' : 'Participi'}
                        onPress={() => {
                          light();
                          setHidden(true);
                          setActiveChat({ kind: 'group', id: event.id });
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {friendsLoading && (
                <View style={styles.listState}>
                  <ActivityIndicator color={colors.green500} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Se încarcă prietenii...</Text>
                </View>
              )}

              {!friendsLoading && friendsError && (
                <View style={styles.listState}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Nu am putut încărca prietenii pentru mesaje.
                  </Text>
                  <Pressable onPress={() => setFriendsReloadKey((key) => key + 1)} style={styles.retryButton}>
                    <Text style={styles.retryText}>Reîncearcă</Text>
                  </Pressable>
                </View>
              )}

              {!friendsLoading && !friendsError && visibleFriends.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Nu ai încă prieteni disponibili pentru mesaje.
                </Text>
              )}

              {!friendsLoading && !friendsError && visibleFriends.length > 0 && (
                <View style={styles.friendsSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIETENI</Text>
                  {visibleFriends.map((friend) => {
                    const last = friendLast[friend.id];
                    const mine = !!last && !!user && last.sender_id === user.id;
                    return (
                      <ChatListRow
                        key={friend.id}
                        avatarNode={<Avatar uri={friend.avatar_url} name={friend.name} size={50} fontSize={18} />}
                        avatarColor="transparent"
                        name={friend.name}
                        timestamp={last ? formatListTimestamp(last.created_at) : null}
                        preview={last ? messagePreview(last) : 'Trimite un mesaj'}
                        mine={mine}
                        read={mine && !!last?.read_at}
                        unreadCount={friendUnread[friend.id] ?? 0}
                        onPress={() => {
                          light();
                          setHidden(true);
                          setActiveChat({ kind: 'friend', id: friend.id });
                        }}
                      />
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={[styles.chatHeader, { borderColor: theme.border }]}>
              <Pressable
                onPress={() => {
                  light();
                  setActiveChat(null);
                }}
                hitSlop={10}
                accessibilityLabel="Înapoi la mesaje"
              >
                <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
              </Pressable>
              {selectedGroup ? (
                <View style={[styles.avatar, { backgroundColor: selectedGroup.color }]}>
                  <Text style={styles.emoji}>{selectedGroup.emoji}</Text>
                </View>
              ) : (
                <Avatar uri={activeFriend?.avatar_url} name={activeFriend?.name ?? '?'} size={38} fontSize={15} style={styles.avatar} />
              )}
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {selectedGroup ? selectedGroup.title : activeFriend?.name}
                </Text>
                {selectedGroup && (
                  <Text numberOfLines={1} style={[styles.online, { color: theme.textSecondary }]}>
                    {selectedGroup.detail || 'Chat de grup'}
                  </Text>
                )}
              </View>
              {activeFriend ? (
                <Pressable
                  onPress={() => {
                    light();
                    router.push(`/user/${activeFriend.id}`);
                  }}
                  hitSlop={10}
                  accessibilityLabel="Vezi profilul"
                >
                  <Text style={[styles.more, { color: theme.textSecondary }]}>•••</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    light();
                    setGroupOptionsVisible(true);
                  }}
                  hitSlop={10}
                  accessibilityLabel="Opțiuni grup"
                >
                  <Text style={[styles.more, { color: theme.textSecondary }]}>•••</Text>
                </Pressable>
              )}
            </View>

            {selectedGroup && (
              <PinnedMessagesBar
                pinned={pinnedMessages}
                senderName={senderDisplayName}
                canUnpin={!!user && selectedGroup.hostId === user.id}
                onJump={jumpToMessage}
                onUnpin={(messageId) => {
                  unpinGroupMessage(messageId).then(() => refreshPinned(selectedGroup.id));
                }}
              />
            )}

            <ScrollView
              ref={messagesScrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => messagesScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {displayedMessages.map((message) => {
                const isUnreadDivider = unreadDivider?.messageId === message.id;
                const dividerNode = isUnreadDivider ? (
                  <View style={styles.unreadDivider}>
                    <View style={[styles.unreadDividerLine, { backgroundColor: theme.border }]} />
                    <Text style={[styles.unreadDividerText, { color: theme.textSecondary }]}>
                      {unreadDivider!.count === 1 ? '1 mesaj necitit' : `${unreadDivider!.count} mesaje necitite`}
                    </Text>
                    <View style={[styles.unreadDividerLine, { backgroundColor: theme.border }]} />
                  </View>
                ) : null;

                if (message.isSystem) {
                  return (
                    <View key={message.id} onLayout={(e) => messagePositionsRef.current.set(message.id, e.nativeEvent.layout.y)}>
                      {dividerNode}
                      <Text style={[styles.systemMessage, { color: theme.textSecondary }]}>{message.text}</Text>
                    </View>
                  );
                }

                const replyTo = message.replyToId ? displayedMessages.find((m) => m.id === message.replyToId) : undefined;
                const replyPreviewText = replyTo
                  ? replyTo.deletedAt
                    ? 'Mesaj șters'
                    : replyTo.text ||
                      (replyTo.mediaType === 'image' ? '📷 Poză' : replyTo.mediaType === 'gif' ? '🎞 GIF' : replyTo.mediaType === 'audio' ? '🎤 Mesaj vocal' : replyTo.pollId ? '📊 Sondaj' : replyTo.eventInviteId ? '🎉 Invitație la eveniment' : '')
                  : '';
                const reactionGroups = groupReactions(reactionsByMessage[message.id] ?? [], user?.id);
                const poll = message.pollId ? polls[message.pollId] : undefined;
                const pollResultsForMessage = message.pollId ? pollResults[message.pollId] ?? [] : [];
                const invite = message.eventInviteId ? invites[message.eventInviteId] : undefined;
                const isHighlighted = highlightedMessageId === message.id;

                return (
                  <View key={message.id} onLayout={(e) => messagePositionsRef.current.set(message.id, e.nativeEvent.layout.y)}>
                    {dividerNode}
                    <Pressable
                      onLongPress={() => handleLongPressMessage(message)}
                      style={[styles.messageRow, message.mine && styles.messageRowMine]}
                    >
                      {!message.mine && selectedGroup && (
                        <Avatar
                          uri={message.senderAvatarUrl}
                          name={message.sender}
                          size={26}
                          fontSize={11}
                          color={selectedGroup.color}
                        />
                      )}
                      {!message.mine && !selectedGroup && <View style={styles.dot} />}
                      <View
                        style={[
                          styles.bubble,
                          message.mine ? styles.mine : [styles.other, { backgroundColor: theme.surfaceMuted }],
                          isHighlighted && styles.bubbleHighlighted,
                        ]}
                      >
                        {selectedGroup && (
                          <Text style={[styles.sender, message.mine ? styles.senderMine : { color: theme.accent }]}>
                            {message.sender}
                          </Text>
                        )}
                        {message.deletedAt ? (
                          <Text style={[styles.deletedText, message.mine ? styles.messageTextMine : { color: theme.textSecondary }]}>
                            🚫 Mesaj șters
                          </Text>
                        ) : poll ? (
                          <PollCard
                            poll={poll}
                            results={pollResultsForMessage}
                            mine={message.mine}
                            canClose={!!user && (poll.created_by === user.id || selectedGroup?.hostId === user.id)}
                            onVote={(optionId) => handleVotePoll(poll.id, optionId)}
                            onClose={() => handleClosePoll(poll.id)}
                          />
                        ) : invite ? (
                          <EventInviteCard
                            invite={invite}
                            mine={message.mine}
                            responding={respondingInviteId === invite.id}
                            onAccept={() => handleRespondInvite(invite.id, true)}
                            onDecline={() => handleRespondInvite(invite.id, false)}
                            onOpenEvent={() => router.push(`/event/${invite.eventId}`)}
                          />
                        ) : (
                          <>
                            {replyTo && (
                              <ReplyQuote
                                sender={replyTo.sender || 'Cineva'}
                                text={replyPreviewText}
                                mine={message.mine}
                                onPress={() => jumpToMessage(replyTo.id)}
                              />
                            )}
                            {(message.mediaType === 'image' || message.mediaType === 'gif') && (message.mediaPath || message.mediaUrl) ? (
                              <ImageBubble
                                path={message.mediaPath}
                                url={message.mediaUrl}
                                viewOnce={!message.mine && !!message.viewOnce}
                                alreadyViewed={!!message.viewedAt}
                                onReveal={() => markMessageViewed(message.id)}
                              />
                            ) : message.mediaType === 'audio' && message.mediaPath ? (
                              <VoiceBubble
                                isPlaying={playingMessageId === message.id}
                                isMine={message.mine}
                                durationMs={message.durationMs}
                                elapsedMs={playingMessageId === message.id ? voicePlayerStatus.currentTime * 1000 : 0}
                                waveform={message.waveform}
                                onToggle={() => toggleVoicePlayback(message.id, message.mediaPath!)}
                              />
                            ) : (
                              <Text
                                style={[
                                  styles.messageText,
                                  message.mine ? styles.messageTextMine : { color: theme.textPrimary },
                                ]}
                              >
                                {message.text}
                              </Text>
                            )}
                          </>
                        )}
                        <View style={styles.bubbleFooter}>
                          {message.pinnedAt && <Ionicons name="pin" size={10} color={message.mine ? '#D6FFE2' : theme.accent} />}
                          {message.editedAt && !message.deletedAt && (
                            <Text style={[styles.editedLabel, message.mine ? styles.timeMine : { color: theme.textSecondary }]}>editat</Text>
                          )}
                          <Text style={[styles.time, message.mine ? styles.timeMine : { color: theme.textSecondary }]}>
                            {message.time}
                          </Text>
                          {message.mine && (
                            <Ionicons
                              name={message.read ? 'checkmark-done' : 'checkmark'}
                              size={13}
                              color={message.read ? colors.white : 'rgba(255,255,255,0.7)'}
                            />
                          )}
                        </View>
                      </View>
                    </Pressable>
                    {!message.deletedAt && reactionGroups.length > 0 && (
                      <View style={message.mine ? styles.reactionsRowMine : undefined}>
                        <ReactionChipsRow groups={reactionGroups} onPress={(emoji) => toggleReaction(message.id, emoji)} />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {!friendBlocked && draft.length > 0 && (
              <Text
                style={[
                  styles.charCounter,
                  { color: draft.length >= MESSAGE_MAX_LENGTH ? '#E5484D' : theme.textSecondary },
                ]}
              >
                {draft.length}/{MESSAGE_MAX_LENGTH}
              </Text>
            )}

            {unreadDivider && (
              <Pressable
                onPress={() => {
                  jumpToMessage(unreadDivider.messageId);
                  setUnreadDivider(null);
                }}
                style={[styles.jumpToUnread, { backgroundColor: colors.green500, bottom: insets.bottom + 84 }]}
              >
                <Ionicons name="arrow-down" size={13} color={colors.white} />
                <Text style={styles.jumpToUnreadText}>
                  {unreadDivider.count === 1 ? '1 mesaj necitit' : `${unreadDivider.count} mesaje necitite`}
                </Text>
              </Pressable>
            )}

            {selectedGroup && (replyTarget || editingMessage) && (
              <View style={[styles.replyBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.replyBarBody}>
                  <Text style={[styles.replyBarLabel, { color: colors.green500 }]}>
                    {editingMessage ? 'Editezi mesajul' : `Răspunzi la ${senderDisplayName(replyTarget!.sender_id)}`}
                  </Text>
                  <Text numberOfLines={1} style={[styles.replyBarText, { color: theme.textSecondary }]}>
                    {editingMessage ? editingMessage.text : replyTarget!.text || '📎 Atașament'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setReplyTarget(null);
                    if (editingMessage) {
                      setEditingMessage(null);
                      setDraft('');
                    }
                  }}
                  hitSlop={8}
                  accessibilityLabel="Anulează"
                >
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            )}

            {/* marginBottom tracks the keyboard directly (see the effect above)
                instead of KeyboardAvoidingView, which overshot on Android. */}
            {friendBlocked ? (
              <Animated.View
                style={[
                  styles.composer,
                  styles.blockedComposer,
                  { marginBottom: composerOffset, backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
              >
                <Ionicons name="lock-closed" size={15} color={theme.textSecondary} />
                <Text style={[styles.blockedComposerText, { color: theme.textSecondary }]} numberOfLines={2}>
                  Ai blocat acest utilizator. Poți continua conversația după ce îl deblochezi din profilul lui.
                </Text>
              </Animated.View>
            ) : (
            <Animated.View
              style={[
                styles.composer,
                { marginBottom: composerOffset, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              {selectedGroup ? (
                // Voice notes stay DM-only (sendMediaMessage takes a single
                // recipient, not an event) — group gets photo + GIF, no mic.
                <>
                  <Pressable
                    onPress={pickAndSendImage}
                    disabled={sendingMedia}
                    style={[styles.add, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                    accessibilityLabel="Trimite o poză"
                  >
                    <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGifPickerVisible(true)}
                    disabled={sendingMedia}
                    style={[styles.gifButton, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                    accessibilityLabel="Trimite un GIF"
                  >
                    <Text style={[styles.gifButtonText, { color: theme.accent }]}>GIF</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPollComposerVisible(true)}
                    disabled={sendingMedia}
                    style={[styles.add, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                    accessibilityLabel="Creează un sondaj"
                  >
                    <Ionicons name="bar-chart-outline" size={17} color={theme.accent} />
                  </Pressable>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={sendMessage}
                    placeholder={editingMessage ? 'Editează mesajul...' : 'Scrie în grup...'}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    returnKeyType="send"
                    maxLength={MESSAGE_MAX_LENGTH}
                  />
                  <Pressable
                    onPress={sendMessage}
                    style={[styles.send, !draft.trim() && styles.sendOff]}
                    accessibilityLabel={editingMessage ? 'Salvează' : 'Trimite'}
                  >
                    <Text style={styles.sendText}>{editingMessage ? '✓' : '↑'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
              {recordedVoice && !recorderState.isRecording ? (
                <Pressable
                  onPress={discardRecordedVoice}
                  disabled={sendingMedia}
                  style={[styles.discard, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                  accessibilityLabel="Șterge înregistrarea"
                >
                  <Ionicons name="trash" size={16} color={theme.textSecondary} />
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={pickAndSendImage}
                    disabled={sendingMedia || recorderState.isRecording}
                    style={[styles.add, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                    accessibilityLabel="Trimite o poză"
                  >
                    <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGifPickerVisible(true)}
                    disabled={sendingMedia || recorderState.isRecording}
                    style={[styles.gifButton, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                    accessibilityLabel="Trimite un GIF"
                  >
                    <Text style={[styles.gifButtonText, { color: theme.accent }]}>GIF</Text>
                  </Pressable>
                </>
              )}
              {recorderState.isRecording ? (
                <View style={styles.recordingRow}>
                  <RecordingWaveform levels={waveLevels} />
                  <Text style={[styles.recordingTimer, { color: colors.green500 }]}>
                    {formatDuration(recorderState.durationMillis)}
                  </Text>
                </View>
              ) : recordedVoice ? (
                <View style={styles.recordingRow}>
                  <PreviewWaveform
                    waveform={recordedVoice.waveform}
                    progress={
                      playingMessageId === VOICE_PREVIEW_ID && recordedVoice.durationMs
                        ? Math.min(1, (voicePlayerStatus.currentTime * 1000) / recordedVoice.durationMs)
                        : 0
                    }
                  />
                  <Text style={[styles.recordingTimer, { color: theme.textSecondary }]}>
                    {formatDuration(
                      playingMessageId === VOICE_PREVIEW_ID
                        ? Math.max(0, recordedVoice.durationMs - voicePlayerStatus.currentTime * 1000)
                        : recordedVoice.durationMs
                    )}
                  </Text>
                </View>
              ) : (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={sendMessage}
                  placeholder="Scrie un mesaj..."
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary }]}
                  returnKeyType="send"
                  maxLength={MESSAGE_MAX_LENGTH}
                />
              )}
              <Pressable
                onPress={
                  recorderState.isRecording
                    ? stopRecordingToPreview
                    : recordedVoice
                      ? togglePreviewPlayback
                      : startRecording
                }
                disabled={sendingMedia}
                style={[styles.voice, recorderState.isRecording && styles.voiceActive, { opacity: sendingMedia ? 0.5 : 1 }]}
                accessibilityLabel={
                  recorderState.isRecording
                    ? 'Oprește înregistrarea'
                    : recordedVoice
                      ? 'Redă înregistrarea'
                      : 'Înregistrează mesaj vocal'
                }
              >
                <Ionicons
                  name={
                    recorderState.isRecording
                      ? 'stop'
                      : recordedVoice
                        ? playingMessageId === VOICE_PREVIEW_ID
                          ? 'pause'
                          : 'play'
                        : 'mic'
                  }
                  size={20}
                  color={colors.white}
                />
              </Pressable>
              <Pressable
                onPress={handleSendPress}
                disabled={sendingMedia}
                style={[styles.send, !draft.trim() && !recorderState.isRecording && !recordedVoice && styles.sendOff]}
                accessibilityLabel="Trimite"
              >
                <Text style={styles.sendText}>↑</Text>
              </Pressable>
                </>
              )}
            </Animated.View>
            )}
          </>
        )}
      </View>

      <GifPickerModal visible={gifPickerVisible} onSelect={handleSelectGif} onClose={() => setGifPickerVisible(false)} />

      {selectedGroup && (
        <>
          <MessageActionsSheet
            visible={!!actionSheetMessage}
            onClose={() => setActionSheetMessage(null)}
            onReact={(emoji) => actionSheetMessage && toggleReaction(actionSheetMessage.id, emoji)}
            actions={
              actionSheetMessage
                ? ([
                    { key: 'reply', label: 'Răspunde', icon: 'arrow-undo-outline', onPress: () => handleReply(actionSheetMessage) },
                    !actionSheetMessage.deleted_at &&
                      actionSheetMessage.sender_id === user?.id &&
                      !actionSheetMessage.media_type &&
                      !actionSheetMessage.poll_id && {
                        key: 'edit',
                        label: 'Editează',
                        icon: 'create-outline',
                        onPress: () => handleStartEdit(actionSheetMessage),
                      },
                    !actionSheetMessage.deleted_at &&
                      (actionSheetMessage.sender_id === user?.id || selectedGroup.hostId === user?.id) && {
                        key: 'delete',
                        label: 'Șterge',
                        icon: 'trash-outline',
                        destructive: true,
                        onPress: () => confirmDeleteMessage(actionSheetMessage),
                      },
                    !actionSheetMessage.deleted_at &&
                      selectedGroup.hostId === user?.id && {
                        key: 'pin',
                        label: actionSheetMessage.pinned_at ? 'Anulează fixarea' : 'Fixează mesajul',
                        icon: 'pin-outline',
                        onPress: () => handleTogglePin(actionSheetMessage),
                      },
                  ].filter(Boolean) as MessageAction[])
                : []
            }
          />

          <PollComposerModal
            visible={pollComposerVisible}
            onClose={() => setPollComposerVisible(false)}
            onCreate={handleCreatePoll}
          />

          <SharedMediaModal visible={sharedMediaVisible} eventId={selectedGroup.id} onClose={() => setSharedMediaVisible(false)} />

          <GroupSearchModal
            visible={searchVisible}
            messages={groupMessages}
            senderName={senderDisplayName}
            onClose={() => setSearchVisible(false)}
            onJump={jumpToMessage}
          />

          <SafetyMenu
            visible={groupOptionsVisible}
            title={selectedGroup.title}
            onClose={() => setGroupOptionsVisible(false)}
            actions={[
              { key: 'search', label: 'Caută în conversație', icon: 'search-outline', onPress: () => setSearchVisible(true) },
              { key: 'media', label: 'Poze din grup', icon: 'image-outline', onPress: () => setSharedMediaVisible(true) },
              { key: 'poll', label: 'Sondaj nou', icon: 'bar-chart-outline', onPress: () => setPollComposerVisible(true) },
            ]}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: { flex: 1 },
  topBar: { paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  roundButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
  groupsSection: { paddingTop: 10 },
  groupsSectionLabel: { paddingHorizontal: 18 },
  groupsRow: { paddingHorizontal: 18, gap: 16 },
  groupCard: { width: 92, alignItems: 'center' },
  groupCardAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  groupCardEmoji: { fontSize: 32 },
  groupCardTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  groupCardDetail: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  friendsSection: { paddingHorizontal: 18, paddingTop: 22 },
  listState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { textAlign: 'center', fontSize: 13, paddingVertical: 12 },
  retryButton: { alignSelf: 'center', borderRadius: 12, backgroundColor: colors.green500, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  chatBody: { flex: 1 },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '700', flexShrink: 1, marginRight: 8 },
  chatTime: { fontSize: 11, fontWeight: '700' },
  chatBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  chatTick: { marginRight: 3 },
  chatPreview: { fontSize: 13, flexShrink: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  avatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  chatHeader: { marginHorizontal: 22, marginTop: 14, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  online: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  more: { marginLeft: 'auto', fontSize: 18, letterSpacing: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, gap: 12 },
  systemMessage: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginVertical: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  messageRowMine: { justifyContent: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D960', marginBottom: 12 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8 },
  other: { borderRadius: 18, borderBottomLeftRadius: 5 },
  mine: { backgroundColor: '#12C854', borderRadius: 18, borderBottomRightRadius: 5 },
  sender: { fontSize: 11, fontWeight: '800', marginBottom: 3 },
  senderMine: { color: '#D6FFE2', textAlign: 'right' },
  messageText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  messageTextMine: { color: '#FFFFFF' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  time: { fontSize: 9, textAlign: 'right' },
  timeMine: { color: '#D6FFE2' },
  composer: { marginHorizontal: 16, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  blockedComposer: { paddingHorizontal: 14, paddingVertical: 12 },
  blockedComposerText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 25, fontWeight: '300', marginTop: -2 },
  gifButton: { height: 34, paddingHorizontal: 9, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  gifButtonText: { fontSize: 11, fontWeight: '800' },
  charCounter: { alignSelf: 'flex-end', marginHorizontal: 22, marginBottom: 4, fontSize: 10, fontWeight: '700' },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  // minWidth: 0 matters specifically on web — react-native-web's flex
  // children default to a CSS min-width of "auto" (their content size), not
  // 0 like native RN, so a flex:1 row nested inside another flex:1 row can
  // collapse to near-nothing there instead of sharing the available width.
  recordingRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 4 },
  recordingTimer: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  waveformRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 32 },
  waveformBar: { flex: 1, minWidth: 3, borderRadius: 2, backgroundColor: '#12C854' },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#BDEBCB' },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: -4 },
  voice: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 23 },
  voiceActive: { backgroundColor: '#E5484D' },
  discard: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  imageBubble: { width: 200, height: 200, borderRadius: 14 },
  imageBubbleLoading: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  viewOnceLabel: { fontSize: 10, fontWeight: '700' },
  voiceBubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 160 },
  // minWidth: 0 matters on web — see the composer waveform's identical note.
  voiceWaveformRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 },
  voiceWaveformBar: { flex: 1, minWidth: 2, borderRadius: 1 },
  voiceDuration: { fontSize: 12, fontWeight: '700' },
  bubbleHighlighted: { borderWidth: 2, borderColor: colors.green500 },
  deletedText: { fontSize: 13, fontStyle: 'italic' },
  editedLabel: { fontSize: 9, fontStyle: 'italic' },
  replyQuote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  replyQuoteSender: { fontSize: 10, fontWeight: '800' },
  replyQuoteText: { fontSize: 11, marginTop: 1 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4, marginLeft: 33 },
  reactionsRowMine: { alignItems: 'flex-end' },
  reactionChip: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  reactionChipText: { fontSize: 11, fontWeight: '700' },
  unreadDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  unreadDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  unreadDividerText: { fontSize: 10, fontWeight: '800' },
  jumpToUnread: {
    position: 'absolute',
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 5,
  },
  jumpToUnreadText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: colors.green500,
  },
  replyBarBody: { flex: 1, minWidth: 0 },
  replyBarLabel: { fontSize: 11, fontWeight: '800' },
  replyBarText: { fontSize: 12, marginTop: 2 },
});
