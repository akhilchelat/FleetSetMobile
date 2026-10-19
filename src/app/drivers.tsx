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
import { useFocusEffect } from "expo-router";
import { getUser } from "../utils/storage";
import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
} from "../services/api";

type Driver = {
  id: string;
  company_id: string;
  branch_id: string;
  user_id?: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  license_number: string;
  license_expiry: string | null;
  status: string;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  company_id: string;
  branch_id: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  type?: string | null;
  is_active: boolean;
};

type Assignment = {
  id: string;
  company_id: string;
  branch_id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_by: string;
  assigned_at?: string | null;
  unassigned_at?: string | null;
  is_active: boolean;
};

type DriverForm = {
  firstName: string;
  email: string;
  password: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
};

const emptyForm: DriverForm = {
  firstName: "",
  email: "",
  password: "",
  lastName: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
};

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

export default function DriversScreen() {
  // ---------------------------------------------------------
  // DRIVER DATA
  // ---------------------------------------------------------
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverSearch, setDriverSearch] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------------
  // DRIVER ADD / EDIT
  // ---------------------------------------------------------
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);

  // ---------------------------------------------------------
  // LICENSE CALENDAR
  // ---------------------------------------------------------
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarYearPicker, setCalendarYearPicker] = useState(false);
  const [yearPickerFromYearField, setYearPickerFromYearField] =
    useState(false);

  // ---------------------------------------------------------
  // VEHICLE ASSIGNMENT
  // ---------------------------------------------------------
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [assignmentDriver, setAssignmentDriver] = useState<Driver | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null
  );
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [unassignConfirmDriver, setUnassignConfirmDriver] = useState<Driver | null>(null);   
  const [statusConfirmDriver, setStatusConfirmDriver] = useState<Driver | null>(null);
  const [statusConfirmActivate, setStatusConfirmActivate] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);


  // ---------------------------------------------------------
  // GET LOGGED-IN USER
  // ---------------------------------------------------------
  
useEffect(() => {
  let mounted = true;

  const loadStoredUser = async () => {
    try {
      const user = await getUser();

      if (!mounted) return;

      if (!user) {
        setLoading(false);

        Alert.alert(
          "Sign in required",
          "Please sign in again to view drivers."
        );

        return;
      }

      setCompanyId(user.company_id || null);
      setBranchId(user.branch_id || null);
      setUserId(user.id || null);

      const role = user.role;
      setUserRole(
        typeof role === "object" && role !== null
          ? role.name || user.role_name || null
          : user.role_name || role || null
      );
    } catch (error) {
      console.error("Could not load stored user:", error);

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

  // ---------------------------------------------------------
  // HELPER: EXTRACT ARRAY FROM API RESPONSE
  // ---------------------------------------------------------
  const extractArray = (data: any): any[] => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (Array.isArray(data?.assignments)) {
      return data.assignments;
    }

    if (Array.isArray(data?.vehicles)) {
      return data.vehicles;
    }

    if (Array.isArray(data?.drivers)) {
      return data.drivers;
    }

    return [];
  };

  // ---------------------------------------------------------
  // LOAD DRIVERS
  // ---------------------------------------------------------
  const loadDrivers = async () => {
  if (!companyId) {
    return;
  }

  try {
    const data = await apiGet(`/drivers/${companyId}`);

    setDrivers(extractArray(data));
  } catch (error) {
    console.error("Driver loading error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.toLowerCase().includes("no drivers found")
    ) {
      setDrivers([]);
      return;
    }

    Alert.alert(
      "Error",
      "Could not load drivers from the server."
    );
  }
};

  // ---------------------------------------------------------
  // LOAD VEHICLES
  // ---------------------------------------------------------
  const loadVehicles = async () => {
  if (!companyId) {
    return;
  }

  try {
    const data = await apiGet(
      `/vehicles/${companyId}/all`
    );

    setVehicles(extractArray(data));
  } catch (error) {
    console.error("Vehicle loading error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("no vehicles")
    ) {
      setVehicles([]);
      return;
    }

    Alert.alert(
      "Error",
      "Could not load vehicles from the server."
    );
  }
};

  // ---------------------------------------------------------
  // LOAD ACTIVE ASSIGNMENTS
  // ---------------------------------------------------------
  const loadAssignments = async () => {
  if (!companyId) {
    return;
  }

  try {
    const data = await apiGet(
      `/driver-vehicle-assignments/${companyId}`
    );

    setAssignments(extractArray(data));
  } catch (error) {
    console.error(
      "Assignment loading error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("no assignments")
    ) {
      setAssignments([]);
      return;
    }

    Alert.alert(
      "Error",
      "Could not load vehicle assignments."
    );
  }
};

  // ---------------------------------------------------------
  // LOAD EVERYTHING
  // ---------------------------------------------------------
  const loadAllData = async (showLoader = true) => {
    if (!companyId) {
      return;
    }

    try {
      if (showLoader) {
        setLoading(true);
      }

      await Promise.all([
        loadDrivers(),
        loadVehicles(),
        loadAssignments(),
      ]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (companyId) {
      void loadAllData();
    }
  }, [companyId]);

  // ---------------------------------------------------------
  // REFRESH WHEN SCREEN GETS FOCUS
  // ---------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      if (companyId) {
        void loadAllData(false);
      }
    }, [companyId])
  );

  // ---------------------------------------------------------
  // PULL TO REFRESH
  // ---------------------------------------------------------
  const refreshDrivers = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadAllData(false);
    } finally {
      setRefreshing(false);
    }
  }, [companyId]);

  // ---------------------------------------------------------
  // FORM
  // ---------------------------------------------------------
  const updateForm = (
    key: keyof DriverForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openAddDriver = () => {
    setEditingDriver(null);
    setForm(emptyForm);

    setCalendarDate(new Date());
    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
    setModalVisible(true);
  };

  const openEditDriver = (driver: Driver) => {
    setEditingDriver(driver);

    setForm({
      firstName: driver.first_name,
      email: driver.email || "",
      password: "",
      lastName: driver.last_name || "",
      phone: driver.phone,
      licenseNumber: driver.license_number,
      licenseExpiry: driver.license_expiry
        ? driver.license_expiry.slice(0, 10)
        : "",
    });

    if (driver.license_expiry) {
      const expiryDate = new Date(
        `${driver.license_expiry.slice(0, 10)}T00:00:00`
      );

      if (!Number.isNaN(expiryDate.getTime())) {
        setCalendarDate(expiryDate);
      }
    } else {
      setCalendarDate(new Date());
    }

    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalVisible(false);
    setEditingDriver(null);
    setForm(emptyForm);
  };

  // ---------------------------------------------------------
  // SAVE DRIVER
  // ---------------------------------------------------------
  const saveDriver = async () => {
  if (!companyId) {
    Alert.alert(
      "Error",
      "Company information is missing."
    );
    return;
  }

  if (
  !form.firstName.trim() ||
  !form.email.trim() ||
  !form.phone.trim() ||
  !form.licenseNumber.trim() ||
  !form.licenseExpiry.trim()
) {
  Alert.alert(
    "Missing information",
    "First name, email, phone number, license number, and license expiry date are required."
  );
  return;
}

  try {
    if (!editingDriver && !branchId) {
      Alert.alert(
        "Branch required",
        "Your account is not assigned to a branch."
      );
      return;
    }

    if (
      !editingDriver &&
      form.password.trim().length < 8
    ) {
      Alert.alert(
        "Invalid password",
        "Password must be at least 8 characters."
      );
      return;
    }

    setSaving(true);

    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim() || null,
      email: form.email.trim(),
      ...(editingDriver
        ? {}
        : {
            password: form.password.trim(),
            branch_id: branchId,
          }),
      phone: form.phone.trim(),
      license_number: form.licenseNumber.trim(),
      license_expiry:
        form.licenseExpiry.trim() || null,
    };

    if (editingDriver) {
      await apiPut(
        `/drivers/${companyId}/${editingDriver.id}`,
        payload
      );
    } else {
      await apiPost(
        `/drivers/${companyId}`,
        payload
      );
    }

    Alert.alert(
      "Success",
      editingDriver
        ? "Driver updated successfully."
        : "Driver added successfully."
    );

    closeModal();

    await loadAllData(false);
  } catch (error) {
    console.error("Driver save error:", error);

    Alert.alert(
      "Error",
      error instanceof Error
        ? error.message
        : "Could not save driver."
    );
  } finally {
    setSaving(false);
  }
};

