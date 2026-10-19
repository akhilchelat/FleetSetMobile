import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getUser } from "../utils/storage";
import { useFocusEffect } from "expo-router";

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "../services/api";

type Vehicle = {
  id: string;
  registration_number?: string;
  registrationNumber?: string;
  manufacturer?: string;
  make?: string;
  model?: string;
  branch_id?: string;
};

type MaintenanceRecord = {
  id: string;
  company_id: string;
  branch_id: string;
  vehicle_id: string;
  recorded_by: string;
  maintenance_type: string;
  status?: "PENDING" | "COMPLETED" | string | null;
  description?: string | null;
  garage_name?: string | null;
  invoice_number?: string | null;
  cost: number | string;
  service_date: string;
  next_service_date?: string | null;
  odometer_reading?: number | null;
  remarks?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type UserData = {
  id?: string;
  company_id?: string;
  branch_id?: string;
  role?: string;
  role_name?: string;
};

type MaintenanceForm = {
  vehicleId: string;
  maintenanceType: string;
  description: string;
  garageName: string;
  invoiceNumber: string;
  cost: string;
  serviceDate: string;
  nextServiceDate: string;
  odometerReading: string;
  remarks: string;
};

type CalendarTarget = "service" | "nextService";

const MAINTENANCE_TYPES = [
  { value: "engine_oil", label: "Engine Oil" },
  { value: "oil_filter", label: "Oil Filter" },
  { value: "air_filter", label: "Air Filter" },
  { value: "fuel_filter", label: "Fuel Filter" },
  { value: "brake_service", label: "Brake Service" },
  { value: "tyre_change", label: "Tyre Change" },
  { value: "wheel_alignment", label: "Wheel Alignment" },
  { value: "wheel_balancing", label: "Wheel Balancing" },
  { value: "battery_replacement", label: "Battery Replacement" },
  { value: "clutch_replacement", label: "Clutch Replacement" },
  { value: "gearbox_service", label: "Gearbox Service" },
  { value: "engine_repair", label: "Engine Repair" },
  { value: "coolant_service", label: "Coolant Service" },
  { value: "suspension_service", label: "Suspension Service" },
  { value: "electrical_repair", label: "Electrical Repair" },
  { value: "ac_service", label: "AC Service" },
  { value: "general_service", label: "General Service" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
];

const emptyForm: MaintenanceForm = {
  vehicleId: "",
  maintenanceType: "general_service",
  description: "",
  garageName: "",
  invoiceNumber: "",
  cost: "",
  serviceDate: "",
  nextServiceDate: "",
  odometerReading: "",
  remarks: "",
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "—";

  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatCurrency(value: number | string) {
  const number = Number(value || 0);

  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTodayString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateDifferenceInDays(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(`${dateString}T00:00:00`);
  targetDate.setHours(0, 0, 0, 0);

  const difference =
    targetDate.getTime() - today.getTime();

  return Math.round(
    difference / (1000 * 60 * 60 * 24)
  );
}

function getRegistrationNumber(vehicle?: Vehicle) {
  if (!vehicle) return "Unknown Vehicle";

  return (
    vehicle.registration_number ||
    vehicle.registrationNumber ||
    "Unknown Vehicle"
  );
}

function getMaintenanceLabel(value: string) {
  return (
    MAINTENANCE_TYPES.find((item) => item.value === value)?.label ||
    value.replace(/_/g, " ")
  );
}

function parseApiArray<T>(response: any): T[] {
  console.log("PARSING VEHICLE RESPONSE:", response);

  if (Array.isArray(response)) {
    console.log("RESPONSE IS ARRAY:", response.length);
    return response;
  }

  if (response?.data) {
    if (Array.isArray(response.data)) {
      console.log("DATA IS ARRAY:", response.data.length);
      return response.data;
    }

    if (Array.isArray(response.data?.vehicles)) {
      console.log(
        "DATA.VEHICLES IS ARRAY:",
        response.data.vehicles.length
      );
      return response.data.vehicles;
    }

    if (response.data?.id) {
      console.log("DATA IS SINGLE VEHICLE");
      return [response.data];
    }
  }

  if (Array.isArray(response?.vehicles)) {
    console.log("VEHICLES IS ARRAY:", response.vehicles.length);
    return response.vehicles;
  }

  if (response?.id) {
    console.log("RESPONSE IS SINGLE VEHICLE");
    return [response];
  }

  console.log("NO VEHICLES FOUND IN RESPONSE");
  return [];
}

export default function VehicleMaintenanceScreen() {
  console.log("🔥 MAINTENANCE SCREEN RENDERING");
  const [user, setUser] = useState<UserData | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [deleteRecord, setDeleteRecord] =
  useState<MaintenanceRecord | null>(null);
  
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);

  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [activeVehicles, setActiveVehicles] = useState<Vehicle[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editingRecord, setEditingRecord] =
    useState<MaintenanceRecord | null>(null);

  const [form, setForm] = useState<MaintenanceForm>(emptyForm);

  
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const [calendarTarget, setCalendarTarget] =
    useState<CalendarTarget | null>(null);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarYearPicker, setCalendarYearPicker] = useState(false);

  const companyId = user?.company_id;

  const roleName =
    user?.role_name ||
    user?.role ||
    "";

  const canManage =
    roleName === "GLOBAL_ADMIN" ||
    roleName === "SUPER_ADMIN" ||
    roleName === "BRANCH_ADMIN";

  const loadUser = useCallback(async () => {
  try {
    const parsed = await getUser();

    if (!parsed) {
      console.log("No logged-in user found.");
      return;
    }

    console.log("Maintenance screen user:", parsed);

    setUser(parsed);
  } catch (error) {
    console.error("Failed to load FleetSet user:", error);
  }
}, []);

  const loadData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);

    try {
      const vehicleResponse = await apiGet(`/vehicles/${companyId}/all`);

console.log("MAINTENANCE VEHICLE RESPONSE:", vehicleResponse);

const loadedVehicles = parseApiArray<Vehicle>(vehicleResponse);

console.log(
  "MAINTENANCE LOADED VEHICLES:",
  loadedVehicles
);

console.log(
  "MAINTENANCE LOADED VEHICLE COUNT:",
  loadedVehicles.length
);

setVehicles(loadedVehicles);
setActiveVehicles(loadedVehicles);

      const maintenanceResponse = await apiGet(
        `/maintenance/${companyId}/all`
      );

      setRecords(
        parseApiArray<MaintenanceRecord>(
          maintenanceResponse
        )
      );
    } catch (error: any) {
      console.error(
        "Maintenance loading error:",
        error
      );

      const message =
        error?.message ||
        "Unable to load maintenance records.";

      if (
        !message
          .toLowerCase()
          .includes("404") &&
        !message
          .toLowerCase()
          .includes("not found")
      ) {
        Alert.alert(
          "Error",
          message
        );
      }

      setVehicles([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, loadData]);

  useFocusEffect(
    useCallback(() => {
      if (companyId) {
        loadData();
      }
    }, [companyId, loadData])
  );

  const vehicleMap = useMemo(() => {
    console.log("MAINTENANCE VEHICLES STATE:", vehicles);
    const map: Record<string, Vehicle> = {};

    vehicles.forEach((vehicle) => {
      map[vehicle.id] = vehicle;
    });

    return map;
  }, [vehicles]);

  const activeRecords = useMemo(
    () => records.filter((record) => record.is_active),
    [records]
  );

  const inactiveRecords = useMemo(
    () => records.filter((record) => !record.is_active),
    [records]
  );

    const upcomingMaintenance = useMemo(() => {
    return activeRecords
      .filter((record) => {
        const status = String(record.status ?? "PENDING")
          .trim()
          .toUpperCase();

        if (status === "COMPLETED") {
          return false;
        }

        if (!record.next_service_date) {
          return false;
        }

        const daysUntil = getDateDifferenceInDays(
          record.next_service_date
        );

        return daysUntil <= 7;
      })
      .sort((a, b) => {
        const dateA = new Date(
          `${a.next_service_date}T00:00:00`
        ).getTime();

        const dateB = new Date(
          `${b.next_service_date}T00:00:00`
        ).getTime();

        return dateA - dateB;
      });
  }, [activeRecords]);
  
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeRecords.filter((record) => {
      const vehicle = vehicleMap[record.vehicle_id];

      const registration =
        getRegistrationNumber(vehicle).toLowerCase();

      const maintenanceType =
        getMaintenanceLabel(
          record.maintenance_type
        ).toLowerCase();

      const garage =
        record.garage_name?.toLowerCase() || "";

      const invoice =
        record.invoice_number?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        registration.includes(query) ||
        maintenanceType.includes(query) ||
        garage.includes(query) ||
        invoice.includes(query);

      const matchesType =
        typeFilter === "all" ||
        record.maintenance_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [
    activeRecords,
    search,
    typeFilter,
    vehicleMap,
  ]);

  const totalCost = useMemo(() => {
    return activeRecords.reduce(
      (total, record) =>
        total + Number(record.cost || 0),
      0
    );
  }, [activeRecords]);

  const vehicleCount = useMemo(() => {
    return new Set(
      activeRecords.map(
        (record) => record.vehicle_id
      )
    ).size;
  }, [activeRecords]);

  const openAddModal = () => {
    setEditingRecord(null);

    setForm({
      ...emptyForm,
      vehicleId: "",
      serviceDate: getTodayString(),
    });

    setShowVehiclePicker(false);
    setShowTypePicker(false);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (saving) return;

    setShowAddModal(false);
    setForm(emptyForm);
    setShowTypePicker(false);
    setShowVehiclePicker(false);
    setCalendarTarget(null);
    setCalendarYearPicker(false);
  };

  const openEditModal = (
    record: MaintenanceRecord
  ) => {
    setEditingRecord(record);

    setForm({
      vehicleId: record.vehicle_id,
      maintenanceType:
        record.maintenance_type,
      description:
        record.description || "",
      garageName:
        record.garage_name || "",
      invoiceNumber:
        record.invoice_number || "",
      cost: String(record.cost ?? ""),
      serviceDate:
        record.service_date || "",
      nextServiceDate:
        record.next_service_date || "",
      odometerReading:
        record.odometer_reading !== null &&
        record.odometer_reading !== undefined
          ? String(record.odometer_reading)
          : "",
      remarks:
        record.remarks || "",
    });

    setShowVehiclePicker(false);
    setShowTypePicker(false);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (saving) return;

    setShowEditModal(false);
    setEditingRecord(null);
    setForm(emptyForm);
    setShowTypePicker(false);
    setShowVehiclePicker(false);
    setCalendarTarget(null);
    setCalendarYearPicker(false);
  };

  const validateForm = () => {
    if (!form.vehicleId) {
      Alert.alert(
        "Required",
        "Please select a vehicle."
      );

      return false;
    }

    if (!form.maintenanceType) {
      Alert.alert(
        "Required",
        "Please select a maintenance type."
      );

      return false;
    }

    if (!form.cost.trim()) {
      Alert.alert(
        "Required",
        "Please enter the maintenance cost."
      );

      return false;
    }

    const cost = Number(form.cost);

    if (!Number.isFinite(cost) || cost <= 0) {
      Alert.alert(
        "Invalid Cost",
        "Maintenance cost must be greater than zero."
      );

      return false;
    }

    if (!form.serviceDate) {
      Alert.alert(
        "Required",
        "Please select the service date."
      );

      return false;
    }

    if (
      form.nextServiceDate &&
      form.nextServiceDate < form.serviceDate
    ) {
      Alert.alert(
        "Invalid Date",
        "Next service date cannot be earlier than service date."
      );

      return false;
    }

    if (form.odometerReading.trim()) {
      const odometer = Number(
        form.odometerReading
      );

      if (
        !Number.isInteger(odometer) ||
        odometer < 0
      ) {
        Alert.alert(
          "Invalid Odometer",
          "Odometer reading must be a valid non-negative number."
        );

        return false;
      }
    }

    return true;
  };

  const buildPayload = () => {
    return {
      vehicle_id: form.vehicleId,

      maintenance_type:
        form.maintenanceType,

      description:
        form.description.trim() || null,

      garage_name:
        form.garageName.trim() || null,

      invoice_number:
        form.invoiceNumber.trim() || null,

      cost:
        Number(form.cost).toFixed(2),

      service_date:
        form.serviceDate,

      next_service_date:
        form.nextServiceDate || null,

      odometer_reading:
        form.odometerReading.trim()
          ? Number(form.odometerReading)
          : null,

      remarks:
        form.remarks.trim() || null,
    };
  };

  const handleCreate = async () => {
    if (!companyId || !validateForm()) {
      return;
    }

    setSaving(true);

    try {
      await apiPost(
        `/maintenance/${companyId}`,
        buildPayload()
      );

      Alert.alert(
        "Success",
        "Maintenance record added successfully."
      );

      closeAddModal();

      await loadData();
    } catch (error: any) {
      console.error(
        "Create maintenance error:",
        error
      );

      Alert.alert(
        "Error",
        error?.message ||
          "Unable to create maintenance record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (
      !companyId ||
      !editingRecord ||
      !validateForm()
    ) {
      return;
    }

    setSaving(true);

    try {
      const payload: any = buildPayload();

      delete payload.vehicle_id;

      await apiPut(
        `/maintenance/${companyId}/${editingRecord.id}`,
        payload
      );

      Alert.alert(
        "Success",
        "Maintenance record updated successfully."
      );

      closeEditModal();

      await loadData();
    } catch (error: any) {
      console.error(
        "Update maintenance error:",
        error
      );

      Alert.alert(
        "Error",
        error?.message ||
          "Unable to update maintenance record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (
  record: MaintenanceRecord
) => {
  setDeleteRecord(record);
};

  const openCalendar = (
    target: CalendarTarget
  ) => {
    const selected =
      target === "service"
        ? form.serviceDate
        : form.nextServiceDate;

    if (selected) {
      const [
        year,
        month,
        day,
      ] = selected
        .split("-")
        .map(Number);

      setCalendarDate(
        new Date(
          year,
          month - 1,
          day
        )
      );
    } else {
      setCalendarDate(new Date());
    }

    setCalendarYearPicker(false);
    setCalendarTarget(target);
  };

  const closeCalendar = () => {
    setCalendarTarget(null);
    setCalendarYearPicker(false);
  };

  const selectCalendarDate = (
    date: Date
  ) => {
    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const value =
      `${year}-${month}-${day}`;

    if (calendarTarget === "service") {
      setForm((previous) => ({
        ...previous,
        serviceDate: value,
      }));
    }

    if (
      calendarTarget ===
      "nextService"
    ) {
      setForm((previous) => ({
        ...previous,
        nextServiceDate: value,
      }));
    }

    closeCalendar();
  };

  const moveCalendarMonth = (
    amount: number
  ) => {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() +
            amount,
          1
        )
    );
  };

  const getCalendarDays = () => {
    const year =
      calendarDate.getFullYear();

    const month =
      calendarDate.getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const days:
      (number | null)[] = [];

    for (
      let i = 0;
      i < firstDay;
      i++
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push(day);
    }

    return days;
  };

  const isSelectedCalendarDay = (
    day: number
  ) => {
    if (!calendarTarget) {
      return false;
    }

    const selected =
      calendarTarget === "service"
        ? form.serviceDate
        : form.nextServiceDate;

    if (!selected) {
      return false;
    }

    const [
      year,
      month,
      selectedDay,
    ] = selected
      .split("-")
      .map(Number);

    return (
      year ===
        calendarDate.getFullYear() &&
      month ===
        calendarDate.getMonth() + 1 &&
      selectedDay === day
    );
  };

  const isTodayCalendarDay = (
    day: number
  ) => {
    const today = new Date();

    return (
      today.getFullYear() ===
        calendarDate.getFullYear() &&
      today.getMonth() ===
        calendarDate.getMonth() &&
      today.getDate() === day
    );
  };

  const updateCalendarYear = (
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

  const calendarYears = useMemo(() => {
    const currentYear =
      new Date().getFullYear();

    return Array.from(
      { length: 91 },
      (_, index) =>
        currentYear +
        70 -
        index
    );
  }, []);

  const renderCalendar = () => {
    if (!calendarTarget) {
      return null;
    }

    const monthName =
      calendarDate.toLocaleString(
        "en-US",
        {
          month: "long",
        }
      );

    const year =
      calendarDate.getFullYear();

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={
          closeCalendar
        }
      >
        <View
          style={
            styles.calendarOverlay
          }
        >
          <View
            style={
              styles.calendarCard
            }
          >
            {!calendarYearPicker ? (
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
                      {monthName}
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
                        {year}
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
                  Tap the year to choose
                  another year
                </Text>

                <View
                  style={
                    styles.weekRow
                  }
                >
                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map((day) => (
                    <Text
                      key={day}
                      style={
                        styles.weekDay
                      }
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                <View
                  style={
                    styles.calendarGrid
                  }
                >
                  {getCalendarDays().map(
                    (
                      day,
                      index
                    ) => {
                      if (
                        day === null
                      ) {
                        return (
                          <View
                            key={`empty-${index}`}
                            style={
                              styles.calendarDay
                            }
                          />
                        );
                      }

                      const selected =
                        isSelectedCalendarDay(
                          day
                        );

                      const today =
                        isTodayCalendarDay(
                          day
                        );

                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.calendarDay,
                            today &&
                              styles.todayDay,
                            selected &&
                              styles.selectedDay,
                          ]}
                          onPress={() =>
                            selectCalendarDate(
                              new Date(
                                year,
                                calendarDate.getMonth(),
                                day
                              )
                            )
                          }
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
                            {day}
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
                      styles.calendarCancelText
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
                      {monthName}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      setCalendarYearPicker(
                        false
                      )
                    }
                  >
                    <Text
                      style={
                        styles.closeText
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
                    {calendarYears.map(
                      (itemYear) => {
                        const selected =
                          itemYear ===
                          year;

                        return (
                          <TouchableOpacity
                            key={
                              itemYear
                            }
                            style={[
                              styles.calendarYearOption,
                              selected &&
                                styles.calendarYearOptionSelected,
                            ]}
                            onPress={() =>
                              updateCalendarYear(
                                itemYear
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
                                itemYear
                              }
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  
  
  const renderDateButton = (
    label: string,
    value: string,
    target: CalendarTarget,
    required = false
  ) => (
    <View
      style={
        styles.fieldGroup
      }
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
        {required ? " *" : ""}
      </Text>

      <TouchableOpacity
        style={
          styles.dateInput
        }
        onPress={() =>
          openCalendar(
            target
          )
        }
      >
        <Text
          style={[
            styles.dateInputText,
            !value &&
              styles.placeholderText,
          ]}
        >
          {value
            ? formatDate(value)
            : "Select date"}
        </Text>

        <Text
          style={
            styles.calendarIcon
          }
        >
          ▣
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFormModal = (
    editMode: boolean
  ) => {
    const visible =
      editMode
        ? showEditModal
        : showAddModal;

    const close =
      editMode
        ? closeEditModal
        : closeAddModal;

    const submit =
      editMode
        ? handleUpdate
        : handleCreate;

    if (!visible) {
      return null;
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {editMode
                    ? "Edit Maintenance"
                    : "Add Maintenance"}
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {editMode
                    ? "Update maintenance record"
                    : "Add a vehicle maintenance record"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={close}
                disabled={saving}
                style={
                  styles.closeButton
                }
              >
                <Text
                  style={
                    styles.closeText
                  }
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldGroup}>
  <Text style={styles.fieldLabel}>
    Vehicle *
  </Text>

  <Pressable
    style={styles.selectInput}
    onPress={() => {
      if (editMode) return;

      setShowVehiclePicker((previous) => !previous);
      setShowTypePicker(false);
    }}
  >
    <Text
      style={[
        styles.selectText,
        !form.vehicleId && styles.placeholderText,
      ]}
    >
      {form.vehicleId
  ? getRegistrationNumber(
      activeVehicles.find(
        (vehicle) => vehicle.id === form.vehicleId
      )
    )
  : "Select vehicle"}
    </Text>

    {!editMode && (
      <Text style={styles.selectArrow}>
        {showVehiclePicker ? "▴" : "▾"}
      </Text>
    )}
  </Pressable>

  {!editMode && showVehiclePicker && (
    <View style={styles.inlineDropdown}>
      {activeVehicles.length === 0 ? (
        <View style={styles.noVehicleContainer}>
          <Text style={styles.noVehicleTitle}>
            No active vehicles available
          </Text>

          <Text style={styles.noVehicleText}>
            Add or activate a vehicle before creating
            a maintenance record.
          </Text>
        </View>
      ) : (
        activeVehicles.map((vehicle) => {
          const selected =
            form.vehicleId === vehicle.id;

          return (
            <Pressable
              key={vehicle.id}
              style={[
                styles.vehicleDropdownOption,
                selected &&
                  styles.vehicleDropdownOptionSelected,
              ]}
              onPress={() => {
                setForm((previous) => ({
                  ...previous,
                  vehicleId: vehicle.id,
                }));

                setShowVehiclePicker(false);
              }}
            >
              <View style={styles.vehiclePickerInfo}>
                <Text
                  style={[
                    styles.vehiclePickerRegistration,
                    selected &&
                      styles.vehiclePickerRegistrationSelected,
                  ]}
                >
                  {getRegistrationNumber(vehicle)}
                </Text>

                {(vehicle.make || vehicle.model) && (
                  <Text style={styles.vehiclePickerSubtitle}>
                    {[vehicle.make, vehicle.model]
                      .filter(Boolean)
                      .join(" ")}
                  </Text>
                )}
              </View>

              {selected && (
                <Text style={styles.vehicleCheck}>
                  ✓
                </Text>
              )}
            </Pressable>
          );
        })
      )}
    </View>
  )}
</View>

              <View style={styles.fieldGroup}>
  <Text style={styles.fieldLabel}>
    Maintenance Type *
  </Text>

  <Pressable
    style={styles.selectInput}
    onPress={() => {
      setShowTypePicker((previous) => !previous);
      setShowVehiclePicker(false);
    }}
  >
    <Text style={styles.selectText}>
      {getMaintenanceLabel(form.maintenanceType)}
    </Text>

    <Text style={styles.selectArrow}>
      {showTypePicker ? "▴" : "▾"}
    </Text>
  </Pressable>

  {showTypePicker && (
    <View style={styles.inlineDropdown}>
      {MAINTENANCE_TYPES.map((item) => {
        const selected =
          form.maintenanceType === item.value;

        return (
          <Pressable
            key={item.value}
            style={[
              styles.typeDropdownOption,
              selected &&
                styles.typeDropdownOptionSelected,
            ]}
            onPress={() => {
              setForm((previous) => ({
                ...previous,
                maintenanceType: item.value,
              }));

              setShowTypePicker(false);
            }}
          >
            <Text
              style={[
                styles.typeOptionText,
                selected &&
                  styles.typeOptionTextSelected,
              ]}
            >
              {item.label}
            </Text>

            {selected && (
              <Text style={styles.typeCheck}>
                ✓
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  )}
</View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Cost *
                </Text>

                <View
                  style={
                    styles.currencyInput
                  }
                >
                  <Text
                    style={
                      styles.currencyPrefix
                    }
                  >
                    ₹
                  </Text>

                  <TextInput
                    value={
                      form.cost
                    }
                    onChangeText={(
                      value
                    ) =>
                      setForm(
                        (previous) => ({
                          ...previous,
                          cost: value.replace(
                            /[^0-9.]/g,
                            ""
                          ),
                        })
                      )
                    }
                    placeholder="0.00"
                    placeholderTextColor="#999999"
                    keyboardType="decimal-pad"
                    style={[
                      styles.currencyTextInput,
                      Platform.OS ===
                        "web"
                        ? ({
                            outline:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                  />
                </View>
              </View>

              {renderDateButton(
                "Service Date",
                form.serviceDate,
                "service",
                true
              )}

              {renderDateButton(
                "Next Service Date",
                form.nextServiceDate,
                "nextService"
              )}

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Odometer Reading
                </Text>

                <TextInput
                  value={
                    form.odometerReading
                  }
                  onChangeText={(
                    value
                  ) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        odometerReading:
                          value.replace(
                            /[^0-9]/g,
                            ""
                          ),
                      })
                    )
                  }
                  placeholder="Enter odometer reading"
                  placeholderTextColor="#999999"
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    Platform.OS ===
                      "web"
                      ? ({
                          outline:
                            "none",
                        } as any)
                      : undefined,
                  ]}
                />
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Garage Name
                </Text>

                <TextInput
                  value={
                    form.garageName
                  }
                  onChangeText={(
                    value
                  ) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        garageName:
                          value,
                      })
                    )
                  }
                  placeholder="Enter garage name"
                  placeholderTextColor="#999999"
                  style={[
                    styles.textInput,
                    Platform.OS ===
                      "web"
                      ? ({
                          outline:
                            "none",
                        } as any)
                      : undefined,
                  ]}
                />
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Invoice Number
                </Text>

                <TextInput
                  value={
                    form.invoiceNumber
                  }
                  onChangeText={(
                    value
                  ) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        invoiceNumber:
                          value,
                      })
                    )
                  }
                  placeholder="Enter invoice number"
                  placeholderTextColor="#999999"
                  style={[
                    styles.textInput,
                    Platform.OS ===
                      "web"
                      ? ({
                          outline:
                            "none",
                      } as any)
                      : undefined,
                  ]}
                />
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Description
                </Text>

                <TextInput
                  value={
                    form.description
                  }
                  onChangeText={(
                    value
                  ) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        description:
                          value,
                      })
                    )
                  }
                  placeholder="Describe the maintenance work"
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.textArea,
                    Platform.OS ===
                      "web"
                      ? ({
                          outline:
                            "none",
                        } as any)
                      : undefined,
                  ]}
                />
              </View>

              <View
                style={
                  styles.fieldGroup
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  Remarks
                </Text>

                <TextInput
                  value={
                    form.remarks
                  }
                  onChangeText={(
                    value
                  ) =>
                    setForm(
                      (previous) => ({
                        ...previous,
                        remarks:
                          value,
                      })
                    )
                  }
                  placeholder="Additional remarks"
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.textArea,
                    Platform.OS ===
                      "web"
                      ? ({
                          outline:
                            "none",
                        } as any)
                      : undefined,
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  saving &&
                    styles.disabledButton,
                ]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    {editMode
                      ? "Update Maintenance"
                      : "Add Maintenance"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.secondaryButton
                }
                onPress={close}
                disabled={saving}
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <View
                style={
                  styles.modalBottomSpace
                }
              />
            </ScrollView>

            
          </View>
        </View>
      </Modal>
    );
  };

  const renderMaintenanceReminder = () => {
  if (upcomingMaintenance.length === 0) {
    return null;
  }

  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderHeader}>
        <Text style={styles.reminderTitle}>
          Maintenance Reminders
        </Text>

        <Text style={styles.reminderSubtitle}>
          Services due within 7 days
        </Text>
      </View>

      {upcomingMaintenance.map((record) => {
          const vehicle = vehicleMap[record.vehicle_id];

       const isCompleted =
      String(record.status ?? "PENDING")
        .trim()
        .toUpperCase() === "COMPLETED";

        const daysUntil = getDateDifferenceInDays(
          record.next_service_date!
        );

        const overdue = daysUntil < 0;
        const today = daysUntil === 0;

        let badgeText = "";
        let badgeStyle: any = styles.reminderBadge;
        let badgeTextStyle: any = styles.reminderBadgeText;
        if (overdue) {
          badgeText = `${Math.abs(daysUntil)} day${
            Math.abs(daysUntil) !== 1 ? "s" : ""
          } overdue`;

          badgeStyle = [
            styles.reminderBadge,
            styles.reminderBadgeOverdue,
          ];

          badgeTextStyle = [
            styles.reminderBadgeText,
            styles.reminderBadgeTextOverdue,
          ];
        } else if (today) {
          badgeText = "Due today";

          badgeStyle = [
            styles.reminderBadge,
            styles.reminderBadgeSoon,
          ];
        } else {
          badgeText = `${daysUntil} day${
            daysUntil !== 1 ? "s" : ""
          } left`;

          badgeStyle = [
            styles.reminderBadge,
            styles.reminderBadgeSoon,
          ];
        }

        return (
          <View
            key={record.id}
            style={styles.reminderItem}
          >
            <View
              style={styles.reminderItemContent}
            >
              <Text
                style={styles.reminderVehicle}
              >
                {getRegistrationNumber(
                  vehicle
                )}
              </Text>

              <Text
                style={styles.reminderType}
              >
                {getMaintenanceLabel(
                  record.maintenance_type
                )}
              </Text>

              <Text
                style={styles.reminderDate}
              >
                Next service:{" "}
                {formatDate(
                  record.next_service_date
                )}
              </Text>
            </View>

            <View style={badgeStyle}>
              <Text
                style={badgeTextStyle}
              >
                {badgeText}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

  const renderRecordCard = (
    record: MaintenanceRecord,
    inactive = false
  ) => {

    const isCompleted =
    String(record.status ?? "PENDING")
    .trim()
    .toUpperCase() === "COMPLETED";
    const vehicle =
      vehicleMap[record.vehicle_id];

    return (
      <View
        key={record.id}
        style={
          styles.recordCard
        }
      >
        <View
          style={
            styles.recordTop
          }
        >
          <View
            style={
              styles.recordVehicle
            }
          >
            <Text
              style={
                styles.registrationNumber
              }
            >
              {getRegistrationNumber(
                vehicle
              )}
            </Text>

                        <Text style={styles.maintenanceType}>
              {getMaintenanceLabel(record.maintenance_type)}
            </Text>

            <View
              style={[
                styles.maintenanceStatusBadge,
                isCompleted
                  ? styles.completedStatusBadge
                  : styles.pendingStatusBadge,
              ]}
            >
              <Text
                style={[
                  styles.maintenanceStatusText,
                  isCompleted
                    ? styles.completedStatusText
                    : styles.pendingStatusText,
                ]}
              >
                {isCompleted ? "Completed" : "Pending"}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.recordCost
            }
          >
            {formatCurrency(
              record.cost
            )}
          </Text>
        </View>

        <View
          style={
            styles.divider
          }
        />

        <View
          style={
            styles.infoGrid
          }
        >
          <View
            style={
              styles.infoItem
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Service Date
            </Text>

            <Text
              style={
                styles.infoValue
              }
            >
              {formatDate(
                record.service_date
              )}
            </Text>
          </View>

          <View
            style={
              styles.infoItem
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Next Service
            </Text>

            <Text
              style={
                styles.infoValue
              }
            >
              {formatDate(
                record.next_service_date
              )}
            </Text>
          </View>

          <View
            style={
              styles.infoItem
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Odometer
            </Text>

            <Text
              style={
                styles.infoValue
              }
            >
              {record.odometer_reading !==
                null &&
              record.odometer_reading !==
                undefined
                ? `${Number(
                    record.odometer_reading
                  ).toLocaleString(
                    "en-IN"
                  )} km`
                : "—"}
            </Text>
          </View>

          <View
            style={
              styles.infoItem
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Garage
            </Text>

            <Text
              style={
                styles.infoValue
              }
              numberOfLines={1}
            >
              {record.garage_name ||
                "—"}
            </Text>
          </View>
        </View>

        {record.description ? (
          <View
            style={
              styles.detailBlock
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Description
            </Text>

            <Text
              style={
                styles.detailText
              }
            >
              {record.description}
            </Text>
          </View>
        ) : null}

        {record.invoice_number ? (
          <View
            style={
              styles.invoiceRow
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Invoice
            </Text>

            <Text
              style={
                styles.invoiceText
              }
            >
              {record.invoice_number}
            </Text>
          </View>
        ) : null}

        {record.remarks ? (
          <View
            style={
              styles.detailBlock
            }
          >
            <Text
              style={
                styles.infoLabel
              }
            >
              Remarks
            </Text>

            <Text
              style={
                styles.detailText
              }
            >
              {record.remarks}
            </Text>
          </View>
        ) : null}

        {!inactive &&
        canManage ? (
          <View
            style={
              styles.actionRow
            }
          >
            <TouchableOpacity
              style={
                styles.editButton
              }
              onPress={() =>
                openEditModal(
                  record
                )
              }
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
              onPress={() => {
    console.log("🔥 DELETE BUTTON PRESSED");
    console.log("Record:", record);
    handleDelete(record);
  }}
            >
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (!companyId) {
    return (
  <View
    style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F7F8FA",
    }}
  >
    <Text
      style={{
        fontSize: 24,
        fontWeight: "700",
        color: "#111111",
      }}
    >
      Maintenance Test
    </Text>
  </View>

    );
  }

  return (
   
   <View
  style={
    styles.container
  }
>
  <ScrollView
    showsVerticalScrollIndicator={
      false
    }
    contentContainerStyle={
      styles.pageContent
    }
  >
    <View
      style={
        styles.header
      }
    >
      <View>
        <Text
          style={
            styles.title
          }
        >
          Vehicle Maintenance
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Manage vehicle maintenance
          records
        </Text>
      </View>

      {canManage && (
        <TouchableOpacity
          style={
            styles.addButton
          }
          onPress={
            openAddModal
          }
        >
          <Text
            style={
              styles.addButtonText
            }
          >
            + Add
          </Text>
        </TouchableOpacity>
      )}
    </View>

    <View
      style={
        styles.summaryRow
      }
    >
      <View
        style={
          styles.summaryCard
        }
      >
        <Text
          style={
            styles.summaryValue
          }
        >
          {activeRecords.length}
        </Text>

        <Text
          style={
            styles.summaryLabel
          }
        >
          Records
        </Text>
      </View>

      <View
        style={
          styles.summaryCard
        }
      >
        <Text
          style={
            styles.summaryValue
          }
        >
          {vehicleCount}
        </Text>

        <Text
          style={
            styles.summaryLabel
          }
        >
          Vehicles
        </Text>
      </View>

      <View
        style={
          styles.summaryCard
        }
      >
        <Text
          style={
            styles.summaryValue
          }
          numberOfLines={
            1
          }
          adjustsFontSizeToFit
        >
          {formatCurrency(
            totalCost
          )}
        </Text>

        <Text
          style={
            styles.summaryLabel
          }
        >
          Total Cost
        </Text>
      </View>
    </View>

    <View
      style={
        styles.filterCard
      }
    >

    </View>

{renderMaintenanceReminder()}

<View
  style={
    styles.filterCard
  }
>
      

      <TextInput
        value={
          search
        }
        onChangeText={
          setSearch
        }
        placeholder="Search vehicle, maintenance, garage..."
        placeholderTextColor="#999999"
        style={[
          styles.searchInput,
          Platform.OS ===
            "web"
            ? ({
                outline:
                  "none",
              } as any)
            : undefined,
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.filterRow
        }
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            typeFilter ===
              "all" &&
              styles.filterButtonActive,
          ]}
          onPress={() =>
            setTypeFilter(
              "all"
            )
          }
        >
          <Text
            style={[
              styles.filterButtonText,
              typeFilter ===
                "all" &&
                styles.filterButtonTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {MAINTENANCE_TYPES.map(
          (item) => {
            const selected =
              typeFilter ===
              item.value;

            return (
              <TouchableOpacity
                key={
                  item.value
                }
                style={[
                  styles.filterButton,
                  selected &&
                    styles.filterButtonActive,
                ]}
                onPress={() =>
                  setTypeFilter(
                    item.value
                  )
                }
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selected &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {
                    item.label
                  }
                </Text>
              </TouchableOpacity>
            );
          }
        )}
      </ScrollView>
    </View>

    {loading ? (
      <View
        style={
          styles.loadingContainer
        }
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
          Loading maintenance
          records...
        </Text>
      </View>
    ) : filteredRecords.length ===
      0 ? (
      <View
        style={
          styles.emptyCard
        }
      >
        <Text
          style={
            styles.emptyIcon
          }
        >
          🔧
        </Text>

        <Text
          style={
            styles.emptyTitle
          }
        >
          No maintenance records
        </Text>

        <Text
          style={
            styles.emptyText
          }
        >
          {search ||
          typeFilter !==
            "all"
            ? "No records match your current filters."
            : "Add a maintenance record to start tracking vehicle service history."}
        </Text>

        {canManage &&
          !search &&
          typeFilter ===
            "all" && (
            <TouchableOpacity
              style={
                styles.emptyButton
              }
              onPress={() => {
                console.log(
                  "ADD MAINTENANCE BUTTON PRESSED"
                );
                openAddModal();
              }}
            >
              <Text
                style={
                  styles.emptyButtonText
                }
              >
                + Add Maintenance
              </Text>
            </TouchableOpacity>
          )}
      </View>
    ) : (
      <>
        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Active Maintenance
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              {
                filteredRecords.length
              }{" "}
              record
              {filteredRecords.length !==
              1
                ? "s"
                : ""}
            </Text>
          </View>
        </View>

        {filteredRecords.map(
          (record) =>
            renderRecordCard(
              record
            )
        )}
      </>
    )}

    {inactiveRecords.length >
      0 &&
      canManage && (
        <View
          style={
            styles.inactiveSection
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Deleted Records
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                {
                  inactiveRecords.length
                }{" "}
                record
                {inactiveRecords.length !==
                1
                  ? "s"
                  : ""}
              </Text>
            </View>
          </View>

          {inactiveRecords.map(
            (record) =>
              renderRecordCard(
                record,
                true
              )
          )}
        </View>
      )}
  </ScrollView>

  {renderFormModal(false)}

  {renderFormModal(true)}

  {renderCalendar()}

  {/* DELETE CONFIRMATION MODAL */}
  <Modal
    visible={
      deleteRecord !== null
    }
    transparent
    animationType="fade"
    onRequestClose={() =>
      setDeleteRecord(null)
    }
  >
    <View
      style={
        styles.deleteModalOverlay
      }
    >
      <View
        style={
          styles.deleteModalContainer
        }
      >
        <Text
          style={
            styles.deleteModalTitle
          }
        >
          Delete Maintenance
        </Text>

        <Text
          style={
            styles.deleteModalMessage
          }
        >
          Are you sure you want to
          delete this maintenance
          record?
        </Text>

        <View
          style={
            styles.deleteModalButtons
          }
        >
          <TouchableOpacity
            style={
              styles.deleteCancelButton
            }
            onPress={() =>
              setDeleteRecord(
                null
              )
            }
          >
            <Text
              style={
                styles.deleteCancelButtonText
              }
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.deleteConfirmButton
            }
            onPress={async () => {
              if (
                !deleteRecord ||
                !companyId
              ) {
                return;
              }

              try {
                console.log(
                  "🔥 CONFIRM DELETE PRESSED"
                );

                console.log(
                  "🔥 DELETE URL:",
                  `/maintenance/${companyId}/${deleteRecord.id}`
                );

                await apiDelete(
                  `/maintenance/${companyId}/${deleteRecord.id}`
                );

                console.log(
                  "✅ DELETE API SUCCESS"
                );

                setDeleteRecord(
                  null
                );

                await loadData();

                Alert.alert(
                  "Success",
                  "Maintenance record deleted successfully."
                );
              } catch (
                error: any
              ) {
                console.error(
                  "❌ Delete maintenance error:",
                  error
                );

                Alert.alert(
                  "Error",
                  error?.message ||
                    "Unable to delete maintenance record."
                );
              }
            }}
          >
            <Text
              style={
                styles.deleteConfirmButtonText
              }
            >
              Delete
            </Text>
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

  pageContent: {
    padding: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111111",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#666666",
  },

  addButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 14,
    minHeight: 82,
    justifyContent: "center",
  },

  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111111",
  },

  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#777777",
  },

  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 14,
    marginBottom: 18,
  },

  searchInput: {
    height: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },

  filterRow: {
    gap: 8,
    paddingTop: 12,
  },

  filterButton: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  filterButtonActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
  },

  filterButtonTextActive: {
    color: "#FFFFFF",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#777777",
  },

  recordCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 16,
    marginBottom: 12,
  },

  recordTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  recordVehicle: {
    flex: 1,
  },

  registrationNumber: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  maintenanceType: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
  },

  recordCost: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 14,
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  infoItem: {
    width: "47%",
  },

  infoLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "600",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 13,
    color: "#222222",
    fontWeight: "600",
  },

  detailBlock: {
    marginTop: 14,
  },

  detailText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#333333",
  },

  invoiceRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  invoiceText: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#222222",
    fontWeight: "600",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  editButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },

  deleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },

  inactiveSection: {
    marginTop: 28,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    fontSize: 32,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#777777",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 430,
  },

  emptyButton: {
    marginTop: 18,
    backgroundColor: "#111111",
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  loadingContainer: {
    paddingVertical: 70,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#666666",
  },

  centered: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalCard: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
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

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    fontSize: 27,
    lineHeight: 30,
    color: "#111111",
  },

  fieldGroup: {
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222222",
    marginBottom: 7,
  },

  selectInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  selectText: {
    fontSize: 14,
    color: "#222222",
    fontWeight: "600",
  },

  selectArrow: {
    fontSize: 16,
    color: "#555555",
  },

  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },

  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },

  currencyInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  currencyPrefix: {
    paddingLeft: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
  },

  currencyTextInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    fontSize: 14,
    color: "#111111",
  },

  dateInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  dateInputText: {
    fontSize: 14,
    color: "#222222",
    fontWeight: "600",
  },

  placeholderText: {
    color: "#999999",
    fontWeight: "400",
  },

  calendarIcon: {
    fontSize: 17,
    color: "#111111",
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.6,
  },

  secondaryButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "700",
  },

  modalBottomSpace: {
    height: 20,
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  typePickerCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },

  vehiclePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 1000,
    elevation: 1000,
  },

  vehiclePickerCard: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },

  vehiclePickerOption: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  vehiclePickerOptionSelected: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  vehiclePickerInfo: {
    flex: 1,
  },

  vehiclePickerRegistration: {
    fontSize: 15,
    fontWeight: "800",
    color: "#222222",
  },

  vehiclePickerRegistrationSelected: {
    color: "#FFFFFF",
  },

  vehiclePickerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#777777",
  },

  vehicleCheck: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 12,
  },

  noVehicleContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  noVehicleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#222222",
    textAlign: "center",
  },

  noVehicleText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#777777",
    textAlign: "center",
  },

  typeOption: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  typeOptionSelected: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  typeOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222222",
  },

  typeOptionTextSelected: {
    color: "#FFFFFF",
  },

  typeCheck: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  calendarOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
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

  calendarCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222222",
  },

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

  inlineDropdown: {
  marginTop: 6,
  borderWidth: 1,
  borderColor: "#DDDDDD",
  borderRadius: 10,
  backgroundColor: "#FFFFFF",
  overflow: "hidden",
},

vehicleDropdownOption: {
  minHeight: 62,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#EEEEEE",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#FFFFFF",
},

vehicleDropdownOptionSelected: {
  backgroundColor: "#111111",
},

typeDropdownOption: {
  minHeight: 48,
  paddingHorizontal: 14,
  borderBottomWidth: 1,
  borderBottomColor: "#EEEEEE",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#FFFFFF",
},

typeDropdownOptionSelected: {
  backgroundColor: "#111111",
},

deleteModalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
},

deleteModalContainer: {
  width: "100%",
  maxWidth: 420,
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  padding: 24,
},

deleteModalTitle: {
  fontSize: 20,
  fontWeight: "700",
  color: "#111111",
  marginBottom: 12,
},

deleteModalMessage: {
  fontSize: 15,
  color: "#555555",
  lineHeight: 22,
  marginBottom: 24,
},

deleteModalButtons: {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: 10,
},

deleteCancelButton: {
  paddingVertical: 11,
  paddingHorizontal: 20,
  borderRadius: 8,
  backgroundColor: "#EEEEEE",
},

deleteCancelButtonText: {
  color: "#111111",
  fontSize: 14,
  fontWeight: "600",
},

deleteConfirmButton: {
  paddingVertical: 11,
  paddingHorizontal: 20,
  borderRadius: 8,
  backgroundColor: "#111111",
},

deleteConfirmButtonText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "600",
},

