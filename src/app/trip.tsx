import {
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getUser } from "../utils/storage";
import "../../web.css";

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from "../services/api";

type Vehicle = {
  id: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  is_active?: boolean;
};

type Driver = {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  license_number?: string;
  is_active?: boolean;
};

type Assignment = {
  id: string;
  company_id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_by: string;
  assigned_at?: string;
  unassigned_at?: string | null;
  is_active: boolean;
};

type TripStatus =
  | "CREATED"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

type Trip = {
  id: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string;
  created_by: string;
  origin: string;
  destination: string;
  cargo_description?: string | null;
  remarks?: string | null;
  status: TripStatus;
  actual_start?: string | null;
  actual_end?: string | null;
  created_at: string;
  updated_at: string;
};

type DateFilter =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM";

type CalendarTarget = "START" | "END";

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


function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function formatDisplayDate(value: string) {
  if (!value) {
    return "";
  }

  const date = parseDateString(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getToday() {
  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return today;
}

function getDateRange(filter: DateFilter) {
  const today = getToday();

  if (filter === "ALL") {
    return null;
  }

  if (filter === "TODAY") {
    return {
      start: new Date(today),
      end: new Date(today),
    };
  }

  if (filter === "YESTERDAY") {
    const yesterday = new Date(today);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return {
      start: yesterday,
      end: yesterday,
    };
  }

  if (filter === "LAST_7_DAYS") {
    const start = new Date(today);

    start.setDate(
      start.getDate() - 6
    );

    return {
      start,
      end: new Date(today),
    };
  }

  if (filter === "LAST_30_DAYS") {
    const start = new Date(today);

    start.setDate(
      start.getDate() - 29
    );

    return {
      start,
      end: new Date(today),
    };
  }

  if (filter === "THIS_MONTH") {
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    return {
      start,
      end: new Date(today),
    };
  }

  if (filter === "LAST_MONTH") {
    const start = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    );

    return {
      start,
      end,
    };
  }

  return null;
}

function getMonthDays(
  year: number,
  month: number
) {
  const firstDay = new Date(
    year,
    month,
    1
  );

  const firstWeekday =
    firstDay.getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const cells: Array<
    number | null
  > = [];

  for (
    let i = 0;
    i < firstWeekday;
    i += 1
  ) {
    cells.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    cells.push(day);
  }

  return cells;
}

function getDriverName(
  driver?: Driver
) {
  if (!driver) {
    return "Unknown driver";
  }

  return (
    `${driver.first_name || ""} ${
      driver.last_name || ""
    }`.trim() ||
    "Unnamed driver"
  );
}

function getErrorMessage(
  data: any,
  fallback: string
) {
  if (!data) {
    return fallback;
  }

  if (
    typeof data.detail ===
    "string"
  ) {
    return data.detail;
  }

  if (
    Array.isArray(data.detail)
  ) {
    return data.detail
      .map(
        (item: any) =>
          item?.msg ||
          "Invalid value"
      )
      .join("\n");
  }

  if (
    typeof data.message ===
    "string"
  ) {
    return data.message;
  }

  return fallback;
}

export default function TripScreen() {
  const params =
    useLocalSearchParams<{
      add?: string;
    }>();

  const [
    companyId,
    setCompanyId,
  ] = useState<string | null>(
    null
  );

  const [
    userId,
    setUserId,
  ] = useState<string | null>(
    null
  );

  const [
    trips,
    setTrips,
  ] = useState<Trip[]>([]);

  const [
    vehicles,
    setVehicles,
  ] = useState<Vehicle[]>([]);

  const [
    drivers,
    setDrivers,
  ] = useState<Driver[]>([]);

  const [
    assignments,
    setAssignments,
  ] = useState<Assignment[]>([]);

  const [
    assignmentsLoading,
    setAssignmentsLoading,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    TripStatus | "ALL"
  >("ALL");

  const [
    dateFilter,
    setDateFilter,
  ] = useState<DateFilter>(
    "THIS_MONTH"
  );

  const [
    customStartDate,
    setCustomStartDate,
  ] = useState("");

  const [
    customEndDate,
    setCustomEndDate,
  ] = useState("");

  const [
    showDateFilters,
    setShowDateFilters,
  ] = useState(false);

  const [
    showStatusFilters,
    setShowStatusFilters,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingTrip,
    setEditingTrip,
  ] = useState<Trip | null>(
    null
  );

  const [
    showVehiclePicker,
    setShowVehiclePicker,
  ] = useState(false);

  const [
    vehicleId,
    setVehicleId,
  ] = useState("");

  const [
    driverId,
    setDriverId,
  ] = useState("");

  const [
    origin,
    setOrigin,
  ] = useState("");

  const [
    destination,
    setDestination,
  ] = useState("");

  const [
    cargoDescription,
    setCargoDescription,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    calendarVisible,
    setCalendarVisible,
  ] = useState(false);

  const [
    calendarTarget,
    setCalendarTarget,
  ] = useState<CalendarTarget>(
    "START"
  );

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    new Date()
  );

  const [
    calendarYearPicker,
    setCalendarYearPicker,
  ] = useState(false);

  const [
    initialAddHandled,
    setInitialAddHandled,
  ] = useState(false);

  const selectedVehicle =
    useMemo(
      () =>
        vehicles.find(
          (vehicle) =>
            vehicle.id ===
            vehicleId
        ),
      [
        vehicles,
        vehicleId,
      ]
    );

  const selectedDriver =
    useMemo(
      () =>
        drivers.find(
          (driver) =>
            driver.id ===
            driverId
        ),
      [
        drivers,
        driverId,
      ]
    );

  const getActiveAssignmentForVehicle =
    useCallback(
      (
        selectedVehicleId: string
      ) => {
        return assignments.find(
          (assignment) =>
            assignment.vehicle_id ===
              selectedVehicleId &&
            assignment.is_active
        );
      },
      [assignments]
    );

  
const loadUser = useCallback(async () => {
  try {
    const user = await getUser();

    if (!user) {
      setCompanyId(null);
      setUserId(null);
      setLoading(false);
      console.error("No logged-in user found.");
      return;
    }

    setCompanyId(user.company_id || null);
    setUserId(user.id || null);

    if (!user.company_id) {
      setLoading(false);
    }
  } catch (error) {
    console.error("Trip user loading error:", error);
    setCompanyId(null);
    setUserId(null);
    setLoading(false);
  }
}, []);
     
  const loadTrips =
    useCallback(async () => {
      if (!companyId) {
        return;
      }

      try {
        const data =
          await apiGet(
            `/trips/company?company_id=${encodeURIComponent(
              companyId
            )}`
          );

        setTrips(
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.data
              )
            ? data.data
            : []
        );
      } catch (error) {
        console.error(
          "Trip loading error:",
          error
        );

        setTrips([]);
      }
    }, [companyId]);

  const loadVehicles =
    useCallback(async () => {
      if (!companyId) {
        return;
      }

      try {
        const data =
          await apiGet(
            `/vehicles/${companyId}/all`
          );

        const vehicleData =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.data
              )
            ? data.data
            : [];

        setVehicles(
          vehicleData
        );
      } catch (error) {
        console.error(
          "Vehicle loading error:",
          error
        );

        setVehicles([]);
      }
    }, [companyId]);

  const loadDrivers =
    useCallback(async () => {
      if (!companyId) {
        return;
      }

      try {
        const data =
          await apiGet(
            `/drivers/${companyId}`
          );

        const driverData =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.data
              )
            ? data.data
            : [];

        setDrivers(
          driverData
        );
      } catch (error) {
        console.error(
          "Driver loading error:",
          error
        );

        setDrivers([]);
      }
    }, [companyId]);

  const loadAssignments =
    useCallback(async () => {
      if (!companyId) {
        return;
      }

      try {
        setAssignmentsLoading(
          true
        );

        const data =
          await apiGet(
            `/driver-vehicle-assignments/${companyId}`
          );

        const assignmentData =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.data
              )
            ? data.data
            : Array.isArray(
                data?.assignments
              )
            ? data.assignments
            : [];

        setAssignments(
          assignmentData
        );
      } catch (error) {
        console.error(
          "Assignment loading error:",
          error
        );

        setAssignments([]);
      } finally {
        setAssignmentsLoading(
          false
        );
      }
    }, [companyId]);

  const loadAllData =
    useCallback(async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        await Promise.all([
          loadTrips(),
          loadVehicles(),
          loadDrivers(),
          loadAssignments(),
        ]);
      } finally {
        setLoading(false);
      }
    }, [
      companyId,
      loadTrips,
      loadVehicles,
      loadDrivers,
      loadAssignments,
    ]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useFocusEffect(
    useCallback(() => {
      if (!companyId) {
        return;
      }

      loadAllData();
    }, [
      companyId,
      loadAllData,
    ])
  );

  useEffect(() => {
    if (
      params.add === "true" &&
      !initialAddHandled &&
      companyId
    ) {
      setInitialAddHandled(
        true
      );

      openAddForm();
    }
  }, [
    params.add,
    companyId,
    initialAddHandled,
  ]);

  const onRefresh =
    async () => {
      setRefreshing(true);

      try {
        await loadAllData();
      } finally {
        setRefreshing(false);
      }
    };

  const openAddForm = () => {
    setEditingTrip(null);

    setVehicleId("");
    setDriverId("");
    setOrigin("");
    setDestination("");
    setCargoDescription("");
    setRemarks("");

    setShowForm(true);
  };

  const openEditForm = (
    trip: Trip
  ) => {
    if (
      trip.status !==
      "CREATED"
    ) {
      Alert.alert(
        "Cannot edit trip",
        "Only CREATED trips can be edited."
      );

      return;
    }

    setEditingTrip(trip);

    setVehicleId(
      trip.vehicle_id
    );

    setDriverId(
      trip.driver_id
    );

    setOrigin(
      trip.origin
    );

    setDestination(
      trip.destination
    );

    setCargoDescription(
      trip.cargo_description ||
        ""
    );

    setRemarks(
      trip.remarks || ""
    );

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingTrip(null);
  };

  const saveTrip =
    async () => {
      // Prevent duplicate requests from rapid repeated taps.
      if (saving) return;

      if (!companyId) {
        Alert.alert(
          "Error",
          "Company information is missing."
        );

        return;
      }

      if (
        !editingTrip &&
        !userId
      ) {
        Alert.alert(
          "Error",
          "Logged-in user information is missing."
        );

        return;
      }

      if (
        !editingTrip &&
        !vehicleId
      ) {
        Alert.alert(
          "Vehicle required",
          "Please select a vehicle."
        );

        return;
      }

      if (!editingTrip) {
        if (
          assignmentsLoading
        ) {
          Alert.alert(
            "Please wait",
            "Driver assignments are still loading."
          );

          return;
        }

        const activeAssignment =
          getActiveAssignmentForVehicle(
            vehicleId
          );

        if (!activeAssignment) {
          Alert.alert(
            "No Driver Assigned",
            "Please assign a driver to this vehicle before creating a trip."
          );

          return;
        }

        if (!driverId) {
          Alert.alert(
            "Driver required",
            "The selected vehicle does not have a valid assigned driver."
          );

          return;
        }

        if (
          activeAssignment.driver_id !==
          driverId
        ) {
          Alert.alert(
            "Driver mismatch",
            "The selected driver's assignment has changed. Please select the vehicle again."
          );

          return;
        }
      }

      if (
        !origin.trim()
      ) {
        Alert.alert(
          "Origin required",
          "Please enter the trip origin."
        );

        return;
      }

      if (
        !destination.trim()
      ) {
        Alert.alert(
          "Destination required",
          "Please enter the trip destination."
        );

        return;
      }

      try {
        setSaving(true);

        if (editingTrip) {
          const body = {
            origin:
              origin.trim(),
            destination:
              destination.trim(),
            cargo_description:
              cargoDescription.trim() ||
              null,
            remarks:
              remarks.trim() ||
              null,
          };

          await apiPut(
            `/trips/${editingTrip.id}?company_id=${encodeURIComponent(
              companyId
            )}`,
            body
          );

          Alert.alert(
            "Success",
            "Trip updated successfully."
          );
        } else {
          const activeAssignment =
            getActiveAssignmentForVehicle(
              vehicleId
            );

          if (!activeAssignment) {
            Alert.alert(
              "No Driver Assigned",
              "Please assign a driver to this vehicle before creating a trip."
            );

            return;
          }

          const assignedDriverId =
            activeAssignment.driver_id;

          const body = {
            vehicle_id:
              vehicleId,
            driver_id:
              assignedDriverId,
            origin:
              origin.trim(),
            destination:
              destination.trim(),
            cargo_description:
              cargoDescription.trim() ||
              null,
            remarks:
              remarks.trim() ||
              null,
          };

          await apiPost(
            `/trips/?company_id=${encodeURIComponent(
              companyId
            )}`,
            body
          );

          Alert.alert(
            "Success",
            "Trip created successfully."
          );
        }

        setShowForm(false);
        setEditingTrip(null);

        await loadTrips();
      } catch (
        error: any
      ) {
        console.error(
          "Save trip error:",
          error
        );

        Alert.alert(
          "Trip error",
          error?.message ||
            "Something went wrong."
        );
      } finally {
        setSaving(false);
      }
    };

  const startTrip =
    async (
      tripId: string
    ) => {
      try {
        await apiPatch(
          `/trips/${tripId}/start?company_id=${encodeURIComponent(
            companyId || ""
          )}`
        );

        Alert.alert(
          "Success",
          "Trip started successfully."
        );

        await loadTrips();
      } catch (
        error: any
      ) {
        console.error(
          "Start trip error:",
          error
        );

        Alert.alert(
          "Unable to Start Trip",
          error?.message ||
            "Something went wrong while starting the trip."
        );
      }
    };

  const completeTrip =
    async (
      tripId: string
    ) => {
      try {
        await apiPatch(
          `/trips/${tripId}/complete?company_id=${encodeURIComponent(
            companyId || ""
          )}`
        );

        Alert.alert(
          "Success",
          "Trip completed successfully."
        );

        await loadTrips();
      } catch (
        error: any
      ) {
        console.error(
          "Complete trip error:",
          error
        );

        Alert.alert(
          "Unable to Complete Trip",
          error?.message ||
            "Something went wrong while completing the trip."
        );
      }
    };

  const cancelTrip =
    async (
      tripId: string
    ) => {
      try {
        await apiPatch(
          `/trips/${tripId}/cancel?company_id=${encodeURIComponent(
            companyId || ""
          )}`
        );

        Alert.alert(
          "Success",
          "Trip cancelled successfully."
        );

        await loadTrips();
      } catch (
        error: any
      ) {
        console.error(
          "Cancel trip error:",
          error
        );

        Alert.alert(
          "Unable to Cancel Trip",
          error?.message ||
            "Something went wrong while cancelling the trip."
        );
      }
    };

  const deleteTrip =
    async (
      tripId: string
    ) => {
      try {
        await apiDelete(
          `/trips/${tripId}?company_id=${encodeURIComponent(
            companyId || ""
          )}`
        );

        Alert.alert(
          "Success",
          "Trip deleted successfully."
        );

        await loadTrips();
      } catch (
        error: any
      ) {
        console.error(
          "Delete trip error:",
          error
        );

        Alert.alert(
          "Unable to Delete Trip",
          error?.message ||
            "Something went wrong while deleting the trip."
        );
      }
    };

  const selectDateFilter =
    (filter: DateFilter) => {
      setDateFilter(filter);
      setShowDateFilters(false);

      if (
        filter !== "CUSTOM"
      ) {
        return;
      }

      if (
        !customStartDate
      ) {
        const today =
          formatDateForApi(
            new Date()
          );

        setCustomStartDate(
          today
        );
      }

      if (
        !customEndDate
      ) {
        const today =
          formatDateForApi(
            new Date()
          );

        setCustomEndDate(
          today
        );
      }
    };

  const closeCalendar = () => {
    setCalendarYearPicker(
      false
    );

    setCalendarVisible(
      false
    );
  };

  const openCalendar = (
    target: CalendarTarget
  ) => {
    setCalendarTarget(
      target
    );

    setCalendarYearPicker(
      false
    );

    const selectedDate =
      target === "START"
        ? customStartDate
        : customEndDate;

    if (selectedDate) {
      setCalendarMonth(
        parseDateString(
          selectedDate
        )
      );
    } else {
      setCalendarMonth(
        new Date()
      );
    }

    setCalendarVisible(true);
  };

  const selectCalendarDate = (
    day: number
  ) => {
    const selected =
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        day
      );

    const value =
      formatDateForApi(
        selected
      );

    if (
      calendarTarget ===
      "START"
    ) {
      setCustomStartDate(
        value
      );

      if (
        customEndDate &&
        value >
          customEndDate
      ) {
        setCustomEndDate(
          value
        );
      }
    } else {
      if (
        customStartDate &&
        value <
          customStartDate
      ) {
        Alert.alert(
          "Invalid range",
          "End date cannot be before the start date."
        );

        return;
      }

      setCustomEndDate(
        value
      );
    }

    setCalendarVisible(
      false
    );

    setCalendarYearPicker(
      false
    );

    setDateFilter(
      "CUSTOM"
    );
  };

  const selectCalendarYear = (
    year: number
  ) => {
    setCalendarMonth(
      new Date(
        year,
        calendarMonth.getMonth(),
        1
      )
    );

    setCalendarYearPicker(
      false
    );
  };

  const goToToday = () => {
    setCalendarMonth(
      new Date()
    );
  };

  const filteredTrips =
    useMemo(() => {
      let result =
        [...trips];

      if (
        statusFilter !==
        "ALL"
      ) {
        result =
          result.filter(
            (trip) =>
              trip.status ===
              statusFilter
          );
      }

      const range =
        getDateRange(
          dateFilter
        );

      if (range) {
        const startValue =
          formatDateForApi(
            range.start
          );

        const endValue =
          formatDateForApi(
            range.end
          );

        result =
          result.filter(
            (trip) => {
              const tripDate =
                trip.created_at?.split(
                  "T"
                )[0];

              return (
                tripDate >=
                  startValue &&
                tripDate <=
                  endValue
              );
            }
          );
      }

      if (
        dateFilter ===
        "CUSTOM"
      ) {
        if (
          customStartDate
        ) {
          result =
            result.filter(
              (trip) =>
                trip.created_at?.split(
                  "T"
                )[0] >=
                customStartDate
            );
        }

        if (
          customEndDate
        ) {
          result =
            result.filter(
              (trip) =>
                trip.created_at?.split(
                  "T"
                )[0] <=
                customEndDate
            );
        }
      }

      const searchValue =
        search
          .trim()
          .toLowerCase();

      if (
        searchValue
      ) {
        result =
          result.filter(
            (trip) => {
              const vehicle =
                vehicles.find(
                  (item) =>
                    item.id ===
                    trip.vehicle_id
                );

              const driver =
                drivers.find(
                  (item) =>
                    item.id ===
                    trip.driver_id
                );

              const vehicleRegistration =
                vehicle?.registration_number?.toLowerCase() ||
                "";

              const driverName =
                getDriverName(
                  driver
                ).toLowerCase();

              const driverPhone =
                driver?.phone?.toLowerCase() ||
                "";

              const originValue =
                trip.origin?.toLowerCase() ||
                "";

              const destinationValue =
                trip.destination?.toLowerCase() ||
                "";

              return (
                vehicleRegistration.includes(
                  searchValue
                ) ||
                driverName.includes(
                  searchValue
                ) ||
                driverPhone.includes(
                  searchValue
                ) ||
                originValue.includes(
                  searchValue
                ) ||
                destinationValue.includes(
                  searchValue
                )
              );
            }
          );
      }

      return result;
    }, [
      trips,
      statusFilter,
      dateFilter,
      customStartDate,
      customEndDate,
      search,
      vehicles,
      drivers,
    ]);

  const hasSearch =
    search.trim()
      .length > 0;

  const hasStatusFilter =
    statusFilter !==
    "ALL";

  const tripSummaryLabel =
    dateFilter ===
      "THIS_MONTH" &&
    !hasSearch &&
    !hasStatusFilter
      ? "Trips this month"
      : "Trips found";

  const statusLabel = (
    status:
      | TripStatus
      | "ALL"
  ) => {
    if (
      status === "ALL"
    ) {
      return "All Status";
    }

    if (
      status ===
      "CREATED"
    ) {
      return "Created";
    }

    if (
      status ===
      "STARTED"
    ) {
      return "Started";
    }

    if (
      status ===
      "COMPLETED"
    ) {
      return "Completed";
    }

    return "Cancelled";
  };

  const dateFilterLabel =
    () => {
      if (
        dateFilter ===
        "ALL"
      ) {
        return "All Trips";
      }

      if (
        dateFilter ===
        "TODAY"
      ) {
        return "Today";
      }

      if (
        dateFilter ===
        "YESTERDAY"
      ) {
        return "Yesterday";
      }

      if (
        dateFilter ===
        "LAST_7_DAYS"
      ) {
        return "Last 7 Days";
      }

      if (
        dateFilter ===
        "LAST_30_DAYS"
      ) {
        return "Last 30 Days";
      }

      if (
        dateFilter ===
        "THIS_MONTH"
      ) {
        return "This Month";
      }

      if (
        dateFilter ===
        "LAST_MONTH"
      ) {
        return "Last Month";
      }

      if (
        dateFilter ===
        "CUSTOM"
      ) {
        if (
          customStartDate &&
          customEndDate
        ) {
          return `${formatDisplayDate(
            customStartDate
          )} - ${formatDisplayDate(
            customEndDate
          )}`;
        }

        return "Custom Range";
      }

      return "All Trips";
    };

  const calendarCells =
    getMonthDays(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth()
    );

  const calendarMonthTitle =
    `${MONTH_NAMES[
      calendarMonth.getMonth()
    ]} ${calendarMonth.getFullYear()}`;

  const previousCalendarMonth =
    () => {
      setCalendarMonth(
        new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth() -
            1,
          1
        )
      );
    };

  const nextCalendarMonth =
    () => {
      setCalendarMonth(
        new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth() +
            1,
          1
        )
      );
    };

  return (
    <View
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              onRefresh
            }
          />
        }
      >
        {/* PAGE HEADER */}

        <View
          style={styles.header}
        >
          <View>
            <Text
              style={styles.logo}
            >
              Trips
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Manage your fleet trips
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.addButton
            }
            onPress={
              openAddForm
            }
          >
            <Text
              style={
                styles.addButtonText
              }
            >
              + Add Trip
            </Text>
          </TouchableOpacity>
        </View>

        {/* TRIP COUNT */}

        <View
          style={
            styles.summaryCard
          }
        >
          <Text
            style={
              styles.summaryNumber
            }
          >
            {
              filteredTrips.length
            }
          </Text>

          <Text
            style={
              styles.summaryLabel
            }
          >
            {
              tripSummaryLabel
            }
          </Text>
        </View>

        {/* SEARCH */}

        <View
          style={
            styles.searchContainer
          }
        >
          <TextInput
  nativeID="fleetset-trip-search"
  style={styles.searchInput}
  placeholder="Search vehicle or driver"
  placeholderTextColor="#999999"
  value={search}
  onChangeText={setSearch}
