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
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { getUser } from "../utils/storage";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "../services/api";

type FuelLog = {
  id: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string | null;
  recorded_by: string;
  fuel_date: string;
  fuel_cost: number;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  registration_number: string;
  make?: string;
  model?: string;
};

type Assignment = {
  id: string;
  company_id: string;
  branch_id: string;
  driver_id: string;
  vehicle_id: string;
  is_active: boolean;
};

type Driver = {
  id: string;
  first_name: string;
  last_name: string | null;
  status: string;
  is_active: boolean;
};

type ExpenseMode =
  | "daily"
  | "monthly"
  | "custom";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function endOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function formatMonthYear(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDisplayDate(value: string) {
  if (!value) {
    return "";
  }

  const date = parseDateKey(value);

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export default function FuelScreen() {
  const { add } = useLocalSearchParams();

  const [fuelLogs, setFuelLogs] =
    useState<FuelLog[]>([]);
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);
  const [drivers, setDrivers] =
    useState<Driver[]>([]);
  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [showAddForm, setShowAddForm] =
    useState(add === "true");

  const [
    selectedVehicleId,
    setSelectedVehicleId,
  ] = useState<string | null>(null);

  const [
    selectedDriverId,
    setSelectedDriverId,
  ] = useState<string | null>(null);

  const [fuelDate, setFuelDate] =
    useState(
      new Date()
        .toISOString()
        .split("T")[0]
    );

  const [fuelCost, setFuelCost] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [
    editingFuelId,
    setEditingFuelId,
  ] = useState<string | null>(null);

  const [editFuelDate, setEditFuelDate] =
    useState("");

  const [editFuelCost, setEditFuelCost] =
    useState("");

  const [updating, setUpdating] =
    useState(false);

  const [
    deletingFuelId,
    setDeletingFuelId,
  ] = useState<string | null>(null);

  const [
    fuelToDelete,
    setFuelToDelete,
  ] = useState<FuelLog | null>(null);

  // =========================================================
  // EXPENSE FILTER STATE
  // =========================================================

  const [
    expenseMode,
    setExpenseMode,
  ] = useState<ExpenseMode>("monthly");

  const [
    selectedMonthlyDate,
    setSelectedMonthlyDate,
  ] = useState<Date>(
    startOfMonth(new Date())
  );

  const [
    selectedDailyDate,
    setSelectedDailyDate,
  ] = useState<string>(
    formatDateKey(new Date())
  );

  const [
    customStartDate,
    setCustomStartDate,
  ] = useState<string | null>(null);

  const [
    customEndDate,
    setCustomEndDate,
  ] = useState<string | null>(null);

  const [
    calendarVisible,
    setCalendarVisible,
  ] = useState(false);

  const [
    calendarDate,
    setCalendarDate,
  ] = useState(new Date());

  const [
    calendarYearPicker,
    setCalendarYearPicker,
  ] = useState(false);

  const [
    monthPickerVisible,
    setMonthPickerVisible,
  ] = useState(false);

  // =========================================================
  // LOAD LOGGED-IN USER
  // =========================================================

  
  useEffect(() => {
    let mounted = true;

    const loadStoredUser = async () => {
      try {
        const user = await getUser();

        if (!mounted) return;

        if (!user) {
          console.log("No logged-in user found.");
          setLoading(false);

          Alert.alert(
            "Sign in required",
            "Please sign in again to view fuel records."
          );

          return;
        }

        console.log("Fuel screen user:", user);

        setCompanyId(user.company_id || null);
      } catch (error) {
        console.error(
          "Could not read logged-in user:",
          error
        );

        if (mounted) {
          setLoading(false);

          Alert.alert(
            "Error",
            "Could not read the logged-in user."
          );
        }
      }
    };

    void loadStoredUser();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================
  // LOAD FUEL LOGS
  // =========================================================

  const loadFuelLogs = async () => {
    try {
      if (!companyId) {
        return;
      }

      setLoading(true);

      const data = await apiGet(
        `/fuel-logs/${companyId}/all`
      );

      console.log(
        "Fuel logs API response:",
        data
      );

      if (Array.isArray(data)) {
        setFuelLogs(data);
      } else if (
        Array.isArray(data?.data)
      ) {
        setFuelLogs(data.data);
      } else if (
        Array.isArray(data?.fuel_logs)
      ) {
        setFuelLogs(data.fuel_logs);
      } else {
        setFuelLogs([]);
      }
    } catch (error) {
      console.error(
        "Fuel loading error:",
        error
      );

      if (
        error instanceof Error &&
        error.message.includes("404")
      ) {
        setFuelLogs([]);
        return;
      }

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not load fuel data from the server."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD VEHICLES
  // =========================================================

  const loadVehicles = async () => {
    try {
      if (!companyId) {
        return;
      }

      const data = await apiGet(
        `/vehicles/${companyId}/all`
      );

      console.log(
        "Vehicles response:",
        data
      );

      if (Array.isArray(data)) {
        setVehicles(data);
      } else if (
        Array.isArray(data?.data)
      ) {
        setVehicles(data.data);
      } else if (
        Array.isArray(data?.vehicles)
      ) {
        setVehicles(data.vehicles);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error(
        "Vehicle loading error:",
        error
      );

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not load vehicles."
      );
    }
  };

  // =========================================================
  // LOAD DRIVERS
  // =========================================================

  const loadDrivers = async () => {
    try {
      if (!companyId) {
        return;
      }

      const data = await apiGet(
        `/drivers/${companyId}`
      );

      console.log(
        "Drivers response:",
        data
      );

      if (Array.isArray(data)) {
        setDrivers(data);
      } else if (
        Array.isArray(data?.data)
      ) {
        setDrivers(data.data);
      } else if (
        Array.isArray(data?.drivers)
      ) {
        setDrivers(data.drivers);
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.error(
        "Driver loading error:",
        error
      );

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not load drivers."
      );
    }
  };

  // =========================================================
  // LOAD ACTIVE VEHICLE ASSIGNMENTS
  // =========================================================

  const loadAssignments = async () => {
    try {
      if (!companyId) {
        return;
      }

      const data = await apiGet(
        `/driver-vehicle-assignments/${companyId}`
      );

      setAssignments(
        Array.isArray(data)
          ? data
          : Array.isArray(
              data?.assignments
            )
          ? data.assignments
          : Array.isArray(data?.data)
          ? data.data
          : []
      );
    } catch (error) {
      console.error(
        "Assignment loading error:",
        error
      );

      if (
        error instanceof Error &&
        error.message.includes("404")
      ) {
        setAssignments([]);
        return;
      }

      setAssignments([]);
    }
  };

  const getAssignedDriverId = (
    vehicleId: string
  ) => {
    return (
      assignments.find(
        (assignment) =>
          assignment.vehicle_id ===
            vehicleId &&
          assignment.is_active
      )?.driver_id || null
    );
  };

  // =========================================================
  // LOAD ALL DATA
  // =========================================================

  useEffect(() => {
    if (!companyId) {
      return;
    }

    loadFuelLogs();
    loadVehicles();
    loadDrivers();
    loadAssignments();
  }, [companyId]);

  // =========================================================
  // REFRESH
  // =========================================================

  const refreshFuelLogs =
    useCallback(async () => {
      setRefreshing(true);

      await loadFuelLogs();

      setRefreshing(false);
    }, [companyId]);

  // =========================================================
  // EXPENSE CALCULATION
  // =========================================================

  const getExpenseForRange = (
    startDate: string,
    endDate: string
  ) => {
    return fuelLogs.reduce(
      (total, fuel) => {
        if (!fuel.is_active) {
          return total;
        }

        const fuelDate =
          fuel.fuel_date.substring(
            0,
            10
          );

        if (
          fuelDate >= startDate &&
          fuelDate <= endDate
        ) {
          return (
            total +
            Number(
              fuel.fuel_cost || 0
            )
          );
        }

        return total;
      },
      0
    );
  };

  const getCurrentExpenseTotal =
    () => {
      if (expenseMode === "daily") {
        return getExpenseForRange(
          selectedDailyDate,
          selectedDailyDate
        );
      }

      if (
        expenseMode === "monthly"
      ) {
        const start = formatDateKey(
          startOfMonth(
            selectedMonthlyDate
          )
        );

        const end = formatDateKey(
          endOfMonth(
            selectedMonthlyDate
          )
        );

        return getExpenseForRange(
          start,
          end
        );
      }

      if (
        expenseMode === "custom" &&
        customStartDate &&
        customEndDate
      ) {
        return getExpenseForRange(
          customStartDate,
          customEndDate
        );
      }

      return 0;
    };

  const getExpensePeriodLabel =
    () => {
      if (expenseMode === "daily") {
        return formatDisplayDate(
          selectedDailyDate
        );
      }

      if (
        expenseMode === "monthly"
      ) {
        return formatMonthYear(
          selectedMonthlyDate
        );
      }

      if (
        expenseMode === "custom" &&
        customStartDate &&
        customEndDate
      ) {
        return `${formatDisplayDate(
          customStartDate
        )} – ${formatDisplayDate(
          customEndDate
        )}`;
      }

      if (
        expenseMode === "custom" &&
        customStartDate
      ) {
        return `${formatDisplayDate(
          customStartDate
        )} – Select end date`;
      }

      return "Select a date range";
    };

  const formattedExpenseTotal =
    getCurrentExpenseTotal().toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    );

  // =========================================================
  // EXPENSE CALENDAR HELPERS
  // =========================================================

  const getCalendarDays = () => {
    const year =
      calendarDate.getFullYear();

    const month =
      calendarDate.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    ).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const days: (
      number | null
    )[] = [];

    for (
      let index = 0;
      index < firstDay;
      index += 1
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      days.push(day);
    }

    return days;
  };

  const openDailyCalendar = () => {
    setExpenseMode("daily");

    setCalendarDate(
      parseDateKey(
        selectedDailyDate
      )
    );

    setCalendarYearPicker(false);
    setMonthPickerVisible(false);
    setCalendarVisible(true);
  };

  const openCustomCalendar = () => {
    setExpenseMode("custom");

    if (customStartDate) {
      setCalendarDate(
        parseDateKey(
          customStartDate
        )
      );
    } else {
      setCalendarDate(new Date());
    }

    setCalendarYearPicker(false);
    setMonthPickerVisible(false);
    setCalendarVisible(true);
  };

  const openMonthlyPicker = () => {
    setExpenseMode("monthly");

    setCalendarDate(
      startOfMonth(
        selectedMonthlyDate
      )
    );

    setCalendarYearPicker(false);
    setCalendarVisible(false);
    setMonthPickerVisible(true);
  };

  const closeCalendar = () => {
    setCalendarYearPicker(false);
    setCalendarVisible(false);
    setMonthPickerVisible(false);
  };

  const moveCalendarMonth = (
    direction: number
  ) => {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() +
            direction,
          1
        )
    );
  };

  const moveMonthPickerYear = (
    direction: number
  ) => {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear() +
            direction,
          previous.getMonth(),
          1
        )
    );
  };

  const getCalendarIsToday = (
    dateKey: string
  ) => {
    return (
      dateKey ===
      formatDateKey(
        new Date()
      )
    );
  };

  const isSelectedCalendarDay = (
    dateKey: string
  ) => {
    if (
      expenseMode === "daily"
    ) {
      return (
        dateKey ===
        selectedDailyDate
      );
    }

    if (
      expenseMode === "custom"
    ) {
      return (
        dateKey ===
          customStartDate ||
        dateKey === customEndDate
      );
    }

    return false;
  };

  const isInsideCustomRange = (
    dateKey: string
  ) => {
    if (
      expenseMode !== "custom" ||
      !customStartDate ||
      !customEndDate
    ) {
      return false;
    }

    return (
      dateKey > customStartDate &&
      dateKey < customEndDate
    );
  };

  const selectExpenseYear = (
    year: number
  ) => {
    setCalendarDate(
      new Date(
        year,
        calendarDate.getMonth(),
        1
      )
    );

    setCalendarYearPicker(false);
  };

  const selectExpenseMonth = (
    monthIndex: number
  ) => {
    const selectedMonth =
      new Date(
        calendarDate.getFullYear(),
        monthIndex,
        1
      );

    setSelectedMonthlyDate(
      selectedMonth
    );

    setExpenseMode("monthly");
    setMonthPickerVisible(false);
  };

  const selectExpenseCalendarDate =
    (day: number) => {
      const year =
        calendarDate.getFullYear();

      const month =
        calendarDate.getMonth();

      const selectedDate =
        new Date(
          year,
          month,
          day
        );

      const dateKey =
        formatDateKey(
          selectedDate
        );

      if (
        expenseMode === "daily"
      ) {
        setSelectedDailyDate(
          dateKey
        );

        closeCalendar();
        return;
      }

      if (
        expenseMode === "custom"
      ) {
        if (
          !customStartDate ||
          customEndDate
        ) {
          setCustomStartDate(
            dateKey
          );
          setCustomEndDate(null);
          return;
        }

        if (
          customStartDate &&
          !customEndDate
        ) {
          if (
            dateKey < customStartDate
          ) {
            setCustomStartDate(
              dateKey
            );

            setCustomEndDate(
              customStartDate
            );
          } else {
            setCustomEndDate(
              dateKey
            );
          }
        }
      }
    };

  const applyCustomRange = () => {
    if (
      !customStartDate ||
      !customEndDate
    ) {
      return;
    }

    closeCalendar();
  };

  const clearCustomRange =
    () => {
      setCustomStartDate(null);
      setCustomEndDate(null);
    };

  const goToToday = () => {
    const today = new Date();

    setCalendarDate(today);

    if (
      expenseMode === "daily"
    ) {
      setSelectedDailyDate(
        formatDateKey(today)
      );
    }
  };

  const getSelectedMonthText = () => {
    return `${MONTH_NAMES[
      calendarDate.getMonth()
    ]}`;
  };

  // =========================================================
  // ADD FUEL LOG
  // =========================================================

  const addFuelLog = async () => {
    try {
      if (!companyId) {
        Alert.alert(
          "Error",
          "Company information is missing."
        );
        return;
      }

      if (!selectedVehicleId) {
        Alert.alert(
          "Vehicle required",
          "Please select a vehicle."
        );
        return;
      }

      if (!fuelDate) {
        Alert.alert(
          "Date required",
          "Please enter the fuel date."
        );
        return;
      }

      if (!selectedDriverId) {
        Alert.alert(
          "Driver required",
          "The selected vehicle has no active driver assignment."
        );
        return;
      }

      if (
        !fuelCost ||
        Number(fuelCost) <= 0
      ) {
        Alert.alert(
          "Invalid fuel cost",
          "Fuel cost must be greater than zero."
        );
        return;
      }

      setSaving(true);

      const payload = {
        vehicle_id:
          selectedVehicleId,
        driver_id:
          selectedDriverId,
        fuel_date: fuelDate,
        fuel_cost:
          Number(fuelCost),
      };

      console.log(
        "Creating fuel log:",
        payload
      );

      await apiPost(
        `/fuel-logs/${companyId}`,
        payload
      );

      Alert.alert(
        "Success",
        "Fuel log added successfully."
      );

      setSelectedVehicleId(null);
      setSelectedDriverId(null);

      setFuelDate(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      setFuelCost("");
      setShowAddForm(false);

      await loadFuelLogs();
    } catch (error) {
      console.error(
        "Add fuel error:",
        error
      );

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not add fuel log."
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // UPDATE FUEL LOG
  // =========================================================

  const updateFuelLog = async () => {
    try {
      if (
        !companyId ||
        !editingFuelId
      ) {
        Alert.alert(
          "Error",
          "Fuel information is missing."
        );
        return;
      }

      if (!editFuelDate) {
        Alert.alert(
          "Date required",
          "Please enter the fuel date."
        );
        return;
      }

      if (
        !editFuelCost ||
        Number(editFuelCost) <= 0
      ) {
        Alert.alert(
          "Invalid fuel cost",
          "Fuel cost must be greater than zero."
        );
        return;
      }

      setUpdating(true);

      const payload = {
        fuel_date: editFuelDate,
        fuel_cost:
          Number(editFuelCost),
      };

      await apiPut(
        `/fuel-logs/${companyId}/${editingFuelId}`,
        payload
      );

      Alert.alert(
        "Success",
        "Fuel log updated successfully."
      );

      setEditingFuelId(null);
      setEditFuelDate("");
      setEditFuelCost("");

      await loadFuelLogs();
    } catch (error) {
      console.error(
        "Update fuel error:",
        error
      );

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not update fuel log."
      );
    } finally {
      setUpdating(false);
    }
  };

  // =========================================================
  // DELETE FUEL LOG
  // =========================================================

  const confirmDeleteFuelLog = (
    fuel: FuelLog
  ) => {
    setFuelToDelete(fuel);
  };

  const deleteFuelLog = async (
    fuelId: string
  ) => {
    try {
      if (!companyId) {
        Alert.alert(
          "Error",
          "Company information is missing."
        );
        return;
      }

      setDeletingFuelId(
        fuelId
      );

      await apiDelete(
        `/fuel-logs/${companyId}/${fuelId}`
      );

      if (
        editingFuelId === fuelId
      ) {
        setEditingFuelId(null);
        setEditFuelDate("");
        setEditFuelCost("");
      }

      setFuelToDelete(null);

      Alert.alert(
        "Success",
        "Fuel log deleted successfully."
      );

      await loadFuelLogs();
    } catch (error) {
      console.error(
        "Delete fuel error:",
        error
      );

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Could not delete fuel log."
      );
    } finally {
      setDeletingFuelId(null);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <View
        style={styles.center}
      >
        <ActivityIndicator
  size="large"
  color="#111111"
/>

        <Text
          style={
            styles.loadingText
          }
        >
          Loading fuel data...
        </Text>
      </View>
    );
  }

  const calendarDays =
    getCalendarDays();

  // =========================================================
  // SCREEN
  // =========================================================

  return (
    <View
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.contentContainer
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              refreshFuelLogs
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <View
          style={
            styles.pageHeader
          }
        >
          <View>
            <Text
              style={
                styles.pageTitle
              }
            >
              Fuel
            </Text>

            <Text
              style={
                styles.pageSubtitle
              }
            >
              Fuel logs and fuel expenses
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.addButton
            }
            onPress={() =>
              setShowAddForm(
                !showAddForm
              )
            }
          >
            <Text
              style={
                styles.addButtonText
              }
            >
              {showAddForm
                ? "Close"
                : "+ Add Fuel"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* =====================================================
            ADD FUEL FORM
        ===================================================== */}

        {showAddForm && (
          <View
            style={
              styles.formCard
            }
          >
            <Text
              style={
                styles.formTitle
              }
            >
              Add Fuel Log
            </Text>

            <Text
              style={styles.label}
            >
              Vehicle
            </Text>

            {vehicles.length ===
            0 ? (
              <Text
                style={
                  styles.noDataText
                }
              >
                No vehicles available.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                style={
                  styles.horizontalList
                }
              >
                {vehicles.map(
                  (vehicle) => (
                    <TouchableOpacity
                      key={
                        vehicle.id
                      }
                      style={[
                        styles.optionButton,
                        selectedVehicleId ===
                          vehicle.id &&
                          styles.selectedOption,
                      ]}
                      onPress={() => {
                        setSelectedVehicleId(
                          vehicle.id
                        );

                        setSelectedDriverId(
                          getAssignedDriverId(
                            vehicle.id
                          )
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedVehicleId ===
                            vehicle.id &&
                            styles.selectedOptionText,
                        ]}
                      >
                        {
                          vehicle.registration_number
                        }
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            )}

            <Text
              style={styles.label}
            >
              Assigned Driver
            </Text>

            <View
              style={
                styles.selectedDriverBox
              }
            >
              {selectedVehicleId &&
              getAssignedDriverId(
                selectedVehicleId
              ) ? (
                <Text
                  style={
                    styles.selectedDriverText
                  }
                >
                  {(() => {
                    const assignedDriver =
                      drivers.find(
                        (
                          driver
                        ) =>
                          driver.id ===
                          getAssignedDriverId(
                            selectedVehicleId
                          )
                      );

                    return assignedDriver
                      ? `${assignedDriver.first_name} ${
                          assignedDriver.last_name ||
                          ""
                        }`.trim()
                      : "Assigned driver";
                  })()}
                </Text>
              ) : (
                <Text
                  style={
                    styles.noAssignedDriverText
                  }
                >
                  No driver assigned to
                  this vehicle.
                </Text>
              )}
            </View>

            <Text
              style={styles.label}
            >
              Fuel Date
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={fuelDate}
              onChangeText={
                setFuelDate
              }
              placeholder="YYYY-MM-DD"
            />

            <Text
              style={styles.label}
            >
              Fuel Cost
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={fuelCost}
              onChangeText={
                setFuelCost
              }
              placeholder="Enter fuel cost"
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={
                styles.saveButton
              }
              onPress={
                addFuelLog
              }
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  Add Fuel Log
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* =====================================================
            EXPENSE SUMMARY
        ===================================================== */}

        <View
          style={
            styles.expenseCard
          }
        >
          <View
            style={
              styles.expenseHeaderRow
            }
          >
            <View>
              <Text
                style={
                  styles.expenseTitle
                }
              >
                Fuel Expense
              </Text>

              <Text
                style={
                  styles.expensePeriodLabel
                }
              >
                {getExpensePeriodLabel()}
              </Text>
            </View>

            <View
              style={
                styles.expenseAmountBlock
              }
            >
              <Text
                style={
                  styles.expenseAmountLabel
                }
              >
                Total
              </Text>

              <Text
                style={
                  styles.expenseAmount
                }
              >
                ₹
                {
                  formattedExpenseTotal
                }
              </Text>
            </View>
          </View>

          <View
            style={
              styles.expenseModeRow
            }
          >
            <TouchableOpacity
              style={[
                styles.expenseModeButton,
                expenseMode ===
                  "daily" &&
                  styles.expenseModeButtonActive,
              ]}
              onPress={
                openDailyCalendar
              }
            >
              <Text
                style={[
                  styles.expenseModeText,
                  expenseMode ===
                    "daily" &&
                    styles.expenseModeTextActive,
                ]}
              >
                Daily
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.expenseModeButton,
                expenseMode ===
                  "monthly" &&
                  styles.expenseModeButtonActive,
              ]}
              onPress={
                openMonthlyPicker
              }
            >
              <Text
                style={[
                  styles.expenseModeText,
                  expenseMode ===
                    "monthly" &&
                    styles.expenseModeTextActive,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.expenseModeButton,
                expenseMode ===
                  "custom" &&
                  styles.expenseModeButtonActive,
              ]}
              onPress={
                openCustomCalendar
              }
            >
              <Text
                style={[
                  styles.expenseModeText,
                  expenseMode ===
                    "custom" &&
                    styles.expenseModeTextActive,
                ]}
              >
                Custom Range
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={
              styles.periodButton
            }
            onPress={() => {
              if (
                expenseMode ===
                "monthly"
              ) {
                openMonthlyPicker();
              } else if (
                expenseMode ===
                "daily"
              ) {
                openDailyCalendar();
              } else {
                openCustomCalendar();
              }
            }}
          >
            <Text
              style={
                styles.periodButtonIcon
              }
            >
              ▣
            </Text>

            <View
              style={
                styles.periodButtonContent
              }
            >
              <Text
                style={
                  styles.periodButtonLabel
                }
              >
                {expenseMode ===
                "daily"
                  ? "Selected Date"
                  : expenseMode ===
                    "monthly"
                  ? "Selected Month"
                  : "Selected Range"}
              </Text>

              <Text
                style={
                  styles.periodButtonValue
                }
              >
                {getExpensePeriodLabel()}
              </Text>
            </View>

            <Text
              style={
                styles.periodButtonArrow
              }
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* =====================================================
            ACTIVE FUEL ENTRIES
        ===================================================== */}

        <View
          style={styles.list}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Active Fuel Entries
          </Text>

          {fuelLogs.length ===
          0 ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No fuel records
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                No fuel logs have
                been recorded yet.
              </Text>
            </View>
          ) : (
            fuelLogs.map(
              (fuel) => {
                const vehicle =
                  vehicles.find(
                    (item) =>
                      item.id ===
                      fuel.vehicle_id
                  );

                const driver =
                  drivers.find(
                    (item) =>
                      item.id ===
                      fuel.driver_id
                  );

                const driverName =
                  driver
                    ? `${driver.first_name} ${
                        driver.last_name ||
                        ""
                      }`.trim()
                    : null;

                return (
                  <View
                    key={
                      fuel.id
                    }
                    style={
                      styles.fuelCard
                    }
                  >
                    <View
                      style={
                        styles.cardTopRow
                      }
                    >
                      <Text
                        style={
                          styles.date
                        }
                      >
                        {
                          fuel.fuel_date
                        }
                      </Text>

                      <Text
                        style={
                          styles.cost
                        }
                      >
                        ₹
                        {Number(
                          fuel.fuel_cost
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.detail
                      }
                    >
                      Vehicle:{" "}
                      {vehicle?.registration_number ||
                        "Unknown vehicle"}
                    </Text>

                    {driverName && (
                      <Text
                        style={
                          styles.detail
                        }
                      >
                        Driver:{" "}
                        {
                          driverName
                        }
                      </Text>
                    )}

                    {editingFuelId ===
                    fuel.id ? (
                      <View
                        style={
                          styles.editBox
                        }
                      >
                        <Text
                          style={
                            styles.label
                          }
                        >
                          Fuel Date
                        </Text>

                        <TextInput
                          style={
                            styles.input
                          }
                          value={
                            editFuelDate
                          }
                          onChangeText={
                            setEditFuelDate
                          }
                          placeholder="YYYY-MM-DD"
                        />

                        <Text
                          style={
                            styles.label
                          }
                        >
                          Fuel Cost
                        </Text>

                        <TextInput
                          style={
                            styles.input
                          }
                          value={
                            editFuelCost
                          }
                          onChangeText={
                            setEditFuelCost
                          }
                          placeholder="Enter fuel cost"
                          keyboardType="numeric"
                        />

                        <View
                          style={
                            styles.editActions
                          }
                        >
                          <TouchableOpacity
                            style={
                              styles.updateButton
                            }
                            onPress={
                              updateFuelLog
                            }
                            disabled={
                              updating
                            }
                          >
                            {updating ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text
                                style={
                                  styles.updateButtonText
                                }
                              >
                                Save Changes
                              </Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={
                              styles.cancelButton
                            }
                            onPress={() => {
                              setEditingFuelId(
                                null
                              );

                              setEditFuelDate(
                                ""
                              );

                              setEditFuelCost(
                                ""
                              );
                            }}
                          >
                            <Text
                              style={
                                styles.cancelButtonText
                              }
                            >
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={
                          styles.recordActions
                        }
                      >
                        <TouchableOpacity
                          style={
                            styles.editButton
                          }
                          onPress={() => {
                            setEditingFuelId(
                              fuel.id
                            );

                            setEditFuelDate(
                              fuel.fuel_date
                            );

                            setEditFuelCost(
                              String(
                                fuel.fuel_cost
                              )
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.editButtonText
                            }
                          >
                            Edit
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.deleteButton
                          }
                          onPress={() =>
                            confirmDeleteFuelLog(
                              fuel
                            )
                          }
                          disabled={
                            deletingFuelId ===
                            fuel.id
                          }
                        >
                          {deletingFuelId ===
                          fuel.id ? (
                            <ActivityIndicator color="#111111" />
                          ) : (
                            <Text
                              style={
                                styles.deleteButtonText
                              }
                            >
                              Delete
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }
            )
          )}
        </View>
      </ScrollView>

      {/* =====================================================
          DAILY / CUSTOM CALENDAR
      ===================================================== */}

      <Modal
        visible={
          calendarVisible
        }
        animationType="fade"
        transparent
        onRequestClose={
          closeCalendar
        }
      >
        <View
          style={
            styles.centerModalOverlay
          }
        >
          <View
            style={
              styles.calendarModal
            }
          >
            {calendarYearPicker ? (
              <>
                <View
                  style={
                    styles.calendarPickerHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.calendarPickerTitle
                      }
                    >
                      Select Year
                    </Text>

                    <Text
                      style={
                        styles.calendarPickerSubtitle
                      }
                    >
                      Choose the expense year
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.closeButton
                    }
                    onPress={
                      closeCalendar
                    }
                  >
                    <Text
                      style={
                        styles.closeButtonText
                      }
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={
                    styles.calendarYearList
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  <View
                    style={
                      styles.calendarYearGrid
                    }
                  >
                    {Array.from(
                      {
                        length: 41,
                      },
                      (_, index) =>
                        new Date().getFullYear() +
                        10 -
                        index
                    ).map(
                      (year) => {
                        const selected =
                          calendarDate.getFullYear() ===
                          year;

                        return (
                          <TouchableOpacity
                            key={
                              year
                            }
                            style={[
                              styles.calendarYearOption,
                              selected &&
                                styles.calendarYearOptionSelected,
                            ]}
                            onPress={() =>
                              selectExpenseYear(
                                year
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.calendarYearOptionText,
                                selected &&
                                  styles.calendarYearOptionTextSelected,
                              ]}
                            >
                              {
                                year
                              }
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={
                    styles.calendarCancelButton
                  }
                  onPress={
                    closeCalendar
                  }
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View
                  style={
                    styles.calendarHeader
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.monthArrow
                    }
                    onPress={() =>
                      moveCalendarMonth(
                        -1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.monthArrowText
                      }
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.calendarTitleContainer
                    }
                    onPress={() =>
                      setCalendarYearPicker(
                        true
                      )
                    }
                  >
                    <Text
                      style={
                        styles.calendarMonth
                      }
                    >
                      {
                        MONTH_NAMES[
                          calendarDate.getMonth()
                        ]
                      }
                    </Text>

                    <View
                      style={
                        styles.calendarYearSelector
                      }
                    >
                      <Text
                        style={
                          styles.calendarYear
                        }
                      >
                        {calendarDate.getFullYear()}
                      </Text>

                      <Text
                        style={
                          styles.calendarYearArrow
                        }
                      >
                        ▾
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.monthArrow
                    }
                    onPress={() =>
                      moveCalendarMonth(
                        1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.monthArrowText
                      }
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text
                  style={
                    styles.calendarYearHint
                  }
                >
                  {expenseMode ===
                  "daily"
                    ? "Select one date."
                    : "Select the start and end dates."}
                </Text>

                <TouchableOpacity
                  style={
                    styles.todayButton
                  }
                  onPress={
                    goToToday
                  }
                >
                  <Text
                    style={
                      styles.todayButtonText
                    }
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <View
                  style={
                    styles.weekRow
                  }
                >
                  {WEEK_DAYS.map(
                    (day) => (
                      <Text
                        key={
                          day
                        }
                        style={
                          styles.weekDay
                        }
                      >
                        {day}
                      </Text>
                    )
                  )}
                </View>

                <View
                  style={
                    styles.calendarGrid
                  }
                >
                  {calendarDays.map(
                    (
                      day,
                      index
                    ) =>
                      day === null ? (
                        <View
                          key={`empty-${index}`}
                          style={
                            styles.calendarDay
                          }
                        />
                      ) : (
                        (() => {
                          const date =
                            new Date(
                              calendarDate.getFullYear(),
                              calendarDate.getMonth(),
                              day
                            );

                          const dateKey =
                            formatDateKey(
                              date
                            );

                          const selected =
                            isSelectedCalendarDay(
                              dateKey
                            );

                          const today =
                            getCalendarIsToday(
                              dateKey
                            );

                          const inRange =
                            isInsideCustomRange(
                              dateKey
                            );

                          return (
                            <TouchableOpacity
                              key={
                                dateKey
                              }
                              style={[
                                styles.calendarDay,
                                inRange &&
                                  styles.calendarDayInRange,
                              ]}
                              onPress={() =>
                                selectExpenseCalendarDate(
                                  day
                                )
                              }
                            >
                              <View
                                style={[
                                  styles.calendarDayInner,
                                  today &&
                                    styles.todayDay,
                                  selected &&
                                    styles.selectedDay,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.calendarDayText,
                                    today &&
                                      styles.todayText,
                                    selected &&
                                      styles.selectedDayText,
                                  ]}
                                >
                                  {
                                    day
                                  }
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })()
                      )
                  )}
                </View>

                <View
                  style={
                    styles.calendarSelectionInfo
                  }
                >
                  <Text
                    style={
                      styles.calendarSelectionLabel
                    }
                  >
                    {expenseMode ===
                    "daily"
                      ? "Selected"
                      : "Selected Range"}
                  </Text>

                  <Text
                    style={
                      styles.calendarSelectionValue
                    }
                  >
                    {getExpensePeriodLabel()}
                  </Text>
                </View>

                {expenseMode === "custom" ? (
  <>
    <TouchableOpacity
      style={styles.clearRangeButton}
      onPress={clearCustomRange}
    >
      <Text style={styles.clearRangeText}>
        Clear Range
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.calendarApplyButton,
        (!customStartDate || !customEndDate) &&
          styles.calendarApplyButtonDisabled,
      ]}
      disabled={!customStartDate || !customEndDate}
      onPress={applyCustomRange}
    >
      <Text style={styles.calendarApplyText}>
        Apply Range
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.calendarCancelButton}
      onPress={closeCalendar}
    >
      <Text style={styles.cancelButtonText}>
        Cancel
      </Text>
    </TouchableOpacity>
  </>
) : (
                  <TouchableOpacity
                    style={
                      styles.calendarDoneButton
                    }
                    onPress={
                      closeCalendar
                    }
                  >
                    <Text
                      style={
                        styles.calendarDoneText
                      }
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          MONTH PICKER
      ===================================================== */}

      <Modal
        visible={
          monthPickerVisible
        }
        animationType="fade"
        transparent
        onRequestClose={
          closeCalendar
        }
      >
        <View
          style={
            styles.centerModalOverlay
          }
        >
          <View
            style={
              styles.calendarModal
            }
          >
            {calendarYearPicker ? (
              <>
                <View
                  style={
                    styles.calendarPickerHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.calendarPickerTitle
                      }
                    >
                      Select Year
                    </Text>

                    <Text
                      style={
                        styles.calendarPickerSubtitle
                      }
                    >
                      Choose the expense year
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.closeButton
                    }
                    onPress={() => {
                      setCalendarYearPicker(
                        false
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.closeButtonText
                      }
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={
                    styles.calendarYearList
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  <View
                    style={
                      styles.calendarYearGrid
                    }
                  >
                    {Array.from(
                      {
                        length: 41,
                      },
                      (_, index) =>
                        new Date().getFullYear() +
                        10 -
                        index
                    ).map(
                      (year) => {
                        const selected =
                          calendarDate.getFullYear() ===
                          year;

                        return (
                          <TouchableOpacity
                            key={
                              year
                            }
                            style={[
                              styles.calendarYearOption,
                              selected &&
                                styles.calendarYearOptionSelected,
                            ]}
                            onPress={() => {
                              setCalendarDate(
                                new Date(
                                  year,
                                  calendarDate.getMonth(),
                                  1
                                )
                              );

                              setCalendarYearPicker(
                                false
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.calendarYearOptionText,
                                selected &&
                                  styles.calendarYearOptionTextSelected,
                              ]}
                            >
                              {
                                year
                              }
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={
                    styles.calendarCancelButton
                  }
                  onPress={() =>
                    setCalendarYearPicker(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View
                  style={
                    styles.calendarHeader
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.monthArrow
                    }
                    onPress={() =>
                      moveMonthPickerYear(
                        -1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.monthArrowText
                      }
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.calendarTitleContainer
                    }
                    onPress={() =>
                      setCalendarYearPicker(
                        true
                      )
                    }
                  >
                    <Text
                      style={
                        styles.calendarMonth
                      }
                    >
                      Select Month
                    </Text>

                    <View
                      style={
                        styles.calendarYearSelector
                      }
                    >
                      <Text
                        style={
                          styles.calendarYear
                        }
                      >
                        {
                          calendarDate.getFullYear()
                        }
                      </Text>

                      <Text
                        style={
                          styles.calendarYearArrow
                        }
                      >
                        ▾
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.monthArrow
                    }
                    onPress={() =>
                      moveMonthPickerYear(
                        1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.monthArrowText
                      }
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text
                  style={
                    styles.calendarYearHint
                  }
                >
                  Select a month to view its
                  total fuel expense.
                </Text>

                <View
                  style={
                    styles.monthGrid
                  }
                >
                  {MONTH_NAMES.map(
                    (
                      month,
                      index
                    ) => {
                      const selected =
                        selectedMonthlyDate.getFullYear() ===
                          calendarDate.getFullYear() &&
                        selectedMonthlyDate.getMonth() ===
                          index;

                      return (
                        <TouchableOpacity
                          key={
                            month
                          }
                          style={[
                            styles.monthOption,
                            selected &&
                              styles.monthOptionSelected,
                          ]}
                          onPress={() =>
                            selectExpenseMonth(
                              index
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.monthOptionText,
                              selected &&
                                styles.monthOptionTextSelected,
                            ]}
                          >
                            {
                              month
                            }
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                <TouchableOpacity
                  style={
                    styles.calendarCancelButton
                  }
                  onPress={
                    closeCalendar
                  }
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          DELETE MODAL
      ===================================================== */}

      <Modal
        visible={
          fuelToDelete !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingFuelId) {
            setFuelToDelete(
              null
            );
          }
        }}
      >
        <View
          style={
            styles.deleteModalOverlay
          }
        >
          <View
            style={
              styles.deleteModalCard
            }
          >
            <Text
              style={
                styles.deleteModalTitle
              }
            >
              Delete fuel log?
            </Text>

            <Text
              style={
                styles.deleteModalText
              }
            >
              {fuelToDelete
                ? `Remove the ₹${Number(
                    fuelToDelete.fuel_cost
                  ).toLocaleString(
                    "en-IN"
                  )} fuel record from ${fuelToDelete.fuel_date}?`
                : ""}
            </Text>

            <Text
              style={
                styles.deleteModalHint
              }
            >
              This record will no longer
              appear in active fuel logs.
            </Text>

            <View
              style={
                styles.deleteModalActions
              }
            >
              <TouchableOpacity
                style={
                  styles.deleteModalCancelButton
                }
                onPress={() =>
                  setFuelToDelete(
                    null
                  )
                }
                disabled={
                  deletingFuelId !==
                  null
                }
              >
                <Text
                  style={
                    styles.deleteModalCancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.deleteModalConfirmButton
                }
                onPress={() => {
                  if (
                    fuelToDelete
                  ) {
                    void deleteFuelLog(
                      fuelToDelete.id
                    );
                  }
                }}
                disabled={
                  deletingFuelId !==
                  null
                }
              >
                {deletingFuelId ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={
                      styles.deleteModalConfirmText
                    }
                  >
                    Delete
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

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 10,
    color: "#666666",
  },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 20,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111111",
  },

  pageSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#666666",
  },

  addButton: {
    backgroundColor: "#111111",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
  },

  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginTop: 12,
    marginBottom: 8,
  },

  selectedDriverBox: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    backgroundColor: "#F7F8FA",
    justifyContent:
      "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  selectedDriverText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },

  noAssignedDriverText: {
    color: "#666666",
    fontSize: 13,
  },

  horizontalList: {
    flexGrow: 0,
  },

  optionButton: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: "#FFFFFF",
  },

  selectedOption: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  optionText: {
    color: "#333333",
    fontSize: 14,
    fontWeight: "600",
  },

  selectedOptionText: {
    color: "#FFFFFF",
  },

  input: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },

  saveButton: {
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 20,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  noDataText: {
    color: "#444444",
    fontSize: 14,
  },

  // =========================================================
  // EXPENSE SUMMARY
  // =========================================================

  expenseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  expenseHeaderRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
  },

  expenseTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  expensePeriodLabel: {
    marginTop: 5,
    fontSize: 13,
    color: "#666666",
  },

  expenseAmountBlock: {
    alignItems: "flex-end",
  },

  expenseAmountLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "700",
  },

  expenseAmount: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "800",
    color: "#111111",
  },

  expenseModeRow: {
    flexDirection: "row",
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: "#F3F3F3",
    padding: 4,
  },

  expenseModeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent:
      "center",
  },

  expenseModeButtonActive: {
    backgroundColor: "#111111",
  },

  expenseModeText: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
  },

  expenseModeTextActive: {
    color: "#FFFFFF",
  },

  periodButton: {
    marginTop: 12,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  periodButtonIcon: {
    fontSize: 18,
    color: "#111111",
    marginRight: 11,
  },

  periodButtonContent: {
    flex: 1,
  },

  periodButtonLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "700",
  },

  periodButtonValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#111111",
    fontWeight: "700",
  },

  periodButtonArrow: {
    fontSize: 28,
    color: "#111111",
    lineHeight: 30,
  },

  // =========================================================
  // FUEL LIST
  // =========================================================

  list: {
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 12,
  },

  fuelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  date: {
    fontSize: 14,
    color: "#666666",
  },

  cost: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
  },

  detail: {
    fontSize: 13,
    color: "#666666",
    marginTop: 7,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 10,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },

  emptyText: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },

  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },

  recordActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },

  deleteButtonText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 14,
  },

  editButtonText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 14,
  },

  editBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#DDDDDD",
  },

  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },

  updateButton: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  updateButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent:
      "center",
  },

  cancelButtonText: {
    color: "#333333",
    fontWeight: "700",
  },

  // =========================================================
  // CALENDAR
  // Same visual style as Vehicle page
  // =========================================================

  centerModalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent:
      "center",
    padding: 20,
  },

  calendarModal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },

  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 20,
  },

  monthArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent:
      "center",
  },

  monthArrowText: {
    fontSize: 32,
    lineHeight: 34,
    color: "#111111",
  },

  calendarTitleContainer: {
    alignItems: "center",
  },

  calendarMonth: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
  },

  calendarYearSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: 2,
  },

  calendarYear: {
    fontSize: 13,
    color: "#666666",
  },

  calendarYearArrow: {
    marginLeft: 5,
    fontSize: 13,
    color: "#111111",
  },

  calendarYearHint: {
    textAlign: "center",
    fontSize: 11,
    color: "#888888",
    marginTop: -10,
    marginBottom: 12,
  },

  todayButton: {
    alignSelf: "center",
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
  },

  todayButtonText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "700",
  },

  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },

  weekDay: {
    width: "14.285%",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#888888",
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  calendarDay: {
    width: "14.285%",
    height: 42,
    alignItems: "center",
    justifyContent:
      "center",
  },

  calendarDayInRange: {
    backgroundColor: "#F3F3F3",
  },

  calendarDayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent:
      "center",
  },

  calendarDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },

  todayDay: {
    borderWidth: 1,
    borderColor: "#111111",
    borderRadius: 21,
  },

  todayText: {
    fontWeight: "800",
  },

  selectedDay: {
    backgroundColor: "#111111",
    borderRadius: 21,
  },

  selectedDayText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  calendarSelectionInfo: {
    marginTop: 15,
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 12,
  },

  calendarSelectionLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "700",
  },

  calendarSelectionValue: {
    marginTop: 3,
    fontSize: 14,
    color: "#111111",
    fontWeight: "700",
  },

  clearRangeButton: {
    alignSelf: "flex-end",
    marginTop: 9,
    paddingHorizontal: 5,
  },

  clearRangeText: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
  },

  calendarApplyButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: 5,
  },

  calendarApplyButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },

  calendarApplyText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  calendarDoneButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent:
      "center",
    marginTop: 12,
  },

  calendarCancelButton: {
  minHeight: 44,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#DDDDDD",
  backgroundColor: "#FFFFFF",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 12,
},

  calendarCancelButtonText: {
  fontSize: 14,
  fontWeight: "700",
  color: "#111111",
},  

  calendarDoneText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },

  // =========================================================
  // YEAR PICKER
  // =========================================================

  calendarPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",
    marginBottom: 15,
  },

  calendarPickerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111111",
  },

  calendarPickerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#666666",
  },

  calendarYearList: {
    maxHeight: 430,
  },

  calendarYearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  calendarYearOption: {
    width: "31.5%",
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    alignItems: "center",
    justifyContent:
      "center",
    backgroundColor: "#FFFFFF",
  },

  calendarYearOptionSelected: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  calendarYearOptionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },

  calendarYearOptionTextSelected: {
    color: "#FFFFFF",
  },

  // =========================================================
  // MONTH PICKER
  // =========================================================

  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },

  monthOption: {
    width: "31.5%",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    alignItems: "center",
    justifyContent:
      "center",
    backgroundColor: "#FFFFFF",
  },

  monthOptionSelected: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  monthOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
  },

  monthOptionTextSelected: {
    color: "#FFFFFF",
  },

  // =========================================================
  // CLOSE BUTTON
  // =========================================================

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent:
      "center",
  },

  closeButtonText: {
    fontSize: 25,
    lineHeight: 27,
    color: "#111111",
  },

  // =========================================================
  // DELETE MODAL
  // =========================================================

  deleteModalOverlay: {
    flex: 1,
    justifyContent:
      "center",
    alignItems: "center",
    padding: 24,
    backgroundColor:
      "rgba(17, 24, 39, 0.45)",
  },

  deleteModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 22,
  },

  deleteModalTitle: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "800",
  },

  deleteModalText: {
    marginTop: 10,
    color: "#333333",
    fontSize: 15,
    lineHeight: 21,
  },

  deleteModalHint: {
    marginTop: 8,
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
  },

  deleteModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  deleteModalCancelButton: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 12,
  },

  deleteModalCancelText: {
    color: "#333333",
    fontWeight: "700",
  },

  deleteModalConfirmButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingVertical: 12,
  },

  deleteModalConfirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});