// ---------------------------------------------------------
// ACTIVATE / DEACTIVATE DRIVER
// ---------------------------------------------------------
const changeDriverStatus = (
  driver: Driver,
  activate: boolean
) => {
  setStatusConfirmDriver(driver);
  setStatusConfirmActivate(activate);
};

const confirmDriverStatus = async () => {
  if (!statusConfirmDriver || !companyId) {
    return;
  }

  const driver = statusConfirmDriver;
  const activate = statusConfirmActivate;
  const action = activate ? "activate" : "deactivate";

  try {
    setStatusChanging(true);

    const normalizedRole = userRole?.trim().toUpperCase();

    console.log("DRIVER STATUS REQUEST:", {
      driverId: driver.id,
      driverUserId: driver.user_id,
      driverEmail: driver.email,
      userRole: normalizedRole,
      action,
    });

    // Deactivation must always remove the driver's active vehicle
    // assignment before changing the driver's status.
    if (!activate) {
      const currentAssignment = getDriverAssignment(driver.id);

      if (currentAssignment) {
        console.log("UNASSIGNING DRIVER BEFORE DEACTIVATION:", {
          driverId: driver.id,
          assignmentId: currentAssignment.id,
          vehicleId: currentAssignment.vehicle_id,
        });

        await apiPatch(
          `/driver-vehicle-assignments/${companyId}/${currentAssignment.id}/unassign`
        );
      }
    }

    if (normalizedRole === "GLOBAL_ADMIN") {
      await apiPatch(
        `/drivers/admin/${driver.id}/${action}`
      );
    } else {
      let userIdToUpdate = driver.user_id;

      if (!userIdToUpdate && driver.email) {
        const userData = await apiGet(
          `/users/email/${encodeURIComponent(driver.email)}`
        );

        userIdToUpdate =
          userData?.id ||
          userData?.data?.id ||
          userData?.user?.id ||
          null;
      }

      if (!userIdToUpdate) {
        throw new Error(
          "Could not resolve the driver's user account."
        );
      }

      await apiPatch(
        `/users/${userIdToUpdate}/${action}`
      );
    }

    setStatusConfirmDriver(null);
    setStatusConfirmActivate(false);

    await loadAllData(false);
  } catch (error) {
    console.error("DRIVER STATUS ERROR:", error);

    Alert.alert(
      `${activate ? "Activate" : "Deactivate"} Failed`,
      error instanceof Error
        ? error.message
        : `Could not ${action} driver.`
    );
  } finally {
    setStatusChanging(false);
  }
};


  // ---------------------------------------------------------
  // ACTIVE / INACTIVE COUNTS
  // ---------------------------------------------------------
  const activeDrivers = drivers.filter(
    (driver) => driver.is_active
  );

  const inactiveDrivers = drivers.filter(
    (driver) => !driver.is_active
  );

  const searchQuery = driverSearch.trim().toLowerCase();

  const filteredActiveDrivers = activeDrivers.filter((driver) =>
  [
    driver.first_name,
    driver.last_name,
    driver.email,
    driver.phone,
    driver.license_number,
  ].some((value) =>
    value?.toLowerCase().includes(searchQuery)
  )
);

  const filteredInactiveDrivers = inactiveDrivers.filter((driver) =>
  [
    driver.first_name,
    driver.last_name,
    driver.email,
    driver.phone,
    driver.license_number,
  ].some((value) =>
    value?.toLowerCase().includes(searchQuery)
  )
);