/>

          {search.length >
            0 && (
            <TouchableOpacity
              onPress={() =>
                setSearch("")
              }
            >
              <Text
                style={
                  styles.clearSearch
                }
              >
                ×
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FILTERS */}

        <View
          style={
            styles.filterRow
          }
        >
          <TouchableOpacity
            style={
              styles.filterButton
            }
            onPress={() =>
              setShowDateFilters(
                !showDateFilters
              )
            }
          >
            <Text
              style={
                styles.filterButtonText
              }
            >
              {
                dateFilterLabel()
              }
            </Text>

            <Text
              style={
                styles.filterArrow
              }
            >
              ⌄
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.filterButton
            }
            onPress={() =>
              setShowStatusFilters(
                !showStatusFilters
              )
            }
          >
            <Text
              style={
                styles.filterButtonText
              }
            >
              {
                statusLabel(
                  statusFilter
                )
              }
            </Text>

            <Text
              style={
                styles.filterArrow
              }
            >
              ⌄
            </Text>
          </TouchableOpacity>
        </View>

        {showDateFilters && (
          <View
            style={
              styles.filterPanel
            }
          >
            {[
              [
                "ALL",
                "All Trips",
              ],
              [
                "TODAY",
                "Today",
              ],
              [
                "YESTERDAY",
                "Yesterday",
              ],
              [
                "LAST_7_DAYS",
                "Last 7 Days",
              ],
              [
                "LAST_30_DAYS",
                "Last 30 Days",
              ],
              [
                "THIS_MONTH",
                "This Month",
              ],
              [
                "LAST_MONTH",
                "Last Month",
              ],
              [
                "CUSTOM",
                "Custom Range",
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <TouchableOpacity
                  key={value}
                  style={
                    styles.filterOption
                  }
                  onPress={() =>
                    selectDateFilter(
                      value as DateFilter
                    )
                  }
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      dateFilter ===
                        value &&
                        styles.selectedFilterText,
                    ]}
                  >
                    {
                      label
                    }
                  </Text>

                  {dateFilter ===
                    value && (
                    <Text
                      style={
                        styles.checkMark
                      }
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              )
            )}

            {dateFilter ===
              "CUSTOM" && (
              <View
                style={
                  styles.customRangeBox
                }
              >
                <Text
                  style={
                    styles.customRangeTitle
                  }
                >
                  Custom date range
                </Text>

                <View
                  style={
                    styles.customDateRow
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.dateField
                    }
                    onPress={() =>
                      openCalendar(
                        "START"
                      )
                    }
                  >
                    <Text
                      style={
                        styles.dateFieldLabel
                      }
                    >
                      Start date
                    </Text>

                    <Text
                      style={
                        styles.dateFieldValue
                      }
                    >
                      {customStartDate
                        ? formatDisplayDate(
                            customStartDate
                          )
                        : "Select date"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.dateField
                    }
                    onPress={() =>
                      openCalendar(
                        "END"
                      )
                    }
                  >
                    <Text
                      style={
                        styles.dateFieldLabel
                      }
                    >
                      End date
                    </Text>

                    <Text
                      style={
                        styles.dateFieldValue
                      }
                    >
                      {customEndDate
                        ? formatDisplayDate(
                            customEndDate
                          )
                        : "Select date"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
  style={styles.filterCancelButton}
  onPress={() => {
    setShowDateFilters(false);
  }}
>
  <Text style={styles.filterCancelButtonText}>
    Cancel
  </Text>
</TouchableOpacity>
          </View>
        )}

        {showStatusFilters && (
  <View style={styles.filterPanel}>
    {(["ALL", "CREATED", "STARTED", "COMPLETED", "CANCELLED"] as const).map(
      (value) => (
        <TouchableOpacity
          key={value}
          style={styles.filterOption}
          onPress={() => {
            setStatusFilter(value);
            setShowStatusFilters(false);
          }}
        >
          <Text style={styles.filterOptionText}>
            {value === "ALL"
              ? "All Status"
              : value.charAt(0) + value.slice(1).toLowerCase()}
          </Text>

          
        </TouchableOpacity>
      )
    )}

    {/* Cancel button MUST be outside the map() */}
    <TouchableOpacity
      style={styles.filterCancelButton}
      onPress={() => {
        setShowStatusFilters(false);
      }}
    >
      <Text style={styles.filterCancelButtonText}>
        Cancel
      </Text>
    </TouchableOpacity>
  </View>
)}
        {/* LIST HEADER */}

        <View
          style={
            styles.listHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Trips
          </Text>

          <Text
            style={
              styles.resultCount
            }
          >
            {
              filteredTrips.length
            }{" "}
            found
          </Text>
        </View>

        {/* TRIP LIST */}

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
              Loading trips...
            </Text>
          </View>
        ) : filteredTrips.length ===
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
              🚚
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No trips found
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Try changing your filters or create a new trip.
            </Text>

            <TouchableOpacity
              style={
                styles.emptyButton
              }
              onPress={
                openAddForm
              }
            >
              <Text
                style={
                  styles.emptyButtonText
                }
              >
                + Create Trip
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTrips.map(
            (trip) => {
              const vehicle =
                vehicles.find(
                  (item) =>
                    item.id ===
                    trip.vehicle_id
                );

              const driver =
                drivers.find(
                  (item) =>
                    item.id ===
                    trip.driver_id
                );

              return (
                <View
                  key={
                    trip.id
                  }
                  style={
                    styles.tripCard
                  }
                >
                  <View
                    style={
                      styles.tripTopRow
                    }
                  >
                    <View
                      style={
                        styles.tripTitleArea
                      }
                    >
                      <Text
                        style={
                          styles.vehicleNumber
                        }
                      >
                        {vehicle?.registration_number ||
                          "Vehicle unavailable"}
                      </Text>

                      <Text
                        style={
                          styles.driverName
                        }
                      >
                        {
                          getDriverName(
                            driver
                          )
                        }
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        trip.status ===
                          "CREATED" &&
                          styles.createdBadge,
                        trip.status ===
                          "STARTED" &&
                          styles.startedBadge,
                        trip.status ===
                          "COMPLETED" &&
                          styles.completedBadge,
                        trip.status ===
                          "CANCELLED" &&
                          styles.cancelledBadge,
                      ]}
                    >
                      <Text
                        style={
                          styles.statusBadgeText
                        }
                      >
                        {
                          statusLabel(
                            trip.status
                          )
                        }
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.routeBox
                    }
                  >
                    <View
                      style={
                        styles.routePoint
                      }
                    >
                      <View
                        style={
                          styles.routeDot
                        }
                      />

                      <View
                        style={
                          styles.routeTextArea
                        }
                      >
                        <Text
                          style={
                            styles.routeLabel
                          }
                        >
                          FROM
                        </Text>

                        <Text
                          style={
                            styles.routeValue
                          }
                        >
                          {
                            trip.origin
                          }
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.routeLine
                      }
                    />

                    <View
                      style={
                        styles.routePoint
                      }
                    >
                      <View
                        style={
                          styles.routeDot
                        }
                      />

                      <View
                        style={
                          styles.routeTextArea
                        }
                      >
                        <Text
                          style={
                            styles.routeLabel
                          }
                        >
                          TO
                        </Text>

                        <Text
                          style={
                            styles.routeValue
                          }
                        >
                          {
                            trip.destination
                          }
                        </Text>
                      </View>
                    </View>
                  </View>

                  {trip.cargo_description ? (
                    <View
                      style={
                        styles.infoRow
                      }
                    >
                      <Text
                        style={
                          styles.infoLabel
                        }
                      >
                        Cargo
                      </Text>

                      <Text
                        style={
                          styles.infoValue
                        }
                      >
                        {
                          trip.cargo_description
                        }
                      </Text>
                    </View>
                  ) : null}

                  {trip.remarks ? (
                    <View
                      style={
                        styles.infoRow
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
                          styles.infoValue
                        }
                      >
                        {
                          trip.remarks
                        }
                      </Text>
                    </View>
                  ) : null}

                  <Text
                    style={
                      styles.createdDate
                    }
                  >
                    Created{" "}
                    {formatDateTime(
                      trip.created_at
                    )}
                  </Text>

                  {trip.actual_start ? (
                    <Text
                      style={
                        styles.createdDate
                      }
                    >
                      Started{" "}
                      {formatDateTime(
                        trip.actual_start
                      )}
                    </Text>
                  ) : null}

                  {trip.actual_end ? (
                    <Text
                      style={
                        styles.createdDate
                      }
                    >
                      Ended{" "}
                      {formatDateTime(
                        trip.actual_end
                      )}
                    </Text>
                  ) : null}

                  <View
                    style={
                      styles.actionRow
                    }
                  >
                    {trip.status ===
                      "CREATED" && (
                      <>
                        <TouchableOpacity
                          style={
                            styles.secondaryAction
                          }
                          onPress={() =>
                            openEditForm(
                              trip
                            )
                          }
                        >
                          <Text
                            style={
                              styles.secondaryActionText
                            }
                          >
                            Edit
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.primarySmallAction
                          }
                          onPress={() =>
                            startTrip(
                              trip.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.primarySmallActionText
                            }
                          >
                            Start
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.secondaryAction
                          }
                          onPress={() =>
                            cancelTrip(
                              trip.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.secondaryActionText
                            }
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.deleteAction
                          }
                          onPress={() =>
                            deleteTrip(
                              trip.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.deleteActionText
                            }
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {trip.status ===
                      "STARTED" && (
                      <>
                        <TouchableOpacity
                          style={
                            styles.primarySmallAction
                          }
                          onPress={() =>
                            completeTrip(
                              trip.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.primarySmallActionText
                            }
                          >
                            Complete
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.secondaryAction
                          }
                          onPress={() =>
                            cancelTrip(
                              trip.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.secondaryActionText
                            }
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {trip.status ===
                      "COMPLETED" && (
                      <Text
                        style={
                          styles.viewOnlyText
                        }
                      >
                        Completed trip
                      </Text>
                    )}

                    {trip.status ===
                      "CANCELLED" && (
                      <Text
                        style={
                          styles.viewOnlyText
                        }
                      >
                        Cancelled trip
                      </Text>
                    )}
                  </View>
                </View>
              );
            }
          )
        )}
      </ScrollView>

      {/* ADD / EDIT TRIP MODAL */}

      <Modal
        visible={
          showForm
        }
        transparent
        animationType="slide"
        onRequestClose={
          closeForm
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.formModal
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
                  {editingTrip
                    ? "Edit Trip"
                    : "Add Trip"}
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {editingTrip
                    ? "Update trip details"
                    : "Create a new fleet trip"}
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.closeButton
                }
                onPress={
                  closeForm
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
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              {!editingTrip && (
                <>
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Vehicle *
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.selectField
                    }
                    onPress={() =>
                      setShowVehiclePicker(
                        true
                      )
                    }
                  >
                    <Text
                      style={
                        selectedVehicle
                          ? styles.selectValue
                          : styles.selectPlaceholder
                      }
                    >
                      {selectedVehicle?.registration_number ||
                        "Select vehicle"}
                    </Text>

                    <Text
                      style={
                        styles.selectArrow
                      }
                    >
                      ⌄
                    </Text>
                  </TouchableOpacity>

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Assigned Driver *
                  </Text>

                  <View
                    style={[
                      styles.selectField,
                      styles.readOnlySelectField,
                    ]}
                  >
                    <Text
                      style={
                        selectedDriver
                          ? styles.selectValue
                          : styles.selectPlaceholder
                      }
                    >
                      {assignmentsLoading
                        ? "Loading driver..."
                        : selectedDriver
                        ? getDriverName(
                            selectedDriver
                          )
                        : vehicleId
                        ? "No driver assigned"
                        : "Select a vehicle first"}
                    </Text>

                    {selectedDriver ? (
                      <Text
                        style={
                          styles.assignedCheckMark
                        }
                      >
                        ✓
                      </Text>
                    ) : null}
                  </View>

                  {vehicleId &&
                    !assignmentsLoading &&
                    !getActiveAssignmentForVehicle(
                      vehicleId
                    ) && (
                      <View
                        style={
                          styles.driverWarning
                        }
                      >
                        <Text
                          style={
                            styles.driverWarningTitle
                          }
                        >
                          ⚠ No Driver Assigned
                        </Text>

                        <Text
                          style={
                            styles.driverWarningText
                          }
                        >
                          Please assign a driver to this vehicle before creating a trip.
                        </Text>
                      </View>
                    )}
                </>
              )}

              {editingTrip && (
                <View
                  style={
                    styles.lockedInfo
                  }
                >
                  <Text
                    style={
                      styles.lockedInfoLabel
                    }
                  >
                    Vehicle
                  </Text>

                  <Text
                    style={
                      styles.lockedInfoValue
                    }
                  >
                    {selectedVehicle?.registration_number ||
                      "Vehicle unavailable"}
                  </Text>

                  <Text
                    style={
                      styles.lockedInfoLabel
                    }
                  >
                    Driver
                  </Text>

                  <Text
                    style={
                      styles.lockedInfoValue
                    }
                  >
                    {
                      getDriverName(
                        selectedDriver
                      )
                    }
                  </Text>
                </View>
              )}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Origin *
              </Text>

              <TextInput
                style={
                  styles.input
                }
                placeholder="Enter origin"
                placeholderTextColor="#999999"
                value={origin}
                onChangeText={
                  setOrigin
                }
              />

              <Text
                style={
                  styles.inputLabel
                }
              >
                Destination *
              </Text>

              <TextInput
                style={
                  styles.input
                }
                placeholder="Enter destination"
                placeholderTextColor="#999999"
                value={destination}
                onChangeText={
                  setDestination
                }
              />

              <Text
                style={
                  styles.inputLabel
                }
              >
                Cargo Description
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
                placeholder="Enter cargo description"
                placeholderTextColor="#999999"
                value={
                  cargoDescription
                }
                onChangeText={
                  setCargoDescription
                }
                multiline
                numberOfLines={
                  3
                }
              />

              <Text
                style={
                  styles.inputLabel
                }
              >
                Remarks
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
                placeholder="Enter remarks"
                placeholderTextColor="#999999"
                value={
                  remarks
                }
                onChangeText={
                  setRemarks
                }
                multiline
                numberOfLines={
                  3
                }
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  saving &&
                    styles.disabledButton,
                ]}
                onPress={
                  saveTrip
                }
                disabled={
                  saving
                }
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
                    {editingTrip
                      ? "Update Trip"
                      : "Create Trip"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.modalCancelButton
                }
                onPress={
                  closeForm
                }
                disabled={
                  saving
                }
              >
                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* VEHICLE PICKER */}

      <Modal
        visible={
          showVehiclePicker
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowVehiclePicker(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.pickerModal
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
                  Select Vehicle
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Choose an active vehicle
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.closeButton
                }
                onPress={() =>
                  setShowVehiclePicker(
                    false
                  )
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

            <ScrollView>
              {vehicles.filter(
                (vehicle) =>
                  vehicle.is_active !==
                  false
              ).length === 0 ? (
                <View
                  style={
                    styles.pickerEmpty
                  }
                >
                  <Text
                    style={
                      styles.pickerEmptyText
                    }
                  >
                    No active vehicles found.
                  </Text>
                </View>
              ) : (
                vehicles
                  .filter(
                    (vehicle) =>
                      vehicle.is_active !==
                      false
                  )
                  .map(
                    (
                      vehicle
                    ) => (
                      <TouchableOpacity
                        key={
                          vehicle.id
                        }
                        style={[
                          styles.pickerOption,
                          vehicle.id ===
                            vehicleId &&
                            styles.selectedPickerOption,
                        ]}
                        onPress={() => {
                          const activeAssignment =
                            getActiveAssignmentForVehicle(
                              vehicle.id
                            );

                          setVehicleId(
                            vehicle.id
                          );

                          if (
                            activeAssignment
                          ) {
                            setDriverId(
                              activeAssignment.driver_id
                            );
                          } else {
                            setDriverId(
                              ""
                            );
                          }

                          setShowVehiclePicker(
                            false
                          );
                        }}
                      >
                        <View>
                          <Text
                            style={
                              styles.pickerMainText
                            }
                          >
                            {
                              vehicle.registration_number
                            }
                          </Text>

                          <Text
                            style={
                              styles.pickerSubText
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
                              ) ||
                              "Vehicle"}
                          </Text>
                        </View>

                        {vehicle.id ===
                          vehicleId && (
                          <Text
                            style={
                              styles.checkMark
                            }
                          >
                            ✓
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* STANDARD FLEETSET DATE CALENDAR */}

      <Modal
        visible={
          calendarVisible
        }
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
                      Choose the trip date year
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
                      (
                        _,
                        index
                      ) =>
                        new Date().getFullYear() +
                        10 -
                        index
                    ).map(
                      (year) => {
                        const selected =
                          calendarMonth.getFullYear() ===
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
                              selectCalendarYear(
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
                      styles.calendarCancelButtonText
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
                    onPress={
                      previousCalendarMonth
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
                          calendarMonth.getMonth()
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
                        {
                          calendarMonth.getFullYear()
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
                    onPress={
                      nextCalendarMonth
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
                  Select the date for the{" "}
                  {calendarTarget ===
                  "START"
                    ? "start"
                    : "end"}{" "}
                  of the custom range.
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
                        {
                          day
                        }
                      </Text>
                    )
                  )}
                </View>

                <View
                  style={
                    styles.calendarGrid
                  }
                >
                  {calendarCells.map(
                    (
                      day,
                      index
                    ) => {
                      if (
                        day ===
                        null
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

                      const selectedDate =
                        formatDateForApi(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth(),
                            day
                          )
                        );

                      const isStart =
                        selectedDate ===
                        customStartDate;

                      const isEnd =
                        selectedDate ===
                        customEndDate;

                      const isToday =
                        selectedDate ===
                        formatDateForApi(
                          new Date()
                        );

                      return (
                        <TouchableOpacity
                          key={
                            selectedDate
                          }
                          style={
                            styles.calendarDay
                          }
                          onPress={() =>
                            selectCalendarDate(
                              day
                            )
                          }
                        >
                          <View
                            style={[
                              styles.calendarDayInner,
                              isToday &&
                                styles.todayDay,
                              (isStart ||
                                isEnd) &&
                                styles.selectedDay,
                            ]}
                          >
                            <Text
                              style={[
                                styles.calendarDayText,
                                isToday &&
                                  styles.todayText,
                                (isStart ||
                                  isEnd) &&
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
                    }
                  )}
                </View>

                <View
                  style={
                    styles.calendarSelectedInfo
                  }
                >
                  <Text
                    style={
                      styles.calendarSelectedLabel
                    }
                  >
                    Start
                  </Text>

                  <Text
                    style={
                      styles.calendarSelectedValue
                    }
                  >
                    {customStartDate
                      ? formatDisplayDate(
                          customStartDate
                        )
                      : "Not selected"}
                  </Text>

                  <Text
                    style={
                      styles.calendarSelectedLabel
                    }
                  >
                    End
                  </Text>

                  <Text
                    style={
                      styles.calendarSelectedValue
                    }
                  >
                    {customEndDate
                      ? formatDisplayDate(
                          customEndDate
                        )
                      : "Not selected"}
                  </Text>
                </View>

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
                      styles.calendarCancelButtonText
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
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F7F8FA",
    },

    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },

    header: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      marginBottom: 22,
    },

    logo: {
      fontSize: 28,
      fontWeight: "800",
      color: "#111111",
    },

    subtitle: {
      marginTop: 4,
      color: "#666666",
      fontSize: 14,
    },

    summaryCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        "#EEEEEE",
      padding: 18,
      marginBottom: 18,
    },

    summaryNumber: {
      color: "#111111",
      fontSize: 28,
      fontWeight: "800",
    },

    summaryLabel: {
      color: "#666666",
      marginTop: 3,
      fontSize: 13,
    },

    addButton: {
      backgroundColor:
        "#111111",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },

    addButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    searchContainer: {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#EEEEEE",
  height: 50,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  marginBottom: 12,
},

searchInput: {
  flex: 1,
  fontSize: 14,
  color: "#111111",
  paddingVertical: 0,
  paddingHorizontal: 0,
},

clearSearch: {
  fontSize: 22,
  color: "#777777",
  paddingLeft: 8,
  width: 28,
  height: 28,
  textAlign: "center",
},

    filterRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      marginBottom: 10,
    },

    filterButton: {
      width: "48%",
      minHeight: 46,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#EEEEEE",
      borderRadius: 11,
      paddingHorizontal: 12,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    filterButtonText: {
      color: "#222222",
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },

    filterArrow: {
      color: "#777777",
      fontSize: 18,
    },

    filterPanel: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        "#EEEEEE",
      marginBottom: 12,
      overflow: "hidden",
    },

    filterCancelButton: {
      alignSelf: "flex-end",
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: "#EEEEEE",
    },
    filterCancelButtonText: {
      color: "#111111",
      fontWeight: "600",
    },
    filterOption: {
      minHeight: 45,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor:
        "#F1F1F1",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    filterOptionText: {
      color: "#333333",
      fontSize: 14,
    },

    selectedFilterText: {
      color: "#111111",
      fontWeight: "700",
    },

    checkMark: {
      color: "#111111",
      fontSize: 17,
      fontWeight: "700",
    },

    customRangeBox: {
      padding: 14,
      backgroundColor:
        "#FAFAFA",
    },

    customRangeTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#333333",
      marginBottom: 10,
    },

    customDateRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
    },

    dateField: {
      width: "48%",
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      borderRadius: 10,
      padding: 11,
    },

    dateFieldLabel: {
      color: "#777777",
      fontSize: 11,
      marginBottom: 5,
    },

    dateFieldValue: {
      color: "#111111",
      fontSize: 13,
      fontWeight: "600",
    },

    listHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      marginTop: 12,
      marginBottom: 12,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#111111",
    },

    resultCount: {
      color: "#777777",
      fontSize: 13,
    },

    loadingContainer: {
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingVertical: 60,
    },

    loadingText: {
      color: "#777777",
      marginTop: 10,
      fontSize: 13,
    },

    emptyCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        "#EEEEEE",
      padding: 25,
      alignItems:
        "center",
    },

    emptyIcon: {
      fontSize: 35,
      marginBottom: 10,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: "#111111",
    },

    emptyDescription: {
      color: "#777777",
      fontSize: 13,
      textAlign:
        "center",
      marginTop: 5,
      lineHeight: 19,
    },

    emptyButton: {
      backgroundColor:
        "#111111",
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 11,
      marginTop: 16,
    },

    emptyButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    tripCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        "#EEEEEE",
      padding: 16,
      marginBottom: 13,
    },

    tripTopRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      marginBottom: 14,
    },

    tripTitleArea: {
      flex: 1,
      paddingRight: 10,
    },

    vehicleNumber: {
      fontSize: 17,
      fontWeight: "800",
      color: "#111111",
    },

    driverName: {
      color: "#666666",
      fontSize: 13,
      marginTop: 4,
    },

    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 20,
    },

    createdBadge: {
      backgroundColor:
        "#EEEEEE",
    },

    startedBadge: {
      backgroundColor:
        "#E8E8E8",
    },

    completedBadge: {
      backgroundColor:
        "#E2E2E2",
    },

    cancelledBadge: {
      backgroundColor:
        "#F1F1F1",
    },

    statusBadgeText: {
      color: "#222222",
      fontSize: 11,
      fontWeight: "700",
    },

    routeBox: {
      backgroundColor:
        "#F7F8FA",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },

    routePoint: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
    },

    routeDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        "#111111",
      marginTop: 4,
      marginRight: 10,
    },

    routeTextArea: {
      flex: 1,
    },

    routeLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: "#888888",
      marginBottom: 2,
    },

    routeValue: {
      fontSize: 14,
      fontWeight: "600",
      color: "#222222",
    },

    routeLine: {
      height: 17,
      borderLeftWidth: 1,
      borderLeftColor:
        "#BBBBBB",
      marginLeft: 4,
      marginVertical: 2,
    },

    infoRow: {
      flexDirection:
        "row",
      marginTop: 8,
    },

    infoLabel: {
      width: 70,
      color: "#777777",
      fontSize: 12,
      fontWeight: "600",
    },

    infoValue: {
      flex: 1,
      color: "#333333",
      fontSize: 12,
    },

    createdDate: {
      color: "#888888",
      fontSize: 11,
      marginTop: 7,
    },

    actionRow: {
      flexDirection:
        "row",
      flexWrap: "wrap",
      marginTop: 13,
      gap: 7,
    },

    primarySmallAction: {
      backgroundColor:
        "#111111",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    primarySmallActionText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },

    secondaryAction: {
      backgroundColor:
        "#F5F5F5",
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    secondaryActionText: {
      color: "#222222",
      fontSize: 12,
      fontWeight: "600",
    },

    deleteAction: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#D9D9D9",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    deleteActionText: {
      color: "#111111",
      fontSize: 12,
      fontWeight: "600",
    },

    viewOnlyText: {
      color: "#777777",
      fontSize: 12,
      fontWeight: "600",
      marginTop: 12,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.45)",
      justifyContent:
        "flex-end",
    },

    formModal: {
      backgroundColor:
        "#FFFFFF",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "92%",
      padding: 20,
    },

    pickerModal: {
      backgroundColor:
        "#FFFFFF",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "75%",
      padding: 20,
    },

    modalHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      marginBottom: 20,
    },

    modalTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: "#111111",
    },

    modalSubtitle: {
      color: "#777777",
      fontSize: 13,
      marginTop: 4,
    },

    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        "#F2F2F2",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    closeButtonText: {
      fontSize: 24,
      color: "#444444",
      lineHeight: 25,
    },

    inputLabel: {
      color: "#333333",
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 7,
      marginTop: 12,
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      borderRadius: 10,
      paddingHorizontal: 13,
      color: "#111111",
      fontSize: 14,
      backgroundColor:
        "#FFFFFF",
    },

    multilineInput: {
      height: 85,
      paddingTop: 12,
      textAlignVertical:
        "top",
    },

    selectField: {
      height: 48,
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      borderRadius: 10,
      paddingHorizontal: 13,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    readOnlySelectField: {
      backgroundColor:
        "#F7F8FA",
    },

    assignedCheckMark: {
      color: "#111111",
      fontSize: 17,
      fontWeight: "700",
    },

    driverWarning: {
      backgroundColor:
        "#F7F7F7",
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      borderRadius: 10,
      padding: 12,
      marginTop: 9,
    },

    driverWarningTitle: {
      color: "#222222",
      fontSize: 13,
      fontWeight: "700",
    },

    driverWarningText: {
      color: "#777777",
      fontSize: 12,
      marginTop: 4,
      lineHeight: 17,
    },

    selectValue: {
      color: "#111111",
      fontSize: 14,
      fontWeight: "500",
    },

    selectPlaceholder: {
      color: "#999999",
      fontSize: 14,
    },

    selectArrow: {
      color: "#777777",
      fontSize: 18,
    },

    lockedInfo: {
      backgroundColor:
        "#F7F8FA",
      borderRadius: 11,
      padding: 13,
      marginBottom: 4,
    },

    lockedInfoLabel: {
      color: "#888888",
      fontSize: 10,
      fontWeight: "700",
      marginTop: 3,
    },

    lockedInfoValue: {
      color: "#222222",
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2,
      marginBottom: 7,
    },

    saveButton: {
      backgroundColor:
        "#111111",
      borderRadius: 11,
      height: 50,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 22,
    },

    saveButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    disabledButton: {
      opacity: 0.6,
    },

    modalCancelButton: {
      height: 48,
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 5,
      marginBottom: 10,
    },

    modalCancelText: {
      color: "#666666",
      fontSize: 14,
      fontWeight: "600",
    },

    pickerOption: {
      minHeight: 65,
      borderBottomWidth: 1,
      borderBottomColor:
        "#EEEEEE",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      paddingHorizontal: 5,
    },

    selectedPickerOption: {
      backgroundColor:
        "#F7F8FA",
    },

    pickerMainText: {
      color: "#111111",
      fontSize: 15,
      fontWeight: "700",
    },

    pickerSubText: {
      color: "#777777",
      fontSize: 12,
      marginTop: 3,
    },

    pickerEmpty: {
      paddingVertical: 40,
      alignItems:
        "center",
    },

    pickerEmptyText: {
      color: "#777777",
      fontSize: 14,
    },

    // CALENDAR

    calendarOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.45)",
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 20,
    },

    calendarModal: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "85%",
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      padding: 20,
    },

    calendarHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginBottom: 20,
    },

    monthArrow: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        "#F3F3F3",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    monthArrowText: {
      fontSize: 32,
      lineHeight: 34,
      color: "#111111",
    },

    calendarTitleContainer: {
      alignItems:
        "center",
    },

    calendarMonth: {
      fontSize: 18,
      fontWeight: "800",
      color: "#111111",
    },

    calendarYearSelector: {
      flexDirection:
        "row",
      alignItems:
        "center",
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
      textAlign:
        "center",
      fontSize: 11,
      color: "#888888",
      marginTop: -10,
      marginBottom: 12,
    },

    todayButton: {
      alignSelf:
        "center",
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor:
        "#EEEEEE",
    },

    todayButtonText: {
      color: "#111111",
      fontSize: 12,
      fontWeight: "700",
    },

    weekRow: {
      flexDirection:
        "row",
      marginBottom: 8,
    },

    weekDay: {
      width: "14.285%",
      textAlign:
        "center",
      fontSize: 11,
      fontWeight: "700",
      color: "#888888",
    },

    calendarGrid: {
      flexDirection:
        "row",
      flexWrap: "wrap",
    },

    calendarDay: {
      width: "14.285%",
      height: 42,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    calendarDayInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems:
        "center",
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
      borderColor:
        "#111111",
      borderRadius: 21,
    },

    todayText: {
      fontWeight: "800",
    },

    selectedDay: {
      backgroundColor:
        "#111111",
      borderRadius: 21,
    },

    selectedDayText: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    calendarSelectedInfo: {
      marginTop: 15,
      backgroundColor:
        "#F7F8FA",
      borderRadius: 10,
      padding: 12,
      flexDirection:
        "row",
      alignItems:
        "center",
      flexWrap: "wrap",
    },

    calendarSelectedLabel: {
      color: "#888888",
      fontSize: 11,
      fontWeight: "700",
      marginRight: 5,
    },

    calendarSelectedValue: {
      color: "#222222",
      fontSize: 12,
      fontWeight: "600",
      marginRight: 18,
    },

    calendarDoneButton: {
      minHeight: 44,
      borderRadius: 10,
      backgroundColor:
        "#111111",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 12,
    },

    calendarDoneText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    calendarCancelButton: {
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      backgroundColor:
        "#FFFFFF",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 10,
    },

    calendarCancelButtonText: {
      color: "#111111",
      fontSize: 13,
      fontWeight: "700",
    },

    // YEAR PICKER

    calendarPickerHeader: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
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
      flexDirection:
        "row",
      flexWrap: "wrap",
      gap: 8,
    },

    calendarYearOption: {
      width: "31.5%",
      minHeight: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        "#DDDDDD",
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FFFFFF",
    },

    calendarYearOptionSelected: {
      backgroundColor:
        "#111111",
      borderColor:
        "#111111",
    },

    calendarYearOptionText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#111111",
    },

    calendarYearOptionTextSelected: {
      color: "#FFFFFF",
    },
  });