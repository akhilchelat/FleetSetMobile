
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
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";

import { API_URL } from "../constants/api";
import { getToken, getUser } from "../utils/storage";

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

type VehicleDocument = {
  id: string;
  company_id: string;
  branch_id: string;
  vehicle_id: string;
  uploaded_by: string;
  document_type: string;
  document_number: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_url?: string | null;
  remarks?: string | null;
  is_active: boolean;
};

type UserData = {
  id?: string;
  company_id?: string;
  branch_id?: string | null;
  role?: string;
};

type RenewalForm = {
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  remarks: string;
};

type FilterType =
  | "expired"
  | "today"
  | "7"
  | "30"
  | "60"
  | "90";

const EMPTY_RENEWAL_FORM: RenewalForm = {
  documentNumber: "",
  issueDate: "",
  expiryDate: "",
  fileUrl: "",
  remarks: "",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  registration_certificate: "Registration Certificate",
  insurance: "Insurance",
  fitness_certificate: "Fitness Certificate",
  pollution_certificate: "Pollution Certificate",
  national_permit: "National Permit",
  state_permit: "State Permit",
  road_tax: "Road Tax",
  other: "Other",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(expiryDate?: string | null) {
  if (!expiryDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getStatusText(daysRemaining: number | null) {
  if (daysRemaining === null) {
    return "No expiry date";
  }

  if (daysRemaining < 0) {
    return `Expired ${Math.abs(daysRemaining)} day${
      Math.abs(daysRemaining) === 1 ? "" : "s"
    } ago`;
  }

  if (daysRemaining === 0) {
    return "Expires today";
  }

  if (daysRemaining === 1) {
    return "Expires tomorrow";
  }

  return `${daysRemaining} days remaining`;
}

function getDocumentTypeLabel(type?: string) {
  if (!type) {
    return "Other";
  }

  return (
    DOCUMENT_TYPE_LABELS[type] ||
    type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export default function VehicleDocumentsScreen() {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] =
    useState<FilterType>("expired");

  const [search, setSearch] = useState("");

  const [renewModalVisible, setRenewModalVisible] =
    useState(false);

  const [selectedDocument, setSelectedDocument] =
    useState<VehicleDocument | null>(null);

  const [renewalForm, setRenewalForm] =
    useState<RenewalForm>(EMPTY_RENEWAL_FORM);

  const [renewing, setRenewing] = useState(false);

  const getFilterTitle = () => {
    switch (filter) {
      case "expired":
        return "Expired Documents";
      case "today":
        return "Documents Expiring Today";
      case "7":
        return "Documents Expiring Within 7 Days";
      case "30":
        return "Documents Expiring Within 30 Days";
      case "60":
        return "Documents Expiring Within 60 Days";
      case "90":
        return "Documents Expiring Within 90 Days";
      default:
        return "Vehicle Documents";
    }
  };

  const getFilterDescription = () => {
    switch (filter) {
      case "expired":
        return "Vehicle documents that have already expired.";
      case "today":
        return "Vehicle documents that expire today.";
      case "7":
        return "Vehicle documents that expire within the next 7 days.";
      case "30":
        return "Vehicle documents that expire within the next 30 days.";
      case "60":
        return "Vehicle documents that expire within the next 60 days.";
      case "90":
        return "Vehicle documents that expire within the next 90 days.";
      default:
        return "Track vehicle document expiry dates.";
    }
  };

  const loadData = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const user = (await getUser()) as UserData | null;

        if (!user?.company_id) {
          Alert.alert(
            "Error",
            "Company information was not found. Please log in again."
          );
          return;
        }

        const companyId = user.company_id;

        let documentEndpoint: string;

        if (filter === "expired") {
          documentEndpoint =
            `${API_URL}/vehicle-documents/${companyId}/expired`;
        } else {
          const days =
            filter === "today" ? 0 : Number(filter);

          documentEndpoint =
            `${API_URL}/vehicle-documents/${companyId}/expiring?days=${days}`;
        }

        const [documentResponse, vehicleResponse] =
          await Promise.all([
            authenticatedFetch(documentEndpoint),
            authenticatedFetch(
              `${API_URL}/vehicles/${companyId}/all`
            ),
          ]);

        if (!documentResponse.ok) {
          const errorText =
            await documentResponse.text();

          throw new Error(
            errorText ||
              "Failed to load vehicle documents."
          );
        }

        if (!vehicleResponse.ok) {
          const errorText =
            await vehicleResponse.text();

          throw new Error(
            errorText ||
              "Failed to load vehicles."
          );
        }

        const documentData =
          await documentResponse.json();

        const vehicleData =
          await vehicleResponse.json();

        const documentList = Array.isArray(documentData)
          ? documentData
          : Array.isArray(documentData?.data)
          ? documentData.data
          : [];

        const vehicleList = Array.isArray(vehicleData)
          ? vehicleData
          : Array.isArray(vehicleData?.data)
          ? vehicleData.data
          : [];

        setDocuments(documentList);
        setVehicles(vehicleList);
      } catch (error: any) {
        console.error(
          "Failed to load vehicle documents:",
          error
        );

        Alert.alert(
          "Error",
          error?.message ||
            "Failed to load vehicle documents."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  const vehicleMap = useMemo(() => {
    const map: Record<string, string> = {};

    vehicles.forEach((vehicle) => {
      map[vehicle.id] =
        vehicle.registration_number || vehicle.id;
    });

    return map;
  }, [vehicles]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return documents;
    }

    return documents.filter((document) => {
      const registration =
        vehicleMap[document.vehicle_id]?.toLowerCase() || "";

      const documentType =
        getDocumentTypeLabel(
          document.document_type
        ).toLowerCase();

      const documentNumber =
        document.document_number?.toLowerCase() || "";

      return (
        registration.includes(query) ||
        documentType.includes(query) ||
        documentNumber.includes(query)
      );
    });
  }, [documents, search, vehicleMap]);

  const expiredCount = useMemo(() => {
    return filteredDocuments.filter((document) => {
      const days = getDaysRemaining(
        document.expiry_date
      );

      return days !== null && days < 0;
    }).length;
  }, [filteredDocuments]);

  const todayCount = useMemo(() => {
    return filteredDocuments.filter((document) => {
      return (
        getDaysRemaining(document.expiry_date) === 0
      );
    }).length;
  }, [filteredDocuments]);

  const sevenDayCount = useMemo(() => {
    return filteredDocuments.filter((document) => {
      const days = getDaysRemaining(
        document.expiry_date
      );

      return (
        days !== null &&
        days >= 0 &&
        days <= 7
      );
    }).length;
  }, [filteredDocuments]);

  const openRenewModal = (
    document: VehicleDocument
  ) => {
    setSelectedDocument(document);

    setRenewalForm({
      documentNumber:
        document.document_number || "",
      issueDate: document.issue_date || "",
      expiryDate: "",
      fileUrl: document.file_url || "",
      remarks: document.remarks || "",
    });

    setRenewModalVisible(true);
  };

  const closeRenewModal = () => {
    if (renewing) {
      return;
    }

    setRenewModalVisible(false);
    setSelectedDocument(null);
    setRenewalForm(EMPTY_RENEWAL_FORM);
  };

  const handleRenew = async () => {
    if (!selectedDocument) {
      return;
    }

    if (!renewalForm.documentNumber.trim()) {
      Alert.alert(
        "Validation",
        "Please enter the document number."
      );
      return;
    }

    if (!renewalForm.issueDate.trim()) {
      Alert.alert(
        "Validation",
        "Please enter the issue date."
      );
      return;
    }

    if (!renewalForm.expiryDate.trim()) {
      Alert.alert(
        "Validation",
        "Please enter the new expiry date."
      );
      return;
    }

    if (!renewalForm.fileUrl.trim()) {
      Alert.alert(
        "Validation",
        "Please enter the document file URL."
      );
      return;
    }

    const issueDate = new Date(
      `${renewalForm.issueDate}T00:00:00`
    );

    const expiryDate = new Date(
      `${renewalForm.expiryDate}T00:00:00`
    );

    if (
      Number.isNaN(issueDate.getTime()) ||
      Number.isNaN(expiryDate.getTime())
    ) {
      Alert.alert(
        "Validation",
        "Please use valid dates in YYYY-MM-DD format."
      );
      return;
    }

    if (expiryDate < issueDate) {
      Alert.alert(
        "Validation",
        "Expiry date cannot be earlier than issue date."
      );
      return;
    }

    try {
      setRenewing(true);

      const user = (await getUser()) as UserData | null;

      if (!user?.company_id) {
        Alert.alert(
          "Error",
          "Company information was not found. Please log in again."
        );
        return;
      }

      const response = await authenticatedFetch(
        `${API_URL}/vehicle-documents/${user.company_id}/${selectedDocument.id}/renew`,
        {
          method: "POST",
          body: JSON.stringify({
            document_number:
              renewalForm.documentNumber.trim(),
            issue_date: renewalForm.issueDate,
            expiry_date: renewalForm.expiryDate,
            file_url: renewalForm.fileUrl.trim(),
            remarks:
              renewalForm.remarks.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          errorText ||
            "Failed to renew document."
        );
      }

      Alert.alert(
        "Success",
        "Vehicle document renewed successfully."
      );

      setRenewModalVisible(false);
      setSelectedDocument(null);
      setRenewalForm(EMPTY_RENEWAL_FORM);

      await loadData(false);
    } catch (error: any) {
      console.error(
        "Failed to renew document:",
        error
      );

      Alert.alert(
        "Renewal Failed",
        error?.message ||
          "Failed to renew the vehicle document."
      );
    } finally {
      setRenewing(false);
    }
  };

  const handleRefresh = async () => {
    await loadData(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {getFilterTitle()}
          </Text>

          <Text style={styles.subtitle}>
            {getFilterDescription()}
          </Text>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>
            Document Status
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.filterScrollContent
            }
          >
            {[
              {
                key: "expired" as FilterType,
                label: "Expired",
              },
              {
                key: "today" as FilterType,
                label: "Today",
              },
              {
                key: "7" as FilterType,
                label: "7 Days",
              },
              {
                key: "30" as FilterType,
                label: "30 Days",
              },
              {
                key: "60" as FilterType,
                label: "60 Days",
              },
              {
                key: "90" as FilterType,
                label: "90 Days",
              },
            ].map((item) => {
              const active =
                filter === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.filterButton,
                    active &&
                      styles.filterButtonActive,
                  ]}
                  onPress={() =>
                    setFilter(item.key)
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      active &&
                        styles.filterButtonTextActive,
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
          <TextInput
  value={search}
  onChangeText={setSearch}
  placeholder="Search vehicle, document type or number"
  placeholderTextColor="#999999"
  style={[
    styles.searchInput,
    Platform.OS === "web"
      ? ({ outline: "none" } as any)
      : undefined,
  ]}
  autoCapitalize="none"
/>
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>
                ×
              </Text>
            </TouchableOpacity>
          )}
        </View>

        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
  size="large"
  color="#000000"
/>

            <Text style={styles.loadingText}>
              Loading documents...
            </Text>
          </View>
        ) : filteredDocuments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {filter === "expired"
                ? "No expired documents"
                : "No documents found"}
            </Text>

            <Text style={styles.emptySubtitle}>
              {filter === "expired"
                ? "All active vehicle documents are currently valid."
                : `No active vehicle documents match the ${getFilterTitle().toLowerCase()} filter.`}
            </Text>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <Text style={styles.refreshButtonText}>
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredDocuments.map((document) => {
              const daysRemaining =
                getDaysRemaining(
                  document.expiry_date
                );

              const registration =
                vehicleMap[
                  document.vehicle_id
                ] || "Vehicle not found";

              const isExpired =
                daysRemaining !== null &&
                daysRemaining < 0;

              return (
                <View
                  key={document.id}
                  style={[
                    styles.documentCard,
                    isExpired &&
                      styles.expiredDocumentCard,
                  ]}
                >
                  <View
                    style={styles.documentTopRow}
                  >
                    <View
                      style={styles.documentMain}
                    >
                      <Text
                        style={styles.vehicleNumber}
                      >
                        {registration}
                      </Text>

                      <Text
                        style={styles.documentType}
                      >
                        {getDocumentTypeLabel(
                          document.document_type
                        )}
                      </Text>
                    </View>

                    <View
                      style={styles.statusContainer}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isExpired &&
                            styles.statusTextExpired,
                          !isExpired &&
                            daysRemaining !== null &&
                            daysRemaining <= 7 &&
                            styles.statusTextUrgent,
                        ]}
                      >
                        {getStatusText(
                          daysRemaining
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <View
                      style={styles.detailItem}
                    >
                      <Text
                        style={styles.detailLabel}
                      >
                        Document Number
                      </Text>

                      <Text
                        style={styles.detailValue}
                      >
                        {document.document_number}
                      </Text>
                    </View>

                    <View
                      style={styles.detailItemRight}
                    >
                      <Text
                        style={styles.detailLabel}
                      >
                        Expiry Date
                      </Text>

                      <Text
                        style={styles.detailValue}
                      >
                        {formatDate(
                          document.expiry_date
                        )}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.renewButton}
                    onPress={() =>
                      openRenewModal(document)
                    }
                    activeOpacity={0.8}
                  >
                    <Text
                      style={
                        styles.renewButtonText
                      }
                    >
                      Renew Document
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={renewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRenewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalContent
              }
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>
                    Renew Document
                  </Text>

                  {selectedDocument && (
                    <Text
                      style={
                        styles.modalSubtitle
                      }
                    >
                      {vehicleMap[
                        selectedDocument.vehicle_id
                      ] || "Vehicle"}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={closeRenewModal}
                  disabled={renewing}
                >
                  <Text style={styles.modalClose}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Document Number
              </Text>

              <TextInput
                value={
                  renewalForm.documentNumber
                }
                onChangeText={(value) =>
                  setRenewalForm((current) => ({
                    ...current,
                    documentNumber: value,
                  }))
                }
                placeholder="Enter document number"
                placeholderTextColor="#999999"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>
                Issue Date
              </Text>

              <TextInput
                value={renewalForm.issueDate}
                onChangeText={(value) =>
                  setRenewalForm((current) => ({
                    ...current,
                    issueDate: value,
                  }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999999"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>
                New Expiry Date
              </Text>

              <TextInput
                value={renewalForm.expiryDate}
                onChangeText={(value) =>
                  setRenewalForm((current) => ({
                    ...current,
                    expiryDate: value,
                  }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999999"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>
                File URL
              </Text>

              <TextInput
                value={renewalForm.fileUrl}
                onChangeText={(value) =>
                  setRenewalForm((current) => ({
                    ...current,
                    fileUrl: value,
                  }))
                }
                placeholder="Enter document file URL"
                placeholderTextColor="#999999"
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>
                Remarks
              </Text>

              <TextInput
                value={renewalForm.remarks}
                onChangeText={(value) =>
                  setRenewalForm((current) => ({
                    ...current,
                    remarks: value,
                  }))
                }
                placeholder="Optional"
                placeholderTextColor="#999999"
                style={[
                  styles.input,
                  styles.textArea,
                ]}
                multiline
              />

              <View
                style={styles.modalButtonRow}
              >
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeRenewModal}
                  disabled={renewing}
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    renewing &&
                      styles.disabledButton,
                  ]}
                  onPress={handleRenew}
                  disabled={renewing}
                >
                  {renewing ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Renew
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 30,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
  },

  subtitle: {
    fontSize: 14,
    color: "#777777",
    marginTop: 5,
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

  searchInput: {
  flex: 1,
  fontSize: 14,
  color: "#000000",
  borderWidth: 0,
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
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  list: {
    gap: 12,
  },

  documentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 16,
  },

  expiredDocumentCard: {
    borderColor: "#FF3B30",
  },

  documentTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  documentMain: {
    flex: 1,
    paddingRight: 10,
  },

  vehicleNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
  },

  documentType: {
    fontSize: 13,
    color: "#555555",
    marginTop: 4,
  },

  statusContainer: {
    alignItems: "flex-end",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
    textAlign: "right",
  },

  statusTextExpired: {
    color: "#FF3B30",
  },

  statusTextUrgent: {
    color: "#000000",
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

  renewButton: {
    marginTop: 14,
    backgroundColor: "#000000",
    borderRadius: 9,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  renewButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  bottomSpace: {
    height: 90,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },

  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 35,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  modalHeaderText: {
    flex: 1,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#777777",
    marginTop: 4,
  },

  modalClose: {
    fontSize: 30,
    lineHeight: 30,
    color: "#777777",
    marginLeft: 15,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#000000",
    backgroundColor: "#FFFFFF",
  },

  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },

  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 9,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  disabledButton: {
    opacity: 0.6,
  },
});

