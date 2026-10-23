
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Href, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGet } from "../services/api";
import { getUser } from "../utils/storage";

type User = {
  id?: string;
  company_id?: string | null;
  branch_id?: string | null;
};

type Driver = {
  is_active?: boolean;
};

type Vehicle = {
  is_active?: boolean;
};

export default function DashboardScreen() {
  const [fuelToday, setFuelToday] = useState(0);
  const [fuelLoading, setFuelLoading] = useState(true);

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [driversCount, setDriversCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [tripsToday, setTripsToday] = useState(0);
  const [maintenanceToday, setMaintenanceToday] = useState(0);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  const [expiringDocumentsCount, setExpiringDocumentsCount] = useState(0);
  const [expiredDocumentsCount, setExpiredDocumentsCount] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUser<User>();

        if (!user) {
          console.log("No logged-in user found.");
          router.replace("/login");
          return;
        }

        console.log("Dashboard user:", user);

        if (!user.company_id) {
          console.error("No company ID found for logged-in user.");
          return;
        }

        setCompanyId(user.company_id);
      } catch (error) {
        console.error("Could not load logged-in user:", error);
      }
    };

    loadUser();
  }, []);

  const loadFuelToday = useCallback(async () => {
    if (!companyId) {
      return;
    }

    try {
      setFuelLoading(true);

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const data = await apiGet(
        `/fuel-logs/${companyId}/expense/daily?target_date=${today}`
      );

      console.log("Fuel today response:", data);

      setFuelToday(Number(data?.total_cost) || 0);
    } catch (error) {
      console.error("Fuel today loading error:", error);
      setFuelToday(0);
    } finally {
      setFuelLoading(false);
    }
  }, [companyId]);

  const loadDriversCount = useCallback(async () => {
    if (!companyId) {
      return;
    }

    try {
      const data = await apiGet(`/drivers/${companyId}`);

      console.log("Drivers response:", data);

      const driverData = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.drivers)
        ? data.drivers
        : Array.isArray(data?.data?.drivers)
        ? data.data.drivers
        : [];

      const activeDrivers = driverData.filter(
        (driver: Driver) => driver.is_active === true
      );

      setDriversCount(activeDrivers.length);
    } catch (error) {
      console.error("Drivers count loading error:", error);
      setDriversCount(0);
    }
  }, [companyId]);

  const loadVehiclesCount = useCallback(async () => {
    if (!companyId) {
      return;
    }

    try {
      const data = await apiGet(`/vehicles/${companyId}/all`);

      console.log("Vehicles response:", data);

      const vehicleData = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.vehicles)
        ? data.vehicles
        : Array.isArray(data?.data?.vehicles)
        ? data.data.vehicles
        : [];

      const activeVehicles = vehicleData.filter(
        (vehicle: Vehicle) => vehicle.is_active === true
      );

      setVehiclesCount(activeVehicles.length);

      console.log("Active vehicle count:", activeVehicles.length);
    } catch (error) {
      console.error("Vehicles count loading error:", error);
      setVehiclesCount(0);
    }
  }, [companyId]);

  const loadTripsToday = useCallback(async () => {
    if (!companyId) {
      console.log("Dashboard: companyId not available.");
      return;
    }

    try {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const endpoint =
        `/trips/date-range` +
        `?start_date=${today}` +
        `&end_date=${today}` +
        `&company_id=${encodeURIComponent(companyId)}`;

      console.log("Dashboard trip endpoint:", endpoint);

      const response = await apiGet(endpoint);

      console.log(
        "Dashboard trips response:",
        JSON.stringify(response, null, 2)
      );

      let tripData: any[] = [];

      if (Array.isArray(response)) {
        tripData = response;
      } else if (Array.isArray(response?.data)) {
        tripData = response.data;
      } else if (Array.isArray(response?.data?.data)) {
        tripData = response.data.data;
      } else if (Array.isArray(response?.trips)) {
        tripData = response.trips;
      } else if (Array.isArray(response?.data?.trips)) {
        tripData = response.data.trips;
      }

      console.log("Dashboard today's trips:", tripData);
      console.log("Dashboard today's trip count:", tripData.length);

      setTripsToday(tripData.length);
    } catch (error: any) {
      console.log("Dashboard trips loading error:", error);
      setTripsToday(0);
    }
  }, [companyId]);

  const loadMaintenanceToday = useCallback(async () => {
    if (!companyId) {
      console.log("Dashboard: companyId not available.");
      return;
    }

    try {
      setMaintenanceLoading(true);

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const response = await apiGet(`/maintenance/${companyId}/all`);

      console.log(
        "Dashboard maintenance response:",
        JSON.stringify(response, null, 2)
      );

      let maintenanceData: any[] = [];

      if (Array.isArray(response)) {
        maintenanceData = response;
      } else if (Array.isArray(response?.data)) {
        maintenanceData = response.data;
      } else if (Array.isArray(response?.maintenance)) {
        maintenanceData = response.maintenance;
      } else if (Array.isArray(response?.data?.maintenance)) {
        maintenanceData = response.data.maintenance;
      }

      const todayMaintenance = maintenanceData.filter((record: any) => {
        // Only active maintenance records
        if (record.is_active === false) {
          return false;
        }

        const maintenanceDate =
          record.service_date ||
          record.serviceDate ||
          record.maintenance_date ||
          record.maintenanceDate;

        if (!maintenanceDate) {
          return false;
        }

        return String(maintenanceDate).slice(0, 10) === today;
      });

      const todayMaintenanceCost = todayMaintenance.reduce(
        (total: number, record: any) => {
          const cost = Number(record.cost) || 0;
          return total + cost;
        },
        0
      );

      console.log("Dashboard today's maintenance:", todayMaintenance);

      console.log(
        "Dashboard today's maintenance cost:",
        todayMaintenanceCost
      );

      setMaintenanceToday(todayMaintenanceCost);
    } catch (error) {
      console.error("Dashboard maintenance loading error:", error);
      setMaintenanceToday(0);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [companyId]);

  const loadDocumentAlerts = useCallback(async () => {
    if (!companyId) {
      return;
    }

    try {
      const [expiringResponse, expiredResponse] = await Promise.all([
        apiGet(`/vehicle-documents/${companyId}/expiring?days=30`),
        apiGet(`/vehicle-documents/${companyId}/expired`),
      ]);

      console.log(
        "Dashboard expiring documents response:",
        JSON.stringify(expiringResponse, null, 2)
      );

      console.log(
        "Dashboard expired documents response:",
        JSON.stringify(expiredResponse, null, 2)
      );

      const extractDocuments = (response: any): any[] => {
        if (Array.isArray(response)) {
          return response;
        }

        if (Array.isArray(response?.data)) {
          return response.data;
        }

        if (Array.isArray(response?.documents)) {
          return response.documents;
        }

        if (Array.isArray(response?.data?.documents)) {
          return response.data.documents;
        }

        return [];
      };

      const expiringDocuments = extractDocuments(expiringResponse);
      const expiredDocuments = extractDocuments(expiredResponse);

      setExpiringDocumentsCount(expiringDocuments.length);
      setExpiredDocumentsCount(expiredDocuments.length);

      console.log(
        "Dashboard expiring document count:",
        expiringDocuments.length
      );

      console.log(
        "Dashboard expired document count:",
        expiredDocuments.length
      );
    } catch (error) {
      console.error("Document alerts loading error:", error);

      setExpiringDocumentsCount(0);
      setExpiredDocumentsCount(0);
    }
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      if (!companyId) {
        return;
      }

      loadFuelToday();
      loadVehiclesCount();
      loadDriversCount();
      loadTripsToday();
      loadMaintenanceToday();
      loadDocumentAlerts();
    }, [
      companyId,
      loadFuelToday,
      loadVehiclesCount,
      loadDriversCount,
      loadTripsToday,
      loadMaintenanceToday,
      loadDocumentAlerts,
    ])
  );

  const hasExpiredDocuments = expiredDocumentsCount > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>FleetSet</Text>

          <TouchableOpacity
            style={styles.profileCircle}
            onPress={() => router.push("/account" as Href)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open user account"
          >
            <Text style={styles.profileText}>A</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Fleet overview</Text>

        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push("/vehicles")}
          >
            <Text style={styles.statIcon}>🚗</Text>

            <Text style={styles.statNumber}>{vehiclesCount}</Text>

            <Text style={styles.statLabel}>Vehicles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push("/drivers" as Href)}
          >
            <Text style={styles.statIcon}>👤</Text>

            <Text style={styles.statNumber}>{driversCount}</Text>

            <Text style={styles.statLabel}>Drivers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push("/fuel")}
          >
            <Text style={styles.statIcon}>₹</Text>

            <Text style={styles.statNumber}>
              {fuelLoading
                ? "..."
                : `₹${fuelToday.toLocaleString("en-IN")}`}
            </Text>

            <Text style={styles.statLabel}>Fuel Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push("/trip" as Href)}
          >
            <Text style={styles.statIcon}>🚚</Text>

            <Text style={styles.statNumber}>{tripsToday}</Text>

            <Text style={styles.statLabel}>Trips Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() =>
              router.push("/vehicle-maintenance" as Href)
            }
          >
            <Text style={styles.statNumber}>
              {maintenanceLoading
                ? "..."
                : `₹${maintenanceToday.toLocaleString("en-IN")}`}
            </Text>

            <Text style={styles.statLabel}>Maintenance Today</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/vehicles?add=true")}
          >
            <Text style={styles.actionIcon}>＋</Text>

            <Text style={styles.actionText}>Add Vehicle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/drivers?add=true" as Href)}
          >
            <Text style={styles.actionIcon}>＋</Text>

            <Text style={styles.actionText}>Add Driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/trip?add=true" as Href)}
          >
            <Text style={styles.actionIcon}>＋</Text>

            <Text style={styles.actionText}>Add Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/fuel?add=true")}
          >
            <Text style={styles.actionIcon}>＋</Text>

            <Text style={styles.actionText}>Add Fuel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push("/vehicle-document-management" as Href)
            }
          >
            <Text style={styles.actionIcon}>▤</Text>

            <Text style={styles.actionText}>Vehicle Documents</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Attention needed</Text>

        <TouchableOpacity
          style={[
            styles.alertCard,
            hasExpiredDocuments && styles.expiredAlertCard,
          ]}
          onPress={() => router.push("/vehicle-documents" as Href)}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.alertIcon,
              hasExpiredDocuments && styles.expiredAlertIcon,
            ]}
          >
            <Text
              style={
                hasExpiredDocuments
                  ? styles.expiredAlertSymbol
                  : undefined
              }
            >
              ⚠
            </Text>
          </View>

          <View style={styles.alertContent}>
            <View style={styles.alertTitleRow}>
              <Text style={styles.alertTitle}>
                Documents expiring soon
              </Text>

              {hasExpiredDocuments && (
                <View style={styles.redIndicator}>
                  <Text style={styles.redIndicatorText}>!</Text>
                </View>
              )}
            </View>

            <Text style={styles.alertDescription}>
              {hasExpiredDocuments
                ? `${expiredDocumentsCount} vehicle ${
                    expiredDocumentsCount === 1
                      ? "document has"
                      : "documents have"
                  } expired.`
                : expiringDocumentsCount > 0
                ? `${expiringDocumentsCount} vehicle ${
                    expiringDocumentsCount === 1
                      ? "document needs"
                      : "documents need"
                  } attention.`
                : "No vehicle documents need attention."}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <Text>⚠</Text>
          </View>

          <TouchableOpacity
            style={styles.alertContent}
            onPress={() => router.push("/vehicles-without-driver")}
            activeOpacity={0.7}
          >
            <Text style={styles.alertTitle}>
              Vehicles without drivers
            </Text>

            <Text style={styles.alertDescription}>
              2 vehicles currently have no driver assigned.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      
