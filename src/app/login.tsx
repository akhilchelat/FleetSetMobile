
import {
  Alert,
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
import { useEffect, useState } from "react";
import {
  setToken,
  setUser,
  getToken,
  getUser,
  clearStorage,
} from "../utils/storage";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const token = await getToken();
        const savedUser = await getUser<any>();

        if (!token || !savedUser) {
          if (mounted) setCheckingSession(false);
          return;
        }

        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401 || response.status === 403) {
          await clearStorage();
          if (mounted) setCheckingSession(false);
          return;
        }

        if (!response.ok) {
          if (mounted) setCheckingSession(false);
          return;
        }

        const user = await response.json();
        await setUser(user);

        if (!mounted) return;

        switch (user?.role_name) {
          case "GLOBAL_ADMIN":
            router.replace("/global-admin");
            break;
          case "SUPER_ADMIN":
            router.replace("/super-admin");
            break;
          case "BRANCH_ADMIN":
            router.replace("/dashboard");
            break;
          case "DRIVER":
            router.replace("/driver-dashboard");
            break;
          default:
            await clearStorage();
            if (mounted) setCheckingSession(false);
        }
      } catch (error) {
        console.error("Session restoration error:", error);
        if (mounted) setCheckingSession(false);
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        "Missing information",
        "Please enter email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const formData = new URLSearchParams();
      formData.append("username", email.trim());
      formData.append("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Login failed",
          data.detail || "Invalid email or password."
        );
        return;
      }

      await setToken(data.access_token);

      const meResponse = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      });

      const meData = await meResponse.json();

      if (!meResponse.ok) {
        throw new Error(
          meData.detail || "Could not load current user."
        );
      }

      await setUser(meData);

      switch (meData?.role_name) {
        case "GLOBAL_ADMIN":
          router.replace("/global-admin");
          break;
        case "SUPER_ADMIN":
          router.replace("/super-admin");
          break;
        case "BRANCH_ADMIN":
          router.replace("/dashboard");
          break;
        case "DRIVER":
          router.replace("/driver-dashboard");
          break;
        default:
          Alert.alert(
            "Access error",
            "Your account does not have a valid FleetSet role."
          );
          break;
      }
    } catch (error) {
      console.error("Login error:", error);

      const message =
        error instanceof Error ? error.message : String(error);

      Alert.alert("Login Error", message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.title}>FleetSet</Text>
        <Text style={styles.subtitle}>
          Checking your session...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View style={styles.content}>
            <Text style={styles.logo}>FleetSet</Text>

            <Text style={styles.title}>Welcome back</Text>

            <Text style={styles.subtitle}>
              Sign in to manage your fleet
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <Text style={styles.label}>Password</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => router.push("/forgot-password")}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Signing in..." : "Sign In"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    width: "90%",
    maxWidth: 450,
    padding: 30,
  },

  logo: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 35,
    color: "#111111",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#111111",
  },

  subtitle: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 35,
  },

  form: {
    width: "100%",
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 15,
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

  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: 12,
    paddingVertical: 4,
  },

  forgotPasswordText: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "600",
  },

  button: {
    height: 52,
    backgroundColor: "#111111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
