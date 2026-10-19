import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_URL } from "../constants/config";
import { apiGet, apiPost } from "../services/api";
import { getToken, getUser } from "../utils/storage";

type ReportSummary = {
  total_vehicles: number;
  active_vehicles: number;
  inactive_vehicles: number;
  total_drivers: number;
  total_trips: number;
  total_fuel_expense: string | number;
  total_maintenance_expense: string | number;
  total_expense: string | number;
};

type ReportDateField = "start" | "end" | null;
type ReportType = "daily" | "weekly" | "monthly" | "custom";

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
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

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const cells: Array<number | null> = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }

  return cells;
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;
}

function getMonthStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function getMonthEnd(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length)
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export default function ReportsScreen() {
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [summary, setSummary] =
    useState<ReportSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("custom");

  const [emailModalVisible, setEmailModalVisible] =
    useState(false);

  const [recipientEmail, setRecipientEmail] =
    useState("");

  const [calendarVisible, setCalendarVisible] =
    useState(false);

  const [calendarMonth, setCalendarMonth] =
    useState(new Date());

  const [yearPickerVisible, setYearPickerVisible] =
    useState(false);

  const [calendarTarget, setCalendarTarget] =
    useState<ReportDateField>(null);

  const loadUser = useCallback(async () => {
  try {
    const user = await getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    console.log("Reports screen user:", user);

    setCompanyId(user.company_id || "");
    setBranchId(user.branch_id || "");

    const currentUser = await apiGet("/auth/me");

    setUserEmail(currentUser.email || "");
    setRecipientEmail(currentUser.email || "");
  } catch (error) {
    console.error("Load user error:", error);

    Alert.alert(
      "Authentication Error",
      "Unable to load your account information."
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const applyReportPeriod = (
    type: ReportType
  ) => {
    const today = new Date();

    setSelectedReportType(type);
    setSummary(null);

    if (type === "daily") {
      const value =
        formatDateForApi(today);

      setStartDate(value);
      setEndDate(value);
      return;
    }

    if (type === "weekly") {
      const weekStart =
        getWeekStart(today);

      const weekEnd = new Date(
        weekStart
      );

      weekEnd.setDate(
        weekStart.getDate() + 6
      );

      setStartDate(
        formatDateForApi(weekStart)
      );

      setEndDate(
        formatDateForApi(weekEnd)
      );

      return;
    }

    if (type === "monthly") {
      const monthStart =
        getMonthStart(today);

      const monthEnd =
        getMonthEnd(today);

      setStartDate(
        formatDateForApi(monthStart)
      );

      setEndDate(
        formatDateForApi(monthEnd)
      );

      return;
    }

    setStartDate("");
    setEndDate("");
  };

  const openReportCalendar = (
    target: "start" | "end"
  ) => {
    const currentValue =
      target === "start"
        ? startDate
        : endDate;

    if (currentValue) {
      setCalendarMonth(
        parseDateString(currentValue)
      );
    } else {
      setCalendarMonth(new Date());
    }

    setCalendarTarget(target);
    setYearPickerVisible(false);
    setCalendarVisible(true);
  };

  const closeReportCalendar = () => {
    setCalendarVisible(false);
    setYearPickerVisible(false);
    setCalendarTarget(null);
  };

  const selectReportCalendarDate = (
    day: number
  ) => {
    const selected = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      day
    );

    const value =
      formatDateForApi(selected);

    if (calendarTarget === "start") {
      setStartDate(value);
    }

    if (calendarTarget === "end") {
      setEndDate(value);
    }

    setSelectedReportType("custom");
    setSummary(null);

    closeReportCalendar();
  };

  const previousCalendarMonth = () => {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  };

  const nextCalendarMonth = () => {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      )
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

    setYearPickerVisible(false);
  };

  const validateDates = () => {
    if (!startDate || !endDate) {
      Alert.alert(
        "Missing Dates",
        "Please select both start date and end date."
      );

      return false;
    }

    if (startDate > endDate) {
      Alert.alert(
        "Invalid Dates",
        "Start date cannot be after end date."
      );

      return false;
    }

    if (!companyId) {
      Alert.alert(
        "Error",
        "Company information could not be loaded."
      );

      return false;
    }

    return true;
  };

  const generateReport = async () => {
    if (!validateDates()) {
      return;
    }

    try {
      setGenerating(true);

      let endpoint = "";

      if (selectedReportType === "daily") {
        endpoint =
          `/reports/${companyId}/daily` +
          `?report_date=${encodeURIComponent(startDate)}`;
      } else if (
        selectedReportType === "weekly"
      ) {
        endpoint =
          `/reports/${companyId}/weekly` +
          `?week_start=${encodeURIComponent(startDate)}`;
      } else if (
        selectedReportType === "monthly"
      ) {
        const selectedMonth =
          parseDateString(startDate);

        endpoint =
          `/reports/${companyId}/monthly` +
          `?year=${selectedMonth.getFullYear()}` +
          `&month=${selectedMonth.getMonth() + 1}`;
      } else {
        endpoint =
          `/reports/${companyId}/date-range` +
          `?start_date=${encodeURIComponent(startDate)}` +
          `&end_date=${encodeURIComponent(endDate)}`;
      }

      if (branchId) {
        endpoint +=
          `&branch_id=${encodeURIComponent(branchId)}`;
      }

      console.log(
        "Generating report:",
        endpoint
      );

      const result = await apiGet(endpoint);

      console.log(
        "Report response:",
        JSON.stringify(
          result,
          null,
          2
        )
      );

      if (!result?.success) {
        throw new Error(
          result?.message ||
            "Failed to generate report"
        );
      }

      if (!result?.data?.summary) {
        throw new Error(
          "Report was generated, but summary data was not returned."
        );
      }

      setSummary(
        result.data.summary
      );

      Alert.alert(
        "Report Generated",
        "Your FleetSet report has been generated successfully."
      );
    } catch (error) {
      console.error(
        "Generate report error:",
        error
      );

      Alert.alert(
        "Report Error",
        error instanceof Error
          ? error.message
          : "Failed to generate report."
      );
    } finally {
      setGenerating(false);
    }
  };

  const downloadReportPdf = async () => {
    if (!validateDates()) {
      return;
    }

    try {
      setDownloading(true);

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found"
        );
      }

      const response = await fetch(
        `${API_URL}/reports/${companyId}/custom/pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Failed to download report.";

        try {
          const result =
            await response.json();

          errorMessage =
            result.message ||
            result.detail ||
            errorMessage;
        } catch {
          // Keep default error message.
        }

        throw new Error(errorMessage);
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/pdf"
        )
      ) {
        throw new Error(
          "The server did not return a PDF file."
        );
      }

      if (Platform.OS === "web") {
        const blob =
          await response.blob();

        const url =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = url;

        link.download =
          `FleetSet_Report_${startDate}_${endDate}.pdf`;

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);

        Alert.alert(
          "Download Complete",
          "The FleetSet report has been downloaded."
        );

        return;
      }

      const buffer =
        await response.arrayBuffer();

      const base64 =
        arrayBufferToBase64(buffer);

      const fileUri =
        `${FileSystem.cacheDirectory}FleetSet_Report_${startDate}_${endDate}.pdf`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        base64,
        {
          encoding:
            FileSystem.EncodingType.Base64,
        }
      );

      const sharingAvailable =
        await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(
          "PDF Saved",
          `The report was saved locally at:\n${fileUri}`
        );

        return;
      }

      await Sharing.shareAsync(
        fileUri,
        {
          mimeType:
            "application/pdf",
          dialogTitle:
            "FleetSet Report",
          UTI:
            "com.adobe.pdf",
        }
      );
    } catch (error) {
      console.error(
        "Download report error:",
        error
      );

      Alert.alert(
        "Download Error",
        error instanceof Error
          ? error.message
          : "Failed to download report."
      );
    } finally {
      setDownloading(false);
    }
  };

  const openEmailModal = () => {
    if (!validateDates()) {
      return;
    }

    setRecipientEmail(userEmail);
    setEmailModalVisible(true);
  };

  const sendReportEmail = async () => {
    if (!recipientEmail.trim()) {
      Alert.alert(
        "Missing Email",
        "Please enter a recipient email address."
      );

      return;
    }

    if (!validateDates()) {
      return;
    }

    try {
      setSendingEmail(true);

      const result = await apiPost(
        `/reports/${companyId}/custom/email`,
        {
          start_date: startDate,
          end_date: endDate,
          recipient_email:
            recipientEmail.trim(),
        }
      );

      if (!result?.success) {
        throw new Error(
          result?.message ||
            "Failed to send report email"
        );
      }

      setEmailModalVisible(false);

      Alert.alert(
        "Email Sent",
        `The FleetSet report was sent to ${recipientEmail.trim()}.`
      );
    } catch (error) {
      console.error(
        "Send report email error:",
        error
      );

      Alert.alert(
        "Email Error",
        error instanceof Error
          ? error.message
          : "Failed to send report email."
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const formatCurrency = (
    value: string | number
  ) => {
    const numberValue =
      Number(value || 0);

    return `₹${numberValue.toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const selectedCalendarDate =
    calendarTarget === "start"
      ? startDate
      : calendarTarget === "end"
      ? endDate
      : "";

  const calendarTitle =
    calendarTarget === "start"
      ? "Start Date"
      : "End Date";

  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" />

        <Text
          style={styles.loadingText}
        >
          Loading Reports...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              FleetSet
            </Text>

            <Text
              style={styles.greeting}
            >
              Reports
            </Text>
          </View>
        </View>

        <Text
          style={styles.sectionTitle}
        >
          Report Type
        </Text>

        <View style={styles.reportTypeCard}>
          <View style={styles.reportTypeRow}>
            <TouchableOpacity
              style={[
                styles.reportTypeButton,
                selectedReportType ===
                  "daily" &&
                  styles.reportTypeButtonActive,
              ]}
              onPress={() =>
                applyReportPeriod("daily")
              }
              disabled={generating}
            >
              <Text
                style={[
                  styles.reportTypeText,
                  selectedReportType ===
                    "daily" &&
                    styles.reportTypeTextActive,
                ]}
              >
                Daily
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reportTypeButton,
                selectedReportType ===
                  "weekly" &&
                  styles.reportTypeButtonActive,
              ]}
              onPress={() =>
                applyReportPeriod("weekly")
              }
              disabled={generating}
            >
              <Text
                style={[
                  styles.reportTypeText,
                  selectedReportType ===
                    "weekly" &&
                    styles.reportTypeTextActive,
                ]}
              >
                Weekly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reportTypeButton,
                selectedReportType ===
                  "monthly" &&
                  styles.reportTypeButtonActive,
              ]}
              onPress={() =>
                applyReportPeriod("monthly")
              }
              disabled={generating}
            >
              <Text
                style={[
                  styles.reportTypeText,
                  selectedReportType ===
                    "monthly" &&
                    styles.reportTypeTextActive,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reportTypeButton,
                selectedReportType ===
                  "custom" &&
                  styles.reportTypeButtonActive,
              ]}
              onPress={() =>
                applyReportPeriod("custom")
              }
              disabled={generating}
            >
              <Text
                style={[
                  styles.reportTypeText,
                  selectedReportType ===
                    "custom" &&
                    styles.reportTypeTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text
          style={styles.sectionTitle}
        >
          Report Period
        </Text>

        <View style={styles.dateCard}>
          <Text
            style={styles.inputLabel}
          >
            Start Date
          </Text>

          <TouchableOpacity
            style={styles.dateInput}
            onPress={() =>
              openReportCalendar("start")
            }
            disabled={generating}
          >
            <Text
              style={
                startDate
                  ? styles.dateInputValue
                  : styles.dateInputPlaceholder
              }
            >
              {startDate
                ? formatDisplayDate(
                    startDate
                  )
                : "Select start date"}
            </Text>

            <Text
              style={styles.dateInputIcon}
            >
              ▣
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.inputLabel,
              styles.endDateLabel,
            ]}
          >
            End Date
          </Text>

          <TouchableOpacity
            style={styles.dateInput}
            onPress={() =>
              openReportCalendar("end")
            }
            disabled={generating}
          >
            <Text
              style={
                endDate
                  ? styles.dateInputValue
                  : styles.dateInputPlaceholder
              }
            >
              {endDate
                ? formatDisplayDate(
                    endDate
                  )
                : "Select end date"}
            </Text>

            <Text
              style={styles.dateInputIcon}
            >
              ▣
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={generateReport}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Generate Report
            </Text>
          )}
        </TouchableOpacity>

        {summary && (
          <>
            <Text
              style={styles.sectionTitle}
            >
              Report Summary
            </Text>

            <View
              style={styles.statsGrid}
            >
              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  🚗
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {summary.total_vehicles}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Vehicles
                </Text>
              </View>

              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  👤
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {summary.total_drivers}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Drivers
                </Text>
              </View>

              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  🛣️
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {summary.total_trips}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Trips
                </Text>
              </View>

              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  ⛽
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {formatCurrency(
                    summary.total_fuel_expense
                  )}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Fuel Expense
                </Text>
              </View>

              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  🔧
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {formatCurrency(
                    summary.total_maintenance_expense
                  )}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Maintenance
                </Text>
              </View>

              <View
                style={styles.statCard}
              >
                <Text
                  style={styles.statIcon}
                >
                  ₹
                </Text>

                <Text
                  style={styles.statNumber}
                >
                  {formatCurrency(
                    summary.total_expense
                  )}
                </Text>

                <Text
                  style={styles.statLabel}
                >
                  Total Expense
                </Text>
              </View>
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Report Actions
            </Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={downloadReportPdf}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  ↓ Download PDF
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openEmailModal}
              disabled={downloading}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                ✉ Send PDF by Email
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeReportCalendar
        }
      >
        <View
          style={styles.calendarOverlay}
        >
          <View
            style={styles.calendarModal}
          >
            <View
              style={styles.calendarHeader}
            >
              <View>
                <Text
                  style={styles.modalTitle}
                >
                  {calendarTitle}
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  Select a date
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={
                  closeReportCalendar
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

            <View
              style={styles.monthHeader}
            >
              <TouchableOpacity
                style={styles.monthArrow}
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
                  styles.monthTitleButton
                }
                onPress={() =>
                  setYearPickerVisible(
                    true
                  )
                }
              >
                <Text
                  style={styles.monthTitle}
                >
                  {calendarMonth.toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                    }
                  )}
                </Text>

                <Text
                  style={styles.yearTitle}
                >
                  {calendarMonth.getFullYear()} ▾
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.monthArrow}
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

            {yearPickerVisible && (
              <View
                style={
                  styles.yearPickerContainer
                }
              >
                <Text
                  style={
                    styles.yearPickerTitle
                  }
                >
                  Select Year
                </Text>

                <ScrollView
                  style={
                    styles.yearPickerScroll
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  {Array.from(
                    {
                      length: 201,
                    },
                    (_, index) =>
                      1900 + index
                  ).map((year) => {
                    const isSelected =
                      year ===
                      calendarMonth.getFullYear();

                    return (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearOption,
                          isSelected &&
                            styles.selectedYearOption,
                        ]}
                        onPress={() =>
                          selectCalendarYear(
                            year
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.yearOptionText,
                            isSelected &&
                              styles.selectedYearOptionText,
                          ]}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View
              style={styles.weekHeader}
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
                  style={styles.weekDay}
                >
                  {day}
                </Text>
              ))}
            </View>

            <View
              style={styles.calendarGrid}
            >
              {getMonthDays(
                calendarMonth.getFullYear(),
                calendarMonth.getMonth()
              ).map(
                (day, index) => {
                  if (day === null) {
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

                  const isSelected =
                    selectedDate ===
                    selectedCalendarDate;

                  const isToday =
                    selectedDate ===
                    formatDateForApi(
                      new Date()
                    );

                  return (
                    <TouchableOpacity
                      key={selectedDate}
                      style={[
                        styles.calendarDay,
                        isToday &&
                          styles.todayCalendarDay,
                      ]}
                      onPress={() =>
                        selectReportCalendarDate(
                          day
                        )
                      }
                    >
                      <View
                        style={[
                          styles.calendarDayInner,
                          isSelected &&
                            styles.selectedCalendarDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isSelected &&
                              styles.selectedCalendarDayText,
                          ]}
                        >
                          {day}
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
                Selected
              </Text>

              <Text
                style={
                  styles.calendarSelectedValue
                }
              >
                {selectedCalendarDate
                  ? formatDisplayDate(
                      selectedCalendarDate
                    )
                  : "Not selected"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={
                closeReportCalendar
              }
            >
              <Text
                style={
                  styles.saveButtonText
                }
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sendingEmail) {
            setEmailModalVisible(
              false
            );
          }
        }}
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalCard}
          >
            <Text
              style={styles.modalTitle}
            >
              Send Report by Email
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              The PDF report will be sent
              to this email address.
            </Text>

            <Text
              style={styles.inputLabel}
            >
              Recipient Email
            </Text>

            <TextInput
              style={styles.input}
              value={recipientEmail}
              onChangeText={
                setRecipientEmail
              }
              placeholder="Enter email address"
              placeholderTextColor="#777777"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sendingEmail}
            />

            <TouchableOpacity
              style={
                styles.primaryButton
              }
              onPress={
                sendReportEmail
              }
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Send Report
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() =>
                setEmailModalVisible(
                  false
                )
              }
              disabled={sendingEmail}
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
      </Modal>
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
    paddingBottom: 110,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#666666",
    fontSize: 14,
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
  },

  greeting: {
    marginTop: 4,
    color: "#666666",
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
    marginTop: 8,
  },

  reportTypeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 20,
  },

  reportTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  reportTypeButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },

  reportTypeButtonActive: {
    backgroundColor: "#111111",
  },

  reportTypeText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "700",
  },

  reportTypeTextActive: {
    color: "#FFFFFF",
  },

  dateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 14,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 7,
    color: "#111111",
  },

  endDateLabel: {
    marginTop: 2,
  },

  dateInput: {
    height: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 13,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateInputValue: {
    color: "#111111",
    fontSize: 14,
  },

  dateInputPlaceholder: {
    color: "#999999",
    fontSize: 14,
  },

  dateInputIcon: {
    fontSize: 16,
    color: "#666666",
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111111",
    marginBottom: 15,
  },

  primaryButton: {
    height: 54,
    backgroundColor: "#111111",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  statIcon: {
    fontSize: 22,
    marginBottom: 10,
  },

  statNumber: {
    fontSize: 21,
    fontWeight: "800",
  },

  statLabel: {
    color: "#666666",
    marginTop: 4,
    fontSize: 14,
  },

  secondaryButton: {
    height: 54,
    backgroundColor: "#111111",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 75,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },

  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },

  navText: {
    fontSize: 11,
    color: "#777777",
  },

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },

  calendarModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },

  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  modalSubtitle: {
    color: "#666666",
    fontSize: 13,
    marginTop: 3,
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },

  closeButtonText: {
    fontSize: 24,
    color: "#222222",
    lineHeight: 27,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 15,
  },

  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },

  monthArrowText: {
    fontSize: 27,
    color: "#222222",
    lineHeight: 28,
  },

  monthTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
  },

  monthTitleButton: {
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },

  yearTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666666",
    marginTop: 2,
  },

  yearPickerContainer: {
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  yearPickerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 8,
  },

  yearPickerScroll: {
    height: 220,
  },

  yearOption: {
    height: 42,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },

  selectedYearOption: {
    backgroundColor: "#111111",
  },

  yearOptionText: {
    fontSize: 14,
    color: "#222222",
    fontWeight: "600",
  },

  selectedYearOptionText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  weekHeader: {
    flexDirection: "row",
    marginBottom: 5,
  },

  weekDay: {
    width: "14.285%",
    textAlign: "center",
    color: "#888888",
    fontSize: 11,
    fontWeight: "700",
  },

  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  calendarDay: {
    width: "14.285%",
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarDayInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  todayCalendarDay: {
    borderRadius: 17,
  },

  selectedCalendarDay: {
    backgroundColor: "#111111",
  },

  calendarDayText: {
    color: "#222222",
    fontSize: 13,
  },

  selectedCalendarDayText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  calendarSelectedInfo: {
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
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

  saveButton: {
    height: 48,
    backgroundColor: "#111111",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },

  modalDescription: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },

  cancelButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#666666",
    fontSize: 14,
    fontWeight: "700",
  },
});