import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { apiGet, apiPost, apiPut } from "../services/api";
import { getUser } from "../utils/storage";

type Vehicle = {
  id: string;
  company_id?: string;
  branch_id?: string;
  registration_number: string;
  manufacturer?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  is_active?: boolean;
};

type VehicleDocument = {
  id: string;
  company_id?: string;
  branch_id?: string;
  vehicle_id: string;
  uploaded_by?: string;
  document_type: string;
  document_number: string;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  remarks: string | null;
  is_active?: boolean;
};

type StoredUser = {
  id?: string;
  company_id?: string | null;
  branch_id?: string | null;
  role_name?: string;
  role?: { name?: string };
};

type FormState = {
  vehicleId: string;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  remarks: string;
};

type DateField = "issueDate" | "expiryDate";
type ExpiryKind = "expired" | "warning" | "valid" | "none";

const COLORS = {
  background: "#F7F8FA",
  white: "#FFFFFF",
  black: "#111111",
  text: "#222222",
  secondary: "#666666",
  muted: "#888888",
  border: "#E2E2E2",
  light: "#EEEEEE",
  soft: "#F4F4F4",
};

const DOCUMENT_TYPES = [
  { value: "registration_certificate", label: "Registration Certificate" },
  { value: "insurance", label: "Insurance" },
  { value: "fitness_certificate", label: "Fitness Certificate" },
  { value: "pollution_certificate", label: "Pollution Certificate" },
  { value: "national_permit", label: "National Permit" },
  { value: "state_permit", label: "State Permit" },
  { value: "road_tax", label: "Road Tax" },
  { value: "other", label: "Other" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_FORM: FormState = {
  vehicleId: "",
  documentType: "registration_certificate",
  documentNumber: "",
  issueDate: "",
  expiryDate: "",
  fileUrl: "",
  remarks: "",
};

function extractArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.vehicles)) return value.vehicles;
  if (Array.isArray(value?.documents)) return value.documents;
  return [];
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) return null;
  return date;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const date = parseDateOnly(value);
  if (!date) return value.slice(0, 10);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateToISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((item) => item.value === value)?.label || value;
}

function expiryStatus(value: string | null): { label: string; kind: ExpiryKind } {
  if (!value) return { label: "No expiry date", kind: "none" };
  const expiry = parseDateOnly(value);
  if (!expiry) return { label: "Expiry date unavailable", kind: "none" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, kind: "expired" };
  if (days === 0) return { label: "Expires today", kind: "expired" };
  if (days <= 30) return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, kind: "warning" };
  return { label: "Valid", kind: "valid" };
}