<SafeAreaView
  edges={["bottom"]}
  style={styles.bottomNavSafeArea}
>
  <View style={styles.bottomNav}>
    <TouchableOpacity
      style={styles.navItem}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>⌂</Text>
      <Text style={styles.navActive}>Home</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navItem}
      onPress={() => router.push("/vehicles")}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>🚗</Text>
      <Text style={styles.navText}>Vehicles</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navItem}
      onPress={() => router.push("/drivers" as Href)}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>👤</Text>
      <Text style={styles.navText}>Drivers</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navItem}
      onPress={() => router.push("/maintenance-due" as Href)}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>⚠</Text>
      <Text style={styles.navText}>Service</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navItem}
      onPress={() => router.push("/reports")}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>▥</Text>
      <Text style={styles.navText}>Reports</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.navItem}
      onPress={() => router.push("/more")}
      activeOpacity={0.7}
    >
      <Text style={styles.navIcon}>⚙</Text>
      <Text style={styles.navText}>More</Text>
    </TouchableOpacity>
  </View>
</SafeAreaView>
</View>
);
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  logo: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111111",
  },

  greeting: {
    marginTop: 4,
    color: "#666666",
    fontSize: 14,
  },

  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },

  profileText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 12,
    marginTop: 4,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  statCard: {
    width: "48%",
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  statIcon: {
    fontSize: 21,
    marginBottom: 8,
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111111",
    flexShrink: 1,
  },

  statLabel: {
    color: "#666666",
    marginTop: 4,
    fontSize: 13,
  },

  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  actionButton: {
    width: "48%",
    minHeight: 54,
    backgroundColor: "#111111",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    flexDirection: "row",
  },

  actionIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    marginRight: 6,
  },

  actionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  expiredAlertCard: {
    borderColor: "#FF3B30",
  },

  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEEEEE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },

  expiredAlertIcon: {
    backgroundColor: "#FFE5E5",
  },

  expiredAlertSymbol: {
    color: "#FF3B30",
  },

  alertContent: {
    flex: 1,
    minWidth: 0,
  },

  alertTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
    flex: 1,
  },

  redIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    flexShrink: 0,
  },

  redIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  alertDescription: {
    color: "#666666",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  bottomNav: {
    minHeight: 64,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  navIcon: {
    fontSize: 19,
    marginBottom: 4,
  },

  navActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111111",
  },

  navText: {
    fontSize: 10,
    color: "#777777",
  },

  bottomNavSafeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingBottom: Platform.OS === "android" ? 2 : 0,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
});
