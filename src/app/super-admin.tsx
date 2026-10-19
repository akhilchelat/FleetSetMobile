
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SuperAdminScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>FleetSet</Text>

      <Text style={styles.title}>Super Admin</Text>

      <Text style={styles.subtitle}>
        Company administration dashboard
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: "#666666",
  },
});

