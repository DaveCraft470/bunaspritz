import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useNavVisibility } from '@/contexts/NavVisibilityContext';

// Chat list / message bubble design by nituraul8 — ported from App.tsx onto
// its own Expo Router screen so it lives alongside the rest of the app.

type Message = { id: string; text: string; time: string; sender?: string; mine?: boolean };

// Fakes a text-stroke (RN has no such style) by stacking black copies of the
// label offset by 1px in every direction underneath the real, on-top copy.
const OUTLINE_OFFSETS: Array<[number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function OutlinedGroupName({ children }: { children: string }) {
  return (
    <>
      {OUTLINE_OFFSETS.map(([dx, dy], i) => (
        <Text
          key={i}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.groupNameOverlay, styles.groupNameOutline, { transform: [{ translateX: dx }, { translateY: dy }] }]}
        >
          {children}
        </Text>
      ))}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.groupNameOverlay}>
        {children}
      </Text>
    </>
  );
}

const chats = [
  { id: 'brasov', title: 'Brașov azi', detail: '12 persoane active', emoji: '⛰️', color: '#25D960' },
  { id: 'gasca', title: 'Gașca de sâmbătă', detail: 'Vlad: Ne vedem la 8?', emoji: '🍹', color: '#08B94C' },
  { id: 'poiana', title: 'Poiana Brașov', detail: 'Ioana: Vin și eu!', emoji: '❄️', color: '#74EB99' },
];

const starterMessages: Message[] = [
  { id: '1', sender: 'Mara', text: 'Ce faceți diseară? ✨', time: '18:41' },
  { id: '2', sender: 'Vlad', text: 'Mergem la un spriț în centru?', time: '18:42' },
  { id: '3', sender: 'Tu', text: 'Eu sunt pentru! Unde ne vedem?', time: '18:43', mine: true },
  { id: '4', sender: 'Ioana', text: 'La Republicii, pe la 20:00?', time: '18:44' },
];

export default function Messages() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useAppTheme();
  const { setHidden } = useNavVisibility();
  // null = showing the group list; a chat only opens once the user taps it.
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const selectedChat = activeChat ? chats.find((chat) => chat.id === activeChat) : undefined;

  // Hide the floating home/messages/profile nav while a chat is open, so it
  // doesn't float over the composer — bring it back on returning to the grid
  // or leaving this screen entirely.
  useEffect(() => {
    setHidden(activeChat !== null);
    return () => setHidden(false);
  }, [activeChat, setHidden]);

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: String(Date.now()), sender: 'Tu', text, time: 'Acum', mine: true }]);
    setDraft('');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />
      <KeyboardAvoidingView
        style={[styles.page, { backgroundColor: theme.page }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {!selectedChat ? (
          <>
            <View style={styles.topBar}>
              <View>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>BUNĂ ANDREI, SPRITZ?</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Mesaje</Text>
              </View>
              <Pressable style={styles.roundButton}>
                <Text style={styles.roundButtonText}>+</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={[styles.groupGrid, { paddingBottom: insets.bottom + 116 }]}
              showsVerticalScrollIndicator={false}
            >
              {chats.map((chat) => (
                <Pressable
                  key={chat.id}
                  onPress={() => {
                    setHidden(true);
                    setActiveChat(chat.id);
                  }}
                  style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.groupPhoto, { backgroundColor: chat.color }]}>
                    <Text style={styles.groupEmoji}>{chat.emoji}</Text>
                    <OutlinedGroupName>{chat.title.toUpperCase()}</OutlinedGroupName>
                  </View>
                  <Text numberOfLines={1} style={[styles.groupDetail, { color: theme.textSecondary }]}>
                    {chat.detail}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={[styles.chatHeader, { borderColor: theme.border }]}>
              <Pressable onPress={() => setActiveChat(null)} hitSlop={10} accessibilityLabel="Înapoi la grupuri">
                <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
              </Pressable>
              <View style={[styles.avatar, { backgroundColor: selectedChat.color }]}>
                <Text style={styles.emoji}>{selectedChat.emoji}</Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{selectedChat.title}</Text>
                <Text style={[styles.online, { color: theme.accent }]}>● activi acum în Brașov</Text>
              </View>
              <Text style={[styles.more, { color: theme.textSecondary }]}>•••</Text>
            </View>

            <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
              <Text style={[styles.today, { color: theme.textSecondary }]}>ASTĂZI</Text>
              {messages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.mine && styles.messageRowMine]}>
                  {!message.mine && <View style={styles.dot} />}
                  <View
                    style={[
                      styles.bubble,
                      message.mine ? styles.mine : [styles.other, { backgroundColor: theme.surfaceMuted }],
                    ]}
                  >
                    <Text style={[styles.sender, message.mine ? styles.senderMine : { color: theme.accent }]}>
                      {message.sender}
                    </Text>
                    <Text
                      style={[
                        styles.messageText,
                        message.mine ? styles.messageTextMine : { color: theme.textPrimary },
                      ]}
                    >
                      {message.text}
                    </Text>
                    <Text style={[styles.time, message.mine ? styles.timeMine : { color: theme.textSecondary }]}>
                      {message.time}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* The floating bottom nav hides itself while a chat is open (see the
                effect above), so the composer only needs to clear the safe area. */}
            <View
              style={[
                styles.composer,
                { marginBottom: insets.bottom + 16, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.add, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.addText, { color: theme.accent }]}>+</Text>
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendMessage}
                placeholder="Scrie un mesaj..."
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.textPrimary }]}
                returnKeyType="send"
              />
              <Pressable style={styles.voice} accessibilityLabel="Înregistrează mesaj vocal">
                <Text style={styles.voiceText}>🎤</Text>
              </Pressable>
              <Pressable onPress={sendMessage} style={[styles.send, !draft.trim() && styles.sendOff]}>
                <Text style={styles.sendText}>↑</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
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
  groupGrid: {
    paddingHorizontal: 18,
    paddingTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  groupCard: { width: '47%', borderRadius: 18, overflow: 'hidden', borderWidth: 1, padding: 10 },
  groupPhoto: { aspectRatio: 1.3, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupEmoji: { fontSize: 34 },
  groupNameOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  groupNameOutline: { color: '#000000' },
  groupDetail: { fontSize: 11, marginTop: 9 },
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
  time: { fontSize: 9, textAlign: 'right', marginTop: 4 },
  timeMine: { color: '#D6FFE2' },
  composer: { marginHorizontal: 16, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 25, fontWeight: '300', marginTop: -2 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#BDEBCB' },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: -4 },
  voice: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 23 },
});
