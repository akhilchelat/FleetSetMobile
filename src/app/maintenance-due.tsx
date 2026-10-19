
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";

import { API_URL } from "../constants/api";
import { getToken, getUser } from "../utils/storage";

type MaintenanceRecord = {
  id: string;
  company_id: string;
  branch_id: string;
  vehicle_id: string;
  recorded_by?: string;
  maintenance_type?: string | null;
  description?: string | null;
  garage_name?: string | null;
  invoice_number?: string | null;
  cost?: number | string | null;
  service_date?: string | null;
  next_service_date?: string | null;
  odometer_reading?: number | null;
  remarks?: string | null;
  is_active: boolean;
  status?: "PENDING" | "COMPLETED";
};

type Vehicle = {
  id: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  is_active?: boolean;
};

type UserData = {
  company_id?: string;
  branch_id?: string | null;
  role?: string;
  role_name?: string;
  user_role?: string;
  user_type?: string;
  data?: {
    role?: string;
    role_name?: string;
    company_id?: string;
  };
  user?: {
    role?: string;
    role_name?: string;
    company_id?: string;
  };
};

type FilterType = "overdue" | "today" | "7" | "30" | "60" | "90";

const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getToken();
  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
};

async function getResponseError(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}.`;

  try {
    const payload = await response.json();

    if (typeof payload?.detail === "string") return payload.detail;
    if (typeof payload?.message === "string") return payload.message;
    if (typeof payload?.detail?.message === "string") {
      return payload.detail.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function getDate(value?: string | null): Date | null {
  if (!value) return null;

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysRemaining(value?: string | null): number | null {
  const target = getDate(value);
  if (!target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(value?: string | null): string {
  const date = getDate(value);
  if (!date) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMaintenanceType(value?: string | null): string {
  if (!value) return "General Maintenance";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDueStatus(days: number | null): string {
  if (days === null) return "Date unavailable";

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
  }

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";

  return `Due in ${days} days`;
}

function getDueFilterTitle(filter: FilterType): string {
  switch (filter) {
    case "overdue":
      return "Overdue Maintenance";
    case "today":
      return "Maintenance Due Today";
    case "7":
      return "Maintenance Due Within 7 Days";
    case "30":
      return "Maintenance Due Within 30 Days";
    case "60":
      return "Maintenance Due Within 60 Days";
    case "90":
      return "Maintenance Due Within 90 Days";
  }
}

function getDueFilterDescription(filter: FilterType): string {
  switch (filter) {
    case "overdue":
      return "Vehicles whose next scheduled service date has passed.";
    case "today":
      return "Vehicles scheduled for maintenance today.";
    case "7":
      return "Plan servicing for vehicles due within the next 7 days.";
    case "30":
      return "Plan upcoming vehicle servicing for the next 30 days.";
    case "60":
      return "Review vehicle servicing due within the next 60 days.";
    case "90":
      return "Review vehicle servicing due within the next 90 days.";
  }
}

function unwrapList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export default function MaintenanceDueScreen() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("overdue");
  const [search, setSearch] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  const roleValue =
  currentUser?.role_name ??
  currentUser?.role ??
  currentUser?.user_role ??
  currentUser?.user_type ??
  currentUser?.data?.role_name ??
  currentUser?.data?.role ??
  currentUser?.user?.role_name ??
  currentUser?.user?.role ??
  "";

  const normalizedRole = String(roleValue)
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, "_");
  
  const canManage = [
  "GLOBAL_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",].includes(normalizedRole);


  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const user = (await getUser()) as UserData | null;
      setCurrentUser(user);

      if (!user?.company_id) {
        Alert.alert(
          "Error",
          "Company information was not found. Please log in again."
        );
        return;
      }

      const companyId = user.company_id;

      const [maintenanceResponse, vehicleResponse] = await Promise.all([
        authenticatedFetch(`${API_URL}/maintenance/${companyId}/all`),
        authenticatedFetch(`${API_URL}/vehicles/${companyId}/all`),
      ]);

      if (!maintenanceResponse.ok && maintenanceResponse.status !== 404) {
        throw new Error(await getResponseError(maintenanceResponse));
      }

      if (!vehicleResponse.ok) {
        throw new Error(await getResponseError(vehicleResponse));
      }

      const maintenancePayload =
        maintenanceResponse.status === 404
          ? []
          : await maintenanceResponse.json();

      const vehiclePayload = await vehicleResponse.json();

      setRecords(
        unwrapList(maintenancePayload).filter(
          (record: MaintenanceRecord) => record.is_active !== false
        )
      );

      setVehicles(unwrapList(vehiclePayload));
    } catch (error: unknown) {
      console.error("Failed to load maintenance due records:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Failed to load maintenance records.";

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData])
  );

  const vehicleMap = useMemo(() => {
    const map: Record<string, Vehicle> = {};

    vehicles.forEach((vehicle) => {
      map[vehicle.id] = vehicle;
    });

    return map;
  }, [vehicles]);

  const pendingRecords = useMemo(
    () => records.filter((record) => record.status !== "COMPLETED"),
    [records]
  );

  const dueRecords = useMemo(() => {
    return pendingRecords.filter((record) => {
      const days = getDaysRemaining(record.next_service_date);

      if (days === null) return false;
      if (filter === "overdue") return days < 0;
      if (filter === "today") return days === 0;

      return days >= 0 && days <= Number(filter);
    });
  }, [pendingRecords, filter]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return dueRecords;

    return dueRecords.filter((record) => {
      const vehicle = vehicleMap[record.vehicle_id];

      const registration =
        vehicle?.registration_number?.toLowerCase() || "";

      const vehicleName =
        `${vehicle?.manufacturer || ""} ${vehicle?.model || ""}`.toLowerCase();

      const type = formatMaintenanceType(record.maintenance_type).toLowerCase();
      const description = record.description?.toLowerCase() || "";
      const garage = record.garage_name?.toLowerCase() || "";
      const invoice = record.invoice_number?.toLowerCase() || "";
      const remarks = record.remarks?.toLowerCase() || "";

      return (
        registration.includes(query) ||
        vehicleName.includes(query) ||
        type.includes(query) ||
        description.includes(query) ||
        garage.includes(query) ||
        invoice.includes(query) ||
        remarks.includes(query)
      );
    });
  }, [dueRecords, search, vehicleMap]);

  const overdueCount = useMemo(
    () =>
      pendingRecords.filter((record) => {
        const days = getDaysRemaining(record.next_service_date);
        return days !== null && days < 0;
      }).length,
    [pendingRecords]
  );

  const todayCount = useMemo(
    () =>
      pendingRecords.filter(
        (record) => getDaysRemaining(record.next_service_date) === 0
      ).length,
    [pendingRecords]
  );

  const upcomingWeekCount = useMemo(
    () =>
      pendingRecords.filter((record) => {
        const days = getDaysRemaining(record.next_service_date);
        return days !== null && days >= 0 && days <= 7;
      }).length,
    [pendingRecords]
  );

  const handleRefresh = useCallback(async () => {
    await loadData(false);
  }, [loadData]);

  const handleCompleteService = useCallback(
    (record: MaintenanceRecord) => {
      const complete = async () => {
        try {
          setCompletingId(record.id);

          const user = (await getUser()) as UserData | null;

          if (!user?.company_id) {
            throw new Error("Company information was not found.");
          }

          const response = await authenticatedFetch(
            `${API_URL}/maintenance/${user.company_id}/${record.id}/complete`,
            { method: "POST" }
          );

          if (!response.ok) {
            throw new Error(await getResponseError(response));
          }

          await loadData(false);

          if (Platform.OS === "web") {
            window.alert("Maintenance marked as completed.");
          } else {
            Alert.alert(
              "Service Completed",
              "The maintenance record has been marked as completed."
            );
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not complete maintenance.";

          if (Platform.OS === "web") {
            window.alert(message);
          } else {
            Alert.alert("Error", message);
          }
        } finally {
          setCompletingId(null);
        }
      };

      if (Platform.OS === "web") {
        if (window.confirm("Mark this maintenance record as completed?")) {
          void complete();
        }
      } else {
        Alert.alert(
          "Complete Service",
          "Mark this maintenance record as completed?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Complete",
              onPress: () => void complete(),
            },
          ]
        );
      }
    },
    [loadData]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{getDueFilterTitle(filter)}</Text>
          <Text style={styles.subtitle}>
            {getDueFilterDescription(filter)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{overdueCount}</Text>
            <Text style={styles.summaryLabel}>Overdue</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{todayCount}</Text>
            <Text style={styles.summaryLabel}>Due Today</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{upcomingWeekCount}</Text>
            <Text style={styles.summaryLabel}>Next 7 Days</Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Maintenance Schedule</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {[
              { key: "overdue" as FilterType, label: "Overdue" },
              { key: "today" as FilterType, label: "Today" },
              { key: "7" as FilterType, label: "7 Days" },
              { key: "30" as FilterType, label: "30 Days" },
              { key: "60" as FilterType, label: "60 Days" },
              { key: "90" as FilterType, label: "90 Days" },
            ].map((item) => {
              const active = filter === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}
                  onPress={() => setFilter(item.key)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      active && styles.filterButtonTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search vehicle, maintenance or garage"
            placeholderTextColor="#999999"
            style={[
              styles.searchInput,
              ...(Platform.OS === "web"
                ? [{ outlineStyle: "none" } as any]
                : []),
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loadingText}>
              Loading maintenance schedule...
            </Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {search.trim()
                ? "No matching maintenance records"
                : filter === "overdue"
                  ? "No overdue maintenance"
                  : "No maintenance due in this period"}
            </Text>

            <Text style={styles.emptySubtitle}>
              {search.trim()
                ? "Try another vehicle registration number, maintenance type, garage, or keyword."
                : filter === "overdue"
                  ? "No pending maintenance records have a past next-service date."
                  : `No pending maintenance records match ${getDueFilterTitle(
                      filter
                    ).toLowerCase()}.`}
            </Text>

            {search.trim().length > 0 && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setSearch("")}
                activeOpacity={0.75}
              >
                <Text style={styles.secondaryButtonText}>Clear Search</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
              activeOpacity={0.75}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.refreshButtonText}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRecords.map((record) => {
              const days = getDaysRemaining(record.next_service_date);
              const vehicle = vehicleMap[record.vehicle_id];
              const overdue = days !== null && days < 0;
              const dueToday = days === 0;
              const isCompleting = completingId === record.id;

              return (
                <View
                  key={record.id}
                  style={[
                    styles.maintenanceCard,
                    overdue && styles.overdueCard,
                    dueToday && styles.todayCard,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleNumber}>
                        {vehicle?.registration_number || "Vehicle not found"}
                      </Text>

                      {!!(vehicle?.manufacturer || vehicle?.model) && (
                        <Text style={styles.vehicleModel}>
                          {[vehicle?.manufacturer, vehicle?.model]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>
                      )}

                      <Text style={styles.maintenanceType}>
                        {formatMaintenanceType(record.maintenance_type)}
                      </Text>
                    </View>

                    <View style={styles.statusContainer}>
                      <Text
                        style={[
                          styles.statusText,
                          overdue && styles.statusOverdue,
                          dueToday && styles.statusToday,
                        ]}
                      >
                        {getDueStatus(days)}
                      </Text>
                    </View>
                  </View>

                  {!!record.description && (
                    <Text style={styles.description}>
                      {record.description}
                    </Text>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Next Service Date</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(record.next_service_date)}
                      </Text>
                    </View>

                    <View style={styles.detailItemRight}>
                      <Text style={styles.detailLabel}>Last Service Date</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(record.service_date)}
                      </Text>
                    </View>
                  </View>

                  {(record.garage_name ||
                    record.odometer_reading != null ||
                    record.cost != null) && (
                    <>
                      <View style={styles.divider} />

                      {!!record.garage_name && (
                        <View style={styles.extraDetail}>
                          <Text style={styles.detailLabel}>Garage</Text>
                          <Text style={styles.detailValue}>
                            {record.garage_name}
                          </Text>
                        </View>
                      )}

                      <View style={styles.extraRow}>
                        {record.odometer_reading != null && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>
                              Service Odometer
                            </Text>
                            <Text style={styles.detailValue}>
                              {record.odometer_reading.toLocaleString("en-IN")} km
                            </Text>
                          </View>
                        )}

                        {record.cost != null && (
                          <View style={styles.detailItemRight}>
                            <Text style={styles.detailLabel}>Service Cost</Text>
                            <Text style={styles.detailValue}>
                              ₹
                              {Number(record.cost).toLocaleString("en-IN", {
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  )}

                  {!!record.invoice_number && (
                    <View style={styles.extraDetail}>
                      <Text style={styles.detailLabel}>Invoice Number</Text>
                      <Text style={styles.detailValue}>
                        {record.invoice_number}
                      </Text>
                    </View>
                  )}

                  {!!record.remarks && (
                    <View style={styles.remarksBox}>
                      <Text style={styles.detailLabel}>Remarks</Text>
                      <Text style={styles.remarksText}>{record.remarks}</Text>
                    </View>
                  )}

                  {canManage && (
  <TouchableOpacity
    style={[
      styles.completeButton,
      completingId === record.id &&
        styles.completeButtonDisabled,
    ]}
    onPress={() => handleCompleteService(record)}
    disabled={completingId !== null}
    activeOpacity={0.75}
  >
    {completingId === record.id ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <Text style={styles.completeButtonText}>
        Complete Service
      </Text>
    )}
  </TouchableOpacity>
)}
                </View>
              );
            })}
          </View>
        )}

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
    paddingTop: 55,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 27,
    fontWeight: "700",
    color: "#000000",
  },
  subtitle: {
    fontSize: 14,
    color: "#777777",
    marginTop: 5,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  summaryNumber: {
    fontSize: 23,
    fontWeight: "700",
    color: "#000000",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#777777",
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 16,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 10,
  },
  filterScrollContent: {
    gap: 8,
  },
  filterButton: {
    height: 40,
    minWidth: 75,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  filterButtonActive: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555555",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  searchContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 23,
    color: "#666666",
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: "#000000",
    borderWidth: 0,
    paddingVertical: 10,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontSize: 22,
    lineHeight: 24,
    color: "#555555",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#777777",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777777",
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },
  refreshButton: {
    marginTop: 18,
    backgroundColor: "#000000",
    borderRadius: 9,
    minWidth: 100,
    minHeight: 40,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#222222",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    gap: 12,
  },
  maintenanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 16,
  },
  overdueCard: {
    borderColor: "#FF3B30",
  },
  todayCard: {
    borderColor: "#D5A000",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  vehicleInfo: {
    flex: 1,
    paddingRight: 10,
  },
  vehicleNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
  },
  vehicleModel: {
    fontSize: 12,
    color: "#777777",
    marginTop: 3,
  },
  maintenanceType: {
    fontSize: 13,
    color: "#555555",
    marginTop: 5,
  },
  statusContainer: {
    maxWidth: "48%",
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
    textAlign: "right",
  },
  statusOverdue: {
    color: "#D92D20",
  },
  statusToday: {
    color: "#9A6700",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: "#555555",
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 13,
  },
  detailRow: {
    flexDirection: "row",
  },
  detailItem: {
    flex: 1,
    paddingRight: 8,
  },
  detailItemRight: {
    flex: 1,
    paddingLeft: 8,
    alignItems: "flex-end",
  },
  detailLabel: {
    fontSize: 11,
    color: "#888888",
  },
  detailValue: {
    fontSize: 13,
    color: "#000000",
    fontWeight: "600",
    marginTop: 4,
  },
  extraDetail: {
    marginBottom: 12,
  },
  extraRow: {
    flexDirection: "row",
  },
  remarksBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F7F8FA",
  },
  remarksText: {
    fontSize: 13,
    color: "#555555",
    marginTop: 5,
    lineHeight: 19,
  },
  bottomSpace: {
    height: 90,
  },
  completeButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
