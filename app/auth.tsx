import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/constants/theme';
import { LogoWordmark } from '@/components/home/LogoWordmark';
import { showAlert } from '@/lib/alert';

type Mode = 'login' | 'signup';
// 'form' is the login/signup card. The other three are full-screen takeovers
// of the same card, entered from signup (verify-signup) or the "Ai uitat
// parola?" link (forgot-request → forgot-verify) — see handleSubmit and
// handleForgotPassword below.
type Stage = 'form' | 'verify-signup' | 'forgot-request' | 'forgot-verify';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/i;
const CODE_REGEX = /^\d{6}$/;
const RESEND_COOLDOWN_SECONDS = 30;

const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
  { label: 'Minim 8 caractere', test: (v) => v.length >= 8 },
  { label: 'O literă mare', test: (v) => /[A-Z]/.test(v) },
  { label: 'O cifră', test: (v) => /[0-9]/.test(v) },
  { label: 'Un caracter special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function Auth() {
  const { colors: theme } = useAppTheme();
  const {
    signUp,
    logIn,
    devSkip,
    verifySignupCode,
    resendSignupCode,
    requestPasswordReset,
    confirmPasswordReset,
  } = useUser();

  const [mode, setMode] = useState<Mode>('signup'); // signup is the default for now
  const [stage, setStage] = useState<Stage>('form');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Shared by the verify-signup and forgot-password-reset stages: which
  // email the code was sent to, the code itself, and a resend cooldown.
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // New-password fields for the "enter code + pick a new password" step —
  // kept separate from password/confirmPassword above (login/signup form)
  // since both can theoretically be mid-flight for a moment during a stage swap.
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) }));
  const passwordValid = passwordChecks.every((check) => check.met);

  const newPasswordChecks = PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(newPassword) }));
  const newPasswordValid = newPasswordChecks.every((check) => check.met);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const resetToForm = (nextMode: Mode = 'login') => {
    setStage('form');
    setMode(nextMode);
    setCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendCooldown(0);
    setError(null);
  };

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

      if (result.needsVerification) {
        setPendingEmail(email.trim().toLowerCase());
        setCode('');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setStage('verify-signup');
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
      // A leftover unconfirmed signup — send them straight back to the code
      // step instead of a dead-end error, with a fresh code already on the way.
      if (result.needsVerification) {
        const trimmedEmail = email.trim().toLowerCase();
        setPendingEmail(trimmedEmail);
        setCode('');
        setStage('verify-signup');
        resendSignupCode(trimmedEmail).then((r) => {
          setResendCooldown(r.ok ? RESEND_COOLDOWN_SECONDS : 0);
        });
        return;
      }
      setError(result.error);
      return;
    }

    router.replace('/');
  };

  const handleDevSkip = async () => {
    await devSkip();
    router.replace('/');
  };

  const handleVerifySignup = async () => {
    if (submitting) return;
    if (!CODE_REGEX.test(code.trim())) {
      setError('Introdu codul de 6 cifre primit pe email.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const result = await verifySignupCode(pendingEmail, code);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace('/');
  };

  const handleResendSignupCode = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    const result = await resendSignupCode(pendingEmail);
    setResending(false);

    if (!result.ok) {
      showAlert('Nu am putut retrimite codul', result.error);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    showAlert('Cod retrimis', `Verifică ${pendingEmail}.`);
  };

  // Step 1 of the forgot-password flow: entered from the "Ai uitat parola?"
  // link below — sends the 6-digit reset code (see supabase/templates/recovery.html)
  // and moves to the code + new-password step (handleForgotVerify).
  const handleForgotRequest = async () => {
    if (submitting) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Introdu o adresă de email validă.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const result = await requestPasswordReset(trimmedEmail);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPendingEmail(trimmedEmail);
    setCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setStage('forgot-verify');
  };

  const handleResendForgotCode = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    const result = await requestPasswordReset(pendingEmail);
    setResending(false);

    if (!result.ok) {
      showAlert('Nu am putut retrimite codul', result.error);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    showAlert('Cod retrimis', `Verifică ${pendingEmail}.`);
  };

  // Step 2: exchanges the code for a session and sets the new password in
  // one call (confirmPasswordReset) — success leaves the user signed in.
  const handleForgotVerify = async () => {
    if (submitting) return;
    if (!CODE_REGEX.test(code.trim())) {
      setError('Introdu codul de 6 cifre primit pe email.');
      return;
    }
    if (!newPasswordValid) {
      setError('Parola nu îndeplinește toate cerințele.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Parolele nu coincid.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const result = await confirmPasswordReset(pendingEmail, code, newPassword);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace('/');
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
          {stage !== 'form' && (
            <Pressable
              onPress={() => resetToForm(mode)}
              hitSlop={10}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={18} color={theme.textSecondary} />
              <Text style={[styles.backText, { color: theme.textSecondary }]}>Înapoi</Text>
            </Pressable>
          )}

          {stage === 'verify-signup' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>Confirmă emailul</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Am trimis un cod de 6 cifre la {pendingEmail}. Introdu-l mai jos ca să îți activezi contul.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Cod de confirmare</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="key-outline" size={19} color={theme.textSecondary} />
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, styles.codeInput, { color: theme.textPrimary }]}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                onPress={handleVerifySignup}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.green500, opacity: pressed || submitting ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.submitText}>Confirmă</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>

              <Pressable
                onPress={handleResendSignupCode}
                disabled={resending || resendCooldown > 0}
                style={styles.forgotButton}
              >
                <Text style={[styles.forgotText, { color: colors.green500 }]}>
                  {resendCooldown > 0
                    ? `Retrimite codul (${resendCooldown}s)`
                    : resending
                      ? 'Se retrimite...'
                      : 'Retrimite codul'}
                </Text>
              </Pressable>
            </>
          )}

          {stage === 'forgot-request' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>Ai uitat parola?</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Introdu emailul contului tău și îți trimitem un cod de resetare.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Email</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="mail-outline" size={19} color={theme.textSecondary} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="numele@email.com"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                onPress={handleForgotRequest}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.green500, opacity: pressed || submitting ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.submitText}>Trimite codul</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>
            </>
          )}

          {stage === 'forgot-verify' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>Resetează parola</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Am trimis un cod de 6 cifre la {pendingEmail}. Introdu-l mai jos împreună cu noua parolă.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Cod de resetare</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="key-outline" size={19} color={theme.textSecondary} />
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, styles.codeInput, { color: theme.textPrimary }]}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Parolă nouă</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={19} color={theme.textSecondary} />
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Parola nouă"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    hitSlop={10}
                    accessibilityLabel={showNewPassword ? 'Ascunde parola' : 'Arată parola'}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>

                <View style={styles.requirements}>
                  {newPasswordChecks.map((check) => (
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
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Confirmă parola nouă</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={19} color={theme.textSecondary} />
                  <TextInput
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Introdu parola din nou"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                onPress={handleForgotVerify}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.green500, opacity: pressed || submitting ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.submitText}>Resetează parola</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>

              <Pressable
                onPress={handleResendForgotCode}
                disabled={resending || resendCooldown > 0}
                style={styles.forgotButton}
              >
                <Text style={[styles.forgotText, { color: colors.green500 }]}>
                  {resendCooldown > 0
                    ? `Retrimite codul (${resendCooldown}s)`
                    : resending
                      ? 'Se retrimite...'
                      : 'Retrimite codul'}
                </Text>
              </Pressable>
            </>
          )}

          {stage === 'form' && (
          <>
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
                accessibilityLabel={showPassword ? 'Ascunde parola' : 'Arată parola'}
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
              onPress={() => {
                setError(null);
                setStage('forgot-request');
              }}
              style={styles.forgotButton}
            >
              <Text
                style={[
                  styles.forgotText,
                  { color: colors.green500 },
                ]}
              >
                Ai uitat parola?
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
          </>
          )}
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

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },

  backText: {
    fontSize: 13,
    fontWeight: '700',
  },

  codeInput: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
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
