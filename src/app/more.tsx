
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

type MenuRowProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function MenuRow({ title, subtitle, onPress }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function MoreScreen() {
  const openUnavailablePage = (page: string) => {
    Alert.alert(
      page,
      `The ${page.toLowerCase()} page is not connected yet.`
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        
<View style={styles.header}>
  <Text style={styles.title}>More</Text>
  <Text style={styles.subtitle}>
    Settings and fleet management
  </Text>
</View>

        <SectionTitle>Reports</SectionTitle>

        <View style={styles.card}>
          <MenuRow
            title="Reports"
            subtitle="View, download and send fleet reports"
            onPress={() => router.push("/reports")}
          />

          <Divider />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                Automatic Report Emails
              </Text>
              <Text style={styles.rowSubtitle}>
                Scheduled email delivery is not available yet
              </Text>
            </View>

            <Text style={styles.comingSoon}>Soon</Text>
          </View>
        </View>

        <SectionTitle>Fleet Management</SectionTitle>

        <View style={styles.card}>
          <MenuRow
            title="Vehicle Document Management"
            subtitle="Add, view, edit and manage vehicle documents"
            onPress={() =>
              router.push("/vehicle-document-management")
            }
          />

          <Divider />

          <MenuRow
            title="Expiring & Expired Documents"
            subtitle="Review documents that need attention"
            onPress={() =>
              router.push("/vehicle-documents" as any)
            }
          />
        </View>

        <SectionTitle>Company</SectionTitle>

        <View style={styles.card}>
          <MenuRow
            title="Company Information"
            subtitle="View company details"
            onPress={() =>
              openUnavailablePage("Company Information")
            }
          />
        </View>

        <SectionTitle>App</SectionTitle>

        <View style={styles.card}>
          <MenuRow
            title="Help & Support"
            subtitle="Get help with FleetSet"
            onPress={() => openUnavailablePage("Help & Support")}
          />

          <Divider />

          <MenuRow
            title="Privacy Policy"
            onPress={() => openUnavailablePage("Privacy Policy")}
          />

          <Divider />

          <MenuRow
            title="Terms & Conditions"
            onPress={() =>
              openUnavailablePage("Terms & Conditions")
            }
          />

          <Divider />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>App Version</Text>
              <Text style={styles.rowSubtitle}>FleetSet V1.0</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  content: {
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 30,
},

  header: {
  marginBottom: 25,
},

  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000000",
    marginBottom: 18,
  },

  title: {
  fontSize: 28,
  fontWeight: "700",
  color: "#000000",
},

  subtitle: {
    fontSize: 14,
    color: "#777777",
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    marginTop: 18,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },

  row: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rowText: {
    flex: 1,
    paddingRight: 12,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
  },

  rowSubtitle: {
    fontSize: 12,
    color: "#777777",
    marginTop: 4,
    lineHeight: 17,
  },

  arrow: {
    fontSize: 28,
    color: "#999999",
    fontWeight: "300",
  },

  comingSoon: {
    fontSize: 11,
    fontWeight: "600",
    color: "#777777",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginLeft: 16,
  },

  bottomSpace: {
    height: 30,
  },

  
});