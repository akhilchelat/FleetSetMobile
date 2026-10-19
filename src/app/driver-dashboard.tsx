
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Href, router } from "expo-router";

const dashboardItems = [
  {
    title: "Vehicle",
    description: "View your assigned vehicle",
    icon: "🚗",
    route: "/vehicles",
  },
  {
    title: "Maintenance",
    description: "Enter maintenance expenses",
    icon: "🔧",
    route: "/vehicle-maintenance",
  },
  {
    title: "Fuel",
    description: "Add fuel entries",
    icon: "⛽",
    route: "/fuel",
  },
  {
    title: "Trips",
    description: "View your assigned trips",
    icon: "🚚",
    route: "/trip",
  },
];

export default function DriverDashboardScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>FleetSet</Text>
            <Text style={styles.subtitle}>
              Driver Dashboard
            </Text>
          </View>

          <TouchableOpacity
            style={styles.profileCircle}
            onPress={() =>
              router.push("/account" as Href)
            }
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open user account"
          >
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Four dashboard boxes */}
        <View style={styles.dashboardGrid}>
          {dashboardItems.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.dashboardCard}
              onPress={() =>
                router.push(item.route as Href)
              }
              activeOpacity={0.75}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.cardIcon}>
                  {item.icon}
                </Text>
              </View>

              <Text style={styles.cardTitle}>
                {item.title}
              </Text>

              <Text style={styles.cardDescription}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  scrollContent: {
    padding: 20,
    paddingTop: 24,
    flexGrow: 1,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },

  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111111",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#666666",
  },

  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },

  profileIcon: {
    fontSize: 21,
    color: "#FFFFFF",
  },

  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  dashboardCard: {
    width: "48%",
    minHeight: 155,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    justifyContent: "center",
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  cardIcon: {
    fontSize: 23,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  cardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "#666666",
  },
});