reminderCard: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#EEEEEE",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
},

reminderHeader: {
  marginBottom: 12,
},

reminderTitle: {
  fontSize: 17,
  fontWeight: "700",
  color: "#111111",
},

reminderSubtitle: {
  fontSize: 13,
  color: "#777777",
  marginTop: 3,
},

reminderItem: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 12,
  borderTopWidth: 1,
  borderTopColor: "#EEEEEE",
  gap: 12,
},

reminderItemContent: {
  flex: 1,
},

reminderVehicle: {
  fontSize: 15,
  fontWeight: "700",
  color: "#111111",
},

reminderType: {
  fontSize: 13,
  color: "#555555",
  marginTop: 3,
},

reminderDate: {
  fontSize: 12,
  color: "#777777",
  marginTop: 3,
},

reminderBadge: {
  backgroundColor: "#EEEEEE",
  borderRadius: 8,
  paddingVertical: 6,
  paddingHorizontal: 9,
},

reminderBadgeSoon: {
  backgroundColor: "#FFF3CD",
  borderWidth: 1,
  borderColor: "#E6C85C",
},

reminderBadgeOverdue: {
  backgroundColor: "#FDECEC",
},

reminderBadgeText: {
  fontSize: 12,
  fontWeight: "600",
  color: "#333333",
},

reminderBadgeTextOverdue: {
  color: "#B00020",
},

  maintenanceStatusBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },

  completedStatusBadge: {
    backgroundColor: "#EEEEEE",
    borderColor: "#BBBBBB",
  },

  pendingStatusBadge: {
    backgroundColor: "#FFF3CD",
    borderColor: "#E6C85C",
  },

  maintenanceStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  completedStatusText: {
    color: "#222222",
  },

  pendingStatusText: {
    color: "#755900",
  },

});