const hasSearchResults =
  filteredActiveDrivers.length > 0 ||
  filteredInactiveDrivers.length > 0;

  // ---------------------------------------------------------
  // ASSIGNMENT HELPERS
  // ---------------------------------------------------------
  const getDriverAssignment = (
    driverId: string
  ) => {
    return assignments.find(
      (assignment) =>
        assignment.driver_id === driverId &&
        assignment.is_active
    );
  };

  const getVehicleById = (
    vehicleId: string
  ) => {
    return vehicles.find(
      (vehicle) => vehicle.id === vehicleId
    );
  };

  const getAssignedVehicle = (
    driverId: string
  ) => {
    const assignment =
      getDriverAssignment(driverId);

    if (!assignment) {
      return null;
    }

    return getVehicleById(
      assignment.vehicle_id
    );
  };

  // ---------------------------------------------------------
  // OPEN ASSIGNMENT MODAL
  // ---------------------------------------------------------
  const openAssignmentModal = (
    driver: Driver
  ) => {
    const assignment =
      getDriverAssignment(driver.id);

    setAssignmentDriver(driver);

    setSelectedVehicleId(
      assignment?.vehicle_id || null
    );

    setAssignmentModalVisible(true);
  };

  const closeAssignmentModal = () => {
    if (assignmentSaving) {
      return;
    }

    setAssignmentModalVisible(false);
    setAssignmentDriver(null);
    setSelectedVehicleId(null);
  };

  // ---------------------------------------------------------
  // AVAILABLE VEHICLES
  // ---------------------------------------------------------
  const availableVehicles = useMemo(() => {
    if (!assignmentDriver) {
      return [];
    }

    const currentAssignment =
      getDriverAssignment(
        assignmentDriver.id
      );

    return vehicles.filter((vehicle) => {
      if (!vehicle.is_active) {
        return false;
      }

      // Keep currently assigned vehicle available
      // when changing vehicle.
      if (
        currentAssignment &&
        vehicle.id === currentAssignment.vehicle_id
      ) {
        return true;
      }

      const assignedToAnotherDriver =
        assignments.some(
          (assignment) =>
            assignment.is_active &&
            assignment.vehicle_id === vehicle.id &&
            assignment.driver_id !==
              assignmentDriver.id
        );

      return !assignedToAnotherDriver;
    });
  }, [
    vehicles,
    assignments,
    assignmentDriver,
  ]);

  // ---------------------------------------------------------
  // ASSIGN / CHANGE VEHICLE
  // ---------------------------------------------------------
  const saveVehicleAssignment = async () => {
  if (
    !companyId ||
    !assignmentDriver ||
    !selectedVehicleId
  ) {
    Alert.alert(
      "Missing information",
      "Please select a vehicle."
    );
    return;
  }

  try {
    setAssignmentSaving(true);

    const currentAssignment =
      getDriverAssignment(
        assignmentDriver.id
      );

    if (currentAssignment) {
      await apiPatch(
        `/driver-vehicle-assignments/${companyId}/${currentAssignment.id}/unassign`
      );
    }

    await apiPost(
      `/driver-vehicle-assignments/${companyId}`,
      {
        driver_id: assignmentDriver.id,
        vehicle_id: selectedVehicleId,
      }
    );

    Alert.alert(
      "Success",
      currentAssignment
        ? "Vehicle changed successfully."
        : "Vehicle assigned successfully."
    );

    closeAssignmentModal();

    await loadAllData(false);
  } catch (error) {
    console.error(
      "Vehicle assignment error:",
      error
    );

    Alert.alert(
      "Error",
      error instanceof Error
        ? error.message
        : "Could not save vehicle assignment."
    );
  } finally {
    setAssignmentSaving(false);
  }
};

 // ---------------------------------------------------------
// UNASSIGN VEHICLE
// ---------------------------------------------------------
const unassignVehicle = (driver: Driver) => {
  const assignment = getDriverAssignment(driver.id);

  if (!assignment || !companyId) {
    Alert.alert(
      "No assignment",
      "This driver does not have an active vehicle assignment."
    );
    return;
  }

  setUnassignConfirmDriver(driver);
};

