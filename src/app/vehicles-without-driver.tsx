
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import { API_URL } from "../constants/api";
import { getToken, getUser } from "../utils/storage";

type Vehicle = {
  id: string;
  company_id: string;
  branch_id: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  year?: number | null;
  status?: string | null;
  is_active: boolean;
};

type Driver = {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  license_number?: string | null;
  is_active?: boolean;
};

type Assignment = {
  id: string;
  branch_id?: string;
  vehicle_id: string;
  driver_id: string;
  is_active: boolean;
};

type StoredUser = {
  company_id?: string | null;
  branch_id?: string | null;
};

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

const getErrorMessage = async (
  response: Response
): Promise<string> => {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: any) => item?.msg || JSON.stringify(item))
        .join(", ");
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }
  } catch {
    // The response may not contain JSON.
  }

  return `Request failed with status ${response.status}`;
};

const getArray = <T,>(
  data: any,
  alternateKey?: string
): T[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (alternateKey && Array.isArray(data?.[alternateKey])) {
    return data[alternateKey];
  }

  return [];
};

const fetchList = async <T,>(
  url: string,
  alternateKey?: string
): Promise<T[]> => {
  const response = await authenticatedFetch(url);

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return getArray<T>(await response.json(), alternateKey);
};

export default function VehiclesWithoutDriverScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] =
    useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] =
    useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [driverModalVisible, setDriverModalVisible] =
    useState(false);

  const getCompanyId = async (): Promise<string | null> => {
    try {
      const user = await getUser<StoredUser>();
      return user?.company_id || null;
    } catch (error) {
      console.error("FAILED TO READ STORED USER:", error);
      return null;
    }
  };

  const loadVehicles = useCallback(async () => {
    try {
      const companyId = await getCompanyId();

      if (!companyId) {
        Alert.alert(
          "Error",
          "Company information is missing. Please log in again."
        );
        return;
      }

      const [loadedVehicles, loadedDrivers, loadedAssignments] =
        await Promise.all([
          fetchList<Vehicle>(
            `${API_URL}/vehicles/${companyId}/all`,
            "vehicles"
          ),
          fetchList<Driver>(
            `${API_URL}/drivers/${companyId}`,
            "drivers"
          ),
          fetchList<Assignment>(
            `${API_URL}/driver-vehicle-assignments/${companyId}`,
            "assignments"
          ),
        ]);

      setVehicles(
        loadedVehicles.filter(
          (vehicle) => vehicle.is_active !== false
        )
      );
      setDrivers(loadedDrivers);
      setAssignments(loadedAssignments);
    } catch (error) {
      console.error("LOAD VEHICLES WITHOUT DRIVER ERROR:", error);

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to load vehicle data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
  };

  const vehiclesWithoutDriver = useMemo(() => {
    const assignedVehicleIds = new Set(
      assignments
        .filter((assignment) => assignment.is_active)
        .map((assignment) => assignment.vehicle_id)
    );

    return vehicles
      .filter((vehicle) => !assignedVehicleIds.has(vehicle.id))
      .filter((vehicle) => {
        const query = search.trim().toLowerCase();

        if (!query) {
          return true;
        }

        return [
          vehicle.registration_number,
          vehicle.manufacturer,
          vehicle.model,
          vehicle.vehicle_type,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );
      });
  }, [vehicles, assignments, search]);

  const availableDrivers = useMemo(() => {
    const assignedDriverIds = new Set(
      assignments
        .filter((assignment) => assignment.is_active)
        .map((assignment) => assignment.driver_id)
    );

    return drivers
      .filter((driver) => driver.is_active !== false)
      .filter((driver) => !assignedDriverIds.has(driver.id))
      .filter((driver) => {
        const query = driverSearch.trim().toLowerCase();

        if (!query) {
          return true;
        }

        const fullName =
          `${driver.first_name} ${driver.last_name}`.trim();

        return (
          fullName.toLowerCase().includes(query) ||
          String(driver.phone || "").toLowerCase().includes(query) ||
          String(driver.license_number || "")
            .toLowerCase()
            .includes(query)
        );
      });
  }, [drivers, assignments, driverSearch]);

  const openAssignModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedDriverId(null);
    setDriverSearch("");
    setDriverModalVisible(true);
  };

  const closeAssignModal = (force = false) => {
    if (assigning && !force) {
      return;
    }

    setDriverModalVisible(false);
    setSelectedVehicle(null);
    setSelectedDriverId(null);
    setDriverSearch("");
  };

  const assignDriver = async () => {
    // Store a narrowed, non-null reference for TypeScript.
    const vehicle = selectedVehicle;
    const driverId = selectedDriverId;

    if (!vehicle) {
      Alert.alert("Select Vehicle", "Please select a vehicle first.");
      return;
    }

    if (!driverId) {
      Alert.alert("Select Driver", "Please select an available driver.");
      return;
    }

    const companyId = await getCompanyId();

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information is missing. Please log in again."
      );
      return;
    }

    const selectedDriver = drivers.find(
      (driver) => driver.id === driverId
    );

    if (!selectedDriver || selectedDriver.is_active === false) {
      Alert.alert(
        "Driver Unavailable",
        "Please select an active driver."
      );
      return;
    }

    const alreadyAssigned = assignments.some(
      (assignment) =>
        assignment.driver_id === driverId && assignment.is_active
    );

    if (alreadyAssigned) {
      Alert.alert(
        "Driver Already Assigned",
        "This driver already has an active vehicle assignment. Refresh and select another driver."
      );
      return;
    }

    const vehicleAlreadyAssigned = assignments.some(
      (assignment) =>
        assignment.vehicle_id === vehicle.id && assignment.is_active
    );

    if (vehicleAlreadyAssigned) {
      Alert.alert(
        "Vehicle Already Assigned",
        "This vehicle already has an active driver assignment. Refresh the list."
      );
      return;
    }

    setAssigning(true);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/driver-vehicle-assignments/${companyId}`,
        {
          method: "POST",
          body: JSON.stringify({
            driver_id: driverId,
            vehicle_id: vehicle.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      closeAssignModal(true);
      await loadVehicles();

      Alert.alert(
        "Success",
        `${selectedDriver.first_name} ${selectedDriver.last_name} assigned to ${vehicle.registration_number}.`
      );
    } catch (error) {
      console.error("ASSIGN DRIVER ERROR:", error);

      Alert.alert(
        "Assign Failed",
        error instanceof Error
          ? error.message
          : "Failed to assign driver."
      );
    } finally {
      setAssigning(false);
    }
  };

  const getVehicleName = (vehicle: Vehicle) => {
    const name = [
      vehicle.manufacturer,
      vehicle.model,
    ]
      .filter(Boolean)
      .join(" ");

    return name || vehicle.vehicle_type || "Vehicle";
  };

  const getDriverName = (driver: Driver) =>
    `${driver.first_name} ${driver.last_name}`.trim();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>
          Vehicles Without Driver
        </Text>

        <Text style={styles.subtitle}>
          Find unassigned vehicles and assign an available driver.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTextContainer}>
          <Text style={styles.summaryLabel}>
            Vehicles without driver
          </Text>

          <Text style={styles.summaryDescription}>
            Active vehicles with no active assignment
          </Text>
        </View>

        <Text style={styles.summaryCount}>
          {loading ? "—" : vehiclesWithoutDriver.length}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search registration, make or model"
          placeholderTextColor="#888888"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />

        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.stateText}>Loading vehicles...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111111"
              colors={["#111111"]}
            />
          }
        >
          {vehiclesWithoutDriver.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>✓</Text>
              </View>

              <Text style={styles.emptyTitle}>
                {search.trim()
                  ? "No matching vehicles"
                  : "All vehicles have drivers"}
              </Text>

              <Text style={styles.emptyDescription}>
                {search.trim()
                  ? "Try another registration number, manufacturer or model."
                  : "There are no active vehicles waiting for a driver assignment."}
              </Text>

              {search.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setSearch("")}
                >
                  <Text style={styles.secondaryButtonText}>
                    Clear Search
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            vehiclesWithoutDriver.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <View style={styles.vehicleTopRow}>
                  <View style={styles.vehicleTitleContainer}>
                    <Text style={styles.registrationNumber}>
                      {vehicle.registration_number}
                    </Text>

                    <Text style={styles.vehicleName}>
                      {getVehicleName(vehicle)}
                    </Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Unassigned</Text>
                  </View>
                </View>

                <View style={styles.vehicleDetails}>
                  {vehicle.vehicle_type ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailValue}>
                        {vehicle.vehicle_type}
                      </Text>
                    </View>
                  ) : null}

                  {vehicle.year ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Year</Text>
                      <Text style={styles.detailValue}>
                        {vehicle.year}
                      </Text>
                    </View>
                  ) : null}

                  {vehicle.status ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>
                        Vehicle status
                      </Text>
                      <Text style={styles.detailValue}>
                        {vehicle.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardDivider} />

                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => openAssignModal(vehicle)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.assignButtonText}>
                    Assign Driver
                  </Text>

                  <Text style={styles.assignButtonArrow}>›</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={styles.footerText}>
            Pull down to refresh vehicle and driver assignments.
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={driverModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => closeAssignModal()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Assign Driver</Text>

                <Text style={styles.modalSubtitle}>
                  Select an available driver for this vehicle.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => closeAssignModal()}
                disabled={assigning}
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedVehicle && (
              <View style={styles.selectedVehicleCard}>
                <Text style={styles.selectedVehicleLabel}>
                  SELECTED VEHICLE
                </Text>

                <Text style={styles.selectedVehicleRegistration}>
                  {selectedVehicle.registration_number}
                </Text>

                <Text style={styles.selectedVehicleName}>
                  {getVehicleName(selectedVehicle)}
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Available drivers</Text>

            <TextInput
              style={styles.driverSearchInput}
              placeholder="Search name, phone or license"
              placeholderTextColor="#888888"
              value={driverSearch}
              onChangeText={setDriverSearch}
              autoCapitalize="none"
            />

            <ScrollView
              style={styles.driverList}
              contentContainerStyle={styles.driverListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {availableDrivers.length === 0 ? (
                <View style={styles.noDriversContainer}>
                  <Text style={styles.noDriversTitle}>
                    {driverSearch.trim()
                      ? "No matching drivers"
                      : "No available drivers"}
                  </Text>

                  <Text style={styles.noDriversDescription}>
                    {driverSearch.trim()
                      ? "Try another search."
                      : "All active drivers may already be assigned to vehicles."}
                  </Text>
                </View>
              ) : (
                availableDrivers.map((driver) => {
                  const isSelected = selectedDriverId === driver.id;

                  return (
                    <TouchableOpacity
                      key={driver.id}
                      style={[
                        styles.driverOption,
                        isSelected && styles.driverOptionSelected,
                      ]}
                      onPress={() => setSelectedDriverId(driver.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.driverAvatar,
                          isSelected && styles.driverAvatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.driverAvatarText,
                            isSelected &&
                              styles.driverAvatarTextSelected,
                          ]}
                        >
                          {driver.first_name?.charAt(0)?.toUpperCase() ||
                            "D"}
                        </Text>
                      </View>

                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>
                          {getDriverName(driver)}
                        </Text>

                        <Text style={styles.driverMeta}>
                          {driver.phone ||
                            driver.license_number ||
                            "Driver"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => closeAssignModal()}
                disabled={assigning}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!selectedDriverId || !selectedVehicle || assigning) &&
                    styles.confirmButtonDisabled,
                ]}
                onPress={assignDriver}
                disabled={
                  !selectedDriverId || !selectedVehicle || assigning
                }
                activeOpacity={0.8}
              >
                {assigning ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Confirm Assignment
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  header: { marginBottom: 20 },
  pageTitle: {
    color: "#111111",
    fontSize: 25,
    fontWeight: "700",
  },
  subtitle: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryTextContainer: { flex: 1, paddingRight: 10 },
  summaryLabel: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },
  summaryDescription: {
    color: "#777777",
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
  summaryCount: {
    color: "#111111",
    fontSize: 32,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    marginBottom: 16,
  },
  searchIcon: {
    color: "#555555",
    fontSize: 27,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#111111",
    fontSize: 14,
    paddingVertical: 12,
    outlineStyle: "none",
  } as any,
  clearButton: { paddingVertical: 8, paddingLeft: 10 },
  clearButtonText: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "600",
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 28 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    color: "#666666",
    fontSize: 14,
    marginTop: 12,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#EEEEEE",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginTop: 4,
  },
  emptyIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111111",
  },
  emptyTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    color: "#777777",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 18,
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "600",
  },
  vehicleCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 14,
    padding: 17,
    marginBottom: 13,
  },
  vehicleTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  vehicleTitleContainer: { flex: 1 },
  registrationNumber: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  vehicleName: {
    color: "#666666",
    fontSize: 13,
    marginTop: 5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#777777",
    marginRight: 6,
  },
  statusText: {
    color: "#555555",
    fontSize: 10,
    fontWeight: "600",
  },
  vehicleDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    marginTop: 18,
    marginBottom: 16,
  },
  detailItem: { minWidth: 75 },
  detailLabel: {
    color: "#888888",
    fontSize: 11,
    marginBottom: 5,
  },
  detailValue: {
    color: "#333333",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginBottom: 13,
  },
  assignButton: {
    backgroundColor: "#111111",
    borderRadius: 9,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  assignButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  assignButtonArrow: {
    color: "#FFFFFF",
    fontSize: 23,
    position: "absolute",
    right: 15,
    top: 7,
  },
  footerText: {
    color: "#888888",
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "92%",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitleContainer: { flex: 1, paddingRight: 10 },
  modalTitle: {
    color: "#111111",
    fontSize: 21,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#777777",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    color: "#111111",
    fontSize: 25,
    lineHeight: 28,
  },
  selectedVehicleCard: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
  },
  selectedVehicleLabel: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  selectedVehicleRegistration: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 6,
  },
  selectedVehicleName: {
    color: "#666666",
    fontSize: 12,
    marginTop: 3,
  },
  fieldLabel: {
    color: "#222222",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 9,
  },
  driverSearchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 9,
    paddingHorizontal: 12,
    color: "#111111",
    fontSize: 13,
    marginBottom: 10,
    outlineStyle: "none",
  } as any,
  driverList: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 100,
  },
  driverListContent: { paddingBottom: 5 },
  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  driverOptionSelected: {
    borderColor: "#111111",
    backgroundColor: "#F7F8FA",
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  driverAvatarSelected: { backgroundColor: "#111111" },
  driverAvatarText: {
    color: "#333333",
    fontSize: 15,
    fontWeight: "700",
  },
  driverAvatarTextSelected: { color: "#FFFFFF" },
  driverInfo: { flex: 1 },
  driverName: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "600",
  },
  driverMeta: {
    color: "#777777",
    fontSize: 11,
    marginTop: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#BBBBBB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  radioOuterSelected: { borderColor: "#111111" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111111",
  },
  noDriversContainer: {
    alignItems: "center",
    paddingVertical: 25,
    paddingHorizontal: 10,
  },
  noDriversTitle: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  noDriversDescription: {
    color: "#777777",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
  },
  cancelButtonText: {
    color: "#333333",
    fontSize: 13,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1.5,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  confirmButtonDisabled: { opacity: 0.45 },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});