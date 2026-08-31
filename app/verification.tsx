import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase';
import { colors } from '@/constants/theme';

// Real KYC via Didit: a session is created server-side (create-verification-session,
// keeps the Didit API key off the client), the user completes ID + liveness on
// Didit's hosted page, and Didit's webhook flips profiles.verified once approved.
// UserContext subscribes to that row over Realtime, so `user.verified` here
// updates on its own — no polling, no client-side "mark myself verified" path.
type Status = 'idle' | 'starting' | 'waiting' | 'error';

export default function Verification() {
  const { colors: theme } = useAppTheme();
  const { user } = useUser();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (user?.verified) {
      router.replace((returnTo as any) || '/');
    }
  }, [user?.verified, returnTo]);

  const startVerification = async () => {
    setStatus('starting');

    const { data, error } = await supabase.functions.invoke('create-verification-session');
    if (error || !data?.url) {
      setStatus('error');
      return;
    }

    if (Platform.OS === 'web') {
      window.open(data.url, '_blank');
    } else {
      await WebBrowser.openBrowserAsync(data.url);
    }

    setStatus('waiting');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Verificare</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Verificarea vârstei 18+</Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.mainIcon, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
            <Ionicons name="shield-checkmark-outline" size={46} color={colors.green500} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Verificare identitate</Text>

          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {status === 'waiting'
              ? 'Se procesează verificarea. Poate dura câteva minute — te trecem automat mai departe imediat ce e gata.'
              : 'Vei fi dus la pagina noastră de verificare (act de identitate + o poză live) pentru a confirma că ai peste 18 ani.'}
          </Text>

          <View style={[styles.infoBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={21} color={colors.green500} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Datele tale sunt procesate securizat de furnizorul de verificare, nu sunt stocate de noi.
            </Text>
          </View>

          {status === 'error' && (
            <Text style={styles.errorText}>Nu am putut porni verificarea. Încearcă din nou.</Text>
          )}

          {status === 'waiting' ? (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={colors.green500} />
              <Text style={[styles.waitingText, { color: theme.textSecondary }]}>Se așteaptă rezultatul...</Text>
            </View>
          ) : (
            <Pressable
              onPress={startVerification}
              disabled={status === 'starting'}
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: colors.green500, opacity: pressed || status === 'starting' ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.continueText}>
                {status === 'starting' ? 'Se pregătește...' : 'Începe verificarea'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </Pressable>
          )}
        </View>

        <View style={styles.security}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            Verificarea este necesară pentru a te alătura unui Spritz.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },

  headerSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  placeholder: {
    width: 42,
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },

  mainIcon: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },

  description: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 380,
    marginTop: 8,
    marginBottom: 22,
  },

  infoBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },

  errorText: {
    color: '#E5484D',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },

  continueButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  continueText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
  },

  waitingText: {
    fontSize: 13,
    fontWeight: '700',
  },

  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
    paddingHorizontal: 20,
  },

  securityText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    flex: 1,
  },
});
