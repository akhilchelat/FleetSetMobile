
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { router, useFocusEffect } from "expo-router";

import { apiGet, apiPost, apiPut } from "../services/api";
import { clearStorage, setUser } from "../utils/storage";


type AccountUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role_name?: string;
  company_id?: string | null;
  branch_id?: string | null;
  company_name?: string | null;
  branch_name?: string | null;
};

export default function AccountScreen() {
  const [user, setCurrentUser] = useState<AccountUser | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] =
  useState<"success" | "error">("success");

  const showMessage = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);

      const data = (await apiGet("/auth/me")) as AccountUser;

      setCurrentUser(data);
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setPhone(data.phone ?? "");

      await setUser(data);
    } catch (error) {
      showMessage(
        "Unable to load account",
        error instanceof Error
          ? error.message
          : "Please sign in again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAccount();
    }, [loadAccount])
  );

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!firstName.trim() || !lastName.trim()) {
      showMessage("Required fields", "Enter your first and last name.");
      return;
    }

    try {
      setSavingProfile(true);

      await apiPut(`/users/${user.id}`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });

      await loadAccount();
      setEditingProfile(false);

      showMessage("Profile updated", "Your account details were saved.");
    } catch (error) {
      showMessage(
        "Update failed",
        error instanceof Error
          ? error.message
          : "Could not update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  
const handleChangePassword = async () => {
  setPasswordMessage("");

  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordMessageType("error");
    setPasswordMessage("Please complete all password fields.");
    return;
  }

  if (newPassword.length < 8) {
    setPasswordMessageType("error");
    setPasswordMessage("Your new password must contain at least 8 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordMessageType("error");
    setPasswordMessage("The new password and confirmation do not match.");
    return;
  }

  if (currentPassword === newPassword) {
    setPasswordMessageType("error");
    setPasswordMessage("Choose a password different from your current password.");
    return;
  }

  try {
    setSavingPassword(true);

    await apiPost("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);

    setPasswordMessageType("success");
    setPasswordMessage(
      "Password changed successfully. Your new password is saved."
    );
  } catch (error) {
    setPasswordMessageType("error");
    setPasswordMessage(
      error instanceof Error
        ? error.message
        : "Unable to change your password. Please try again."
    );
  } finally {
    setSavingPassword(false);
  }
};

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await clearStorage();
      router.replace("/login");
    } catch {
      showMessage("Logout failed", "Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.pageTitle}>Unable to load account</Text>
        <TouchableOpacity style={styles.button} onPress={loadAccount}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.secondaryButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fullName =
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

  const initials =
    `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

  return (
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    keyboardVerticalOffset={0}
  >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
    >

      <View style={styles.pageHeader}>
        <Text style={styles.brand}>FleetSet</Text>
        <Text style={styles.pageTitle}>My Account</Text>
        <Text style={styles.pageSubtitle}>
          Manage your profile and security settings.
        </Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "U"}</Text>
        </View>

        <Text style={styles.profileName}>{fullName || "FleetSet User"}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {(user.role_name || "USER").replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {!editingProfile && (
            <TouchableOpacity onPress={() => setEditingProfile(true)}>
              <Text style={styles.textAction}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>First name</Text>
        <TextInput
          style={[styles.input, !editingProfile && styles.readOnlyInput]}
          value={firstName}
          onChangeText={setFirstName}
          editable={editingProfile && !savingProfile}
          placeholder="First name"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={[styles.input, !editingProfile && styles.readOnlyInput]}
          value={lastName}
          onChangeText={setLastName}
          editable={editingProfile && !savingProfile}
          placeholder="Last name"
          placeholderTextColor="#999999"
        />

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={user.email}
          editable={false}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={[styles.input, !editingProfile && styles.readOnlyInput]}
          value={phone}
          onChangeText={setPhone}
          editable={editingProfile && !savingProfile}
          placeholder="Phone number"
          placeholderTextColor="#999999"
          keyboardType="phone-pad"
        />

        {editingProfile && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={savingProfile}
              onPress={() => {
                setFirstName(user.first_name ?? "");
                setLastName(user.last_name ?? "");
                setPhone(user.phone ?? "");
                setEditingProfile(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.flexButton]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>
            {(user.role_name || "Not available").replace(/_/g, " ")}
          </Text>
        </View>

        <View style={styles.infoRow}>
  <Text style={styles.infoLabel}>Company</Text>
  <Text style={styles.infoValue}>
    {user.company_name || "Not assigned"}
  </Text>
</View>

<View style={styles.infoRow}>
  <Text style={styles.infoLabel}>Branch</Text>
  <Text style={styles.infoValue}>
    {user.branch_name || "Not assigned"}
  </Text>
</View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Security</Text>
        </View>

        <Text style={styles.description}>
          Change your password regularly to keep your account secure.
        </Text>

        
{passwordMessage !== "" && (
  <Text
    style={[
      styles.passwordMessage,
      passwordMessageType === "success"
        ? styles.passwordMessageSuccess
        : styles.passwordMessageError,
    ]}
  >
    {passwordMessage}
  </Text>
)}

        {!showPasswordForm ? (
          <TouchableOpacity
            style={styles.secondaryButtonFull}
            onPress={() => setShowPasswordForm(true)}
          >
            <Text style={styles.secondaryButtonText}>Change Password</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingPassword}
              placeholder="Enter current password"
              placeholderTextColor="#999999"
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#999999"
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingPassword}
              placeholder="Enter password again"
              placeholderTextColor="#999999"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Update Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelPasswordButton}
              disabled={savingPassword}
              onPress={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setShowPasswordForm(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Log Out</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>FleetSet Fleet Management</Text>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: "#666666",
    fontSize: 14,
  },
  pageHeader: {
    marginBottom: 22,
  },
  brand: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  pageTitle: {
    color: "#111111",
    fontSize: 28,
    fontWeight: "700",
  },
  pageSubtitle: {
    color: "#777777",
    fontSize: 14,
    marginTop: 6,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
    padding: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "700",
  },
  profileName: {
    color: "#111111",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  profileEmail: {
    color: "#777777",
    fontSize: 14,
    marginTop: 5,
    textAlign: "center",
  },
  roleBadge: {
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 14,
  },
  roleText: {
    color: "#222222",
    fontSize: 11,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  textAction: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    color: "#333333",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#E3E3E3",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  readOnlyInput: {
    backgroundColor: "#F5F5F5",
    color: "#666666",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  flexButton: {
    flex: 1,
  },
  button: {
    minHeight: 48,
    backgroundColor: "#111111",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 18,
  },
  secondaryButtonFull: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "600",
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 5,
  },
  infoLabel: {
    color: "#777777",
    fontSize: 12,
  },
  infoValue: {
    color: "#222222",
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    color: "#777777",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  cancelPasswordButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    marginTop: 4,
  },
  logoutButton: {
    minHeight: 50,
    backgroundColor: "#111111",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  footer: {
    color: "#999999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 22,
  },

  
passwordMessage: {
  fontSize: 13,
  lineHeight: 20,
  marginBottom: 12,
  padding: 12,
  borderRadius: 8,
},
passwordMessageSuccess: {
  color: "#166534",
  backgroundColor: "#F0FDF4",
},
passwordMessageError: {
  color: "#B91C1C",
  backgroundColor: "#FEF2F2",
},
});    