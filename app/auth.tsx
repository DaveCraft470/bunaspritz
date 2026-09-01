import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, Pressable, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/lib/supabase';
import { colors } from '@/constants/theme';
import { LogoWordmark } from '@/components/home/LogoWordmark';

type Mode = 'login' | 'signup';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/i;

const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
  { label: 'Minim 8 caractere', test: (v) => v.length >= 8 },
  { label: 'O literă mare', test: (v) => /[A-Z]/.test(v) },
  { label: 'O cifră', test: (v) => /[0-9]/.test(v) },
  { label: 'Un caracter special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function Auth() {
  const { colors: theme } = useAppTheme();
  const { signUp, logIn, devSkip } = useUser();

  const [mode, setMode] = useState<Mode>('signup'); // signup is the default for now
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) }));
  const passwordValid = passwordChecks.every((check) => check.met);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Introdu numele tău.');
        return;
      }
      if (!USERNAME_REGEX.test(username.trim())) {
        setError('Username: 3-20 caractere, doar litere, cifre, "." sau "_".');
        return;
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        setError('Introdu o adresă de email validă.');
        return;
      }
      if (!passwordValid) {
        setError('Parola nu îndeplinește toate cerințele.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Parolele nu coincid.');
        return;
      }

      setSubmitting(true);
      const result = await signUp(name, username, email, password);
      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace('/');
      return;
    }

    if (!email.trim() || !password) {
      setError('Introdu emailul și parola.');
      return;
    }

    setSubmitting(true);
    const result = await logIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace('/');
  };

  const handleDevSkip = async () => {
    await devSkip();
    router.replace('/');
  };

  // Sends Supabase's own password-reset email — completing the reset
  // (setting a new password) happens on whatever page Supabase's Auth
  // settings point the link at, not in this app. That's the honest half of
  // this button to build without knowing that redirect target; wiring a
  // full in-app "set new password" deep-link screen is a separate follow-up.
  const handleForgotPassword = async () => {
    if (resettingPassword) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Introdu emailul tău mai sus, apoi apasă din nou.');
      return;
    }

    setError(null);
    setResettingPassword(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
    setResettingPassword(false);

    if (resetError) {
      Alert.alert('A apărut o eroare', resetError.message);
      return;
    }

    Alert.alert('Email trimis', `Verifică ${trimmedEmail} pentru linkul de resetare a parolei.`);
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <StatusBar style={theme.statusBar} />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
        keyboardOpeningTime={0}
      >
        <View style={styles.logoContainer}>
          <LogoWordmark />

          <Text
            style={[
              styles.subtitle,
              { color: theme.textSecondary },
            ]}
          >
            Descoperă evenimentele din jurul tău.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.tabs,
              { backgroundColor: theme.surfaceMuted },
            ]}
          >
            <Pressable
              onPress={() => switchMode('login')}
              style={[
                styles.tab,
                mode === 'login' && {
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      mode === 'login'
                        ? theme.textPrimary
                        : theme.textSecondary,
                  },
                ]}
              >
                Login
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode('signup')}
              style={[
                styles.tab,
                mode === 'signup' && {
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      mode === 'signup'
                        ? theme.textPrimary
                        : theme.textSecondary,
                  },
                ]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          <Text
            style={[
              styles.heading,
              { color: theme.textPrimary },
            ]}
          >
            {mode === 'login'
              ? 'Bine ai revenit!'
              : 'Creează-ți contul'}
          </Text>

          <Text
            style={[
              styles.description,
              { color: theme.textSecondary },
            ]}
          >
            {mode === 'login'
              ? 'Conectează-te pentru a continua.'
              : 'Creează un cont pentru a descoperi evenimente.'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.label,
                  { color: theme.textPrimary },
                ]}
              >
                Nume
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={theme.textSecondary}
                />

                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Numele tău"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.textPrimary },
                  ]}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.label,
                  { color: theme.textPrimary },
                ]}
              >
                Username
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="at-outline"
                  size={19}
                  color={theme.textSecondary}
                />

                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.textPrimary },
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.textPrimary },
              ]}
            >
              Email
            </Text>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={19}
                color={theme.textSecondary}
              />

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="numele@email.com"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.textPrimary },
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text
              style={[
                styles.label,
                { color: theme.textPrimary },
              ]}
            >
              Parolă
            </Text>

            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color={theme.textSecondary}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Parola ta"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.textPrimary },
                ]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />

              <Pressable
                onPress={() =>
                  setShowPassword(!showPassword)
                }
                hitSlop={10}
              >
                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>

            {mode === 'signup' && (
              <View style={styles.requirements}>
                {passwordChecks.map((check) => (
                  <View key={check.label} style={styles.requirementRow}>
                    <Ionicons
                      name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={check.met ? colors.green500 : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        { color: check.met ? theme.textPrimary : theme.textSecondary },
                      ]}
                    >
                      {check.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.label,
                  { color: theme.textPrimary },
                ]}
              >
                Confirmă parola
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={19}
                  color={theme.textSecondary}
                />

                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Introdu parola din nou"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.textPrimary },
                  ]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          {mode === 'login' && (
            <Pressable
              onPress={handleForgotPassword}
              disabled={resettingPassword}
              style={styles.forgotButton}
            >
              <Text
                style={[
                  styles.forgotText,
                  { color: colors.green500 },
                ]}
              >
                {resettingPassword ? 'Se trimite...' : 'Ai uitat parola?'}
              </Text>
            </Pressable>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.green500,
                opacity: pressed || submitting ? 0.8 : 1,
              },
            ]}
          >
            <Text style={styles.submitText}>
              {mode === 'login'
                ? 'Intră în cont'
                : 'Continuă'}
            </Text>

            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.white}
            />
          </Pressable>

          <View style={styles.switchRow}>
            <Text
              style={[
                styles.switchText,
                { color: theme.textSecondary },
              ]}
            >
              {mode === 'login'
                ? 'Nu ai încă un cont?'
                : 'Ai deja un cont?'}
            </Text>

            <Pressable
              onPress={() =>
                switchMode(
                  mode === 'login'
                    ? 'signup'
                    : 'login'
                )
              }
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: colors.green500 },
                ]}
              >
                {mode === 'login'
                  ? 'Sign Up'
                  : 'Login'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text
          style={[
            styles.footer,
            { color: theme.textSecondary },
          ]}
        >
          Prin continuare accepți termenii și politica de
          confidențialitate.
        </Text>

        {/* `__DEV__` would be false in the sideloaded preview APK — the
            actual place this needs testing right now — so this stays
            unconditional for the current pre-release phase. Remove before
            a real production release. */}
        <Pressable onPress={handleDevSkip} style={styles.devSkip}>
          <Text style={[styles.devSkipText, { color: theme.textSecondary }]}>
            Sări peste (doar dev)
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },

  tabs: {
    flexDirection: 'row',
    borderRadius: 13,
    padding: 4,
    marginBottom: 24,
  },

  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  heading: {
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 5,
  },

  description: {
    fontSize: 13,
    marginBottom: 22,
  },

  inputGroup: {
    marginBottom: 15,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  input: {
    flex: 1,
    fontSize: 14,
    minHeight: 50,
    // RN Web renders TextInput as a plain <input>, which browsers outline
    // in black on focus by default — this app draws its own focus state.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },

  requirements: {
    marginTop: 10,
    gap: 5,
  },

  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  requirementText: {
    fontSize: 11,
    fontWeight: '600',
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -3,
    marginBottom: 18,
  },

  forgotText: {
    fontSize: 12,
    fontWeight: '700',
  },

  errorText: {
    color: '#E5484D',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },

  submitButton: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 5,
  },

  submitText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 20,
  },

  switchText: {
    fontSize: 12,
  },

  switchLink: {
    fontSize: 12,
    fontWeight: '800',
  },

  footer: {
    maxWidth: 430,
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 20,
  },

  devSkip: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 8,
  },

  devSkipText: {
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
