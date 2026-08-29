import { useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Chat list / message bubble design by nituraul8 — ported from App.tsx onto
// its own Expo Router screen so it lives alongside the rest of the app.

type Message = { id: string; text: string; time: string; sender?: string; mine?: boolean };

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
  const [activeChat, setActiveChat] = useState('brasov');
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const selectedChat = chats.find((chat) => chat.id === activeChat) ?? chats[0];

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: String(Date.now()), sender: 'Tu', text, time: 'Acum', mine: true }]);
    setDraft('');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>BUNĂ, ANDREI</Text>
            <Text style={styles.title}>Mesaje</Text>
          </View>
          <Pressable style={styles.roundButton}>
            <Text style={styles.roundButtonText}>+</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.chatScroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
        >
          {chats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => setActiveChat(chat.id)}
              style={[styles.chatCard, chat.id === activeChat && styles.chatCardActive]}
            >
              <View style={[styles.groupPhoto, { backgroundColor: chat.color }]}>
                <Text style={styles.groupEmoji}>{chat.emoji}</Text>
              </View>
              <View style={styles.groupNameRow}>
                <Text numberOfLines={1} style={styles.groupName}>
                  {chat.title}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.chatHeader}>
          <View style={[styles.avatar, { backgroundColor: selectedChat.color }]}>
            <Text style={styles.emoji}>{selectedChat.emoji}</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{selectedChat.title}</Text>
            <Text style={styles.online}>● activi acum în Brașov</Text>
          </View>
          <Text style={styles.more}>•••</Text>
        </View>

        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
          <Text style={styles.today}>ASTĂZI</Text>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.mine && styles.messageRowMine]}>
              {!message.mine && <View style={styles.dot} />}
              <View style={[styles.bubble, message.mine ? styles.mine : styles.other]}>
                <Text style={[styles.sender, message.mine && styles.senderMine]}>{message.sender}</Text>
                <Text style={[styles.messageText, message.mine && styles.messageTextMine]}>{message.text}</Text>
                <Text style={[styles.time, message.mine && styles.timeMine]}>{message.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* marginBottom clears the floating bottom nav (bottle + islands), which
            overlays every screen — a flat value here would sit under it. */}
        <View style={[styles.composer, { marginBottom: insets.bottom + 116 }]}>
          <View style={styles.add}>
            <Text style={styles.addText}>+</Text>
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendMessage}
            placeholder="Scrie un mesaj..."
            placeholderTextColor="#9D9A98"
            style={styles.input}
            returnKeyType="send"
          />
          <Pressable style={styles.voice} accessibilityLabel="Înregistrează mesaj vocal">
            <Text style={styles.voiceText}>🎤</Text>
          </Pressable>
          <Pressable onPress={sendMessage} style={[styles.send, !draft.trim() && styles.sendOff]}>
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5FFF8' },
  page: { flex: 1, backgroundColor: '#F5FFF8' },
  topBar: { paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#078C3C', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#0B3D20', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  roundButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
  chatScroller: { flexGrow: 0, height: 108 },
  chatList: { paddingHorizontal: 18, paddingVertical: 12, gap: 10, alignItems: 'center' },
  chatCard: { width: 142, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'transparent' },
  chatCardActive: { backgroundColor: '#FFFFFF', borderColor: '#25D960' },
  groupPhoto: { height: 51, alignItems: 'center', justifyContent: 'center' },
  groupEmoji: { fontSize: 28 },
  groupNameRow: { flex: 1, justifyContent: 'center', paddingHorizontal: 8, backgroundColor: '#FFFFFF' },
  groupName: { color: '#0B3D20', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  chatHeader: { marginHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#CDEFD8', flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#0B3D20', fontSize: 16, fontWeight: '800' },
  online: { color: '#078C3C', fontSize: 11, marginTop: 3, fontWeight: '600' },
  more: { marginLeft: 'auto', color: '#34734D', fontSize: 18, letterSpacing: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, gap: 12 },
  today: { color: '#6D9B7C', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, alignSelf: 'center', marginBottom: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  messageRowMine: { justifyContent: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D960', marginBottom: 12 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8 },
  other: { backgroundColor: '#E2F8E9', borderRadius: 18, borderBottomLeftRadius: 5 },
  mine: { backgroundColor: '#12C854', borderRadius: 18, borderBottomRightRadius: 5 },
  sender: { color: '#078C3C', fontSize: 11, fontWeight: '800', marginBottom: 3 },
  senderMine: { color: '#D6FFE2', textAlign: 'right' },
  messageText: { color: '#123A21', fontSize: 15, lineHeight: 20, fontWeight: '500' },
  messageTextMine: { color: '#FFFFFF' },
  time: { color: '#6D9B7C', fontSize: 9, textAlign: 'right', marginTop: 4 },
  timeMine: { color: '#D6FFE2' },
  composer: { marginHorizontal: 16, paddingVertical: 7, paddingHorizontal: 7, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDEFD8', flexDirection: 'row', alignItems: 'center', gap: 7 },
  add: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2F8E9', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#078C3C', fontSize: 25, fontWeight: '300', marginTop: -2 },
  input: { flex: 1, color: '#123A21', fontSize: 15, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#BDEBCB' },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: -4 },
  voice: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#12C854', alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 23 },
});
