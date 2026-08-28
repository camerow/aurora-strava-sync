import { useClerk, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../components/Logo";

type Phase = { name: "email" } | { name: "code"; mode: "sign-in" | "sign-up" };

function errorMessage(err: unknown): string {
  const first = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
  return first?.longMessage ?? first?.message ?? "Something went wrong. Try again.";
}

function errorCode(err: unknown): string | undefined {
  return (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
}

export default function SignIn(): React.ReactElement {
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const clerk = useClerk();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>({ name: "email" });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function sendCode(): Promise<void> {
    if (!signInLoaded || !signUpLoaded) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code");
      if (factor === undefined || !("emailAddressId" in factor)) {
        setError("Email code sign-in is not enabled for this account.");
        setBusy(false);
        return;
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setPhase({ name: "code", mode: "sign-in" });
    } catch (signInErr) {
      if (errorCode(signInErr) !== "form_identifier_not_found") {
        setError(errorMessage(signInErr));
        setBusy(false);
        return;
      }
      try {
        await signUp.create({ emailAddress: email });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPhase({ name: "code", mode: "sign-up" });
      } catch (signUpErr) {
        setError(errorMessage(signUpErr));
      }
    }
    setBusy(false);
  }

  async function verifyCode(): Promise<void> {
    if (!signInLoaded || !signUpLoaded || phase.name !== "code") return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the six-digit code from the email.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (phase.mode === "sign-in") {
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (result.status === "complete" && setActive !== undefined) {
          await setActive({ session: result.createdSessionId });
          router.replace("/(tabs)/sessions");
          return;
        }
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === "complete" && result.createdSessionId !== null) {
          await clerk.setActive({ session: result.createdSessionId });
          router.replace("/(tabs)/sessions");
          return;
        }
      }
      setError("That code didn't verify. Try again or resend.");
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  const inCodePhase = phase.name === "code";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 32, gap: 16 }}>
          <Logo size={24} />
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              letterSpacing: -1,
              color: colors.gunmetal,
              marginTop: 6,
            }}
          >
            {inCodePhase ? "Check your inbox." : "Sign in."}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 21,
              color: colors.textSecondary,
            }}
          >
            {inCodePhase
              ? `We sent a six-digit code to ${email}.`
              : "No password. We email you a one-time code. New email, new account - same thing."}
          </Text>
          {inCodePhase ? (
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setError(null);
              }}
              placeholder="123456"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus
              style={{
                fontFamily: fonts.mono,
                fontSize: 18,
                letterSpacing: 6,
                color: colors.gunmetal,
                backgroundColor: colors.surfaceSoft,
                borderWidth: 1,
                borderColor: "rgba(64,63,76,0.12)",
                borderRadius: radius.control,
                paddingHorizontal: 15,
                paddingVertical: 13,
                minHeight: 48,
              }}
            />
          ) : (
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              placeholder="you@email.com"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: fonts.sans,
                fontSize: 16,
                color: colors.gunmetal,
                backgroundColor: colors.surfaceSoft,
                borderWidth: 1,
                borderColor: "rgba(64,63,76,0.12)",
                borderRadius: radius.control,
                paddingHorizontal: 15,
                paddingVertical: 13,
                minHeight: 44,
              }}
            />
          )}
          {error !== null && (
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
              {error}
            </Text>
          )}
          <Pressable
            onPress={() => void (inCodePhase ? verifyCode() : sendCode())}
            disabled={busy}
            style={{
              backgroundColor: colors.azureInk,
              borderRadius: radius.control,
              paddingVertical: 14,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.45 : 1,
            }}
          >
            <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.white }}>
              {inCodePhase
                ? phase.name === "code" && phase.mode === "sign-up"
                  ? "Create account"
                  : "Sign in"
                : "Email me a code"}
            </Text>
          </Pressable>
          {inCodePhase && (
            <View style={{ flexDirection: "row", gap: 22 }}>
              <Pressable
                onPress={() => {
                  setPhase({ name: "email" });
                  setCode("");
                  setError(null);
                }}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    color: "rgba(64,63,76,0.6)",
                    textDecorationLine: "underline",
                  }}
                >
                  Different email
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void sendCode()}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    color: "rgba(64,63,76,0.6)",
                    textDecorationLine: "underline",
                  }}
                >
                  Resend
                </Text>
              </Pressable>
            </View>
          )}
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              lineHeight: 19,
              color: "rgba(64,63,76,0.58)",
            }}
          >
            Strava linking happens on the web. Log sessions here or at sendtally.com - same account,
            same logbook.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