export default function DocumentsScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedVehicleIds, setExpandedVehicleIds] = useState<string[]>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarField, setCalendarField] = useState<DateField | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const user = await getUser<StoredUser>();
      if (!user?.company_id) {
        setCompanyId(null);
        setLoading(false);
        Alert.alert("Sign in required", "Please sign in again to view vehicle documents.");
        return;
      }
      setCompanyId(user.company_id);
    } catch (error) {
      console.error("Could not read FleetSet user:", error);
      setLoading(false);
      Alert.alert("Error", "Could not read the logged-in user. Please sign in again.");
    }
  }, []);

  const loadAllData = useCallback(async (showLoader = true) => {
    if (!companyId) return;
    if (showLoader) setLoading(true);
    try {
      const [vehicleResponse, documentResponse] = await Promise.all([
        apiGet(`/vehicles/${companyId}/all`),
        apiGet(`/vehicle-documents/${companyId}/all`),
      ]);
      const activeVehicles = extractArray(vehicleResponse).filter(
        (item: Vehicle) => item.is_active !== false,
      );
      const activeDocuments = extractArray(documentResponse).filter(
        (item: VehicleDocument) => item.is_active !== false,
      );
      setVehicles(activeVehicles);
      setDocuments(activeDocuments);
    } catch (error) {
      console.error("FleetSet document data loading error:", error);
      Alert.alert(
        "Unable to load data",
        error instanceof Error ? error.message : "Could not load vehicles and documents.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (companyId) void loadAllData(true);
  }, [companyId, loadAllData]);

  useFocusEffect(
    useCallback(() => {
      if (companyId) void loadAllData(false);
    }, [companyId, loadAllData]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllData(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadAllData]);

  const vehicleById = useCallback((id: string) => vehicles.find((vehicle) => vehicle.id === id), [vehicles]);

  const setFormField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: vehicles.length === 1 ? vehicles[0].id : "",
    });
    setVehiclePickerVisible(false);
    setTypePickerVisible(false);
    setFormVisible(true);
  };

  const openEditForm = (document: VehicleDocument) => {
    setEditingId(document.id);
    setForm({
      vehicleId: document.vehicle_id,
      documentType: document.document_type,
      documentNumber: document.document_number || "",
      issueDate: document.issue_date?.slice(0, 10) || "",
      expiryDate: document.expiry_date?.slice(0, 10) || "",
      fileUrl: document.file_url || "",
      remarks: document.remarks || "",
    });
    setVehiclePickerVisible(false);
    setTypePickerVisible(false);
    setFormVisible(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormVisible(false);
    setVehiclePickerVisible(false);
    setTypePickerVisible(false);
    setCalendarVisible(false);
    setYearPickerVisible(false);
    setCalendarField(null);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const saveDocument = async () => {
    if (!companyId) {
      Alert.alert("Error", "Company information is missing. Please sign in again.");
      return;
    }
    if (!form.vehicleId) return Alert.alert("Vehicle required", "Please select a vehicle.");
    if (!form.documentType) return Alert.alert("Document type required", "Please select a document type.");
    if (!form.documentNumber.trim()) return Alert.alert("Document number required", "Please enter the document number.");
    if (!form.issueDate) return Alert.alert("Issue date required", "Please select the issue date.");
    if (!form.expiryDate) return Alert.alert("Expiry date required", "Please select the expiry date.");
    if (!form.fileUrl.trim()) return Alert.alert("File URL required", "Please enter the document file URL.");

    const issueDate = parseDateOnly(form.issueDate);
    const expiryDate = parseDateOnly(form.expiryDate);
    if (!issueDate || !expiryDate) return Alert.alert("Invalid date", "Please select valid issue and expiry dates.");
    if (expiryDate.getTime() < issueDate.getTime()) {
      return Alert.alert("Invalid dates", "Expiry date cannot be earlier than issue date.");
    }

    const payload = {
      document_type: form.documentType,
      document_number: form.documentNumber.trim(),
      issue_date: form.issueDate,
      expiry_date: form.expiryDate,
      file_url: form.fileUrl.trim(),
      remarks: form.remarks.trim() || null,
    };
    const isEditing = editingId !== null;

    try {
      setSaving(true);
      if (isEditing && editingId) {
        await apiPut(`/vehicle-documents/${companyId}/${editingId}`, payload);
      } else {
        await apiPost(`/vehicle-documents/${companyId}`, {
          vehicle_id: form.vehicleId,
          ...payload,
        });
      }
      setFormVisible(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      setVehiclePickerVisible(false);
      setTypePickerVisible(false);
      await loadAllData(false);
      Alert.alert("Success", isEditing ? "Vehicle document updated successfully." : "Vehicle document added successfully.");
    } catch (error) {
      console.error(isEditing ? "Document update error:" : "Document create error:", error);
      const message = error instanceof Error ? error.message : "Could not save the vehicle document.";
      if (message.toLowerCase().includes("document_already_exists") || message.toLowerCase().includes("already exists")) {
        Alert.alert("Document already exists", "This vehicle already has an active document of this type.");
      } else {
        Alert.alert("Unable to save document", message);
      }
    } finally {
      setSaving(false);
    }
  };

  const openDatePicker = (field: DateField) => {
    const existing = parseDateOnly(form[field]);
    setCalendarDate(existing || new Date());
    setCalendarField(field);
    setYearPickerVisible(false);
    setCalendarVisible(true);
  };

  const chooseCalendarDay = (day: number) => {
    if (!calendarField) return;
    setFormField(calendarField, dateToISO(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)));
    setCalendarVisible(false);
    setYearPickerVisible(false);
    setCalendarField(null);
  };

  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: monthStart.getDay() }, () => null),
    ...Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate() }, (_, index) => index + 1),
  ];
  const years = Array.from({ length: 71 }, (_, index) => 2050 - index);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const vehicleDocs = documents.filter((doc) => doc.vehicle_id === vehicle.id);
    const typeMatches = typeFilter === "all" || vehicleDocs.some((doc) => doc.document_type === typeFilter);
    const statusMatches = statusFilter === "all" || vehicleDocs.some((doc) => expiryStatus(doc.expiry_date).kind === statusFilter);
    if (!typeMatches || !statusMatches) return false;
    if (!normalizedSearch) return true;
    const vehicleMatches = (vehicle.registration_number || "").toLowerCase().includes(normalizedSearch);
    const documentMatches = vehicleDocs.some((doc) =>
      (doc.document_number || "").toLowerCase().includes(normalizedSearch) ||
      documentTypeLabel(doc.document_type).toLowerCase().includes(normalizedSearch),
    );
    return vehicleMatches || documentMatches;
  }), [vehicles, documents, typeFilter, statusFilter, normalizedSearch]);

  const documentsForVehicle = (vehicleId: string) => documents.filter((document) => {
    if (document.vehicle_id !== vehicleId) return false;
    if (typeFilter !== "all" && document.document_type !== typeFilter) return false;
    if (statusFilter !== "all" && expiryStatus(document.expiry_date).kind !== statusFilter) return false;
    if (!normalizedSearch) return true;
    const vehicle = vehicleById(vehicleId);
    return (document.document_number || "").toLowerCase().includes(normalizedSearch) ||
      documentTypeLabel(document.document_type).toLowerCase().includes(normalizedSearch) ||
      (vehicle?.registration_number || "").toLowerCase().includes(normalizedSearch);
  });

  const totalExpired = documents.filter((doc) => expiryStatus(doc.expiry_date).kind === "expired").length;
  const totalDueSoon = documents.filter((doc) => expiryStatus(doc.expiry_date).kind === "warning").length;

  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicleIds((current) => current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : [...current, vehicleId]);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.black} />
        <Text style={styles.loadingText}>Loading vehicle documents…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.black} colors={[COLORS.black]} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <View style={styles.headerCopy}>
           
            <Text style={styles.pageTitle}>Vehicle documents</Text>
            <Text style={styles.pageSubtitle}>Keep vehicle paperwork organised and expiry dates visible.</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={openAddForm} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active documents</Text>
            <Text style={styles.summaryValue}>{documents.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expiring soon</Text>
            <Text style={styles.summaryValue}>{totalDueSoon}</Text>
            <Text style={styles.summaryHint}>Within 30 days</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expired</Text>
            <Text style={styles.summaryValue}>{totalExpired}</Text>
            <Text style={styles.summaryHint}>Needs attention</Text>
          </View>
        </View>

        <View style={styles.searchPanel}>
          <Text style={styles.searchLabel}>Search documents</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Registration, document number or type"
            placeholderTextColor={COLORS.muted}
            autoCorrect={false}
            returnKeyType="search"
          />
          <Text style={styles.filterHeading}>Document type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[{ value: "all", label: "All types" }, ...DOCUMENT_TYPES].map((item) => (
              <TouchableOpacity key={item.value} style={[styles.filterChip, typeFilter === item.value && styles.filterChipActive]} onPress={() => setTypeFilter(item.value)}>
                <Text style={[styles.filterChipText, typeFilter === item.value && styles.filterChipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.filterHeading}>Expiry status</Text>
          <View style={styles.statusFilters}>
            {[
              { value: "all", label: "All" },
              { value: "valid", label: "Valid" },
              { value: "warning", label: "Expiring soon" },
              { value: "expired", label: "Expired" },
              { value: "none", label: "No expiry" },
            ].map((item) => (
              <TouchableOpacity key={item.value} style={[styles.statusChip, statusFilter === item.value && styles.statusChipActive]} onPress={() => setStatusFilter(item.value)}>
                <Text style={[styles.statusChipText, statusFilter === item.value && styles.statusChipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vehicles</Text>
          <Text style={styles.sectionCount}>{filteredVehicles.length} shown</Text>
        </View>

        {filteredVehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>▤</Text></View>
            <Text style={styles.emptyTitle}>{vehicles.length === 0 ? "No active vehicles" : "No matching results"}</Text>
            <Text style={styles.emptyDescription}>{vehicles.length === 0 ? "Add an active vehicle before registering its documents." : "Try another search term or change the filters."}</Text>
            {vehicles.length === 0 ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={refresh}>
                <Text style={styles.secondaryButtonText}>Refresh</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}>
                <Text style={styles.secondaryButtonText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filteredVehicles.map((vehicle) => {
          const allVehicleDocs = documents.filter((doc) => doc.vehicle_id === vehicle.id);
          const visibleDocs = documentsForVehicle(vehicle.id);
          const expanded = expandedVehicleIds.includes(vehicle.id);
          const vehicleName = [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ");
          return (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <TouchableOpacity style={styles.vehicleHeader} onPress={() => toggleVehicle(vehicle.id)} activeOpacity={0.8}>
                <View style={styles.vehicleSymbol}><Text style={styles.vehicleSymbolText}>▣</Text></View>
                <View style={styles.vehicleMain}>
                  <Text style={styles.registration}>{vehicle.registration_number}</Text>
                  <Text style={styles.vehicleSubtext}>{vehicleName || vehicle.vehicle_type || "Vehicle"}</Text>
                </View>
                <View style={styles.docCountPill}>
                  <Text style={styles.docCountValue}>{allVehicleDocs.length}</Text>
                  <Text style={styles.docCountLabel}>{allVehicleDocs.length === 1 ? "DOC" : "DOCS"}</Text>
                </View>
                <Text style={styles.expandIcon}>{expanded ? "−" : "+"}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.vehicleDocuments}>
                  {visibleDocs.length === 0 ? (
                    <View style={styles.noDocsBox}>
                      <Text style={styles.noDocsTitle}>No matching documents</Text>
                      <Text style={styles.noDocsText}>Add a document or adjust the current filters.</Text>
                      <TouchableOpacity style={styles.inlineAddButton} onPress={() => { openAddForm(); setForm((current) => ({ ...current, vehicleId: vehicle.id })); }}>
                        <Text style={styles.inlineAddText}>+ Add document for this vehicle</Text>
                      </TouchableOpacity>
                    </View>
                  ) : visibleDocs.map((document) => {
                    const status = expiryStatus(document.expiry_date);
                    return (
                      <View key={document.id} style={styles.documentCard}>
                        <View style={styles.documentTopRow}>
                          <View style={styles.documentIcon}><Text style={styles.documentIconText}>▤</Text></View>
                          <View style={styles.documentTitleBlock}>
                            <Text style={styles.documentType}>{documentTypeLabel(document.document_type)}</Text>
                            <Text style={styles.documentNumber}>{document.document_number}</Text>
                          </View>
                          <TouchableOpacity style={styles.editButton} onPress={() => openEditForm(document)}>
                            <Text style={styles.editButtonText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.dateGrid}>
                          <View style={styles.dateCell}>
                            <Text style={styles.metaLabel}>ISSUED</Text>
                            <Text style={styles.metaValue}>{formatDate(document.issue_date)}</Text>
                          </View>
                          <View style={styles.dateCell}>
                            <Text style={styles.metaLabel}>EXPIRES</Text>
                            <Text style={styles.metaValue}>{formatDate(document.expiry_date)}</Text>
                          </View>
                        </View>
                        <View style={[styles.expiryBanner, status.kind === "expired" && styles.expiryBannerExpired, status.kind === "warning" && styles.expiryBannerWarning, status.kind === "valid" && styles.expiryBannerValid]}>
                          <View style={[styles.statusDot, status.kind === "expired" && styles.statusDotExpired, status.kind === "warning" && styles.statusDotWarning, status.kind === "valid" && styles.statusDotValid]} />
                          <Text style={styles.expiryBannerText}>{status.kind === "valid" ? `Valid · ${formatDate(document.expiry_date)}` : status.label}</Text>
                        </View>
                        {document.remarks ? <Text style={styles.remarksText}>{document.remarks}</Text> : null}
                        {document.file_url ? (
                          <TouchableOpacity onPress={async () => { try { if (document.file_url) await Linking.openURL(document.file_url); } catch { Alert.alert("Unable to open file", "Check that the document URL is valid and accessible."); } }} style={styles.fileLinkRow}>
                            <Text style={styles.fileLinkIcon}>↗</Text>
                            <Text style={styles.fileLinkText} numberOfLines={1}>View file URL</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                  <TouchableOpacity style={styles.addAnotherButton} onPress={() => { openAddForm(); setForm((current) => ({ ...current, vehicleId: vehicle.id })); }}>
                    <Text style={styles.addAnotherText}>+ Add another document</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.footerHint}>Pull down to refresh the latest vehicle and document records.</Text>
      </ScrollView>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.formModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalEyebrow}>{editingId ? "EDIT RECORD" : "NEW RECORD"}</Text>
                <Text style={styles.modalTitle}>{editingId ? "Edit document" : "Add document"}</Text>
                <Text style={styles.modalSubtitle}>Enter the document details below.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeForm} disabled={saving} accessibilityRole="button" accessibilityLabel="Close document form">
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Vehicle <Text style={styles.requiredMark}>*</Text></Text>
              <TouchableOpacity style={styles.selectField} onPress={() => { setVehiclePickerVisible((current) => !current); setTypePickerVisible(false); }}>
                <View style={styles.selectFieldTextBlock}>
                  <Text style={[styles.selectValue, !form.vehicleId && styles.placeholderText]}>{form.vehicleId ? vehicleById(form.vehicleId)?.registration_number || "Select vehicle" : "Select vehicle"}</Text>
                  {form.vehicleId && vehicleById(form.vehicleId) ? <Text style={styles.selectSubvalue}>{[vehicleById(form.vehicleId)?.manufacturer, vehicleById(form.vehicleId)?.model].filter(Boolean).join(" ")}</Text> : null}
                </View>
                <Text style={styles.selectChevron}>{vehiclePickerVisible ? "⌃" : "⌄"}</Text>
              </TouchableOpacity>
              {vehiclePickerVisible && (
                <View style={styles.pickerList}>
                  <ScrollView nestedScrollEnabled style={styles.pickerScroll}>
                    {vehicles.length === 0 ? <Text style={styles.pickerEmpty}>No active vehicles available.</Text> : vehicles.map((vehicle) => (
                      <TouchableOpacity key={vehicle.id} style={[styles.pickerOption, form.vehicleId === vehicle.id && styles.pickerOptionSelected]} onPress={() => { setFormField("vehicleId", vehicle.id); setVehiclePickerVisible(false); }}>
                        <View style={styles.pickerOptionText}>
                          <Text style={styles.pickerOptionTitle}>{vehicle.registration_number}</Text>
                          <Text style={styles.pickerOptionSub}>{[vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Vehicle"}</Text>
                        </View>
                        {form.vehicleId === vehicle.id ? <Text style={styles.checkmark}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.fieldLabel}>Document type <Text style={styles.requiredMark}>*</Text></Text>
              <TouchableOpacity style={styles.selectField} onPress={() => { setTypePickerVisible((current) => !current); setVehiclePickerVisible(false); }}>
                <Text style={styles.selectValue}>{documentTypeLabel(form.documentType)}</Text>
                <Text style={styles.selectChevron}>{typePickerVisible ? "⌃" : "⌄"}</Text>
              </TouchableOpacity>
              {typePickerVisible && (
                <View style={styles.pickerList}>
                  {DOCUMENT_TYPES.map((item) => (
                    <TouchableOpacity key={item.value} style={[styles.pickerOption, form.documentType === item.value && styles.pickerOptionSelected]} onPress={() => { setFormField("documentType", item.value); setTypePickerVisible(false); }}>
                      <Text style={styles.pickerOptionTitle}>{item.label}</Text>
                      {form.documentType === item.value ? <Text style={styles.checkmark}>✓</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Document number <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput style={styles.textField} value={form.documentNumber} onChangeText={(value) => setFormField("documentNumber", value)} placeholder="Enter document number" placeholderTextColor={COLORS.muted} autoCapitalize="characters" autoCorrect={false} />

              <View style={styles.twoColumnFields}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Issue date <Text style={styles.requiredMark}>*</Text></Text>
                  <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker("issueDate")}>
                    <Text style={[styles.dateFieldText, !form.issueDate && styles.placeholderText]}>{form.issueDate ? formatDate(form.issueDate) : "Select date"}</Text>
                    <Text style={styles.dateFieldIcon}>▦</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Expiry date <Text style={styles.requiredMark}>*</Text></Text>
                  <TouchableOpacity style={styles.dateField} onPress={() => openDatePicker("expiryDate")}>
                    <Text style={[styles.dateFieldText, !form.expiryDate && styles.placeholderText]}>{form.expiryDate ? formatDate(form.expiryDate) : "Select date"}</Text>
                    <Text style={styles.dateFieldIcon}>▦</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {form.issueDate && form.expiryDate && parseDateOnly(form.expiryDate) && parseDateOnly(form.issueDate) && parseDateOnly(form.expiryDate)!.getTime() < parseDateOnly(form.issueDate)!.getTime() ? <Text style={styles.validationText}>Expiry date cannot be earlier than issue date.</Text> : null}

              <Text style={styles.fieldLabel}>File URL <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput style={styles.textField} value={form.fileUrl} onChangeText={(value) => setFormField("fileUrl", value)} placeholder="Enter document file URL" placeholderTextColor={COLORS.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

              <Text style={styles.fieldLabel}>Remarks <Text style={styles.optionalText}>(optional)</Text></Text>
              <TextInput style={[styles.textField, styles.remarksField]} value={form.remarks} onChangeText={(value) => setFormField("remarks", value)} placeholder="Add a note if needed" placeholderTextColor={COLORS.muted} multiline numberOfLines={3} textAlignVertical="top" />

              <View style={styles.formButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeForm} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={saveDocument} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>{editingId ? "Save changes" : "Add document"}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => { setCalendarVisible(false); setYearPickerVisible(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.monthArrow} onPress={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><Text style={styles.monthArrowText}>‹</Text></TouchableOpacity>
              <TouchableOpacity style={styles.monthTitleButton} onPress={() => setYearPickerVisible((current) => !current)}>
                <Text style={styles.calendarMonth}>{MONTHS[calendarDate.getMonth()]}</Text>
                <Text style={styles.calendarYear}>{calendarDate.getFullYear()}  ▾</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.monthArrow} onPress={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><Text style={styles.monthArrowText}>›</Text></TouchableOpacity>
            </View>
            {yearPickerVisible ? (
              <ScrollView style={styles.yearList}>
                {years.map((year) => <TouchableOpacity key={year} style={[styles.yearOption, calendarDate.getFullYear() === year && styles.yearOptionSelected]} onPress={() => { setCalendarDate((date) => new Date(year, date.getMonth(), 1)); setYearPickerVisible(false); }}><Text style={[styles.yearOptionText, calendarDate.getFullYear() === year && styles.yearOptionTextSelected]}>{year}</Text></TouchableOpacity>)}
              </ScrollView>
            ) : (
              <>
                <View style={styles.weekdayRow}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekdayText}>{day}</Text>)}</View>
                <View style={styles.calendarGrid}>{calendarCells.map((day, index) => {
                  if (day === null) return <View key={`blank-${index}`} style={styles.calendarDay} />;
                  const current = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                  const today = new Date();
                  const isToday = current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth() && current.getDate() === today.getDate();
                  const selectedValue = calendarField ? form[calendarField] : "";
                  const selectedDate = parseDateOnly(selectedValue);
                  const isSelected = !!selectedDate && current.getFullYear() === selectedDate.getFullYear() && current.getMonth() === selectedDate.getMonth() && current.getDate() === selectedDate.getDate();
                  return <TouchableOpacity key={`day-${day}`} style={[styles.calendarDay, isToday && styles.calendarToday, isSelected && styles.calendarDaySelected]} onPress={() => chooseCalendarDay(day)}><Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected, isToday && !isSelected && styles.calendarTodayText]}>{day}</Text></TouchableOpacity>;
                })}</View>
              </>
            )}
            <TouchableOpacity style={styles.calendarCancel} onPress={() => { setCalendarVisible(false); setYearPickerVisible(false); setCalendarField(null); }}><Text style={styles.calendarCancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  pageContent: { padding: 16, paddingBottom: 40 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background, gap: 12 },
  loadingText: { color: COLORS.secondary, fontSize: 14 },
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1 },
  eyebrow: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 6 },
  pageTitle: { color: COLORS.black, fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.5 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 300 },
  primaryButton: { backgroundColor: COLORS.black, minHeight: 42, paddingHorizontal: 15, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },
  summaryRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 13, padding: 12, minHeight: 91 },
  summaryLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "700", lineHeight: 14 },
  summaryValue: { color: COLORS.black, fontSize: 24, fontWeight: "800", marginTop: 7 },
  summaryHint: { color: COLORS.muted, fontSize: 9, marginTop: 2 },
  searchPanel: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 20 },
  searchLabel: { color: COLORS.text, fontSize: 12, fontWeight: "800", marginBottom: 8 },
  searchInput: { minHeight: 44, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, fontSize: 13 },
  filterHeading: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  filterRow: { gap: 7, paddingRight: 4 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  filterChipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  filterChipText: { color: COLORS.secondary, fontSize: 11, fontWeight: "700" },
  filterChipTextActive: { color: COLORS.white },
  statusFilters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  statusChip: { borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 7 },
  statusChipActive: { backgroundColor: COLORS.light, borderColor: COLORS.black },
  statusChipText: { color: COLORS.secondary, fontSize: 10, fontWeight: "700" },
  statusChipTextActive: { color: COLORS.black },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: COLORS.black, fontSize: 17, fontWeight: "800" },
  sectionCount: { color: COLORS.secondary, fontSize: 11, fontWeight: "600" },
  emptyCard: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 15, padding: 24, alignItems: "center" },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.light, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyIconText: { color: COLORS.black, fontSize: 22 },
  emptyTitle: { color: COLORS.black, fontSize: 15, fontWeight: "800" },
  emptyDescription: { color: COLORS.secondary, fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 7, marginBottom: 14 },
  secondaryButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 9 },
  secondaryButtonText: { color: COLORS.black, fontSize: 12, fontWeight: "800" },
  vehicleCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, marginBottom: 12, overflow: "hidden" },
  vehicleHeader: { flexDirection: "row", alignItems: "center", padding: 13, gap: 11 },
  vehicleSymbol: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.light, alignItems: "center", justifyContent: "center" },
  vehicleSymbolText: { color: COLORS.black, fontSize: 19 },
  vehicleMain: { flex: 1, minWidth: 0 },
  registration: { color: COLORS.black, fontSize: 14, fontWeight: "800" },
  vehicleSubtext: { color: COLORS.secondary, fontSize: 11, marginTop: 4 },
  docCountPill: { backgroundColor: COLORS.background, borderRadius: 9, minWidth: 43, paddingVertical: 5, paddingHorizontal: 7, alignItems: "center" },
  docCountValue: { color: COLORS.black, fontSize: 14, fontWeight: "800" },
  docCountLabel: { color: COLORS.secondary, fontSize: 8, fontWeight: "800", marginTop: 1 },
  expandIcon: { color: COLORS.black, fontSize: 24, fontWeight: "400", width: 20, textAlign: "center" },
  vehicleDocuments: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 11, backgroundColor: "#FAFAFA" },
  noDocsBox: { padding: 16, backgroundColor: COLORS.white, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: "flex-start" },
  noDocsTitle: { color: COLORS.black, fontSize: 13, fontWeight: "800" },
  noDocsText: { color: COLORS.secondary, fontSize: 11, marginTop: 5, lineHeight: 16 },
  inlineAddButton: { marginTop: 10, paddingVertical: 4 },
  inlineAddText: { color: COLORS.black, fontSize: 11, fontWeight: "800" },
  documentCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 9 },
  documentTopRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  documentIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: COLORS.light, alignItems: "center", justifyContent: "center" },
  documentIconText: { color: COLORS.black, fontSize: 17 },
  documentTitleBlock: { flex: 1, minWidth: 0 },
  documentType: { color: COLORS.black, fontSize: 12, fontWeight: "800" },
  documentNumber: { color: COLORS.secondary, fontSize: 11, marginTop: 4 },
  editButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: COLORS.white },
  editButtonText: { color: COLORS.black, fontSize: 11, fontWeight: "800" },
  dateGrid: { flexDirection: "row", gap: 10, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: COLORS.background },
  dateCell: { flex: 1 },
  metaLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  metaValue: { color: COLORS.text, fontSize: 11, fontWeight: "700", marginTop: 5 },
  expiryBanner: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, marginTop: 11, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.border },
  expiryBannerExpired: { backgroundColor: "#EAEAEA", borderColor: "#BEBEBE" },
  expiryBannerWarning: { backgroundColor: "#F0F0F0", borderColor: "#D0D0D0" },
  expiryBannerValid: { backgroundColor: "#F8F8F8", borderColor: COLORS.border },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.muted },
  statusDotExpired: { backgroundColor: COLORS.black },
  statusDotWarning: { backgroundColor: "#666666" },
  statusDotValid: { backgroundColor: "#999999" },
  expiryBannerText: { color: COLORS.text, fontSize: 11, fontWeight: "700", flex: 1 },
  remarksText: { color: COLORS.secondary, fontSize: 11, lineHeight: 16, marginTop: 9 },
  fileLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: COLORS.background },
  fileLinkIcon: { color: COLORS.black, fontSize: 14, fontWeight: "800" },
  fileLinkText: { color: COLORS.black, fontSize: 11, fontWeight: "800", textDecorationLine: "underline", flex: 1 },
  addAnotherButton: { alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 10, paddingVertical: 11, marginTop: 1, backgroundColor: COLORS.white },
  addAnotherText: { color: COLORS.black, fontSize: 11, fontWeight: "800" },
  footerHint: { color: COLORS.muted, fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: 8, marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end", paddingTop: 24 },
  formModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "94%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 19, paddingTop: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitleBlock: { flex: 1 },
  modalEyebrow: { color: COLORS.secondary, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 5 },
  modalTitle: { color: COLORS.black, fontSize: 21, fontWeight: "800" },
  modalSubtitle: { color: COLORS.secondary, fontSize: 11, marginTop: 5 },
  closeButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.light, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  closeButtonText: { color: COLORS.black, fontSize: 24, lineHeight: 27 },
  formScroll: { flexGrow: 0 },
  formContent: { padding: 18, paddingBottom: 30 },
  fieldLabel: { color: COLORS.text, fontSize: 12, fontWeight: "800", marginBottom: 7, marginTop: 13 },
  requiredMark: { color: COLORS.black },
  optionalText: { color: COLORS.muted, fontSize: 10, fontWeight: "500" },
  textField: { minHeight: 45, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, color: COLORS.text, fontSize: 13 },
  remarksField: { minHeight: 85, paddingTop: 11 },
  selectField: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectFieldTextBlock: { flex: 1 },
  selectValue: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  selectSubvalue: { color: COLORS.secondary, fontSize: 10, marginTop: 3 },
  placeholderText: { color: COLORS.muted, fontWeight: "400" },
  selectChevron: { color: COLORS.secondary, fontSize: 17 },
  pickerList: { marginTop: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: "hidden", backgroundColor: COLORS.white },
  pickerScroll: { maxHeight: 190 },
  pickerEmpty: { color: COLORS.secondary, fontSize: 12, padding: 13 },
  pickerOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  pickerOptionSelected: { backgroundColor: COLORS.background },
  pickerOptionText: { flex: 1 },
  pickerOptionTitle: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  pickerOptionSub: { color: COLORS.secondary, fontSize: 10, marginTop: 3 },
  checkmark: { color: COLORS.black, fontSize: 16, fontWeight: "800" },
  twoColumnFields: { flexDirection: "row", gap: 10 },
  halfField: { flex: 1, minWidth: 0 },
  dateField: { minHeight: 45, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  dateFieldText: { color: COLORS.text, fontSize: 11, flex: 1 },
  dateFieldIcon: { color: COLORS.secondary, fontSize: 14 },
  validationText: { color: COLORS.secondary, fontSize: 11, marginTop: 7 },
  formButtonRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 47, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white },
  cancelButtonText: { color: COLORS.black, fontSize: 13, fontWeight: "800" },
  saveButton: { flex: 1.35, minHeight: 47, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.black, paddingHorizontal: 12 },
  saveButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "800" },
  disabledButton: { opacity: 0.6 },
  calendarModal: { alignSelf: "center", width: "92%", maxWidth: 390, backgroundColor: COLORS.white, borderRadius: 18, padding: 17, marginVertical: "auto", overflow: "hidden" },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 17 },
  monthArrow: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  monthArrowText: { color: COLORS.black, fontSize: 27, lineHeight: 30 },
  monthTitleButton: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 4 },
  calendarMonth: { color: COLORS.black, fontSize: 15, fontWeight: "800" },
  calendarYear: { color: COLORS.secondary, fontSize: 11, marginTop: 3 },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekdayText: { width: `${100 / 7}%`, textAlign: "center", color: COLORS.muted, fontSize: 10, fontWeight: "800", paddingVertical: 8 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: { width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  calendarDayText: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  calendarToday: { borderWidth: 1, borderColor: COLORS.black, borderRadius: 21 },
  calendarTodayText: { color: COLORS.black, fontWeight: "800" },
  calendarDaySelected: { backgroundColor: COLORS.black, borderRadius: 21 },
  calendarDayTextSelected: { color: COLORS.white, fontWeight: "800" },
  yearList: { maxHeight: 330 },
  yearOption: { paddingVertical: 11, alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.background, borderRadius: 7 },
  yearOptionSelected: { backgroundColor: COLORS.black },
  yearOptionText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  yearOptionTextSelected: { color: COLORS.white, fontWeight: "800" },
  calendarCancel: { minHeight: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 14 },
  calendarCancelText: { color: COLORS.black, fontSize: 12, fontWeight: "800" },
});
