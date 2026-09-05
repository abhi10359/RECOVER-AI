import { useEffect, useMemo, useState } from "react";

import {
  CalendarCheck,
  RefreshCw,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Bell,
  CalendarPlus,
  Download,
  X,
  Save,
  Phone,
  MessageCircle,
  User,
  History,
  Mail,
  Send,
} from "lucide-react";

import { useToast } from "../context/ToastContext";
import { exportToCSV } from "../utils/csvExport";

const API_URL = "http://127.0.0.1:8000";

function PromiseToPayTracker() {
  const toast = useToast();

  // =========================================================
  // STATES
  // =========================================================

  const [transactions, setTransactions] = useState([]);
  const [promiseData, setPromiseData] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(null);

  // Active / Historical tab
  const [activeTab, setActiveTab] = useState("active");

  // Update commitment modal
  const [editingPromise, setEditingPromise] = useState(null);
  const [newPromiseDate, setNewPromiseDate] = useState("");
  const [promiseNote, setPromiseNote] = useState("");
  const [updatingPromise, setUpdatingPromise] = useState(false);

  // Urgent chaser preview modal
  const [chaserModal, setChaserModal] = useState(null);
  const [chaserLoading, setChaserLoading] = useState(false);

  // =========================================================
  // BASIC HELPERS
  // =========================================================

  const getTransactionId = (transaction) => {
    return transaction?.transaction_id || transaction?.id || null;
  };

  const getCustomerName = (transaction) => {
    return (
      transaction?.customer_name ||
      transaction?.customer ||
      transaction?.customerName ||
      "Customer"
    );
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "—";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getToday = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const parseDateOnly = (value) => {
    if (!value) return null;

    const dateString = String(value).slice(0, 10);
    const parts = dateString.split("-");

    if (parts.length !== 3) {
      const parsed = new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
      );
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  };

  const getDaysDifference = (promiseDate) => {
    const target = parseDateOnly(promiseDate);

    if (!target) return null;

    const today = parseDateOnly(getToday());

    if (!today) return null;

    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return Math.round(
      (target.getTime() - today.getTime()) /
        millisecondsPerDay
    );
  };

  // =========================================================
  // PAYMENT STATUS DETECTION
  // =========================================================

  const isTransactionPaid = (transaction) => {
    const values = [
      transaction?.status,
      transaction?.payment_status,
      transaction?.transaction_status,
      transaction?.recovery_status,
      transaction?.recovery_outcome,
      transaction?.promise_status,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return values.some(
      (value) =>
        value === "paid" ||
        value === "success" ||
        value === "successful" ||
        value === "recovered" ||
        value === "fulfilled" ||
        value === "completed" ||
        value.includes("payment completed") ||
        value.includes("payment successful")
    );
  };

  // =========================================================
  // LOAD PROMISE DATA
  // =========================================================

  const loadPromises = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/transactions`
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load transactions."
        );
      }

      const data = await response.json();

      const transactionList = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
        ? data.transactions
        : [];

      setTransactions(transactionList);

      const results = await Promise.all(
        transactionList.map(async (transaction) => {
          const transactionId =
            getTransactionId(transaction);

          if (!transactionId) {
            return [
              `unknown-${Math.random()}`,
              {
                promise_status: "No active promise",
                promise_date: null,
                promise_amount: null,
                promise_note: "",
                follow_up_required: false,
                capture_channel: null,
              },
            ];
          }

          try {
            const statusResponse = await fetch(
              `${API_URL}/api/transactions/${encodeURIComponent(
                transactionId
              )}/promise-status`
            );

            if (!statusResponse.ok) {
              return [
                transactionId,
                {
                  promise_status:
                    transaction.promise_status ||
                    "No active promise",

                  promise_date:
                    transaction.promise_date ||
                    null,

                  promise_amount:
                    transaction.promise_amount ??
                    null,

                  promise_note:
                    transaction.promise_note ||
                    "",

                  follow_up_required: false,

                  capture_channel:
                    transaction.promise_capture_channel ||
                    transaction.capture_channel ||
                    transaction.language_source ||
                    null,
                },
              ];
            }

            const statusData =
              await statusResponse.json();

            return [
              transactionId,
              {
                ...(statusData || {}),

                promise_date:
                  statusData?.promise_date ??
                  transaction.promise_date ??
                  null,

                promise_amount:
                  statusData?.promise_amount ??
                  transaction.promise_amount ??
                  null,

                promise_note:
                  statusData?.promise_note ??
                  transaction.promise_note ??
                  "",

                capture_channel:
                  statusData?.capture_channel ||
                  statusData?.source ||
                  transaction.promise_capture_channel ||
                  transaction.capture_channel ||
                  transaction.promise_source ||
                  null,
              },
            ];
          } catch (err) {
            console.warn(
              `Promise status unavailable for ${transactionId}`,
              err
            );

            return [
              transactionId,
              {
                promise_status:
                  transaction.promise_status ||
                  "No active promise",

                promise_date:
                  transaction.promise_date ||
                  null,

                promise_amount:
                  transaction.promise_amount ??
                  null,

                promise_note:
                  transaction.promise_note ||
                  "",

                follow_up_required: false,

                capture_channel:
                  transaction.promise_capture_channel ||
                  transaction.capture_channel ||
                  transaction.promise_source ||
                  null,
              },
            ];
          }
        })
      );

      setPromiseData(
        Object.fromEntries(results)
      );
    } catch (err) {
      console.error(
        "Promise-to-Pay loading error:",
        err
      );

      const message =
        err?.message ||
        "Could not load Promise-to-Pay data. Make sure the backend is running.";

      setError(message);

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPromises();
  }, []);

  // =========================================================
  // PROMISE HELPERS
  // =========================================================

  const getPromiseDate = (transaction) => {
    const id = getTransactionId(transaction);

    return (
      promiseData[id]?.promise_date ||
      transaction?.promise_date ||
      null
    );
  };

  const getPromiseAmount = (transaction) => {
    const id = getTransactionId(transaction);

    return Number(
      promiseData[id]?.promise_amount ??
        transaction?.promise_amount ??
        transaction?.amount ??
        0
    );
  };

  const getPromiseNote = (transaction) => {
    const id = getTransactionId(transaction);

    return (
      promiseData[id]?.promise_note ||
      transaction?.promise_note ||
      ""
    );
  };

  // =========================================================
  // CAPTURE CHANNEL
  // =========================================================

  const getCaptureChannel = (transaction) => {
    const id = getTransactionId(transaction);

    const channel =
      promiseData[id]?.capture_channel ||
      promiseData[id]?.promise_capture_channel ||
      promiseData[id]?.source ||
      transaction?.promise_capture_channel ||
      transaction?.capture_channel ||
      transaction?.promise_source ||
      transaction?.source ||
      "";

    const value = String(channel).toLowerCase();

    if (
      value.includes("voice") ||
      value.includes("call") ||
      value.includes("hinglish")
    ) {
      return {
        label: "Hinglish Voice Agent",
        type: "voice",
      };
    }

    if (
      value.includes("whatsapp") ||
      value.includes("wa")
    ) {
      return {
        label: "WhatsApp",
        type: "whatsapp",
      };
    }

    if (
      value.includes("manual") ||
      value.includes("admin") ||
      value.includes("human")
    ) {
      return {
        label: "Manual Entry",
        type: "manual",
      };
    }

    if (
      value.includes("chat") ||
      value.includes("ai")
    ) {
      return {
        label: "AI Assistant",
        type: "ai",
      };
    }

    if (channel) {
      return {
        label: String(channel),
        type: "system",
      };
    }

    return {
      label: "System",
      type: "system",
    };
  };

  // =========================================================
  // PROMISE EXISTENCE
  // =========================================================

  const hasRealPromise = (transaction) => {
    const promiseDate =
      getPromiseDate(transaction);

    return Boolean(promiseDate);
  };

  // =========================================================
  // STATUS CALCULATION
  // =========================================================

  const getComputedStatus = (transaction) => {
    const promiseDate =
      getPromiseDate(transaction);

    if (!promiseDate) {
      return "No active promise";
    }

    if (isTransactionPaid(transaction)) {
      return "Fulfilled";
    }

    const daysDifference =
      getDaysDifference(promiseDate);

    if (daysDifference === null) {
      return "Active Promise";
    }

    if (daysDifference < 0) {
      return "Overdue Promise";
    }

    return "Active Promise";
  };

  // =========================================================
  // FOLLOW-UP STATUS
  // =========================================================

  const getFollowUpInfo = (transaction) => {
    const status =
      getComputedStatus(transaction);

    const promiseDate =
      getPromiseDate(transaction);

    if (status === "Fulfilled") {
      return {
        required: false,
        label: "Not required",
        detail: "Promise fulfilled",
        type: "success",
      };
    }

    if (!promiseDate) {
      return {
        required: false,
        label: "Not required",
        detail: "No promise date",
        type: "warning",
      };
    }

    const daysDifference =
      getDaysDifference(promiseDate);

    if (
      status === "Overdue Promise" ||
      (daysDifference !== null &&
        daysDifference < 0)
    ) {
      const overdueDays =
        Math.abs(daysDifference || 0);

      return {
        required: true,
        label: "Pending AI Chaser",
        detail:
          overdueDays === 1
            ? "1 day overdue"
            : `${overdueDays} days overdue`,
        type: "danger",
      };
    }

    if (
      daysDifference !== null &&
      daysDifference === 0
    ) {
      return {
        required: true,
        label: "Due today",
        detail: "Follow-up scheduled today",
        type: "warning",
      };
    }

    return {
      required: false,
      label: "Scheduled",
      detail:
        daysDifference === 1
          ? "Due in 1 day"
          : `Due in ${daysDifference} days`,
      type: "info",
    };
  };

  // =========================================================
  // PROMISE COLLECTION
  // =========================================================

  const promiseTransactions = useMemo(() => {
    return transactions.filter(
      hasRealPromise
    );
  }, [transactions, promiseData]);

  // =========================================================
  // ACTIVE / HISTORICAL
  // =========================================================

  const activePromiseTransactions =
    useMemo(() => {
      return promiseTransactions.filter(
        (transaction) => {
          const status =
            getComputedStatus(transaction);

          return (
            status === "Active Promise" ||
            status === "Overdue Promise"
          );
        }
      );
    }, [promiseTransactions]);

  const historicalPromiseTransactions =
    useMemo(() => {
      return promiseTransactions.filter(
        (transaction) =>
          getComputedStatus(transaction) ===
          "Fulfilled"
      );
    }, [promiseTransactions]);

  const displayedTransactions =
    activeTab === "active"
      ? activePromiseTransactions
      : historicalPromiseTransactions;

  // =========================================================
  // STATUS CLASS
  // =========================================================

  const statusClass = (status = "") => {
    const value =
      status.toString().toLowerCase();

    if (
      value.includes("overdue") ||
      value.includes("escalat")
    ) {
      return "danger";
    }

    if (
      value.includes("paid") ||
      value.includes("fulfilled") ||
      value.includes("completed")
    ) {
      return "success";
    }

    if (
      value.includes("active") ||
      value.includes("pending")
    ) {
      return "info";
    }

    return "warning";
  };

  // =========================================================
  // STATISTICS
  // =========================================================

  const totalPromisedAmount =
    activePromiseTransactions.reduce(
      (total, transaction) =>
        total +
        getPromiseAmount(transaction),
      0
    );

  const activePromises =
    activePromiseTransactions.filter(
      (transaction) =>
        getComputedStatus(
          transaction
        ) === "Active Promise"
    ).length;

  const overduePromises =
    activePromiseTransactions.filter(
      (transaction) =>
        getComputedStatus(
          transaction
        ) === "Overdue Promise"
    ).length;

  const followUpsPending =
    activePromiseTransactions.filter(
      (transaction) =>
        getFollowUpInfo(transaction)
          .required
    ).length;

  // =========================================================
  // UPDATE COMMITMENT MODAL
  // =========================================================

  const openUpdateModal = (
    transaction
  ) => {
    const currentDate =
      getPromiseDate(transaction);

    const currentNote =
      getPromiseNote(transaction);

    setEditingPromise(transaction);

    setNewPromiseDate(
      currentDate
        ? String(currentDate).slice(0, 10)
        : ""
    );

    setPromiseNote(currentNote);

    setError("");
  };

  const closeUpdateModal = () => {
    if (updatingPromise) {
      return;
    }

    setEditingPromise(null);
    setNewPromiseDate("");
    setPromiseNote("");
  };

  // =========================================================
  // UPDATE COMMITMENT
  // =========================================================

  const updateCommitment = async () => {
    if (!editingPromise) {
      return;
    }

    if (!newPromiseDate) {
      toast.error(
        "Please select a Promise-to-Pay date."
      );
      return;
    }

    const transactionId =
      getTransactionId(editingPromise);

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    setUpdatingPromise(true);

    try {
      const response = await fetch(
        `${API_URL}/api/transactions/${encodeURIComponent(
          transactionId
        )}/promise-to-pay`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            promise_date:
              newPromiseDate,

            note:
              promiseNote.trim() ||
              "Promise-to-Pay commitment updated.",

            capture_channel:
              "Manual Entry",
          }),
        }
      );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to update commitment."
        );
      }

      toast.success(
        "Promise-to-Pay commitment updated successfully."
      );

      setEditingPromise(null);
      setNewPromiseDate("");
      setPromiseNote("");

      await loadPromises();
    } catch (err) {
      console.error(
        "Update commitment error:",
        err
      );

      toast.error(
        err?.message ||
          "Unable to update commitment."
      );
    } finally {
      setUpdatingPromise(false);
    }
  };

  // =========================================================
  // RECORD NEW COMMITMENT
  // =========================================================

  const recordCommitment = async (
    transaction
  ) => {
    const transactionId =
      getTransactionId(transaction);

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    const selectedDate =
      window.prompt(
        "Enter Promise-to-Pay date (YYYY-MM-DD):"
      );

    if (!selectedDate) {
      return;
    }

    setActionLoading(
      transactionId
    );

    try {
      const response = await fetch(
        `${API_URL}/api/transactions/${encodeURIComponent(
          transactionId
        )}/promise`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            promise_date:
              selectedDate,

            amount:
              transaction.amount || 0,

            capture_channel:
              "Manual Entry",
          }),
        }
      );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Promise recording endpoint is not available."
        );
      }

      toast.success(
        "Promise-to-Pay commitment recorded successfully."
      );

      await loadPromises();
    } catch (err) {
      console.error(
        "Record commitment error:",
        err
      );

      toast.error(
        err?.message ||
          "Unable to record commitment."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================
  // GENERATE / PREVIEW URGENT CHASER
  // =========================================================

  const generatePromiseReminder = async (
    transaction
  ) => {
    const transactionId =
      getTransactionId(transaction);

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    setChaserLoading(true);

    try {
      /*
       * PREVIEW ONLY
       *
       * This request generates the AI message
       * but does NOT send it.
       */

      const response = await fetch(
        `${API_URL}/api/receivables/chaser`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            transaction_id:
              transactionId,

            stage: 3,

            channel: "email",

            priority: "urgent",

            action: "preview",
          }),
        }
      );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to generate reminder."
        );
      }

      /*
       * Backend may return the generated
       * message using different field names.
       */

      const message =
        data?.message_body ||
        data?.message ||
        data?.body ||
        data?.content ||
        data?.generated_message ||
        data?.reminder_message ||
        data?.text ||
        "";

      const subject =
        data?.subject ||
        `Payment Reminder: Invoice ${transactionId}`;

      if (!message) {
        throw new Error(
          "Backend did not return a reminder message."
        );
      }

      /*
       * Store generated message locally.
       * It will be sent later only after
       * the user clicks Send Message.
       */

      setChaserModal({
        transaction,

        transactionId,

        customerName:
          getCustomerName(transaction),

        subject,

        message,

        channel:
          data?.channel || "Email",

        priority:
          data?.priority || "Urgent",

        rawResponse: data,
      });
    } catch (err) {
      console.error(
        "Generate reminder error:",
        err
      );

      toast.error(
        err?.message ||
          "Unable to generate reminder."
      );
    } finally {
      setChaserLoading(false);
    }
  };

  // =========================================================
  // CLOSE CHASER MODAL
  // =========================================================

  const closeChaserModal = () => {
    if (chaserLoading) {
      return;
    }

    setChaserModal(null);
  };

  // =========================================================
  // SEND GENERATED CHASER
  // =========================================================

  const sendGeneratedChaser = async () => {
    if (!chaserModal) {
      return;
    }

    const transactionId =
      chaserModal.transactionId;

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    if (!chaserModal.message) {
      toast.error(
        "There is no generated message to send."
      );
      return;
    }

    setActionLoading(transactionId);

    try {
      /*
       * SEND OPERATION
       *
       * The exact AI-generated message from the
       * preview modal is sent to the backend.
       */

      const response = await fetch(
        `${API_URL}/api/receivables/chaser`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            transaction_id:
              transactionId,

            stage: 3,

            channel: String(
              chaserModal.channel ||
                "email"
            ).toLowerCase(),

            priority: String(
              chaserModal.priority ||
                "urgent"
            ).toLowerCase(),

            subject:
              chaserModal.subject,

            message:
              chaserModal.message,

            action: "send",
          }),
        }
      );

      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "Unable to send reminder."
        );
      }

      /*
       * Close preview only after
       * successful backend response.
       */

      setChaserModal(null);

      /*
       * IMPORTANT FIX:
       *
       * Do NOT use:
       *
       * toast.success(data.message)
       *
       * because data.message may contain the
       * complete AI-generated message body.
       *
       * Use a fixed short success message instead.
       */

      toast.success(
        "Payment reminder sent successfully."
      );

      /*
       * Refresh Promise-to-Pay data.
       */

      await loadPromises();
    } catch (err) {
      console.error(
        "Send generated chaser error:",
        err
      );

      toast.error(
        err?.message ||
          "Unable to send reminder."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExportCSV = () => {
    if (
      displayedTransactions.length ===
      0
    ) {
      toast.info(
        activeTab === "active"
          ? "No active promise records to export."
          : "No historical promise records to export."
      );

      return;
    }

    const columns = [
      {
        key: "transaction_id",
        label: "Transaction ID",

        formatter: (
          value,
          row
        ) =>
          getTransactionId(row) ||
          value ||
          "—",
      },

      {
        key: "customer_name",
        label: "Customer Name",

        formatter: (
          value,
          row
        ) =>
          value ||
          row.customer ||
          row.customerName ||
          "Customer",
      },

      {
        key: "amount",
        label: "Amount (₹)",

        formatter: (
          value,
          row
        ) =>
          Number(
            value ??
              getPromiseAmount(
                row
              ) ??
              0
          ).toFixed(2),
      },

      {
        key: "promise_date",
        label: "Promise Date",

        formatter: (
          value,
          row
        ) =>
          formatDate(
            getPromiseDate(row)
          ),
      },

      {
        key: "promise_status",
        label: "Status",

        formatter: (
          value,
          row
        ) =>
          getComputedStatus(row),
      },

      {
        key: "follow_up",
        label: "Follow-up",

        formatter: (
          value,
          row
        ) =>
          getFollowUpInfo(row)
            .label,
      },

      {
        key: "capture_channel",
        label: "Captured Via",

        formatter: (
          value,
          row
        ) =>
          getCaptureChannel(row)
            .label,
      },
    ];

    const dateStr =
      new Date()
        .toISOString()
        .slice(0, 10);

    const filename =
      activeTab === "active"
        ? `active_promises_${dateStr}.csv`
        : `fulfilled_promises_${dateStr}.csv`;

    exportToCSV(
      displayedTransactions,
      filename,
      columns
    );

    toast.success(
      "Promise-to-Pay records exported to CSV."
    );
  };

  // =========================================================
  // SKELETON
  // =========================================================

  const renderSkeleton = () => {
    return (
      <>
        <div className="feature-stat-grid">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="skeleton-card skeleton-shimmer"
              >
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--value" />
                <div className="skeleton-line skeleton-line--sub" />
              </div>
            )
          )}
        </div>

        <div className="feature-table-card">
          <div className="feature-section-heading">
            <div>
              <div
                className="skeleton-shimmer"
                style={{
                  width: "260px",
                  height: "22px",
                  borderRadius: "6px",
                }}
              />

              <div
                className="skeleton-shimmer"
                style={{
                  width: "360px",
                  height: "14px",
                  borderRadius: "6px",
                  marginTop: "10px",
                }}
              />
            </div>

            <div
              className="skeleton-shimmer"
              style={{
                width: "80px",
                height: "30px",
                borderRadius: "20px",
              }}
            />
          </div>

          <div className="skeleton-table">
            {[1, 2, 3, 4, 5].map(
              (row) => (
                <div
                  key={row}
                  className="skeleton-table-row"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(
                    (cell) => (
                      <div
                        key={cell}
                        className="skeleton-shimmer skeleton-cell"
                        style={{
                          width:
                            cell === 7
                              ? "16%"
                              : "14%",
                        }}
                      />
                    )
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </>
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="feature-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="feature-page-header">
        <div>
          <div className="feature-title-row">
            <CalendarCheck size={28} />

            <h2>
              Promise-to-Pay Tracker
            </h2>
          </div>

          <p>
            Monitor customer payment commitments,
            overdue promises, and AI follow-ups.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="feature-action-button export-csv-button"
            onClick={handleExportCSV}
            disabled={
              loading ||
              displayedTransactions.length === 0
            }
            title="Export promise records to CSV"
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="feature-refresh-button"
            onClick={loadPromises}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle
                size={16}
                className="spin"
              />
            ) : (
              <RefreshCw size={16} />
            )}

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && !loading && (
        <div className="feature-error">
          <AlertCircle size={20} />

          <span>{error}</span>

          <button
            type="button"
            className="feature-refresh-button"
            onClick={loadPromises}
          >
            Try Again
          </button>
        </div>
      )}

      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading &&
        renderSkeleton()}

      {/* =====================================================
          CONTENT
      ===================================================== */}

      {!loading && !error && (
        <>
          {/* STATISTICS */}

          <div className="feature-stat-grid">

            <div className="feature-stat-card">
              <span>
                ACTIVE PROMISED AMOUNT
              </span>

              <strong>
                {formatCurrency(
                  totalPromisedAmount
                )}
              </strong>
            </div>

            <div className="feature-stat-card">
              <span>
                ACTIVE PROMISES
              </span>

              <strong>
                {activePromises}
              </strong>
            </div>

            <div className="feature-stat-card">
              <span>
                OVERDUE PROMISES
              </span>

              <strong>
                {overduePromises}
              </strong>
            </div>

            <div className="feature-stat-card">
              <span>
                FOLLOW-UPS PENDING
              </span>

              <strong>
                {followUpsPending}
              </strong>
            </div>

          </div>

          {/* TABS */}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setActiveTab("active")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 10,
                border:
                  activeTab === "active"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  activeTab === "active"
                    ? "#111827"
                    : "#ffffff",
                color:
                  activeTab === "active"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <CalendarCheck size={15} />

              Active Promises

              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 999,
                  background:
                    activeTab === "active"
                      ? "rgba(255,255,255,.18)"
                      : "#f1f5f9",
                }}
              >
                {
                  activePromiseTransactions.length
                }
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("historical")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 10,
                border:
                  activeTab === "historical"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  activeTab === "historical"
                    ? "#111827"
                    : "#ffffff",
                color:
                  activeTab === "historical"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <History size={15} />

              Fulfilled / Historical

              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 999,
                  background:
                    activeTab === "historical"
                      ? "rgba(255,255,255,.18)"
                      : "#f1f5f9",
                }}
              >
                {
                  historicalPromiseTransactions.length
                }
              </span>
            </button>
          </div>

          {/* TABLE */}

          <div className="feature-table-card">

            <div className="feature-section-heading">

              <div>
                <h3>
                  {activeTab === "active"
                    ? "Active Customer Commitments"
                    : "Fulfilled Promise History"}
                </h3>

                <p>
                  {activeTab === "active"
                    ? "Only genuine Promise-to-Pay commitments that are still active or overdue are shown."
                    : "Completed and paid Promise-to-Pay commitments are retained here for historical reference."}
                </p>
              </div>

              <div className="feature-count">
                {
                  displayedTransactions.length
                }{" "}
                record
                {displayedTransactions.length ===
                1
                  ? ""
                  : "s"}
              </div>

            </div>

            {displayedTransactions.length ===
            0 ? (
              <div className="feature-empty">

                {activeTab ===
                "active" ? (
                  <Clock3 size={34} />
                ) : (
                  <History size={34} />
                )}

                <h3>
                  {activeTab === "active"
                    ? "No active promises"
                    : "No fulfilled promises"}
                </h3>

                <p>
                  {activeTab === "active"
                    ? "There are currently no active or overdue Promise-to-Pay commitments."
                    : "Paid and fulfilled Promise-to-Pay commitments will appear here."}
                </p>

                {activeTab ===
                  "active" &&
                  transactions.length >
                    0 && (
                    <button
                      type="button"
                      className="feature-action-button"
                      onClick={() =>
                        recordCommitment(
                          transactions[0]
                        )
                      }
                    >
                      <CalendarPlus
                        size={16}
                      />

                      Record Commitment
                    </button>
                  )}

              </div>
            ) : (
              <div className="responsive-table">

                <table className="feature-table">

                  <thead>
                    <tr>
                      <th>
                        Transaction
                      </th>

                      <th>
                        Customer
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Promise Date
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Follow-up
                      </th>

                      <th>
                        Captured Via
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {displayedTransactions.map(
                      (transaction) => {

                        const transactionId =
                          getTransactionId(
                            transaction
                          );

                        const status =
                          getComputedStatus(
                            transaction
                          );

                        const promiseDate =
                          getPromiseDate(
                            transaction
                          );

                        const followUp =
                          getFollowUpInfo(
                            transaction
                          );

                        const captureChannel =
                          getCaptureChannel(
                            transaction
                          );

                        const daysDifference =
                          getDaysDifference(
                            promiseDate
                          );

                        const isLoading =
                          actionLoading ===
                          transactionId;

                        return (
                          <tr
                            key={
                              transactionId
                            }
                          >

                            <td>
                              <strong>
                                {transactionId ||
                                  "—"}
                              </strong>
                            </td>

                            <td>
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 6,
                                }}
                              >
                                <User
                                  size={14}
                                  style={{
                                    color:
                                      "#64748b",
                                  }}
                                />

                                {
                                  getCustomerName(
                                    transaction
                                  )
                                }
                              </div>
                            </td>

                            <td>
                              {formatCurrency(
                                getPromiseAmount(
                                  transaction
                                )
                              )}
                            </td>

                            <td>
                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: 4,
                                }}
                              >
                                <strong>
                                  {formatDate(
                                    promiseDate
                                  )}
                                </strong>

                                {daysDifference !==
                                  null &&
                                  status !==
                                    "Fulfilled" && (
                                    <span
                                      style={{
                                        fontSize:
                                          11,
                                        opacity:
                                          0.65,
                                      }}
                                    >
                                      {daysDifference <
                                      0
                                        ? `${Math.abs(
                                            daysDifference
                                          )} ${
                                            Math.abs(
                                              daysDifference
                                            ) ===
                                            1
                                              ? "day"
                                              : "days"
                                          } overdue`
                                        : daysDifference ===
                                          0
                                        ? "Due today"
                                        : `Due in ${daysDifference} ${
                                            daysDifference ===
                                            1
                                              ? "day"
                                              : "days"
                                          }`}
                                    </span>
                                  )}
                              </div>
                            </td>

                            <td>
                              <span
                                className={`feature-badge ${statusClass(
                                  status
                                )}`}
                              >
                                {status ===
                                  "Fulfilled" && (
                                  <CheckCircle2
                                    size={13}
                                  />
                                )}

                                {status ===
                                  "Overdue Promise" && (
                                  <AlertCircle
                                    size={13}
                                  />
                                )}

                                {status ===
                                  "Active Promise" && (
                                  <Clock3
                                    size={13}
                                  />
                                )}

                                {status}
                              </span>
                            </td>

                            <td>
                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: 4,
                                }}
                              >
                                <span
                                  className={`feature-badge ${followUp.type}`}
                                >
                                  {followUp.required ? (
                                    <Bell
                                      size={13}
                                    />
                                  ) : (
                                    <CheckCircle2
                                      size={13}
                                    />
                                  )}

                                  {
                                    followUp.label
                                  }
                                </span>

                                <span
                                  style={{
                                    fontSize:
                                      11,
                                    opacity:
                                      0.65,
                                  }}
                                >
                                  {
                                    followUp.detail
                                  }
                                </span>
                              </div>
                            </td>

                            <td>
                              <span className="feature-badge info">

                                {captureChannel.type ===
                                  "voice" && (
                                  <Phone
                                    size={13}
                                  />
                                )}

                                {captureChannel.type ===
                                  "whatsapp" && (
                                  <MessageCircle
                                    size={13}
                                  />
                                )}

                                {captureChannel.type ===
                                  "manual" && (
                                  <User
                                    size={13}
                                  />
                                )}

                                {captureChannel.type !==
                                  "voice" &&
                                  captureChannel.type !==
                                    "whatsapp" &&
                                  captureChannel.type !==
                                    "manual" && (
                                    <CalendarCheck
                                      size={13}
                                    />
                                  )}

                                {
                                  captureChannel.label
                                }
                              </span>
                            </td>

                            {/* ACTION */}

                            <td>

                              {status ===
                              "Fulfilled" ? (
                                <span
                                  className="feature-badge success"
                                >
                                  <CheckCircle2
                                    size={13}
                                  />

                                  Payment Complete
                                </span>
                              ) : status ===
                                "Overdue Promise" ? (
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap: 7,
                                    flexWrap:
                                      "wrap",
                                  }}
                                >

                                  {/* URGENT CHASER */}

                                  <button
                                    type="button"
                                    className="feature-action-button"
                                    disabled={
                                      isLoading ||
                                      chaserLoading
                                    }
                                    onClick={() =>
                                      generatePromiseReminder(
                                        transaction
                                      )
                                    }
                                  >
                                    {isLoading ||
                                    chaserLoading ? (
                                      <>
                                        <LoaderCircle
                                          size={
                                            15
                                          }
                                          className="spin"
                                        />

                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Bell
                                          size={
                                            15
                                          }
                                        />

                                        Urgent Chaser
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    className="feature-refresh-button"
                                    disabled={
                                      isLoading
                                    }
                                    onClick={() =>
                                      openUpdateModal(
                                        transaction
                                      )
                                    }
                                  >
                                    <CalendarPlus
                                      size={
                                        15
                                      }
                                    />

                                    Update
                                  </button>

                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="feature-action-button"
                                  onClick={() =>
                                    openUpdateModal(
                                      transaction
                                    )
                                  }
                                >
                                  <CalendarPlus
                                    size={15}
                                  />

                                  Update Commitment
                                </button>
                              )}

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </div>
        </>
      )}

      {/* =========================================================
          UPDATE COMMITMENT MODAL
      ========================================================= */}

      {editingPromise && (
        <div
          className="promise-modal-overlay"
          onClick={
            closeUpdateModal
          }
        >

          <div
            className="promise-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="promise-modal-header">

              <div>

                <div className="feature-title-row">

                  <CalendarCheck
                    size={22}
                  />

                  <h3>
                    Update Commitment
                  </h3>

                </div>

                <p>
                  Update the customer's
                  Promise-to-Pay date.
                </p>

              </div>

              <button
                type="button"
                className="promise-modal-close"
                onClick={
                  closeUpdateModal
                }
                disabled={
                  updatingPromise
                }
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

            </div>

            <div className="promise-modal-transaction">
              <span>
                Transaction
              </span>

              <strong>
                {getTransactionId(
                  editingPromise
                )}
              </strong>
            </div>

            <div className="promise-modal-transaction">
              <span>
                Customer
              </span>

              <strong>
                {getCustomerName(
                  editingPromise
                )}
              </strong>
            </div>

            <div className="promise-modal-transaction">
              <span>
                Current Status
              </span>

              <strong>
                {getComputedStatus(
                  editingPromise
                )}
              </strong>
            </div>

            <div className="promise-modal-transaction">
              <span>
                Captured Via
              </span>

              <strong>
                {
                  getCaptureChannel(
                    editingPromise
                  ).label
                }
              </strong>
            </div>

            <div className="promise-form-group">

              <label>
                New Promise Date
              </label>

              <input
                type="date"
                value={
                  newPromiseDate
                }
                min={getToday()}
                onChange={(event) =>
                  setNewPromiseDate(
                    event.target.value
                  )
                }
                disabled={
                  updatingPromise
                }
              />

            </div>

            <div className="promise-form-group">

              <label>
                Update Note
              </label>

              <textarea
                value={
                  promiseNote
                }
                onChange={(event) =>
                  setPromiseNote(
                    event.target.value
                  )
                }
                placeholder="Reason for changing the commitment..."
                rows={4}
                disabled={
                  updatingPromise
                }
              />

            </div>

            <div className="promise-modal-footer">

              <button
                type="button"
                className="feature-refresh-button"
                onClick={
                  closeUpdateModal
                }
                disabled={
                  updatingPromise
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="feature-action-button"
                onClick={
                  updateCommitment
                }
                disabled={
                  updatingPromise ||
                  !newPromiseDate
                }
              >

                {updatingPromise ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="spin"
                    />

                    Updating...
                  </>
                ) : (
                  <>
                    <Save size={16} />

                    Update Commitment
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          URGENT CHASER PREVIEW MODAL
      ========================================================= */}

      {chaserModal && (
        <div
          className="promise-modal-overlay chaser-modal-overlay"
          onClick={closeChaserModal}
        >

          <div
            className="promise-modal chaser-preview-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="promise-modal-header">

              <div>

                <div className="feature-title-row">

                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#eff6ff",
                      color: "#2563eb",
                    }}
                  >
                    <Mail size={20} />
                  </div>

                  <div>

                    <h3>
                      Review AI-Generated Reminder
                    </h3>

                    <p>
                      Review the urgent payment chaser before sending.
                    </p>

                  </div>

                </div>

              </div>

              <button
                type="button"
                className="promise-modal-close"
                onClick={
                  closeChaserModal
                }
                disabled={
                  actionLoading !== null
                }
                aria-label="Close reminder preview"
              >
                <X size={20} />
              </button>

            </div>

            {/* TRANSACTION INFORMATION */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >

              <div className="promise-modal-transaction">

                <span>
                  Transaction
                </span>

                <strong>
                  {chaserModal.transactionId}
                </strong>

              </div>

              <div className="promise-modal-transaction">

                <span>
                  Customer
                </span>

                <strong>
                  {chaserModal.customerName}
                </strong>

              </div>

            </div>

            {/* SUBJECT */}

            <div className="promise-form-group">

              <label>
                Subject
              </label>

              <input
                type="text"
                value={
                  chaserModal.subject || ""
                }
                readOnly
              />

            </div>

            {/* MESSAGE */}

            <div className="promise-form-group">

              <label>
                Message
              </label>

              <textarea
                value={
                  chaserModal.message ||
                  "No message content was returned by the backend."
                }
                readOnly
                rows={9}
                style={{
                  resize: "vertical",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              />

            </div>

            {/* CHANNEL / PRIORITY */}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >

              <span className="feature-badge info">

                <Mail size={13} />

                Send via:{" "}
                {chaserModal.channel}

              </span>

              <span className="feature-badge danger">

                <AlertCircle size={13} />

                Priority:{" "}
                {chaserModal.priority}

              </span>

            </div>

            {/* FOOTER */}

            <div className="promise-modal-footer">

              <button
                type="button"
                className="feature-refresh-button"
                onClick={
                  closeChaserModal
                }
                disabled={
                  actionLoading !== null
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="feature-action-button"
                onClick={
                  sendGeneratedChaser
                }
                disabled={
                  actionLoading !== null ||
                  !chaserModal.message
                }
              >

                {actionLoading !== null ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="spin"
                    />

                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />

                    Send Message
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default PromiseToPayTracker;