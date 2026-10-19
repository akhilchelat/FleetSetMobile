import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { API_URL } from "../constants/api";

type Stage = "email" | "otp";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRequestOTP = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your registered email address.");
      return;
    }

    setError("");
    setMessage("");

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not process your request.");
      }

      setEmail(cleanEmail);
      setStage("otp");
      setMessage(
        data.message ||
          "If an active account matches this email, a verification code will be sent."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to FleetSet."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const cleanOTP = otp.trim();

    if (!/^\d{6}$/.test(cleanOTP)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setError("");
    setMessage("");

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOTP,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not verify the code.");
      }

      if (!data.reset_token) {
        throw new Error(
          "The server did not return reset authorization. Please try again."
        );
      }

      router.replace({
        pathname: "/reset-password",
        params: { token: data.reset_token },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to FleetSet."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>FleetSet</Text>

          <Text style={styles.title}>
            {stage === "email" ? "Forgot Password?" : "Verify Your Email"}
          </Text>

          <Text style={styles.subtitle}>
            {stage === "email"
              ? "Enter your registered email to receive a password-reset verification code."
              : `Enter the six-digit code sent to ${email}.`}
          </Text>

          {stage === "email" ? (
            <>
              <Text style={styles.label}>Email</Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
                onSubmitEditing={handleRequestOTP}
                returnKeyType="send"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRequestOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    Send Verification Code
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email verification code</Text>

              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={(value) =>
                  setOtp(value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                placeholderTextColor="#999999"
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleVerifyOTP}
                returnKeyType="done"
                textContentType="oneTimeCode"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setStage("email");
                  setOtp("");
                  setError("");
                  setMessage("");
                }}
                disabled={loading}
              >
                <Text style={styles.secondaryText}>Change Email</Text>
              </TouchableOpacity>
            </>
          )}

          {!!message && (
            <Text style={styles.successMessage}>{message}</Text>
          )}

          {!!error && (
            <Text accessibilityRole="alert" style={styles.errorMessage}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => router.replace("/login")}
            style={styles.backButton}
            disabled={loading}
          >
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  content: {
    width: "90%",
    maxWidth: 450,
    padding: 30,
    backgroundColor: "#F7F8FA",
  },
  logo: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 35,
    color: "#111111",
  },
  title: {
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    color: "#111111",
  },
  subtitle: {
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#222222",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#111111",
  },
  otpInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: "700",
  },
  button: {
    minHeight: 52,
    backgroundColor: "#111111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButton: {
    padding: 14,
    alignItems: "center",
  },
  secondaryText: {
    color: "#222222",
    fontWeight: "600",
  },
  successMessage: {
    color: "#267044",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 21,
  },
  errorMessage: {
    color: "#B42318",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 21,
  },
  backButton: {
    padding: 16,
    alignItems: "center",
  },
  backText: {
    color: "#222222",
    fontWeight: "600",
  },
});