const confirmUnassignVehicle = async () => {
  if (!unassignConfirmDriver || !companyId) {
    return;
  }

  const assignment = getDriverAssignment(
    unassignConfirmDriver.id
  );

  if (!assignment) {
    Alert.alert(
      "No assignment",
      "This driver does not have an active vehicle assignment."
    );
    setUnassignConfirmDriver(null);
    return;
  }

  try {
    setUnassigning(true);

    await apiPatch(
      `/driver-vehicle-assignments/${companyId}/${assignment.id}/unassign`
    );

    setUnassignConfirmDriver(null);

    Alert.alert(
      "Success",
      "Vehicle unassigned successfully."
    );

    await loadAllData(false);
  } catch (error) {
    console.error(
      "Unassign vehicle error:",
      error
    );

    Alert.alert(
      "Error",
      error instanceof Error
        ? error.message
        : "Could not unassign vehicle."
    );
  } finally {
    setUnassigning(false);
  }
};

  // ---------------------------------------------------------
  // LICENSE DATE HELPERS
  // ---------------------------------------------------------
  const parseDateOnly = (
    value: string
  ) => {
    const parts = value.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);

    const date = new Date(
      year,
      month,
      day
    );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  };

  const formatDateForDisplay = (
    value: string
  ) => {
    const date = parseDateOnly(value);

    if (!date) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const getExpiryState = (
    expiry: string | null
  ) => {
    if (!expiry) {
      return {
        label: "No expiry date",
        type: "none",
      };
    }

    const expiryDate =
      parseDateOnly(
        expiry.slice(0, 10)
      );

    if (!expiryDate) {
      return {
        label: expiry,
        type: "none",
      };
    }

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    expiryDate.setHours(
      0,
      0,
      0,
      0
    );

    const difference =
      expiryDate.getTime() -
      today.getTime();

    const daysLeft = Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );

    if (daysLeft < 0) {
      return {
        label: `Expired ${Math.abs(
          daysLeft
        )} day${
          Math.abs(daysLeft) === 1
            ? ""
            : "s"
        } ago`,
        type: "expired",
      };
    }

    if (daysLeft === 0) {
      return {
        label: "Expires today",
        type: "expired",
      };
    }

    if (daysLeft <= 30) {
      return {
        label: `Expires in ${daysLeft} day${
          daysLeft === 1
            ? ""
            : "s"
        }`,
        type: "warning",
      };
    }

    return {
      label: `Expires ${formatDateForDisplay(
        expiry.slice(0, 10)
      )}`,
      type: "valid",
    };
  };

  // ---------------------------------------------------------
  // CALENDAR
  // ---------------------------------------------------------
  const calendarYear = calendarDate.getFullYear();
  const calendarMonthIndex = calendarDate.getMonth();

  const firstDayOfMonth = new Date(
    calendarYear,
    calendarMonthIndex,
    1
  ).getDay();

  const daysInMonth = new Date(
    calendarYear,
    calendarMonthIndex + 1,
    0
  ).getDate();

  const calendarDays: (number | null)[] = [];

  for (let index = 0; index < firstDayOfMonth; index += 1) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarDays.push(day);
  }

  const driverYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let year = currentYear + 1; year >= 1980; year -= 1) {
      years.push(year);
    }

    return years;
  }, []);

  const openCalendar = () => {
    const currentValue = form.licenseExpiry;

    if (currentValue && parseDateOnly(currentValue)) {
      setCalendarDate(parseDateOnly(currentValue)!);
    } else {
      setCalendarDate(new Date());
    }

    setYearPickerFromYearField(false);
    setCalendarYearPicker(false);
    setCalendarVisible(true);
  };

  const openCalendarYearPicker = () => {
    setYearPickerFromYearField(false);
    setCalendarYearPicker(true);
    setCalendarVisible(true);
  };

  const closeCalendar = () => {
    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
    setCalendarVisible(false);
  };

  const moveCalendarMonth = (direction: number) => {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + direction,
          1
        )
    );
  };

  const selectCalendarDate = (day: number) => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;

    const formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    updateForm("licenseExpiry", formatted);
    closeCalendar();
  };

  const selectDriverYear = (year: number) => {
    setCalendarDate(
      new Date(
        year,
        calendarDate.getMonth(),
        1
      )
    );

    if (yearPickerFromYearField) {
      closeCalendar();
    } else {
      setCalendarYearPicker(false);
    }
  };

  // ---------------------------------------------------------
  // LOADING SCREEN
  // ---------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111111" />

        <Text style={styles.loadingText}>
          Loading drivers...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // DRIVER CARD
  // ---------------------------------------------------------
  const renderDriverCard = (
    driver: Driver
  ) => {
    const fullName =
      `${driver.first_name} ${
        driver.last_name || ""
      }`.trim();

    const assignment =
      getDriverAssignment(
        driver.id
      );

    const assignedVehicle =
      getAssignedVehicle(
        driver.id
      );

    const expiryState =
      getExpiryState(
        driver.license_expiry
      );

    return (
      <View
        key={driver.id}
        style={styles.driverCard}
      >
        {/* HEADER */}
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {fullName}
            </Text>

            <Text style={styles.driverPhone}>
              {driver.phone}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              driver.is_active
                ? styles.activeBadge
                : styles.inactiveBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                driver.is_active
                  ? styles.activeText
                  : styles.inactiveText,
              ]}
            >
              {driver.is_active
                ? "Active"
                : "Inactive"}
            </Text>
          </View>
        </View>

        {/* LICENSE */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>
            License
          </Text>

          <Text style={styles.infoValue}>
            {driver.license_number}
          </Text>
        </View>

        {/* LICENSE EXPIRY */}
        <View
          style={[
            styles.expiryBox,
            expiryState.type ===
              "expired" &&
              styles.expiryExpired,
            expiryState.type ===
              "warning" &&
              styles.expiryWarning,
            expiryState.type ===
              "valid" &&
              styles.expiryValid,
          ]}
        >
          <Text style={styles.expiryIcon}>
            ▣
          </Text>

          <View style={styles.expiryContent}>
            <Text style={styles.expiryTitle}>
              License expiry
            </Text>

            <Text
              style={[
                styles.expiryText,
                expiryState.type ===
                  "expired" &&
                  styles.expiryTextExpired,
                expiryState.type ===
                  "warning" &&
                  styles.expiryTextWarning,
                expiryState.type ===
                  "valid" &&
                  styles.expiryTextValid,
              ]}
            >
              {expiryState.label}
            </Text>
          </View>
        </View>

        {/* ASSIGNED VEHICLE */}
        <View style={styles.assignmentBox}>
          <View style={styles.assignmentHeader}>
            <Text style={styles.assignmentTitle}>
              Vehicle
            </Text>

            {assignedVehicle && driver.is_active && (
              <View style={styles.assignedBadge}>
                <Text style={styles.assignedBadgeText}>
                  Assigned
                </Text>
              </View>
            )}
          </View>

          {assignedVehicle ? (
            <>
              <Text style={styles.vehicleRegistration}>
                {assignedVehicle.registration_number}
              </Text>

              {Boolean(
                assignedVehicle.manufacturer ||
                assignedVehicle.model
              ) && (
                <Text style={styles.vehicleDetails}>
                  {[
                    assignedVehicle.manufacturer,
                    assignedVehicle.model,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              )}

              {driver.is_active ? (
                <View style={styles.assignmentActions}>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() =>
                      openAssignmentModal(driver)
                    }
                  >
                    <Text style={styles.secondaryActionText}>
                      Change Vehicle
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dangerOutlineButton}
                    onPress={() => unassignVehicle(driver)}
                  >
                    <Text style={styles.dangerOutlineText}>
                      Unassign
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.noVehicleText}>
                No vehicle assigned
              </Text>

              {driver.is_active ? (
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() =>
                    openAssignmentModal(driver)
                  }
                >
                  <Text style={styles.assignButtonText}>
                    Assign Vehicle
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        {/* DRIVER ACTIONS */}
        {driver.is_active ? (
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditDriver(driver)}
            >
              <Text style={styles.editButtonText}>
                Edit Driver
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={() => changeDriverStatus(driver, false)}
            >
              <Text style={styles.deactivateText}>
                Deactivate
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={styles.activateButton}
              onPress={() => changeDriverStatus(driver, true)}
            >
              <Text style={styles.activateText}>
                Activate
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------
  // MAIN SCREEN
  // ---------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Drivers
          </Text>

          <Text style={styles.subtitle}>
            {activeDrivers.length} active ·{" "}
            {inactiveDrivers.length} inactive
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddDriver}
        >
          <Text style={styles.addButtonText}>
            + Add
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, styles.driverSearchContainer]}>
  <Text style={styles.searchIcon}>⌕</Text>

  <TextInput
    style={[
  styles.searchInput,
  { outlineStyle: "none" } as any,
]}
    placeholder="Search name, phone, email, license..."
    placeholderTextColor="#999999"
    value={driverSearch}
    onChangeText={setDriverSearch}
    autoCapitalize="none"
    autoCorrect={false}
    clearButtonMode="while-editing"
  />

  {driverSearch.length > 0 && (
    <TouchableOpacity
      onPress={() => setDriverSearch("")}
      style={styles.clearSearchButton}
    >
      <Text style={styles.clearSearchText}>×</Text>
    </TouchableOpacity>
  )}
</View>
      {!hasSearchResults && searchQuery.length > 0 ? (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyTitle}>
      No matching drivers
    </Text>

    <Text style={styles.emptyText}>
      Try another name, phone number, email, or license number.
    </Text>
  </View>
) : (
  <>
    {/* Keep your existing Active Drivers section here. */}

    {/* Keep your existing Inactive Drivers section here. */}
  </>
)}
      {/* DRIVER LIST */}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDrivers}
          />
        }
      >
        {drivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No drivers yet
            </Text>

            <Text style={styles.emptyText}>
              Add your first driver to start
              assigning vehicles.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={openAddDriver}
            >
              <Text style={styles.emptyButtonText}>
                Add Driver
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {activeDrivers.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  Active Drivers
                </Text>

                {filteredActiveDrivers.map(
  renderDriverCard
)}
              </>
            )}

            {inactiveDrivers.length > 0 && (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.inactiveSectionTitle,
                  ]}
                >
                  Inactive Drivers
                </Text>

                {filteredInactiveDrivers.map(
  renderDriverCard
)}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* =====================================================
          ADD / EDIT DRIVER MODAL
          ===================================================== */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDriver
                  ? "Edit Driver"
                  : "Add Driver"}
              </Text>

              <TouchableOpacity
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={styles.closeText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text style={styles.label}>
                First name *
              </Text>

              <TextInput
                style={styles.input}
                value={form.firstName}
                onChangeText={(value) =>
                  updateForm(
                    "firstName",
                    value
                  )
                }
              />

              <Text style={styles.label}>
                Email *
              </Text>

              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(value) => updateForm("email", value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
              />

              {!editingDriver && (
                <>
                  <Text style={styles.label}>
                    Password *
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={form.password}
                    onChangeText={(value) => updateForm("password", value)}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    importantForAutofill="no"
                  />
                </>
              )}

              <Text style={styles.label}>
                Last name
              </Text>

              <TextInput
                style={styles.input}
                value={form.lastName}
                onChangeText={(value) =>
                  updateForm(
                    "lastName",
                    value
                  )
                }
              />

              <Text style={styles.label}>
                Phone number *
              </Text>

              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(value) =>
                  updateForm(
                    "phone",
                    value
                  )
                }
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>
                License number *
              </Text>

              <TextInput
                style={styles.input}
                value={
                  form.licenseNumber
                }
                onChangeText={(value) =>
                  updateForm(
                    "licenseNumber",
                    value
                  )
                }
                autoCapitalize="characters"
              />

              {/* LICENSE DATE PICKER */}
              <Text style={styles.label}>
                License expiry *
              </Text>

              <TouchableOpacity
                style={styles.dateInput}
                onPress={openCalendar}
              >
                <Text
                  style={
                    form.licenseExpiry
                      ? styles.dateText
                      : styles.datePlaceholder
                  }
                >
                  {form.licenseExpiry
                    ? formatDateForDisplay(
                        form.licenseExpiry
                      )
                    : "Select expiry date"}
                </Text>

                <Text style={styles.calendarIcon}>
                  ▣
                </Text>
              </TouchableOpacity>

              {form.licenseExpiry && (
                <TouchableOpacity
                  style={styles.clearDateButton}
                  onPress={() =>
                    updateForm(
                      "licenseExpiry",
                      ""
                    )
                  }
                >
                  <Text style={styles.clearDateText}>
                    Clear expiry date
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveDriver}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={
                      styles.saveButtonText
                    }
                  >
                    {editingDriver
                      ? "Save Changes"
                      : "Add Driver"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          LICENSE CALENDAR MODAL
          ===================================================== */}
      <Modal
        visible={calendarVisible}
        animationType="fade"
        transparent
        onRequestClose={closeCalendar}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarCard}>
            {calendarYearPicker ? (
              <>
                <View style={styles.calendarPickerHeader}>
                  <View>
                    <Text style={styles.calendarPickerTitle}>
                      Select Year
                    </Text>

                    <Text style={styles.calendarPickerSubtitle}>
                      Choose the license expiry year
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeCalendar}
                  >
                    <Text style={styles.closeText}>×</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.calendarYearList}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.calendarYearGrid}>
                    {driverYears.map((year) => {
                      const selected =
                        calendarDate.getFullYear() === year;

                      return (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.calendarYearOption,
                            selected && styles.calendarYearOptionSelected,
                          ]}
                          onPress={() => selectDriverYear(year)}
                        >
                          <Text
                            style={[
                              styles.calendarYearOptionText,
                              selected && styles.calendarYearOptionTextSelected,
                            ]}
                          >
                            {year}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

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
              <>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={styles.monthArrow}
                    onPress={() => moveCalendarMonth(-1)}
                  >
                    <Text style={styles.monthArrowText}>‹</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.calendarTitleContainer}
                    onPress={openCalendarYearPicker}
                  >
                    <Text style={styles.calendarMonth}>
                      {MONTH_NAMES[calendarMonthIndex]}
                    </Text>

                    <View style={styles.calendarYearSelector}>
                      <Text style={styles.calendarYear}>
                        {calendarYear}
                      </Text>

                      <Text style={styles.calendarYearArrow}>
                        ▾
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.monthArrow}
                    onPress={() => moveCalendarMonth(1)}
                  >
                    <Text style={styles.monthArrowText}>›</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.calendarYearHint}>
                  Tap the year to select a different year.
                </Text>

                <View style={styles.weekRow}>
                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map((day) => (
                    <Text key={day} style={styles.weekDay}>
                      {day}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return (
                        <View
                          key={`empty-${index}`}
                          style={styles.calendarDay}
                        />
                      );
                    }

                    const selectedDate =
                      `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                    const isSelected =
                      form.licenseExpiry === selectedDate;

                    const today = new Date();
                    const isToday =
                      day === today.getDate() &&
                      calendarMonthIndex === today.getMonth() &&
                      calendarYear === today.getFullYear();

                    return (
                      <TouchableOpacity
                        key={selectedDate}
                        style={[
                          styles.calendarDay,
                          isToday && styles.todayDay,
                          isSelected && styles.selectedDay,
                        ]}
                        onPress={() => selectCalendarDate(day)}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isToday && styles.todayText,
                            isSelected && styles.selectedDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.calendarCancelButton}
                  onPress={closeCalendar}
                >
                  <Text style={styles.cancelButtonText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          DRIVER STATUS CONFIRMATION
          ===================================================== */}
      <Modal
        visible={!!statusConfirmDriver}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!statusChanging) {
            setStatusConfirmDriver(null);
            setStatusConfirmActivate(false);
          }
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {statusConfirmActivate
                ? "Activate Driver?"
                : "Deactivate Driver?"}
            </Text>

            <Text style={styles.confirmMessage}>
              {statusConfirmDriver
                ? `${
                    statusConfirmActivate
                      ? "Activate"
                      : "Deactivate"
                  } ${statusConfirmDriver.first_name} ${
                    statusConfirmDriver.last_name || ""
                  }?`
                : ""}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  if (!statusChanging) {
                    setStatusConfirmDriver(null);
                    setStatusConfirmActivate(false);
                  }
                }}
                disabled={statusChanging}
              >
                <Text style={styles.confirmCancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmUnassignButton}
                onPress={confirmDriverStatus}
                disabled={statusChanging}
              >
                {statusChanging ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.confirmUnassignText}>
                    {statusConfirmActivate
                      ? "Activate"
                      : "Deactivate"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          VEHICLE ASSIGNMENT MODAL
          ===================================================== */}
      <Modal
        visible={assignmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={
          closeAssignmentModal
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.assignmentModalCard}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text
                  style={styles.modalTitle}
                >
                  {assignmentDriver &&
                  getDriverAssignment(
                    assignmentDriver.id
                  )
                    ? "Change Vehicle"
                    : "Assign Vehicle"}
                </Text>

                {assignmentDriver && (
                  <Text
                    style={
                      styles.assignmentDriverName
                    }
                  >
                    {assignmentDriver.first_name}{" "}
                    {assignmentDriver.last_name ||
                      ""}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={
                  closeAssignmentModal
                }
                disabled={assignmentSaving}
              >
                <Text style={styles.closeText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={styles.assignmentSelectLabel}
            >
              Select vehicle
            </Text>

            <ScrollView
              style={
                styles.vehicleSelectionList
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {availableVehicles.length ===
              0 ? (
                <View
                  style={
                    styles.noVehiclesCard
                  }
                >
                  <Text
                    style={
                      styles.noVehiclesTitle
                    }
                  >
                    No vehicles available
                  </Text>

                  <Text
                    style={
                      styles.noVehiclesText
                    }
                  >
                    Add an active vehicle or
                    unassign a vehicle from
                    another driver first.
                  </Text>
                </View>
              ) : (
                availableVehicles.map(
                  (vehicle) => {
                    const selected =
                      selectedVehicleId ===
                      vehicle.id;

                    return (
                      <TouchableOpacity
                        key={vehicle.id}
                        style={[
                          styles.vehicleOption,
                          selected &&
                            styles.selectedVehicleOption,
                        ]}
                        onPress={() =>
                          setSelectedVehicleId(
                            vehicle.id
                          )
                        }
                      >
                        <View
                          style={
                            styles.vehicleOptionInfo
                          }
                        >
                          <Text
                            style={
                              styles.vehicleOptionRegistration
                            }
                          >
                            {
                              vehicle.registration_number
                            }
                          </Text>

                          {Boolean(
  vehicle.manufacturer ||
    vehicle.model
) && (
                            <Text
                              style={
                                styles.vehicleOptionDetails
                              }
                            >
                              {[
                                vehicle.manufacturer,
                                vehicle.model,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " "
                                )}
                            </Text>
                          )}
                        </View>

                        <View
                          style={[
                            styles.radioOuter,
                            selected &&
                              styles.radioOuterSelected,
                          ]}
                        >
                          {selected && (
                            <View
                              style={
                                styles.radioInner
                              }
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                )
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.assignmentSaveButton,
                (!selectedVehicleId ||
                  availableVehicles.length ===
                    0) &&
                  styles.disabledButton,
              ]}
              onPress={
                saveVehicleAssignment
              }
              disabled={
                assignmentSaving ||
                !selectedVehicleId ||
                availableVehicles.length ===
                  0
              }
            >
              {assignmentSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  {assignmentDriver &&
                  getDriverAssignment(
                    assignmentDriver.id
                  )
                    ? "Change Vehicle"
                    : "Assign Vehicle"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
       {/* =====================================================
          UNASSIGN VEHICLE CONFIRMATION
          ===================================================== */}
      <Modal
        visible={!!unassignConfirmDriver}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!unassigning) {
            setUnassignConfirmDriver(null);
          }
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              Unassign Vehicle?
            </Text>

            <Text style={styles.confirmMessage}>
              {unassignConfirmDriver
                ? `Remove the vehicle assignment from ${
                    unassignConfirmDriver.first_name
                  } ${
                    unassignConfirmDriver.last_name || ""
                  }?`
                : ""}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() =>
                  setUnassignConfirmDriver(null)
                }
                disabled={unassigning}
              >
                <Text style={styles.confirmCancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmUnassignButton}
                onPress={confirmUnassignVehicle}
                disabled={unassigning}
              >
                {unassigning ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.confirmUnassignText}>
                    Unassign
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


      
// =============================================================
// STYLES
// =============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f8fa",
  },

  loadingText: {
    marginTop: 10,
    color: "#666666",
  },

  // -----------------------------------------------------------
  // HEADER
  // -----------------------------------------------------------

  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
  },


  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111111",
  },

  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#666666",
  },

  addButton: {
    backgroundColor: "#111111",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  // -----------------------------------------------------------
  // LIST
  // -----------------------------------------------------------

  list: {
    padding: 16,
    paddingBottom: 40,
  },

  sectionTitle: {
    marginBottom: 10,
    marginTop: 2,
    color: "#111111",
    fontSize: 16,
    fontWeight: "800",
  },

  inactiveSectionTitle: {
    marginTop: 12,
  },

  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#DDDDDD",
  },

  avatarText: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "800",
  },

  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },

  driverName: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "800",
  },

  driverPhone: {
    marginTop: 3,
    color: "#666666",
    fontSize: 13,
  },

  statusBadge: {
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  activeBadge: {
    backgroundColor: "#F0F0F0",
  },

  inactiveBadge: {
    backgroundColor: "#EEEEEE",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  activeText: {
    color: "#111111",
  },

  inactiveText: {
    color: "#666666",
  },

  // -----------------------------------------------------------
  // DRIVER INFO
  // -----------------------------------------------------------

  infoBlock: {
    marginTop: 16,
  },

  infoLabel: {
    color: "#999999",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  infoValue: {
    marginTop: 3,
    color: "#333333",
    fontSize: 13,
    fontWeight: "600",
  },

  // -----------------------------------------------------------
  // LICENSE EXPIRY
  // -----------------------------------------------------------

  expiryBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  expiryValid: {
    backgroundColor: "#F7F8FA",
    borderColor: "#CCCCCC",
  },

  expiryWarning: {
    backgroundColor: "#F5F5F5",
    borderColor: "#CCCCCC",
  },

  expiryExpired: {
    backgroundColor: "#EEEEEE",
    borderColor: "#BBBBBB",
  },

  expiryIcon: {
    fontSize: 18,
    color: "#111111",
    marginRight: 10,
  },

  expiryContent: {
    flex: 1,
  },

  expiryTitle: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "700",
  },

  expiryText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
  },

  expiryTextValid: {
    color: "#333333",
  },

  expiryTextWarning: {
    color: "#444444",
  },

  expiryTextExpired: {
    color: "#111111",
  },

  // -----------------------------------------------------------
  // ASSIGNMENT
  // -----------------------------------------------------------

  assignmentBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  assignmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  assignmentTitle: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  assignedBadge: {
    backgroundColor: "#111111",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  assignedBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  vehicleRegistration: {
    marginTop: 7,
    color: "#111111",
    fontSize: 15,
    fontWeight: "800",
  },

  vehicleDetails: {
    marginTop: 3,
    color: "#666666",
    fontSize: 12,
  },

  noVehicleText: {
    marginTop: 7,
    color: "#999999",
    fontSize: 13,
  },

  assignmentActions: {
    marginTop: 11,
    flexDirection: "row",
    gap: 8,
  },

  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  secondaryActionText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "700",
  },

  dangerOutlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#BBBBBB",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  dangerOutlineText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "700",
  },

  assignButton: {
    marginTop: 10,
    backgroundColor: "#111111",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },

  assignButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // -----------------------------------------------------------
  // DRIVER ACTIONS
  // -----------------------------------------------------------

  driverActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },

  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 9,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  editButtonText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 12,
  },

  deactivateButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#BBBBBB",
    borderRadius: 9,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  deactivateText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 12,
  },

  activateButton: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 9,
  alignItems: "center",
  backgroundColor: "#111111",
},

activateText: {
  color: "#FFFFFF",
  fontWeight: "700",
  fontSize: 12,
},

  // -----------------------------------------------------------
  // EMPTY
  // -----------------------------------------------------------

  emptyCard: {
    marginTop: 50,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
  },

  emptyText: {
    marginTop: 8,
    textAlign: "center",
    color: "#666666",
    lineHeight: 20,
  },

  emptyButton: {
    marginTop: 18,
    backgroundColor: "#111111",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 9,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // -----------------------------------------------------------
  // DRIVER MODAL
  // -----------------------------------------------------------

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },

  modalCard: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  assignmentModalCard: {
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111111",
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: "#444444",
    fontSize: 30,
    lineHeight: 30,
  },

  label: {
    marginTop: 13,
    marginBottom: 7,
    color: "#333333",
    fontSize: 13,
    fontWeight: "700",
  },

  input: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#111111",
  },

  dateInput: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateText: {
    color: "#111111",
    fontSize: 15,
  },

  datePlaceholder: {
    color: "#999999",
    fontSize: 15,
  },

  calendarIcon: {
    color: "#111111",
    fontSize: 18,
  },

  clearDateButton: {
    marginTop: 7,
    alignSelf: "flex-end",
  },

  clearDateText: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
  },

  saveButton: {
    marginTop: 22,
    marginBottom: 10,
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  cancelButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },

  // -----------------------------------------------------------
  // CALENDAR
  // -----------------------------------------------------------

  calendarOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 20,
  },

  calendarCard: {
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
    justifyContent: "space-between",
    marginBottom: 20,
  },

  monthArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "center",
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
    justifyContent: "center",
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

  // -----------------------------------------------------------
  // YEAR PICKER
  // -----------------------------------------------------------

  calendarPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
    justifyContent: "center",
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

  // -----------------------------------------------------------
  // ASSIGNMENT MODAL
  // -----------------------------------------------------------

  assignmentDriverName: {
    marginTop: 3,
    color: "#666666",
    fontSize: 13,
  },

  assignmentSelectLabel: {
    marginTop: 8,
    marginBottom: 9,
    color: "#333333",
    fontSize: 13,
    fontWeight: "700",
  },

  vehicleSelectionList: {
    maxHeight: 390,
  },

  vehicleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  selectedVehicleOption: {
    borderColor: "#111111",
    backgroundColor: "#F7F8FA",
  },

  vehicleOptionInfo: {
    flex: 1,
  },

  vehicleOptionRegistration: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "800",
  },

  vehicleOptionDetails: {
    marginTop: 3,
    color: "#666666",
    fontSize: 12,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },

  radioOuterSelected: {
    borderColor: "#111111",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111111",
  },

  noVehiclesCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  noVehiclesTitle: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 15,
  },

  noVehiclesText: {
    marginTop: 7,
    textAlign: "center",
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
  },

  assignmentSaveButton: {
    marginTop: 16,
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.45,
  },
  
    confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 20,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },

  confirmTitle: {
    color: "#111111",
    fontSize: 19,
    fontWeight: "800",
  },

  confirmMessage: {
    marginTop: 8,
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
  },

  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  confirmCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  confirmCancelText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },

  confirmUnassignButton: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#111111",
  },

  confirmUnassignText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  searchContainer: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#DDDDDD",
  borderRadius: 10,
  paddingHorizontal: 12,
  minHeight: 48,
  marginBottom: 18,
},

driverSearchContainer: {
  width: "92%",
  alignSelf: "center",
  marginTop: 10,
},

searchIcon: {
  fontSize: 23,
  color: "#666666",
  marginRight: 8,
},

searchInput: {
  flex: 1,
  minWidth: 0,
  paddingVertical: 10,
  fontSize: 14,
  color: "#111111",
},

clearSearchButton: {
  width: 30,
  height: 30,
  alignItems: "center",
  justifyContent: "center",
},

clearSearchText: {
  fontSize: 24,
  color: "#666666",
},

});