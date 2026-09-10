import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUser } from '@/contexts/UserContext';
import { colors } from '@/constants/theme';
import { LogoWordmark } from '@/components/home/LogoWordmark';
import { showAlert } from '@/lib/alert';

type Mode = 'login' | 'signup';
// 'form' is the login/signup card. The other three are full-screen takeovers
// of the same card, entered from signup (verify-signup) or the "forgot
// password?" link (forgot-request → forgot-verify) — see handleSubmit and
// handleForgotPassword below.
type Stage = 'form' | 'verify-signup' | 'forgot-request' | 'forgot-verify';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/i;
const CODE_REGEX = /^\d{6}$/;
const RESEND_COOLDOWN_SECONDS = 30;

export default function Auth() {
  const { colors: theme } = useAppTheme();
  const { t } = useLanguage();
  const PASSWORD_REQUIREMENTS: { label: string; test: (value: string) => boolean }[] = [
    { label: t.auth.passwordReqMinLength, test: (v) => v.length >= 8 },
    { label: t.auth.passwordReqUppercase, test: (v) => /[A-Z]/.test(v) },
    { label: t.auth.passwordReqDigit, test: (v) => /[0-9]/.test(v) },
    { label: t.auth.passwordReqSpecial, test: (v) => /[^A-Za-z0-9]/.test(v) },
  ];
  const {
    signUp,
    logIn,
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [over18, setOver18] = useState(false);
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
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

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
        setError(t.auth.errorEnterName);
        return;
      }
      if (!USERNAME_REGEX.test(username.trim())) {
        setError(t.auth.errorUsernameFormat);
        return;
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        setError(t.auth.errorEnterValidEmail);
        return;
      }
      if (!passwordValid) {
        setError(t.auth.errorPasswordRequirements);
        return;
      }
      if (password !== confirmPassword) {
        setError(t.auth.errorPasswordsDontMatch);
        return;
      }
      if (!over18) {
        setError('Trebuie să declari că ai peste 18 ani pentru a-ți crea un cont.');
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
      setError(t.auth.errorEnterEmailAndPassword);
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

  const handleVerifySignup = async () => {
    if (submitting) return;
    if (!CODE_REGEX.test(code.trim())) {
      setError(t.auth.errorEnterCode);
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
      showAlert(t.auth.resendFailedTitle, result.error);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    showAlert(t.auth.resendSuccessTitle, t.auth.resendSuccessMessage(pendingEmail));
  };

  // Step 1 of the forgot-password flow: entered from the "Ai uitat parola?"
  // link below — sends the 6-digit reset code (see supabase/templates/recovery.html)
  // and moves to the code + new-password step (handleForgotVerify).
  const handleForgotRequest = async () => {
    if (submitting) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(t.auth.errorEnterValidEmail);
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
      showAlert(t.auth.resendFailedTitle, result.error);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    showAlert(t.auth.resendSuccessTitle, t.auth.resendSuccessMessage(pendingEmail));
  };

  // Step 2: exchanges the code for a session and sets the new password in
  // one call (confirmPasswordReset) — success leaves the user signed in.
  const handleForgotVerify = async () => {
    if (submitting) return;
    if (!CODE_REGEX.test(code.trim())) {
      setError(t.auth.errorEnterCode);
      return;
    }
    if (!newPasswordValid) {
      setError(t.auth.errorPasswordRequirements);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t.auth.errorPasswordsDontMatch);
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
    setOver18(false);
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
            {t.auth.subtitle}
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
              <Text style={[styles.backText, { color: theme.textSecondary }]}>{t.common.back}</Text>
            </Pressable>
          )}

          {stage === 'verify-signup' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>{t.auth.confirmEmailHeading}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {t.auth.confirmEmailDescription(pendingEmail)}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>{t.auth.confirmationCodeLabel}</Text>
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
                <Text style={styles.submitText}>{t.auth.confirmSubmit}</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>

              <Pressable
                onPress={handleResendSignupCode}
                disabled={resending || resendCooldown > 0}
                style={styles.forgotButton}
              >
                <Text style={[styles.forgotText, { color: colors.green500 }]}>
                  {resendCooldown > 0
                    ? t.auth.resendCodeCooldown(resendCooldown)
                    : resending
                      ? t.auth.resending
                      : t.auth.resendCode}
                </Text>
              </Pressable>
            </>
          )}

          {stage === 'forgot-request' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>{t.auth.forgotRequestHeading}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {t.auth.forgotRequestDescription}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>{t.auth.emailLabel}</Text>
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
                    placeholder={t.auth.emailPlaceholder}
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
                <Text style={styles.submitText}>{t.auth.sendCodeSubmit}</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>
            </>
          )}

          {stage === 'forgot-verify' && (
            <>
              <Text style={[styles.heading, { color: theme.textPrimary }]}>{t.auth.resetPasswordHeading}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {t.auth.resetPasswordDescription(pendingEmail)}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>{t.auth.resetCodeLabel}</Text>
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
                <Text style={[styles.label, { color: theme.textPrimary }]}>{t.auth.newPasswordLabel}</Text>
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
                    placeholder={t.auth.newPasswordPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    hitSlop={10}
                    accessibilityLabel={showNewPassword ? t.auth.hidePassword : t.auth.showPassword}
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
                <Text style={[styles.label, { color: theme.textPrimary }]}>{t.auth.confirmNewPasswordLabel}</Text>
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
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary }]}
                    secureTextEntry={!showConfirmNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    hitSlop={10}
                    accessibilityLabel={showConfirmNewPassword ? t.auth.hidePassword : t.auth.showPassword}
                  >
                    <Ionicons
                      name={showConfirmNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
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
                <Text style={styles.submitText}>{t.auth.resetPasswordSubmit}</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </Pressable>

              <Pressable
                onPress={handleResendForgotCode}
                disabled={resending || resendCooldown > 0}
                style={styles.forgotButton}
              >
                <Text style={[styles.forgotText, { color: colors.green500 }]}>
                  {resendCooldown > 0
                    ? t.auth.resendCodeCooldown(resendCooldown)
                    : resending
                      ? t.auth.resending
                      : t.auth.resendCode}
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
                {t.auth.loginTab}
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
                {t.auth.signupTab}
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
              ? t.auth.welcomeBackHeading
              : t.auth.createAccountHeading}
          </Text>

          <Text
            style={[
              styles.description,
              { color: theme.textSecondary },
            ]}
          >
            {mode === 'login'
              ? t.auth.welcomeBackDescription
              : t.auth.createAccountDescription}
          </Text>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.label,
                  { color: theme.textPrimary },
                ]}
              >
                {t.auth.nameLabel}
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
                  placeholder={t.auth.namePlaceholder}
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
                {t.auth.usernameLabel}
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
                  placeholder={t.auth.usernamePlaceholder}
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
              {t.auth.emailLabel}
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
                placeholder={t.auth.emailPlaceholder}
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
              {t.auth.passwordLabel}
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
                placeholder={t.auth.passwordPlaceholder}
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
                accessibilityLabel={showPassword ? t.auth.hidePassword : t.auth.showPassword}
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
                {t.auth.confirmPasswordLabel}
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
                  placeholder={t.auth.confirmPasswordPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.textPrimary },
                  ]}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />

                <Pressable
                  onPress={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  hitSlop={10}
                  accessibilityLabel={showConfirmPassword ? t.auth.hidePassword : t.auth.showPassword}
                >
                  <Ionicons
                    name={
                      showConfirmPassword
                        ? 'eye-off-outline'
                        : 'eye-outline'
                    }
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          )}

          {mode === 'signup' && (
            <Pressable
              onPress={() => setOver18((v) => !v)}
              style={styles.over18Row}
              hitSlop={6}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: over18 ? colors.green500 : theme.border,
                    backgroundColor: over18 ? colors.green500 : 'transparent',
                  },
                ]}
              >
                {over18 && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={[styles.over18Text, { color: theme.textPrimary }]}>
                Declar că am peste 18 ani
              </Text>
            </Pressable>
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
                {t.auth.forgotPassword}
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
                ? t.auth.loginSubmit
                : t.auth.signupSubmit}
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
                ? t.auth.noAccountYet
                : t.auth.haveAccountAlready}
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
                  ? t.auth.signupTab
                  : t.auth.loginTab}
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
          {t.auth.footerPrefix}{' '}
          <Text style={{ color: colors.green600, fontWeight: '800' }} onPress={() => router.push('/terms')}>
            {t.auth.footerTermsLink}
          </Text>{' '}
          {t.auth.footerMiddle}{' '}
          <Text style={{ color: colors.green600, fontWeight: '800' }} onPress={() => router.push('/privacy')}>
            {t.auth.footerPrivacyLink}
          </Text>
          {t.auth.footerSuffix}
        </Text>

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

  over18Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  over18Text: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
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
});
