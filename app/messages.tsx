import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { colors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';
import { useHaptics } from '@/contexts/HapticsContext';
import { useUser } from '@/contexts/UserContext';
import { Avatar } from '@/components/common/Avatar';
import { Profile, getMutualFriends } from '@/lib/social';
import { extensionAndTypeForImage } from '@/lib/media';
import { alertPermissionDenied } from '@/lib/permissions';
import { showAlert } from '@/lib/alert';
import {
  DbMessage,
  MediaType,
  getLastMessage,
  getSignedMediaUrl,
  getThread,
  getUnreadCount,
  markThreadRead,
  sendDirectMessage,
  sendMediaMessage,
  subscribeToIncoming,
  subscribeToReadReceipts,
} from '@/lib/messaging';

// Sentinel playingMessageId for the not-yet-sent recording preview — no real
// message has this id, so it can share the shared voicePlayer/playingMessageId
// state with the sent-message bubbles without colliding.
const VOICE_PREVIEW_ID = '__voice-preview__';

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
// The 3 group chats below stay mock/decorative; real 1:1 friend DMs are a
// separate, backend-backed capability added alongside them.

type DisplayMessage = {
  id: string;
  text: string;
  time: string;
  sender: string;
  mine: boolean;
  read: boolean;
  mediaType?: MediaType | null;
  mediaPath?: string | null;
  durationMs?: number | null;
};
type ActiveChat = { kind: 'group'; id: string } | { kind: 'friend'; id: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

// What the chat-list row shows for a thread's last message — media has no
// text (see lib/messaging.sendMediaMessage), so it needs its own preview.
function messagePreview(message: DbMessage): string {
  if (message.media_type === 'image') return '📷 Poză';
  if (message.media_type === 'audio') return '🎤 Mesaj vocal';
  return message.text;
}

function formatDuration(ms: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// One bubble's photo, resolved from a signed URL on demand — the DB only
// stores the private bucket path (see messages.media_path).
function ImageBubble({ path }: { path: string }) {
  const { colors: theme } = useAppTheme();
  const [url, setUrl] = useState<string | null>(null);
  // Bumped to force a fresh signed URL if the current one fails to load —
  // e.g. a thread left open past the 1-hour signed-URL TTL. Without this,
  // an expired URL just showed a permanently broken image.
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    getSignedMediaUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path, retryCount]);

  if (!url) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleLoading, { backgroundColor: theme.surfaceMuted }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
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
  onToggle,
}: {
  isPlaying: boolean;
  isMine: boolean;
  durationMs: number | null | undefined;
  elapsedMs: number;
  onToggle: () => void;
}) {
  const { colors: theme } = useAppTheme();
  const remainingMs = isPlaying ? Math.max(0, (durationMs ?? 0) - elapsedMs) : durationMs;
  return (
    <Pressable onPress={onToggle} style={styles.voiceBubbleRow} hitSlop={6}>
      <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={isMine ? colors.white : colors.green500} />
      <View style={[styles.voiceWave, { backgroundColor: isMine ? 'rgba(255,255,255,0.5)' : colors.green500 }]} />
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

const chats = [
  { id: 'brasov', title: 'Brașov azi', detail: '12 persoane active', emoji: '⛰️', color: '#25D960', time: 'Azi' },
  { id: 'gasca', title: 'Gașca de sâmbătă', detail: 'Vlad: Ne vedem la 8?', emoji: '🍹', color: '#08B94C', time: 'Azi' },
  { id: 'poiana', title: 'Poiana Brașov', detail: 'Ioana: Vin și eu!', emoji: '❄️', color: '#74EB99', time: 'Azi' },
];

// Shared chat-list row — same shape for the mock group chats and the real
// friend DMs, matching the reference design: avatar, name + timestamp on
// top, preview (with a read-receipt tick when it's your own last message)
// and an unread badge on the bottom line.
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
// (ChatListRow) they already had, per the requested distinction.
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
        <View style={styles.groupCardDemoBadge}>
          <Text style={styles.groupCardDemoBadgeText}>PREVIEW</Text>
        </View>
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

const starterMessages: DisplayMessage[] = [
  { id: '1', sender: 'Mara', text: 'Ce faceți diseară? ✨', time: '18:41', mine: false, read: false },
  { id: '2', sender: 'Vlad', text: 'Mergem la un spriț în centru?', time: '18:42', mine: false, read: false },
  { id: '3', sender: 'Tu', text: 'Eu sunt pentru! Unde ne vedem?', time: '18:43', mine: true, read: true },
  { id: '4', sender: 'Ioana', text: 'La Republicii, pe la 20:00?', time: '18:44', mine: false, read: false },
];

export default function Messages() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  const { light } = useHaptics();
  const { user } = useUser();
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
  const [groupMessages, setGroupMessages] = useState<DisplayMessage[]>(starterMessages);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendLast, setFriendLast] = useState<Record<string, DbMessage | null>>({});
  const [friendUnread, setFriendUnread] = useState<Record<string, number>>({});
  const [friendMessages, setFriendMessages] = useState<DbMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  // A stopped-but-unsent recording, waiting for the user to preview-listen
  // to it and either send or discard it. Reuses the same voicePlayer/
  // playingMessageId machinery as the message bubbles, under this sentinel id.
  const [recordedVoice, setRecordedVoice] = useState<{ uri: string; durationMs: number } | null>(null);
  const messagesScrollRef = useRef<ScrollView>(null);
  const restingComposerOffset = insets.bottom + 16;
  const composerOffset = useRef(new Animated.Value(restingComposerOffset)).current;

  const activeFriend = activeChat?.kind === 'friend' ? friends.find((f) => f.id === activeChat.id) : undefined;
  const selectedGroup = activeChat?.kind === 'group' ? chats.find((c) => c.id === activeChat.id) : undefined;

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
      setWaveLevels(Array(RECORDING_WAVE_BARS).fill(0));
      return;
    }
    setWaveLevels((current) => [...current.slice(1), normalizedMeteringLevel(recorderState.metering)]);
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

  async function startRecording() {
    if (!activeFriend || sendingMedia) return;
    unlockWebAudioPlayback();

    const permission = await AudioModule.requestRecordingPermissionsAsync();
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
    } catch {
      showAlert('A apărut o eroare', 'Nu am putut porni înregistrarea. Încearcă din nou.');
    }
  }

  // Shared by both the quick-send-while-recording path and sending after a
  // preview listen — the only difference between them is what stops first.
  async function sendVoiceUri(uri: string, durationMs: number) {
    if (!user || !activeFriend) return;

    // expo-audio records audio/webm on web (the HIGH_QUALITY preset's native
    // formats are m4a) — tagging a webm blob as m4a uploads fine but breaks
    // playback, since the container doesn't match the extension/content-type.
    const [audioExtension, audioContentType] =
      Platform.OS === 'web' ? ['.webm', 'audio/webm'] : ['.m4a', 'audio/m4a'];

    setSendingMedia(true);
    try {
      const sent = await sendMediaMessage(user.id, activeFriend.id, uri, 'audio', audioExtension, audioContentType, durationMs);
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
    } catch {
      showAlert('A apărut o eroare', 'Nu am putut trimite mesajul vocal. Încearcă din nou.');
    } finally {
      setSendingMedia(false);
    }
  }

  // The send button, pressed mid-recording: stop and upload straight away,
  // skipping the preview step.
  async function stopRecordingAndSend() {
    light();
    const durationMs = Math.round(recorderState.durationMillis);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) return;
    await sendVoiceUri(uri, durationMs);
  }

  // The mic/stop button, pressed mid-recording: stop but hold the recording
  // for a preview listen instead of sending immediately.
  async function stopRecordingToPreview() {
    light();
    const durationMs = Math.round(recorderState.durationMillis);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) return;
    setRecordedVoice({ uri, durationMs });
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
      sendVoiceUri(recordedVoice.uri, recordedVoice.durationMs);
    } else {
      sendMessage();
    }
  }

  async function pickAndSendImage() {
    if (!user || !activeFriend || sendingMedia) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermissionDenied(permission.canAskAgain, 'Activează accesul la poze din Setările telefonului ca să poți trimite fotografii.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const { extension, contentType } = extensionAndTypeForImage(asset);

    light();
    setSendingMedia(true);
    try {
      const sent = await sendMediaMessage(user.id, activeFriend.id, asset.uri, 'image', extension, contentType);
      if (sent) {
        setFriendMessages((current) => [...current, sent]);
        setFriendLast((current) => ({ ...current, [activeFriend.id]: sent }));
      } else {
        showAlert('A apărut o eroare', 'Nu am putut trimite fotografia. Încearcă din nou.');
      }
    } catch {
      showAlert('A apărut o eroare', 'Nu am putut trimite fotografia. Încearcă din nou.');
    } finally {
      setSendingMedia(false);
    }
  }

  // Load your mutual friends + their last message and unread count, for the
  // "PRIETENI" section of the list screen.
  useEffect(() => {
    if (!user) return;
    getMutualFriends(user.id).then(async (list) => {
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
    });
  }, [user]);

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

  const displayedMessages: DisplayMessage[] = useMemo(() => {
    if (activeChat?.kind === 'group') return groupMessages;
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
        durationMs: m.duration_ms,
      }));
    }
    return [];
  }, [activeChat, groupMessages, friendMessages, user, activeFriend]);

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
  }, [activeChat, displayedMessages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !activeChat) return;
    light();
    setDraft('');

    if (activeChat.kind === 'group') {
      setGroupMessages((current) => [...current, { id: String(Date.now()), sender: 'Tu', text, time: 'Acum', mine: true, read: false }]);
      return;
    }

    if (!user) return;
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

            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 116 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.groupsSection}>
                <Text style={[styles.sectionLabel, styles.groupsSectionLabel, { color: theme.textSecondary }]}>GRUPURI</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
                  {chats.map((chat) => (
                    <GroupCard
                      key={chat.id}
                      emoji={chat.emoji}
                      color={chat.color}
                      title={chat.title}
                      detail={chat.detail}
                      onPress={() => {
                        light();
                        setHidden(true);
                        setActiveChat({ kind: 'group', id: chat.id });
                      }}
                    />
                  ))}
                </ScrollView>
              </View>

              {friends.length > 0 && (
                <View style={styles.friendsSection}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIETENI</Text>
                  {friends.map((friend) => {
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
                {selectedGroup && <Text style={[styles.online, { color: theme.accent }]}>● activi acum în Brașov</Text>}
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
                <Text style={[styles.more, { color: theme.textSecondary }]}>•••</Text>
              )}
            </View>

            <ScrollView
              ref={messagesScrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => messagesScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {selectedGroup && <Text style={[styles.today, { color: theme.textSecondary }]}>ASTĂZI</Text>}
              {displayedMessages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.mine && styles.messageRowMine]}>
                  {!message.mine && <View style={styles.dot} />}
                  <View
                    style={[
                      styles.bubble,
                      message.mine ? styles.mine : [styles.other, { backgroundColor: theme.surfaceMuted }],
                    ]}
                  >
                    {selectedGroup && (
                      <Text style={[styles.sender, message.mine ? styles.senderMine : { color: theme.accent }]}>
                        {message.sender}
                      </Text>
                    )}
                    {message.mediaType === 'image' && message.mediaPath ? (
                      <ImageBubble path={message.mediaPath} />
                    ) : message.mediaType === 'audio' && message.mediaPath ? (
                      <VoiceBubble
                        isPlaying={playingMessageId === message.id}
                        isMine={message.mine}
                        durationMs={message.durationMs}
                        elapsedMs={playingMessageId === message.id ? voicePlayerStatus.currentTime * 1000 : 0}
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
                    <View style={styles.bubbleFooter}>
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
                </View>
              ))}
            </ScrollView>

            {/* marginBottom tracks the keyboard directly (see the effect above)
                instead of KeyboardAvoidingView, which overshot on Android. */}
            <Animated.View
              style={[
                styles.composer,
                { marginBottom: composerOffset, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
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
                <Pressable
                  onPress={pickAndSendImage}
                  disabled={sendingMedia || recorderState.isRecording}
                  style={[styles.add, { backgroundColor: theme.surfaceMuted, opacity: sendingMedia ? 0.5 : 1 }]}
                  accessibilityLabel="Trimite o poză"
                >
                  <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
                </Pressable>
              )}
              {recorderState.isRecording ? (
                <View style={styles.recordingRow}>
                  <RecordingWaveform levels={waveLevels} />
                  <Text style={[styles.recordingTimer, { color: colors.green500 }]}>
                    {formatDuration(recorderState.durationMillis)}
                  </Text>
                </View>
              ) : (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={sendMessage}
                  placeholder={
                    recordedVoice
                      ? `Mesaj vocal • ${formatDuration(
                          playingMessageId === VOICE_PREVIEW_ID
                            ? Math.max(0, recordedVoice.durationMs - voicePlayerStatus.currentTime * 1000)
                            : recordedVoice.durationMs
                        )}`
                      : 'Scrie un mesaj...'
                  }
                  placeholderTextColor={theme.textSecondary}
                  editable={!recordedVoice}
                  style={[styles.input, { color: theme.textPrimary }]}
                  returnKeyType="send"
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
            </Animated.View>
          </>
        )}
      </View>
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
  groupCardDemoBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  groupCardDemoBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  groupCardTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  groupCardDetail: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  friendsSection: { paddingHorizontal: 18, paddingTop: 22 },
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
  today: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, alignSelf: 'center', marginBottom: 4 },
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
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 25, fontWeight: '300', marginTop: -2 },
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
  imageBubbleLoading: { alignItems: 'center', justifyContent: 'center' },
  voiceBubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 160 },
  voiceWave: { flex: 1, height: 3, borderRadius: 2 },
  voiceDuration: { fontSize: 12, fontWeight: '700' },
});
