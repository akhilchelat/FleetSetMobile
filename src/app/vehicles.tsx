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

const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getToken();
  console.log(
  "VEHICLES TOKEN:",
  token ? "TOKEN EXISTS" : "NO TOKEN"
);

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

type Vehicle = {
  id: string;
  company_id: string;
  branch_id: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  year?: number | null;
  purchase_date?: string | null;
  current_odometer?: number | null;
  status?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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

type VehicleForm = {
  registration_number: string;
  manufacturer: string;
  model: string;
  vehicle_type: string;
  year: string;
  purchase_date: string;
  current_odometer: string;
};

const EMPTY_VEHICLE_FORM: VehicleForm = {
  registration_number: "",
  manufacturer: "",
  model: "",
  vehicle_type: "",
  year: "",
  purchase_date: "",
  current_odometer: "",
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

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inactiveVehicles, setInactiveVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] =
    useState<VehicleForm>(EMPTY_VEHICLE_FORM);
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [driverModalVisible, setDriverModalVisible] = useState(false);
  const [driverAction, setDriverAction] = useState<
    "assign" | "change" | "unassign"
  >("assign");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    null
  );

  const [changeDriverConfirmVisible, setChangeDriverConfirmVisible] = useState(false);
  const [changeDriverTarget, setChangeDriverTarget] = useState<Driver | null>(null);  

  const [assigning, setAssigning] = useState(false);

  const [vehicleActionLoading, setVehicleActionLoading] = useState<
    string | null
  >(null);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarYearPicker, setCalendarYearPicker] = useState(false);

  // Used to know whether the year picker was opened
  // from the Year field or from the calendar header.
  const [yearPickerFromYearField, setYearPickerFromYearField] =
    useState(false);

  type StoredUser = {
    id?: string;
    company_id?: string | null;
    branch_id?: string | null;
    role_name?: string;
  };

  const getStoredUser = async (): Promise<StoredUser | null> => {
    try {
      return await getUser<StoredUser>();
    } catch (error) {
      console.error("Failed to read stored user:", error);
      return null;
    }
  };

  const getCompanyId = async () => {
    const user = await getStoredUser();
    return user?.company_id || null;
  };

  const getBranchId = async () => {
    const user = await getStoredUser();
    return user?.branch_id || null;
  };

  const getErrorMessage = async (response: Response) => {
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
      // Ignore JSON parsing errors.
    }

    return `Request failed with status ${response.status}`;
  };

  const getVehicleArray = (data: any): Vehicle[] => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.vehicles)) {
      return data.vehicles;
    }

    return [];
  };

  const fetchVehicleList = async (
    companyId: string,
    endpoint: string
  ): Promise<Vehicle[]> => {
    const response = await authenticatedFetch(
      `${API_URL}/vehicles/${companyId}/${endpoint}`
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    return getVehicleArray(await response.json());
  };

  const loadVehicles = useCallback(async () => {
    const companyId = await getCompanyId();

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information is missing. Please log in again."
      );
      setLoading(false);
      return;
    }

    try {
      const [
        activeVehicles,
        inactiveVehicleList,
        driversResponse,
        assignmentsResponse,
      ] = await Promise.all([
        fetchVehicleList(companyId, "all"),
        fetchVehicleList(companyId, "inactive"),
        authenticatedFetch(`${API_URL}/drivers/${companyId}`),
        authenticatedFetch(
          `${API_URL}/driver-vehicle-assignments/${companyId}`
        ),
      ]);

      let loadedDrivers: Driver[] = [];

      if (driversResponse.ok) {
        const driverData = await driversResponse.json();

        if (Array.isArray(driverData)) {
          loadedDrivers = driverData;
        } else if (Array.isArray(driverData?.data)) {
          loadedDrivers = driverData.data;
        } else if (Array.isArray(driverData?.drivers)) {
          loadedDrivers = driverData.drivers;
        }
      } else if (driversResponse.status !== 404) {
        throw new Error(await getErrorMessage(driversResponse));
      }

      let loadedAssignments: Assignment[] = [];

      if (assignmentsResponse.ok) {
        const assignmentData = await assignmentsResponse.json();

        if (Array.isArray(assignmentData)) {
          loadedAssignments = assignmentData;
        } else if (Array.isArray(assignmentData?.data)) {
          loadedAssignments = assignmentData.data;
        } else if (Array.isArray(assignmentData?.assignments)) {
          loadedAssignments = assignmentData.assignments;
        }
      } else if (assignmentsResponse.status !== 404) {
        throw new Error(await getErrorMessage(assignmentsResponse));
      }

      setVehicles(activeVehicles);
      setInactiveVehicles(inactiveVehicleList);
      setDrivers(loadedDrivers);
      setAssignments(loadedAssignments);
    } catch (error) {
      console.error("LOAD VEHICLES ERROR:", error);

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

  const getActiveAssignment = (vehicleId: string) => {
    return assignments.find(
      (assignment) =>
        assignment.vehicle_id === vehicleId && assignment.is_active
    );
  };

  const getDriverForVehicle = (vehicleId: string) => {
    const assignment = getActiveAssignment(vehicleId);

    if (!assignment) {
      return null;
    }

    return (
      drivers.find((driver) => driver.id === assignment.driver_id) || null
    );
  };

  /*
   * Only active drivers with no active vehicle assignment
   * are available for Assign and Change.
   */
  const availableDrivers = useMemo(() => {
    const assignedDriverIds = new Set(
      assignments
        .filter((assignment) => assignment.is_active)
        .map((assignment) => assignment.driver_id)
    );

    return drivers.filter(
      (driver) =>
        driver.is_active !== false && !assignedDriverIds.has(driver.id)
    );
  }, [drivers, assignments]);

  const filteredVehicles = vehicles.filter((vehicle) => {
  const query = vehicleSearch.trim().toLowerCase();

  if (!query) return true;

  return [
    vehicle.registration_number,
    vehicle.manufacturer,
    vehicle.model,
    vehicle.vehicle_type,
    vehicle.year?.toString(),
  ].some((value) =>
    value?.toLowerCase().includes(query)
  );
});

  /*
   * VEHICLE MODAL
   */

  const openAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({ ...EMPTY_VEHICLE_FORM });
    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
    setVehicleModalVisible(true);
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);

    setVehicleForm({
      registration_number: vehicle.registration_number || "",
      manufacturer: vehicle.manufacturer || "",
      model: vehicle.model || "",
      vehicle_type: vehicle.vehicle_type || "",
      year: vehicle.year ? String(vehicle.year) : "",
      purchase_date: vehicle.purchase_date
        ? vehicle.purchase_date.substring(0, 10)
        : "",
      current_odometer:
        vehicle.current_odometer !== null &&
        vehicle.current_odometer !== undefined
          ? String(vehicle.current_odometer)
          : "",
    });

    if (vehicle.purchase_date) {
      const parts = vehicle.purchase_date.substring(0, 10).split("-");

      if (parts.length === 3) {
        const date = new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        );

        if (!Number.isNaN(date.getTime())) {
          setCalendarDate(date);
        }
      }
    }

    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
    setVehicleModalVisible(true);
  };

  const closeVehicleModal = () => {
    if (savingVehicle) {
      return;
    }

    setVehicleModalVisible(false);
    setEditingVehicle(null);
    setVehicleForm({ ...EMPTY_VEHICLE_FORM });
    setCalendarVisible(false);
    setCalendarYearPicker(false);
    setYearPickerFromYearField(false);
  };

  const updateVehicleForm = (
    field: keyof VehicleForm,
    value: string
  ) => {
    setVehicleForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateDate = (value: string) => {
    if (!value) {
      return true;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  /*
   * CALENDAR
   */

  const openCalendar = () => {
    const currentValue = vehicleForm.purchase_date;

    if (currentValue && validateDate(currentValue)) {
      const [year, month, day] = currentValue.split("-").map(Number);

      setCalendarDate(new Date(year, month - 1, day));
    } else {
      setCalendarDate(new Date());
    }

    setYearPickerFromYearField(false);
    setCalendarYearPicker(false);
    setCalendarVisible(true);
  };

  const openYearPicker = () => {
    if (vehicleForm.year && Number(vehicleForm.year)) {
      setCalendarDate(
        new Date(
          Number(vehicleForm.year),
          calendarDate.getMonth(),
          1
        )
      );
    }

    setYearPickerFromYearField(true);
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

  const getCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(day);
    }

    return days;
  };

  const selectCalendarDate = (day: number) => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;

    const formatted =
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;

    updateVehicleForm("purchase_date", formatted);
    closeCalendar();
  };

  const vehicleYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let year = currentYear + 1; year >= 1980; year -= 1) {
      years.push(year);
    }

    return years;
  }, []);

  const selectVehicleYear = (year: number) => {
    updateVehicleForm("year", String(year));

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

  /*
   * SAVE VEHICLE
   */

  const saveVehicle = async () => {
    const companyId = await getCompanyId();

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information is missing. Please log in again."
      );
      return;
    }

    const registrationNumber =
      vehicleForm.registration_number.trim().toUpperCase();

    if (!registrationNumber) {
      Alert.alert(
        "Validation Error",
        "Registration number is required."
      );
      return;
    }

    let year: number | null = null;

    if (vehicleForm.year.trim()) {
      year = Number(vehicleForm.year.trim());

      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2100
      ) {
        Alert.alert(
          "Validation Error",
          "Please select a valid vehicle year."
        );
        return;
      }
    }

    const purchaseDate = vehicleForm.purchase_date.trim();

    if (purchaseDate && !validateDate(purchaseDate)) {
      Alert.alert(
        "Validation Error",
        "Please select a valid purchase date."
      );
      return;
    }

    let odometer: number | null = null;

    if (vehicleForm.current_odometer.trim()) {
      odometer = Number(vehicleForm.current_odometer.trim());

      if (!Number.isFinite(odometer) || odometer < 0) {
        Alert.alert(
          "Validation Error",
          "Please enter a valid odometer reading."
        );
        return;
      }
    }

    setSavingVehicle(true);

    try {
      let response: Response;

      if (!editingVehicle) {
        const branchId = await getBranchId();

        if (!branchId) {
          Alert.alert(
            "Branch required",
            "Your account is not assigned to a branch."
          );
          return;
        }

        response = await authenticatedFetch(
          `${API_URL}/vehicles/${companyId}`,
          {
            method: "POST",
            body: JSON.stringify({
              branch_id: branchId,
              registration_number: registrationNumber,
              manufacturer:
                vehicleForm.manufacturer.trim() || null,
              model: vehicleForm.model.trim() || null,
              vehicle_type:
                vehicleForm.vehicle_type.trim() || null,
              year,
              purchase_date: purchaseDate || null,
              current_odometer: odometer,
            }),
          }
        );
      } else {
        response = await authenticatedFetch(
          `${API_URL}/vehicles/${companyId}/${editingVehicle.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              registration_number: registrationNumber,
              manufacturer:
                vehicleForm.manufacturer.trim() || null,
              model: vehicleForm.model.trim() || null,
              vehicle_type:
                vehicleForm.vehicle_type.trim() || null,
              year,
              purchase_date: purchaseDate || null,
              current_odometer: odometer,
            }),
          }
        );
      }

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const wasEditing = Boolean(editingVehicle);

      closeVehicleModal();
      await loadVehicles();

      Alert.alert(
        "Success",
        wasEditing
          ? "Vehicle updated successfully."
          : "Vehicle added successfully."
      );
    } catch (error) {
      console.error("SAVE VEHICLE ERROR:", error);

      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to save vehicle."
      );
    } finally {
      setSavingVehicle(false);
    }
  };

  /*
   * ACTIVATE
   */

  const activateVehicle = async (vehicle: Vehicle) => {
    const companyId = await getCompanyId();

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information is missing. Please log in again."
      );
      return;
    }

    if (vehicle.is_active) {
      Alert.alert(
        "Already Active",
        "This vehicle is already active."
      );
      return;
    }

    setVehicleActionLoading(vehicle.id);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/vehicles/${companyId}/${vehicle.id}/activate`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const message = await getErrorMessage(response);
        throw new Error(message);
      }

      await loadVehicles();

      Alert.alert(
        "Success",
        `${vehicle.registration_number} has been activated successfully.`
      );
    } catch (error) {
      console.error("ACTIVATE VEHICLE ERROR:", error);

      Alert.alert(
        "Activation Failed",
        error instanceof Error
          ? error.message
          : "Failed to activate vehicle."
      );
    } finally {
      setVehicleActionLoading(null);
    }
  };

  /*
   * DEACTIVATE
   */

  const deactivateVehicle = async (vehicle: Vehicle) => {
    const companyId = await getCompanyId();

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information is missing. Please log in again."
      );
      return;
    }

    const driver = getDriverForVehicle(vehicle.id);

    if (driver) {
      Alert.alert(
        "Driver Assigned",
        `This vehicle is currently assigned to ${driver.first_name} ${driver.last_name}. Please unassign the driver first.`
      );
      return;
    }

    setVehicleActionLoading(vehicle.id);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/vehicles/${companyId}/${vehicle.id}/deactivate`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadVehicles();

      Alert.alert(
        "Success",
        "Vehicle deactivated successfully."
      );
    } catch (error) {
      console.error("DEACTIVATE VEHICLE ERROR:", error);

      Alert.alert(
        "Deactivate Failed",
        error instanceof Error
          ? error.message
          : "Failed to deactivate vehicle."
      );
    } finally {
      setVehicleActionLoading(null);
    }
  };

  /*
   * DRIVER MODAL
   */

  const openDriverModal = (
    vehicle: Vehicle,
    action: "assign" | "change" | "unassign"
  ) => {
    setSelectedVehicle(vehicle);
    setDriverAction(action);
    setSelectedDriverId(null);
    setDriverModalVisible(true);
  };

  const closeDriverModal = (force = false) => {
    if (assigning && !force) {
      return;
    }

    setDriverModalVisible(false);
    setSelectedVehicle(null);
    setSelectedDriverId(null);
  };

  /*
   * ASSIGN DRIVER
   */

  const assignDriver = async () => {
    if (!selectedVehicle || !selectedDriverId) {
      Alert.alert(
        "Select Driver",
        "Please select an available driver first."
      );
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
      (driver) => driver.id === selectedDriverId
    );

    if (!selectedDriver) {
      Alert.alert(
        "Error",
        "The selected driver is no longer available."
      );
      return;
    }

    const alreadyAssigned = assignments.some(
      (assignment) =>
        assignment.driver_id === selectedDriverId &&
        assignment.is_active
    );

    if (alreadyAssigned) {
      Alert.alert(
        "Driver Already Assigned",
        "This driver already has an active vehicle assignment."
      );
      return;
    }

    setAssigning(true);

    try {
      console.log("ASSIGN DRIVER URL:", `${API_URL}/driver-vehicle-assignments/${companyId}`);
console.log("ASSIGN DRIVER DATA:", {
  driver_id: selectedDriverId,
  vehicle_id: selectedVehicle.id,
});
      const response = await authenticatedFetch(
        `${API_URL}/driver-vehicle-assignments/${companyId}`,
        {
          method: "POST",
          body: JSON.stringify({
            driver_id: selectedDriverId,
            vehicle_id: selectedVehicle.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadVehicles();

      closeDriverModal(true);

      Alert.alert(
        "Success",
        "Driver assigned successfully."
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

  /*
   * UNASSIGN DRIVER
   */

  const performUnassignDriver = async () => {
    console.log("UNASSIGN DRIVER BUTTON PRESSED");
    if (!selectedVehicle) {
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

    const currentAssignment = getActiveAssignment(
      selectedVehicle.id
    );

    if (!currentAssignment) {
      Alert.alert(
        "No Assignment",
        "This vehicle does not have an active driver assignment."
      );
      return;
    }

    setAssigning(true);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/driver-vehicle-assignments/${companyId}/${currentAssignment.id}/unassign`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadVehicles();

      closeDriverModal(true);

      Alert.alert(
        "Success",
        "Driver unassigned successfully."
      );
    } catch (error) {
      console.error("UNASSIGN DRIVER ERROR:", error);

      Alert.alert(
        "Unassign Failed",
        error instanceof Error
          ? error.message
          : "Failed to unassign driver."
      );
    } finally {
      setAssigning(false);
    }
  };

  const confirmUnassignDriver = () => {
  console.log("CONFIRM UNASSIGN BUTTON PRESSED");

  if (!selectedVehicle) {
    return;
  }

  const driver = getDriverForVehicle(selectedVehicle.id);

  if (!driver) {
    Alert.alert(
      "No Driver",
      "This vehicle does not have an assigned driver."
    );
    return;
  }

  performUnassignDriver();
};

  /*
   * CHANGE DRIVER
   */

  const changeDriver = async () => {
  if (!selectedVehicle || !selectedDriverId) {
    Alert.alert(
      "Select Driver",
      "Please select an available driver first."
    );
    return;
  }

  const currentAssignment = getActiveAssignment(
    selectedVehicle.id
  );

  if (!currentAssignment) {
    Alert.alert(
      "No Current Driver",
      "This vehicle has no current driver. Use Assign Driver instead."
    );
    return;
  }

  const newDriver = drivers.find(
    (driver) => driver.id === selectedDriverId
  );

  if (!newDriver) {
    Alert.alert(
      "Error",
      "The selected driver is no longer available."
    );
    return;
  }

  const alreadyAssigned = assignments.some(
    (assignment) =>
      assignment.driver_id === selectedDriverId &&
      assignment.is_active
  );

  if (alreadyAssigned) {
    Alert.alert(
      "Driver Already Assigned",
      "This driver already has an active vehicle assignment."
    );
    return;
  }

  setChangeDriverTarget(newDriver);
  setChangeDriverConfirmVisible(true);
};

  const confirmChangeDriver = async () => {
  if (
    !selectedVehicle ||
    !changeDriverTarget
  ) {
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

  const currentAssignment = getActiveAssignment(
    selectedVehicle.id
  );

  if (!currentAssignment) {
    Alert.alert(
      "No Current Driver",
      "This vehicle has no current driver."
    );
    return;
  }

  try {
    setAssigning(true);

    const unassignResponse =
      await authenticatedFetch(
        `${API_URL}/driver-vehicle-assignments/${companyId}/${currentAssignment.id}/unassign`,
        {
          method: "PATCH",
        }
      );

    if (!unassignResponse.ok) {
      throw new Error(
        await getErrorMessage(unassignResponse)
      );
    }

    const assignResponse =
      await authenticatedFetch(
        `${API_URL}/driver-vehicle-assignments/${companyId}`,
        {
          method: "POST",
          body: JSON.stringify({
            driver_id: changeDriverTarget.id,
            vehicle_id: selectedVehicle.id,
          }),
        }
      );

    if (!assignResponse.ok) {
      throw new Error(
        await getErrorMessage(assignResponse)
      );
    }

    setChangeDriverConfirmVisible(false);
    setChangeDriverTarget(null);

    await loadVehicles();

    closeDriverModal(true);

    Alert.alert(
      "Success",
      "Driver changed successfully."
    );
  } catch (error) {
    console.error(
      "CHANGE DRIVER ERROR:",
      error
    );

    Alert.alert(
      "Change Driver Failed",
      error instanceof Error
        ? error.message
        : "Failed to change driver."
    );
  } finally {
    setAssigning(false);
  }
};

  /*
   * LOADING
   */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#111111"
        />

        <Text style={styles.loadingText}>
          Loading vehicles...
        </Text>
      </View>
    );
  }

  const activeCount = vehicles.length;
  const inactiveCount = inactiveVehicles.length;
  const totalCount = activeCount + inactiveCount;

  /*
   * VEHICLE CARD
   */

  const renderVehicleCard = (
    vehicle: Vehicle,
    inactive = false
  ) => {
    const driver = getDriverForVehicle(vehicle.id);

    const actionLoading =
      vehicleActionLoading === vehicle.id;

    return (
      <View
        key={vehicle.id}
        style={styles.vehicleCard}
      >
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleHeaderLeft}>
            <Text style={styles.registrationNumber}>
              {vehicle.registration_number}
            </Text>

            <Text style={styles.vehicleName}>
              {[vehicle.manufacturer, vehicle.model]
                .filter(Boolean)
                .join(" ") || "Vehicle"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              inactive
                ? styles.inactiveBadge
                : styles.activeBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                inactive
                  ? styles.inactiveStatusText
                  : styles.activeStatusText,
              ]}
            >
              {inactive ? "Inactive" : "Active"}
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          {vehicle.vehicle_type ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                Type
              </Text>

              <Text style={styles.detailValue}>
                {vehicle.vehicle_type}
              </Text>
            </View>
          ) : null}

          {vehicle.year ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                Year
              </Text>

              <Text style={styles.detailValue}>
                {vehicle.year}
              </Text>
            </View>
          ) : null}

          {vehicle.current_odometer !== null &&
          vehicle.current_odometer !== undefined ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>
                Odometer
              </Text>

              <Text style={styles.detailValue}>
                {vehicle.current_odometer.toLocaleString()} km
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.driverSection}>
          <Text style={styles.driverLabel}>
            Driver
          </Text>

          {driver ? (
            <Text style={styles.driverName}>
              {driver.first_name} {driver.last_name}
            </Text>
          ) : (
            <Text style={styles.noDriverText}>
              No driver assigned
            </Text>
          )}
        </View>

        {!inactive ? (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  openEditVehicle(vehicle)
                }
                disabled={actionLoading}
              >
                <Text style={styles.secondaryButtonText}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  styles.dangerButton,
                ]}
                onPress={() =>
                  deactivateVehicle(vehicle)
                }
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#111111"
                  />
                ) : (
                  <Text style={styles.dangerButtonText}>
                    Deactivate
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.driverActionsRow}>
              {!driver ? (
                <TouchableOpacity
                  style={styles.driverActionButton}
                  onPress={() =>
                    openDriverModal(
                      vehicle,
                      "assign"
                    )
                  }
                >
                  <Text style={styles.driverActionButtonText}>
                    + Assign Driver
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.driverActionButton}
                    onPress={() =>
                      openDriverModal(
                        vehicle,
                        "change"
                      )
                    }
                  >
                    <Text style={styles.driverActionButtonText}>
                      Change Driver
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.driverActionButton,
                      styles.unassignDriverButton,
                    ]}
                    onPress={() =>
                      openDriverModal(
                        vehicle,
                        "unassign"
                      )
                    }
                  >
                    <Text
                      style={
                        styles.unassignDriverButtonText
                      }
                    >
                      Unassign
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                openEditVehicle(vehicle)
              }
              disabled={actionLoading}
            >
              <Text style={styles.secondaryButtonText}>
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primarySmallButton,
                actionLoading &&
                  styles.disabledButton,
              ]}
              onPress={() =>
                activateVehicle(vehicle)
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.primarySmallButtonText}>
                  Activate
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const calendarDays = getCalendarDays();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>
              Vehicles
            </Text>

            <Text style={styles.pageSubtitle}>
              Manage your fleet vehicles
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={openAddVehicle}
          >
            <Text style={styles.addButtonText}>
              + Add
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {totalCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Total
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {activeCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Active
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {inactiveCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Inactive
            </Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
  <Text style={styles.searchIcon}>⌕</Text>

  <TextInput
    style={[
  styles.searchInput,
  { outlineStyle: "none" } as any,
]}
    placeholder="Search registration, make, model..."
    placeholderTextColor="#999999"
    value={vehicleSearch}
    onChangeText={setVehicleSearch}
    autoCapitalize="none"
    autoCorrect={false}
    clearButtonMode="while-editing"
  />

  {vehicleSearch.length > 0 && (
    <TouchableOpacity
      onPress={() => setVehicleSearch("")}
      style={styles.clearSearchButton}
    >
      <Text style={styles.clearSearchText}>×</Text>
    </TouchableOpacity>
  )}
</View>
        <Text style={styles.sectionTitle}>
          Active Vehicles
        </Text>

        {filteredVehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              No active vehicles
            </Text>

            <Text style={styles.emptyText}>
              Add your first vehicle to get started.
            </Text>

            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={openAddVehicle}
            >
              <Text style={styles.emptyAddButtonText}>
                Add Vehicle
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredVehicles.map((vehicle) =>
  renderVehicleCard(vehicle)
)
        )}

        {inactiveVehicles.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                styles.inactiveSectionTitle,
              ]}
            >
              Inactive Vehicles
            </Text>

            {inactiveVehicles.map((vehicle) =>
              renderVehicleCard(vehicle, true)
            )}
          </>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* ADD / EDIT VEHICLE */}

      <Modal
        visible={vehicleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeVehicleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.vehicleModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingVehicle
                    ? "Edit Vehicle"
                    : "Add Vehicle"}
                </Text>

                <Text style={styles.modalSubtitle}>
                  {editingVehicle
                    ? "Update vehicle information"
                    : "Enter vehicle information"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeVehicleModal}
                disabled={savingVehicle}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>
                Registration Number *
              </Text>

              <TextInput
                style={styles.input}
                value={vehicleForm.registration_number}
                onChangeText={(value) =>
                  updateVehicleForm(
                    "registration_number",
                    value
                  )
                }
                autoCapitalize="characters"
                editable={!savingVehicle}
              />

              <Text style={styles.inputLabel}>
                Manufacturer
              </Text>

              <TextInput
                style={styles.input}
                value={vehicleForm.manufacturer}
                onChangeText={(value) =>
                  updateVehicleForm(
                    "manufacturer",
                    value
                  )
                }
                editable={!savingVehicle}
              />

              <Text style={styles.inputLabel}>
                Model
              </Text>

              <TextInput
                style={styles.input}
                value={vehicleForm.model}
                onChangeText={(value) =>
                  updateVehicleForm(
                    "model",
                    value
                  )
                }
                editable={!savingVehicle}
              />

              <Text style={styles.inputLabel}>
                Vehicle Type
              </Text>

              <TextInput
                style={styles.input}
                value={vehicleForm.vehicle_type}
                onChangeText={(value) =>
                  updateVehicleForm(
                    "vehicle_type",
                    value
                  )
                }
                editable={!savingVehicle}
              />

              <Text style={styles.inputLabel}>
                Year
              </Text>

              <TouchableOpacity
                style={styles.selectorInput}
                onPress={openYearPicker}
                disabled={savingVehicle}
              >
                <Text
                  style={[
                    styles.selectorText,
                    !vehicleForm.year &&
                      styles.placeholderText,
                  ]}
                >
                  {vehicleForm.year ||
                    "Select vehicle year"}
                </Text>

                <Text style={styles.selectorIcon}>
                  ▾
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>
                Purchase Date
              </Text>

              <TouchableOpacity
                style={styles.selectorInput}
                onPress={openCalendar}
                disabled={savingVehicle}
              >
                <Text
                  style={[
                    styles.selectorText,
                    !vehicleForm.purchase_date &&
                      styles.placeholderText,
                  ]}
                >
                  {vehicleForm.purchase_date ||
                    "Select purchase date"}
                </Text>

                <Text style={styles.calendarIcon}>
                  ▣
                </Text>
              </TouchableOpacity>

              <Text style={styles.helperText}>
                Select the purchase date from the calendar.
              </Text>

              <Text style={styles.inputLabel}>
                Current Odometer
              </Text>

              <TextInput
                style={styles.input}
                value={vehicleForm.current_odometer}
                onChangeText={(value) =>
                  updateVehicleForm(
                    "current_odometer",
                    value
                  )
                }
                keyboardType="decimal-pad"
                editable={!savingVehicle}
              />

              <Text style={styles.helperText}>
                Enter the current odometer reading in
                kilometres.
              </Text>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  savingVehicle &&
                    styles.disabledButton,
                ]}
                onPress={saveVehicle}
                disabled={savingVehicle}
              >
                {savingVehicle ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingVehicle
                      ? "Update Vehicle"
                      : "Add Vehicle"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeVehicleModal}
                disabled={savingVehicle}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <View style={styles.modalBottomSpace} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CALENDAR / YEAR PICKER */}

      <Modal
        visible={calendarVisible}
        animationType="fade"
        transparent
        onRequestClose={closeCalendar}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.calendarModal}>
            {calendarYearPicker ? (
              <>
                <View style={styles.calendarPickerHeader}>
                  <View>
                    <Text style={styles.calendarPickerTitle}>
                      Select Year
                    </Text>

                    <Text style={styles.calendarPickerSubtitle}>
                      Choose the vehicle year
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeCalendar}
                  >
                    <Text style={styles.closeButtonText}>
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.calendarYearList}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.calendarYearGrid}>
                    {vehicleYears.map((year) => {
                      const selected =
                        vehicleForm.year === String(year);

                      return (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.calendarYearOption,
                            selected &&
                              styles.calendarYearOptionSelected,
                          ]}
                          onPress={() =>
                            selectVehicleYear(year)
                          }
                        >
                          <Text
                            style={[
                              styles.calendarYearOptionText,
                              selected &&
                                styles.calendarYearOptionTextSelected,
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
                    onPress={() =>
                      moveCalendarMonth(-1)
                    }
                  >
                    <Text style={styles.monthArrowText}>
                      ‹
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.calendarTitleContainer}
                    onPress={() =>
                      setCalendarYearPicker(true)
                    }
                  >
                    <Text style={styles.calendarMonth}>
                      {MONTH_NAMES[
                        calendarDate.getMonth()
                      ]}
                    </Text>

                    <View
                      style={
                        styles.calendarYearSelector
                      }
                    >
                      <Text style={styles.calendarYear}>
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
                    style={styles.monthArrow}
                    onPress={() =>
                      moveCalendarMonth(1)
                    }
                  >
                    <Text style={styles.monthArrowText}>
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.calendarYearHint}>
                  Tap the year to select a different year.
                </Text>

                <View style={styles.weekRow}>
                  {WEEK_DAYS.map((day) => (
                    <Text
                      key={day}
                      style={styles.weekDay}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarDays.map((day, index) =>
                    day === null ? (
                      <View
                        key={`empty-${index}`}
                        style={styles.calendarDay}
                      />
                    ) : (
                      <TouchableOpacity
                        key={`${calendarDate.getFullYear()}-${calendarDate.getMonth()}-${day}`}
                        style={styles.calendarDay}
                        onPress={() =>
                          selectCalendarDate(day)
                        }
                      >
                        <Text
                          style={styles.calendarDayText}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
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

      {/* DRIVER ASSIGNMENT */}

      <Modal
        visible={driverModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => closeDriverModal()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.driverModal}>
            <View style={styles.modalHeader}>
              <View style={styles.driverModalHeaderContent}>
                <Text style={styles.modalTitle}>
                  {driverAction === "assign"
                    ? "Assign Driver"
                    : driverAction === "change"
                    ? "Change Driver"
                    : "Unassign Driver"}
                </Text>

                {selectedVehicle ? (
                  <Text style={styles.modalSubtitle}>
                    {selectedVehicle.registration_number}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => closeDriverModal()}
                disabled={assigning}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            {selectedVehicle &&
            getDriverForVehicle(
              selectedVehicle.id
            ) ? (
              <View style={styles.currentDriverBox}>
                <Text style={styles.currentDriverLabel}>
                  Current Driver
                </Text>

                <Text style={styles.currentDriverName}>
                  {
                    getDriverForVehicle(
                      selectedVehicle.id
                    )?.first_name
                  }{" "}
                  {
                    getDriverForVehicle(
                      selectedVehicle.id
                    )?.last_name
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.noCurrentDriverBox}>
                <Text style={styles.noCurrentDriverText}>
                  No driver currently assigned
                </Text>
              </View>
            )}

            {driverAction === "unassign" ? (
              <View style={styles.unassignInfoBox}>
                <Text style={styles.unassignInfoTitle}>
                  Remove current driver?
                </Text>

                <Text style={styles.unassignInfoText}>
                  The driver will become available for
                  another vehicle after this assignment
                  is removed.
                </Text>

                <TouchableOpacity
                  style={styles.confirmUnassignButton}
                  onPress={confirmUnassignDriver}
                  disabled={assigning}
                >
                  {assigning ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.confirmUnassignButtonText
                      }
                    >
                      Unassign Driver
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.driverListTitle}>
                  Available Drivers
                </Text>

                <Text style={styles.availableDriverHint}>
                  Only active drivers without an active
                  vehicle assignment are shown.
                </Text>

                <ScrollView
                  style={styles.driverList}
                  showsVerticalScrollIndicator={false}
                >
                  {availableDrivers.length === 0 ? (
                    <View style={styles.noDriversBox}>
                      <Text style={styles.noDriversTitle}>
                        No drivers available
                      </Text>

                      <Text style={styles.noDriversText}>
                        All active drivers are currently
                        assigned to vehicles.
                      </Text>
                    </View>
                  ) : (
                    availableDrivers.map((driver) => {
                      const isSelected =
                        selectedDriverId === driver.id;

                      return (
                        <TouchableOpacity
                          key={driver.id}
                          style={[
                            styles.driverOption,
                            isSelected &&
                              styles.selectedDriverOption,
                          ]}
                          onPress={() =>
                            setSelectedDriverId(
                              driver.id
                            )
                          }
                          disabled={assigning}
                        >
                          <View
                            style={[
                              styles.radioOuter,
                              isSelected &&
                                styles.radioOuterSelected,
                            ]}
                          >
                            {isSelected ? (
                              <View
                                style={
                                  styles.radioInner
                                }
                              />
                            ) : null}
                          </View>

                          <View
                            style={
                              styles.driverOptionContent
                            }
                          >
                            <Text
                              style={
                                styles.driverOptionName
                              }
                            >
                              {driver.first_name}{" "}
                              {driver.last_name}
                            </Text>

                            {driver.phone ? (
                              <Text
                                style={
                                  styles.driverOptionDetail
                                }
                              >
                                {driver.phone}
                              </Text>
                            ) : null}

                            {driver.license_number ? (
                              <Text
                                style={
                                  styles.driverOptionDetail
                                }
                              >
                                License:{" "}
                                {driver.license_number}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                <View style={styles.driverModalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() =>
                      closeDriverModal()
                    }
                    disabled={assigning}
                  >
                    <Text style={styles.cancelButtonText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.assignButton,
                      (!selectedDriverId ||
                        assigning) &&
                        styles.disabledButton,
                    ]}
                    onPress={
                      driverAction === "assign"
                        ? assignDriver
                        : changeDriver
                    }
                    disabled={
                      !selectedDriverId || assigning
                    }
                  >
                    {assigning ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text style={styles.assignButtonText}>
                        {driverAction === "assign"
                          ? "Assign Driver"
                          : "Change Driver"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
            
      {/* =====================================================
          CHANGE DRIVER CONFIRMATION
          ===================================================== */}

      <Modal
        visible={changeDriverConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!assigning) {
            setChangeDriverConfirmVisible(false);
            setChangeDriverTarget(null);
          }
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              Change Driver?
            </Text>

            {selectedVehicle && changeDriverTarget ? (
              <Text style={styles.confirmMessage}>
                {`Change the driver of ${selectedVehicle.registration_number} to ${changeDriverTarget.first_name} ${changeDriverTarget.last_name || ""}?`}
              </Text>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  if (!assigning) {
                    setChangeDriverConfirmVisible(false);
                    setChangeDriverTarget(null);
                  }
                }}
                disabled={assigning}
              >
                <Text style={styles.confirmCancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
  style={styles.confirmChangeButton}
  onPress={confirmChangeDriver}
  disabled={assigning}
>
                {assigning ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.confirmUnassignText}>
                    Change Driver
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
  },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666666",
  },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: "center",
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111111",
  },

  summaryLabel: {
    marginTop: 3,
    fontSize: 12,
    color: "#666666",
    fontWeight: "500",
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 12,
  },

  inactiveSectionTitle: {
    marginTop: 16,
  },

  vehicleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 16,
    marginBottom: 12,
  },

  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  vehicleHeaderLeft: {
    flex: 1,
    paddingRight: 10,
  },

  registrationNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 0.3,
  },

  vehicleName: {
    marginTop: 4,
    fontSize: 14,
    color: "#666666",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
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

  activeStatusText: {
    color: "#111111",
  },

  inactiveStatusText: {
    color: "#666666",
  },

  detailsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 13,
  },

  detailItem: {
    width: "33.33%",
    marginBottom: 8,
  },

  detailLabel: {
    fontSize: 11,
    color: "#999999",
    marginBottom: 3,
  },

  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },

  driverSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },

  driverLabel: {
    fontSize: 11,
    color: "#999999",
    marginBottom: 3,
  },

  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },

  noDriverText: {
    fontSize: 14,
    color: "#999999",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },

  dangerButton: {
    backgroundColor: "#F7F7F7",
  },

  dangerButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },

  primarySmallButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  primarySmallButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  driverActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  driverActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  driverActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  unassignDriverButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#111111",
  },

  unassignDriverButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 24,
    alignItems: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
  },

  emptyAddButton: {
    marginTop: 16,
    backgroundColor: "#111111",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },

  emptyAddButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  bottomSpace: {
    height: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  centerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  vehicleModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "92%",
  },

  driverModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "88%",
  },

  calendarModal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111111",
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#666666",
  },

  driverModalHeaderContent: {
    flex: 1,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonText: {
    fontSize: 25,
    lineHeight: 27,
    color: "#111111",
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 7,
    marginTop: 10,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: "#FFFFFF",
    color: "#111111",
    fontSize: 14,
  },

  selectorInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectorText: {
    color: "#111111",
    fontSize: 14,
  },

  placeholderText: {
    color: "#999999",
  },

  selectorIcon: {
    fontSize: 18,
    color: "#111111",
  },

  calendarIcon: {
    fontSize: 18,
    color: "#111111",
  },

  helperText: {
    marginTop: 5,
    fontSize: 11,
    color: "#999999",
  },

  saveButton: {
    height: 48,
    marginTop: 22,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  cancelButtonText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.5,
  },

  modalBottomSpace: {
    height: 20,
  },

  /*
   * CALENDAR
   */

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

  /*
   * YEAR PICKER
   */

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

    confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    padding: 20,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
  },

  confirmTitle: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  confirmMessage: {
    marginTop: 10,
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  confirmCancelButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  confirmCancelText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },

  confirmUnassignText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  confirmChangeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * DRIVER
   */

  currentDriverBox: {
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 13,
    marginBottom: 16,
  },

  currentDriverLabel: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 4,
  },

  currentDriverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },

  noCurrentDriverBox: {
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 13,
    marginBottom: 16,
  },

  noCurrentDriverText: {
    fontSize: 13,
    color: "#666666",
  },

  driverListTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 4,
  },

  availableDriverHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "#777777",
    marginBottom: 10,
  },

  driverList: {
    maxHeight: 320,
  },

  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },

  selectedDriverOption: {
    borderColor: "#111111",
    backgroundColor: "#F7F8FA",
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BBBBBB",
    alignItems: "center",
    justifyContent: "center",
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

  driverOptionContent: {
    flex: 1,
    marginLeft: 11,
  },

  driverOptionName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111111",
  },

  driverOptionDetail: {
    marginTop: 2,
    fontSize: 11,
    color: "#666666",
  },

  noDriversBox: {
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    alignItems: "center",
  },

  noDriversTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111111",
    textAlign: "center",
  },

  noDriversText: {
    marginTop: 5,
    color: "#666666",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },

  unassignInfoBox: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    padding: 15,
  },

  unassignInfoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },

  unassignInfoText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#666666",
  },

  confirmUnassignButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },

  confirmUnassignButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  driverModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },

  assignButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  assignButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
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