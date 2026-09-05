import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  RefreshCw,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Download,
  X,
  Mail,
  MessageCircle,
  Phone,
  Clock3,
  CalendarCheck,
  ShieldAlert,
  User,
  History,
  PauseCircle,
} from "lucide-react";

import { useToast } from "../context/ToastContext";
import { exportToCSV } from "../utils/csvExport";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function B2BReceivables() {
  const toast = useToast();

  // =========================================================
  // STATE
  // =========================================================

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sending, setSending] = useState(null);

  const [agingFilter, setAgingFilter] = useState("all");

  const [chaserModal, setChaserModal] = useState(null);
  const [chaserLoading, setChaserLoading] = useState(false);
  const [chaserSending, setChaserSending] = useState(false);

  const [editedSubject, setEditedSubject] = useState("");
  const [editedMessage, setEditedMessage] = useState("");

  const [selectedChannel, setSelectedChannel] = useState("email");

  // Audit modal
  const [auditModal, setAuditModal] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // =========================================================
  // BASIC HELPERS
  // =========================================================

  const getTransactionId = (item) => {
    return (
      item?.transaction_id ||
      item?.transactionId ||
      item?.id ||
      item?.txn_id ||
      null
    );
  };

  const getCustomerName = (item) => {
    return (
      item?.customer ||
      item?.customer_name ||
      item?.customerName ||
      item?.client_name ||
      item?.company_name ||
      "Customer"
    );
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString("en-IN", {
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

  const parseDateOnly = (value) => {
    if (!value) return null;

    const stringValue = String(value).slice(0, 10);

    const parts = stringValue.split("-");

    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);

      if (year && month && day) {
        return new Date(year, month - 1, day);
      }
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    );
  };

  // =========================================================
  // NORMALIZATION
  // =========================================================

  const normalizeValue = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase();
  };

  const normalizeRecovery = (value) => {
    return normalizeValue(value);
  };

  const normalizeStatus = (value) => {
    return normalizeValue(value);
  };

  // =========================================================
  // PAYMENT / RECOVERY
  // =========================================================

  const isRecovered = (item) => {
    const recoveryValues = [
      item?.recovery_status,
      item?.recovery,
      item?.recovery_outcome,
      item?.recoveryStatus,
    ]
      .filter(Boolean)
      .map(normalizeRecovery);

    return recoveryValues.some(
      (value) =>
        value === "recovered" ||
        value === "paid" ||
        value === "resolved" ||
        value === "successful" ||
        value === "success"
    );
  };

  const isPaid = (item) => {
    const statusValues = [
      item?.status,
      item?.payment_status,
      item?.transaction_status,
      item?.paymentStatus,
    ]
      .filter(Boolean)
      .map(normalizeStatus);

    return (
      isRecovered(item) ||
      statusValues.some(
        (status) =>
          status === "paid" ||
          status === "successful" ||
          status === "success" ||
          status === "completed" ||
          status === "resolved"
      )
    );
  };

  // =========================================================
  // PROMISE-TO-PAY
  // =========================================================

  const isPromiseToPay = (item) => {
    const values = [
      item?.recovery_status,
      item?.recovery,
      item?.recovery_outcome,
      item?.promise_status,
      item?.promiseStatus,
      item?.payment_status,
      item?.status,
      item?.transaction_status,
      item?.collection_status,
    ]
      .filter(Boolean)
      .map(normalizeValue);

    return values.some(
      (value) =>
        value.includes("promise to pay") ||
        value.includes("promise-to-pay") ||
        value.includes("promised") ||
        value === "ptp" ||
        value.includes("commitment")
    );
  };

  const getPromiseDate = (item) => {
    return (
      item?.promise_date ||
      item?.promised_date ||
      item?.promise_to_pay_date ||
      item?.promiseToPayDate ||
      item?.ptp_date ||
      item?.ptpDate ||
      item?.commitment_date ||
      item?.commitmentDate ||
      item?.promised_due_date ||
      item?.promisedDueDate ||
      item?.promise?.date ||
      item?.promise?.promise_date ||
      item?.promise?.commitment_date ||
      null
    );
  };

  const getPromiseDisplay = (item) => {
    const promiseDate = getPromiseDate(item);

    if (promiseDate) {
      const date = parseDateOnly(promiseDate);

      if (date) {
        const today = parseDateOnly(getToday());

        if (today) {
          const difference =
            (date.getTime() - today.getTime()) /
            (24 * 60 * 60 * 1000);

          if (difference < 0) {
            const overdueDays = Math.abs(Math.round(difference));

            return {
              primary: formatDate(promiseDate),
              secondary:
                overdueDays === 1
                  ? "Overdue by 1 day"
                  : `Overdue by ${overdueDays} days`,
              type: "danger",
            };
          }

          if (difference === 0) {
            return {
              primary: formatDate(promiseDate),
              secondary: "Due today",
              type: "warning",
            };
          }

          return {
            primary: formatDate(promiseDate),
            secondary:
              difference === 1
                ? "Due in 1 day"
                : `Due in ${Math.round(difference)} days`,
            type: "info",
          };
        }
      }

      return {
        primary: formatDate(promiseDate),
        secondary: "Promise-to-Pay commitment",
        type: "info",
      };
    }

    if (isPromiseToPay(item)) {
      return {
        primary: "Commitment recorded",
        secondary: "Promise date pending",
        type: "warning",
      };
    }

    return {
      primary: "No commitment",
      secondary: "",
      type: "muted",
    };
  };

  // =========================================================
  // AGING
  // =========================================================

  const getDaysOverdue = (item) => {
    const directValues = [
      item?.days_overdue,
      item?.overdue_days,
      item?.aging_days,
      item?.daysPastDue,
      item?.days_past_due,
      item?.daysPastDue,
      item?.overdueDays,
    ];

    for (const directValue of directValues) {
      if (
        directValue !== undefined &&
        directValue !== null &&
        directValue !== ""
      ) {
        const numeric = Number(directValue);

        if (Number.isFinite(numeric)) {
          return Math.max(0, Math.round(numeric));
        }
      }
    }

    // Support backend aging bucket if days are not directly supplied.
    const backendBucket = normalizeValue(
      item?.aging_bucket ||
        item?.agingBucket ||
        item?.aging ||
        ""
    );

    if (backendBucket.includes("90")) {
      return 90;
    }

    if (
      backendBucket.includes("61") ||
      backendBucket.includes("60-89")
    ) {
      return 61;
    }

    if (
      backendBucket.includes("31") ||
      backendBucket.includes("31-60")
    ) {
      return 31;
    }

    if (
      backendBucket.includes("1-30") ||
      backendBucket.includes("overdue")
    ) {
      return 1;
    }

    const dueDate =
      item?.due_date ||
      item?.invoice_due_date ||
      item?.payment_due_date ||
      item?.dueDate ||
      item?.invoiceDueDate ||
      null;

    if (!dueDate) {
      return 0;
    }

    const due = parseDateOnly(dueDate);
    const today = parseDateOnly(getToday());

    if (!due || !today) {
      return 0;
    }

    const difference =
      (today.getTime() - due.getTime()) /
      (24 * 60 * 60 * 1000);

    return Math.max(0, Math.round(difference));
  };

  const getAgingBucket = (item) => {
    const days = getDaysOverdue(item);

    if (days <= 0) {
      return "current";
    }

    if (days >= 1 && days <= 30) {
      return "1-30";
    }

    if (days >= 31 && days <= 60) {
      return "31-60";
    }

    if (days >= 61 && days <= 90) {
      return "61-90";
    }

    return "90+";
  };

  const getAgingLabel = (item) => {
    const bucket = getAgingBucket(item);

    if (bucket === "current") {
      return "Current";
    }

    if (bucket === "1-30") {
      return "1–30 Days Overdue";
    }

    if (bucket === "31-60") {
      return "31–60 Days Overdue";
    }

    if (bucket === "61-90") {
      return "61–90 Days Overdue";
    }

    return "90+ Days • High Risk";
  };

  // =========================================================
  // STATUS DISPLAY
  // =========================================================

  const getDisplayStatus = (item) => {
    if (isPaid(item)) {
      return "Paid";
    }

    if (isPromiseToPay(item)) {
      return "Promise to Pay";
    }

    const days = getDaysOverdue(item);

    if (days > 0) {
      return `Overdue (${days} Days)`;
    }

    return (
      item?.status ||
      item?.payment_status ||
      item?.transaction_status ||
      "Pending"
    );
  };

  // =========================================================
  // ESCALATION
  // =========================================================

  const getEscalationLevel = (item) => {
    const days = getDaysOverdue(item);

    // Promise-to-Pay pauses automatic escalation.
    if (isPromiseToPay(item)) {
      return {
        level:
          days >= 90
            ? 3
            : days >= 31
            ? 2
            : 1,
        label:
          days >= 90
            ? "Level 3: Executive Account Manager Intervention"
            : days >= 31
            ? "Level 2: Urgent WhatsApp + Voice Chaser"
            : "Level 1: Gentle Email Reminder",
        short:
          days >= 90
            ? "Level 3"
            : days >= 31
            ? "Level 2"
            : "Level 1",
        type:
          days >= 90
            ? "danger"
            : days >= 31
            ? "warning"
            : "info",
      };
    }

    const explicitLevel =
      item?.escalation_level ??
      item?.escalationLevel ??
      item?.escalation_stage ??
      item?.escalationStage ??
      item?.chaser_stage ??
      item?.chaserStage ??
      item?.stage;

    if (
      explicitLevel !== undefined &&
      explicitLevel !== null &&
      explicitLevel !== ""
    ) {
      const level = Number(explicitLevel);

      if (level >= 3) {
        return {
          level: 3,
          label:
            "Level 3: Executive Account Manager Intervention",
          short: "Level 3",
          type: "danger",
        };
      }

      if (level === 2) {
        return {
          level: 2,
          label:
            "Level 2: Urgent WhatsApp + Voice Chaser",
          short: "Level 2",
          type: "warning",
        };
      }

      return {
        level: 1,
        label:
          "Level 1: Gentle Email Reminder",
        short: "Level 1",
        type: "info",
      };
    }

    if (days >= 90) {
      return {
        level: 3,
        label:
          "Level 3: Executive Account Manager Intervention",
        short: "Level 3",
        type: "danger",
      };
    }

    if (days >= 31) {
      return {
        level: 2,
        label:
          "Level 2: Urgent WhatsApp + Voice Chaser",
        short: "Level 2",
        type: "warning",
      };
    }

    return {
      level: 1,
      label:
        "Level 1: Gentle Email Reminder",
      short: "Level 1",
      type: "info",
    };
  };

  // =========================================================
  // BOUNDED RECOVERY
  // =========================================================

  const getContactAttempts = (item) => {
    const value =
      item?.contact_attempts ??
      item?.contactAttempts ??
      item?.chaser_attempts ??
      item?.chaserAttempts ??
      item?.retry_count ??
      item?.retryCount ??
      item?.attempts ??
      0;

    const numeric = Number(value);

    return Number.isFinite(numeric)
      ? Math.max(0, Math.round(numeric))
      : 0;
  };

  const getContactCap = (item) => {
    const value =
      item?.contact_cap ??
      item?.contactCap ??
      item?.max_contact_attempts ??
      item?.maxContactAttempts ??
      3;

    const numeric = Number(value);

    return Number.isFinite(numeric)
      ? Math.max(1, Math.round(numeric))
      : 3;
  };

  const getBoundedRule = (item) => {
    const attempts = getContactAttempts(item);
    const cap = getContactCap(item);

    if (isPromiseToPay(item)) {
      return {
        text: "Auto-Paused • Promise Made",
        icon: PauseCircle,
        type: "info",
      };
    }

    if (attempts >= cap) {
      return {
        text: `Contact Cap Reached • ${attempts}/${cap}`,
        icon: ShieldAlert,
        type: "danger",
      };
    }

    return {
      text: `Contact Cap: ${attempts}/${cap}`,
      icon: Clock3,
      type: attempts >= cap - 1 ? "warning" : "info",
    };
  };

  // =========================================================
  // LOAD DASHBOARD
  // =========================================================

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/receivables/dashboard`
      );

      if (!response.ok) {
        let message =
          "Unable to load B2B receivables.";

        try {
          const data = await response.json();

          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Ignore JSON parsing error.
        }

        throw new Error(message);
      }

      const data = await response.json();

      setDashboard(data);
    } catch (err) {
      console.error(
        "B2B dashboard loading error:",
        err
      );

      const message =
        err.message ||
        "Could not load B2B receivables. Make sure the backend is running.";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // =========================================================
  // NORMALIZE RECEIVABLES
  // =========================================================

  const allReceivables = useMemo(() => {
    const source = Array.isArray(
      dashboard?.receivables
    )
      ? dashboard.receivables
      : [];

    return source
      .filter(Boolean)
      .map((item) => {
        const paid = isPaid(item);

        return {
          ...item,

          transaction_id:
            getTransactionId(item),

          customer:
            getCustomerName(item),

          amount:
            Number(item?.amount || 0),

          outstanding_amount:
            Number(
              item?.outstanding_amount ??
                item?.amount ??
                0
            ),

          status:
            paid
              ? "Paid"
              : getDisplayStatus(item),

          recovery_status:
            paid
              ? "Recovered"
              : item?.recovery_status ||
                item?.recovery ||
                "Not Started",

          promise_date:
            getPromiseDate(item),

          aging_days:
            getDaysOverdue(item),

          aging_bucket:
            getAgingBucket(item),

          aging_label:
            getAgingLabel(item),

          escalation:
            getEscalationLevel(item),
        };
      })
      .filter((item) => !isPaid(item));
  }, [dashboard]);

  // =========================================================
  // FILTER
  // =========================================================

  const filteredReceivables = useMemo(() => {
    if (agingFilter === "all") {
      return allReceivables;
    }

    return allReceivables.filter(
      (item) =>
        item.aging_bucket ===
        agingFilter
    );
  }, [
    allReceivables,
    agingFilter,
  ]);

  // =========================================================
  // KPI CALCULATIONS
  // =========================================================

  const totalOutstanding = useMemo(() => {
    return allReceivables.reduce(
      (total, item) =>
        total + Number(item.amount || 0),
      0
    );
  }, [allReceivables]);

  const activePromises = useMemo(() => {
    return allReceivables.filter(
      (item) =>
        isPromiseToPay(item) ||
        Boolean(getPromiseDate(item))
    ).length;
  }, [allReceivables]);

  const overduePromises = useMemo(() => {
    const today = parseDateOnly(
      getToday()
    );

    if (!today) {
      return 0;
    }

    return allReceivables.filter(
      (item) => {
        const promiseDate =
          getPromiseDate(item);

        if (!promiseDate) {
          return false;
        }

        const date =
          parseDateOnly(promiseDate);

        if (!date) {
          return false;
        }

        return date < today && !isPaid(item);
      }
    ).length;
  }, [allReceivables]);

  // =========================================================
  // AGING COUNTS
  // =========================================================

  const agingCounts = useMemo(() => {
    return {
      current:
        allReceivables.filter(
          (item) =>
            item.aging_bucket ===
            "current"
        ).length,

      "1-30":
        allReceivables.filter(
          (item) =>
            item.aging_bucket ===
            "1-30"
        ).length,

      "31-60":
        allReceivables.filter(
          (item) =>
            item.aging_bucket ===
            "31-60"
        ).length,

      "61-90":
        allReceivables.filter(
          (item) =>
            item.aging_bucket ===
            "61-90"
        ).length,

      "90+":
        allReceivables.filter(
          (item) =>
            item.aging_bucket ===
            "90+"
        ).length,
    };
  }, [allReceivables]);

  // =========================================================
  // CHASER GENERATION
  // =========================================================

  const generateChaser = async (
    item,
    requestedChannel = null
  ) => {
    const transactionId =
      getTransactionId(item);

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    const bounded =
      getBoundedRule(item);

    if (
      bounded.text.includes(
        "Contact Cap Reached"
      )
    ) {
      toast.error(
        "Contact cap reached. Automatic recovery action is paused."
      );
      return;
    }

    setSending(transactionId);
    setChaserLoading(true);

    try {
      const escalation =
        getEscalationLevel(item);

      const channel =
        requestedChannel ||
        (escalation.level >= 2
          ? "whatsapp"
          : "email");

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

            stage:
              escalation.level,

            channel,

            priority:
              escalation.level >= 3
                ? "urgent"
                : escalation.level === 2
                ? "high"
                : "normal",

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

      const backendChannel =
        String(
          data?.channel ||
            channel ||
            "email"
        ).toLowerCase();

      const validChannel =
        [
          "email",
          "whatsapp",
          "voice",
        ].includes(
          backendChannel
        )
          ? backendChannel
          : channel;

      setChaserModal({
        transaction: item,

        transactionId,

        customerName:
          getCustomerName(item),

        subject,

        message,

        channel:
          validChannel,

        priority:
          data?.priority ||
          "normal",

        escalation:
          data?.stage ||
          escalation.level,

        rawResponse: data,
      });

      setEditedSubject(subject);
      setEditedMessage(message);
      setSelectedChannel(
        validChannel
      );
    } catch (err) {
      console.error(
        "Generate B2B chaser error:",
        err
      );

      toast.error(
        err.message ||
          "Unable to generate payment reminder."
      );
    } finally {
      setSending(null);
      setChaserLoading(false);
    }
  };

  // =========================================================
  // CLOSE CHASER
  // =========================================================

  const closeChaserModal = () => {
    if (chaserSending) {
      return;
    }

    setChaserModal(null);
    setEditedSubject("");
    setEditedMessage("");
    setSelectedChannel("email");
  };

  // =========================================================
  // SEND CHASER
  // =========================================================

  const sendChaser = async () => {
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

    if (!editedMessage.trim()) {
      toast.error(
        "Message cannot be empty."
      );
      return;
    }

    setChaserSending(true);

    try {
      const escalation =
        getEscalationLevel(
          chaserModal.transaction
        );

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

            stage:
              escalation.level,

            channel:
              selectedChannel,

            priority:
              escalation.level >= 3
                ? "urgent"
                : escalation.level === 2
                ? "high"
                : "normal",

            subject:
              editedSubject.trim(),

            message:
              editedMessage.trim(),

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
            data?.message ||
            "Unable to send reminder."
        );
      }

      closeChaserModal();

      toast.success(
        `${getChannelLabel(
          selectedChannel
        )} chaser dispatched successfully.`
      );

      await loadDashboard();
    } catch (err) {
      console.error(
        "Send B2B chaser error:",
        err
      );

      toast.error(
        err.message ||
          "Unable to send payment reminder."
      );
    } finally {
      setChaserSending(false);
    }
  };

  // =========================================================
  // AUDIT HISTORY
  // =========================================================

  const openAuditHistory = async (item) => {
    const transactionId =
      getTransactionId(item);

    if (!transactionId) {
      toast.error(
        "Transaction ID is missing."
      );
      return;
    }

    setAuditLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/transactions/${encodeURIComponent(
          transactionId
        )}/audit`
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
            "Unable to load audit history."
        );
      }

      const logs =
        Array.isArray(data)
          ? data
          : data?.audit_logs ||
            data?.logs ||
            data?.history ||
            data?.data ||
            [];

      setAuditModal({
        transactionId,
        customerName:
          getCustomerName(item),
        logs,
        raw: data,
      });
    } catch (err) {
      console.error(
        "Audit history error:",
        err
      );

      toast.error(
        err.message ||
          "Unable to load audit history."
      );
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditModal = () => {
    setAuditModal(null);
  };

  // =========================================================
  // CHANNEL HELPERS
  // =========================================================

  const renderChannelIcon = (
    channel
  ) => {
    if (channel === "whatsapp") {
      return (
        <MessageCircle size={16} />
      );
    }

    if (channel === "voice") {
      return <Phone size={16} />;
    }

    return <Mail size={16} />;
  };

  const getChannelLabel = (
    channel
  ) => {
    if (channel === "whatsapp") {
      return "WhatsApp Business";
    }

    if (channel === "voice") {
      return "Hinglish Voice Agent";
    }

    return "Email";
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExportCSV = () => {
    if (
      filteredReceivables.length === 0
    ) {
      toast.info(
        "No B2B receivables to export."
      );
      return;
    }

    const columns = [
      {
        key: "transaction_id",
        label: "Transaction ID",
      },

      {
        key: "customer",
        label: "Customer Name",
      },

      {
        key: "amount",
        label: "Amount (₹)",

        formatter: (value) =>
          Number(
            value || 0
          ).toFixed(2),
      },

      {
        key: "status",
        label: "Account Status",
      },

      {
        key: "recovery_status",
        label: "Recovery Status",
      },

      {
        key: "promise_date",
        label: "Promise-to-Pay Date",

        formatter: (value) =>
          formatDate(value),
      },

      {
        key: "aging_label",
        label: "Aging Bucket",
      },

      {
        key: "aging_days",
        label: "Days Overdue",
      },

      {
        key: "escalation",
        label: "Escalation Level",

        formatter: (value) =>
          value?.short ||
          "Level 1",
      },
    ];

    const dateStr = getToday();

    exportToCSV(
      filteredReceivables,
      `b2b_receivables_${dateStr}.csv`,
      columns
    );

    toast.success(
      "B2B receivables exported successfully."
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
                style={{
                  height: 110,
                }}
              >
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--value" />
                <div className="skeleton-line skeleton-line--sub" />
              </div>
            )
          )}
        </div>

        <div className="feature-table-card">
          <div className="skeleton-table">
            {[1, 2, 3, 4, 5].map(
              (item) => (
                <div
                  key={item}
                  className="skeleton-table-row"
                >
                  {[1, 2, 3, 4, 5, 6].map(
                    (cell) => (
                      <div
                        key={cell}
                        className="skeleton-shimmer skeleton-cell"
                        style={{
                          width: "15%",
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
            <Building2 size={28} />

            <h2>
              B2B Receivables
            </h2>
          </div>

          <p>
            Monitor outstanding B2B invoices,
            Promise-to-Pay commitments,
            aging risk, and graduated recovery actions.
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
              filteredReceivables.length === 0
            }
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="feature-refresh-button"
            onClick={loadDashboard}
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
            onClick={loadDashboard}
          >
            Try Again
          </button>
        </div>
      )}

      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading && renderSkeleton()}

      {/* =====================================================
          CONTENT
      ===================================================== */}

      {!loading && dashboard && (
        <>
          {/* =================================================
              KPI CARDS
          ================================================= */}

          <div className="feature-stat-grid">

            <div className="feature-stat-card">
              <span>
                UNPAID ACCOUNTS
              </span>

              <strong>
                {allReceivables.length}
              </strong>

              <small>
                Outstanding B2B accounts
              </small>
            </div>

            <div className="feature-stat-card">
              <span>
                TOTAL OUTSTANDING
              </span>

              <strong>
                {formatCurrency(
                  totalOutstanding
                )}
              </strong>

              <small>
                Excludes recovered / paid accounts
              </small>
            </div>

            <div className="feature-stat-card">
              <span>
                ACTIVE PROMISES
              </span>

              <strong>
                {activePromises}
              </strong>

              <small>
                Promise-to-Pay commitments
              </small>
            </div>

            <div className="feature-stat-card">
              <span>
                OVERDUE PROMISES
              </span>

              <strong>
                {overduePromises}
              </strong>

              <small>
                Require follow-up
              </small>
            </div>
          </div>

          {/* =================================================
              AGING FILTERS
          ================================================= */}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >

            {/* ALL */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("all")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "all"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "all"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "all"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <CalendarCheck size={15} />

              All

              <span>
                {allReceivables.length}
              </span>
            </button>

            {/* CURRENT */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("current")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "current"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "current"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "current"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Current

              <span>
                {agingCounts.current}
              </span>
            </button>

            {/* 1-30 */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("1-30")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "1-30"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "1-30"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "1-30"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              1–30 Days Overdue

              <span>
                {agingCounts["1-30"]}
              </span>
            </button>

            {/* 31-60 */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("31-60")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "31-60"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "31-60"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "31-60"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              31–60 Days Overdue

              <span>
                {agingCounts["31-60"]}
              </span>
            </button>

            {/* 61-90 */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("61-90")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "61-90"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "61-90"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "61-90"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              61–90 Days Overdue

              <span>
                {agingCounts["61-90"]}
              </span>
            </button>

            {/* 90+ */}

            <button
              type="button"
              onClick={() =>
                setAgingFilter("90+")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 14px",
                borderRadius: 10,
                border:
                  agingFilter === "90+"
                    ? "1px solid #111827"
                    : "1px solid #e2e8f0",
                background:
                  agingFilter === "90+"
                    ? "#111827"
                    : "#ffffff",
                color:
                  agingFilter === "90+"
                    ? "#ffffff"
                    : "#111827",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <ShieldAlert size={15} />

              90+ Days • High Risk

              <span>
                {agingCounts["90+"]}
              </span>
            </button>
          </div>

          {/* =================================================
              TABLE
          ================================================= */}

          <div className="feature-table-card">

            <div className="feature-section-heading">

              <div>
                <h3>
                  Outstanding B2B Receivables
                </h3>

                <p>
                  Recovered and paid accounts are
                  automatically excluded from this
                  outstanding receivables view.
                </p>
              </div>

              <div className="feature-count">
                {filteredReceivables.length}{" "}
                account
                {filteredReceivables.length ===
                1
                  ? ""
                  : "s"}
              </div>
            </div>

            {filteredReceivables.length ===
            0 ? (
              <div className="feature-empty">

                <CheckCircle2 size={34} />

                <h3>
                  No outstanding receivables
                </h3>

                <p>
                  There are no accounts matching
                  the selected aging bucket.
                </p>

              </div>
            ) : (
              <div className="responsive-table">

                <table className="feature-table">

                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Promise-to-Pay</th>
                      <th>Aging</th>
                      <th>Escalation</th>
                      <th>Recovery</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredReceivables.map(
                      (item) => {

                        const transactionId =
                          getTransactionId(
                            item
                          );

                        const escalation =
                          getEscalationLevel(
                            item
                          );

                        const days =
                          getDaysOverdue(
                            item
                          );

                        const promiseDisplay =
                          getPromiseDisplay(
                            item
                          );

                        const boundedRule =
                          getBoundedRule(
                            item
                          );

                        const BoundedIcon =
                          boundedRule.icon;

                        const isSending =
                          sending ===
                          transactionId;

                        return (
                          <tr
                            key={
                              transactionId
                            }
                          >

                            {/* TRANSACTION */}

                            <td>
                              <strong>
                                {
                                  transactionId ||
                                  "—"
                                }
                              </strong>
                            </td>

                            {/* CUSTOMER */}

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
                                    item
                                  )
                                }
                              </div>

                            </td>

                            {/* AMOUNT */}

                            <td>
                              {formatCurrency(
                                item.outstanding_amount ?? item.amount
                              )}
                            </td>

                            {/* STATUS */}

                            <td>

                              <span
                                className={`feature-badge ${
                                  days > 0
                                    ? "danger"
                                    : isPromiseToPay(
                                        item
                                      )
                                    ? "info"
                                    : "warning"
                                }`}
                              >

                                {days > 0 ? (
                                  <AlertCircle
                                    size={13}
                                  />
                                ) : (
                                  <Clock3
                                    size={13}
                                  />
                                )}

                                {
                                  getDisplayStatus(
                                    item
                                  )
                                }

                              </span>

                            </td>

                            {/* PROMISE TO PAY */}

                            <td>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: 3,
                                  minWidth: 145,
                                }}
                              >

                                <strong
                                  style={{
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {
                                    promiseDisplay.primary
                                  }
                                </strong>

                                {promiseDisplay.secondary && (
                                  <span
                                    style={{
                                      fontSize:
                                        11,
                                      color:
                                        promiseDisplay.type ===
                                        "danger"
                                          ? "#dc2626"
                                          : promiseDisplay.type ===
                                            "warning"
                                          ? "#b45309"
                                          : "#64748b",
                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    {
                                      promiseDisplay.secondary
                                    }
                                  </span>
                                )}

                              </div>

                            </td>

                            {/* AGING */}

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
                                  className={`feature-badge ${
                                    days >= 90
                                      ? "danger"
                                      : days > 0
                                      ? "warning"
                                      : "info"
                                  }`}
                                >
                                  {
                                    item.aging_label
                                  }
                                </span>

                                {days > 0 && (
                                  <span
                                    style={{
                                      fontSize:
                                        11,
                                      opacity:
                                        0.7,
                                    }}
                                  >
                                    {days}{" "}
                                    day
                                    {days ===
                                    1
                                      ? ""
                                      : "s"}{" "}
                                    overdue
                                  </span>
                                )}

                              </div>

                            </td>

                            {/* ESCALATION */}

                            <td>

                              <span
                                className={`feature-badge ${escalation.type}`}
                                title={
                                  escalation.label
                                }
                              >
                                <ShieldAlert
                                  size={13}
                                />

                                {
                                  escalation.short
                                }
                              </span>

                              <div
                                style={{
                                  fontSize:
                                    11,
                                  color:
                                    "#475569",
                                  fontWeight:
                                    500,
                                  marginTop:
                                    5,
                                  maxWidth:
                                    190,
                                  lineHeight:
                                    1.35,
                                }}
                              >
                                {
                                  escalation.label
                                }
                              </div>

                            </td>

                            {/* RECOVERY */}

                            <td>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: 6,
                                }}
                              >

                                <span
                                  className="feature-badge warning"
                                >
                                  {
                                    item.recovery_status ||
                                    "Not Started"
                                  }
                                </span>

                                <span
                                  style={{
                                    display:
                                      "inline-flex",
                                    alignItems:
                                      "center",
                                    gap: 4,
                                    fontSize:
                                      10,
                                    color:
                                      boundedRule.type ===
                                      "danger"
                                        ? "#dc2626"
                                        : boundedRule.type ===
                                          "warning"
                                        ? "#b45309"
                                        : "#475569",
                                    fontWeight:
                                      600,
                                  }}
                                  title="Bounded recovery rule"
                                >
                                  <BoundedIcon
                                    size={12}
                                  />

                                  {
                                    boundedRule.text
                                  }
                                </span>

                              </div>

                            </td>

                            {/* ACTION */}

                            <td>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: 7,
                                  minWidth:
                                    205,
                                }}
                              >

                                {/* MAIN BUTTON */}

                                <button
                                  type="button"
                                  className="feature-action-button"
                                  disabled={
                                    isSending ||
                                    chaserLoading ||
                                    boundedRule.text.includes(
                                      "Contact Cap Reached"
                                    )
                                  }
                                  onClick={() =>
                                    generateChaser(
                                      item
                                    )
                                  }
                                >

                                  {isSending ? (
                                    <>
                                      <LoaderCircle
                                        size={15}
                                        className="spin"
                                      />

                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Send
                                        size={15}
                                      />

                                      Generate Reminder
                                    </>
                                  )}

                                </button>

                                {/* CHANNEL SHORTCUTS */}

                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap: 5,
                                  }}
                                >

                                  <button
                                    type="button"
                                    title="Email Chaser"
                                    disabled={
                                      isSending ||
                                      chaserLoading
                                    }
                                    onClick={() =>
                                      generateChaser(
                                        item,
                                        "email"
                                      )
                                    }
                                    style={{
                                      flex: 1,
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                      gap: 4,
                                      padding:
                                        "7px 5px",
                                      border:
                                        "1px solid #dbeafe",
                                      borderRadius:
                                        8,
                                      background:
                                        "#eff6ff",
                                      color:
                                        "#2563eb",
                                      cursor:
                                        "pointer",
                                      fontSize:
                                        11,
                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    <Mail
                                      size={13}
                                    />
                                    Email
                                  </button>

                                  <button
                                    type="button"
                                    title="WhatsApp Business Chaser"
                                    disabled={
                                      isSending ||
                                      chaserLoading
                                    }
                                    onClick={() =>
                                      generateChaser(
                                        item,
                                        "whatsapp"
                                      )
                                    }
                                    style={{
                                      flex: 1,
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                      gap: 4,
                                      padding:
                                        "7px 5px",
                                      border:
                                        "1px solid #bbf7d0",
                                      borderRadius:
                                        8,
                                      background:
                                        "#f0fdf4",
                                      color:
                                        "#16a34a",
                                      cursor:
                                        "pointer",
                                      fontSize:
                                        11,
                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    <MessageCircle
                                      size={13}
                                    />
                                    WhatsApp
                                  </button>

                                  <button
                                    type="button"
                                    title="Hinglish Voice Chaser"
                                    disabled={
                                      isSending ||
                                      chaserLoading
                                    }
                                    onClick={() =>
                                      generateChaser(
                                        item,
                                        "voice"
                                      )
                                    }
                                    style={{
                                      flex: 1,
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                      gap: 4,
                                      padding:
                                        "7px 5px",
                                      border:
                                        "1px solid #ddd6fe",
                                      borderRadius:
                                        8,
                                      background:
                                        "#faf5ff",
                                      color:
                                        "#7c3aed",
                                      cursor:
                                        "pointer",
                                      fontSize:
                                        11,
                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    <Phone
                                      size={13}
                                    />
                                    Voice
                                  </button>

                                </div>

                                {/* AUDIT */}

                                <button
                                  type="button"
                                  disabled={
                                    auditLoading
                                  }
                                  onClick={() =>
                                    openAuditHistory(
                                      item
                                    )
                                  }
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    justifyContent:
                                      "center",
                                    gap: 5,
                                    padding:
                                      "7px 8px",
                                    border:
                                      "1px solid #e2e8f0",
                                    borderRadius:
                                      8,
                                    background:
                                      "#ffffff",
                                    color:
                                      "#475569",
                                    cursor:
                                      "pointer",
                                    fontSize:
                                      11,
                                    fontWeight:
                                      600,
                                  }}
                                >
                                  {auditLoading ? (
                                    <LoaderCircle
                                      size={13}
                                      className="spin"
                                    />
                                  ) : (
                                    <History
                                      size={13}
                                    />
                                  )}

                                  View Audit History
                                </button>

                              </div>

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

          {/* =================================================
              ESCALATION GUIDE
          ================================================= */}

          <div
            className="feature-table-card"
            style={{
              marginTop: 18,
            }}
          >

            <div className="feature-section-heading">

              <div>
                <h3>
                  B2B Collection Escalation
                </h3>

                <p>
                  Graduated recovery workflow based
                  on invoice aging.
                </p>
              </div>

            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >

              {/* LEVEL 1 */}

              <div
                style={{
                  padding: 16,
                  border:
                    "1px solid #dbeafe",
                  borderRadius: 12,
                  background:
                    "#f8fbff",
                }}
              >
                <span className="feature-badge info">
                  Level 1
                </span>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  0–30 Days
                </p>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize: 13,
                  }}
                >
                  Gentle Email Reminder
                </p>

                <span
                  style={{
                    fontSize: 11,
                    color:
                      "#475569",
                  }}
                >
                  Initial payment follow-up
                </span>
              </div>

              {/* LEVEL 2 */}

              <div
                style={{
                  padding: 16,
                  border:
                    "1px solid #fde68a",
                  borderRadius: 12,
                  background:
                    "#fffdf5",
                }}
              >
                <span className="feature-badge warning">
                  Level 2
                </span>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  31–60 Days
                </p>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize: 13,
                  }}
                >
                  WhatsApp + Hinglish Voice
                </p>

                <span
                  style={{
                    fontSize: 11,
                    color:
                      "#475569",
                  }}
                >
                  Escalated overdue account
                </span>
              </div>

              {/* LEVEL 3 */}

              <div
                style={{
                  padding: 16,
                  border:
                    "1px solid #fecaca",
                  borderRadius: 12,
                  background:
                    "#fffafa",
                }}
              >
                <span className="feature-badge danger">
                  Level 3
                </span>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  90+ Days
                </p>

                <p
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize: 13,
                  }}
                >
                  Executive Account Manager
                </p>

                <span
                  style={{
                    fontSize: 11,
                    color:
                      "#475569",
                  }}
                >
                  High-risk strategic account
                </span>
              </div>

            </div>

          </div>
        </>
      )}

      {/* =======================================================
          AI REMINDER MODAL
      ======================================================= */}

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

                <div
                  className="feature-title-row"
                >

                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      background:
                        "#eff6ff",
                      color:
                        "#2563eb",
                    }}
                  >
                    {renderChannelIcon(
                      selectedChannel
                    )}
                  </div>

                  <div>

                    <h3>
                      Review AI-Generated Chaser
                    </h3>

                    <p>
                      Edit the message and choose
                      the dispatch channel before sending.
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
                  chaserSending
                }
                aria-label="Close reminder preview"
              >
                <X size={20} />
              </button>

            </div>

            {/* TRANSACTION DETAILS */}

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
                  {
                    chaserModal.transactionId
                  }
                </strong>
              </div>

              <div className="promise-modal-transaction">
                <span>
                  Customer
                </span>

                <strong>
                  {
                    chaserModal.customerName
                  }
                </strong>
              </div>

            </div>

            {/* ESCALATION */}

            <div
              style={{
                marginBottom: 18,
              }}
            >
              <span
                className={`feature-badge ${
                  getEscalationLevel(
                    chaserModal.transaction
                  ).type
                }`}
              >
                <ShieldAlert
                  size={13}
                />

                {
                  getEscalationLevel(
                    chaserModal.transaction
                  ).label
                }
              </span>
            </div>

            {/* PROMISE STATUS */}

            <div
              style={{
                marginBottom: 18,
                padding: 12,
                border:
                  "1px solid #e2e8f0",
                borderRadius: 10,
                background:
                  "#f8fafc",
              }}
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 7,
                  marginBottom:
                    4,
                }}
              >
                <CalendarCheck
                  size={15}
                />

                <strong
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  Promise-to-Pay
                </strong>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color:
                    "#475569",
                }}
              >
                {
                  getPromiseDisplay(
                    chaserModal.transaction
                  ).primary
                }

                {getPromiseDisplay(
                  chaserModal.transaction
                ).secondary &&
                  ` • ${
                    getPromiseDisplay(
                      chaserModal.transaction
                    ).secondary
                  }`}
              </span>

            </div>

            {/* SUBJECT */}

            <div className="promise-form-group">

              <label>
                Subject
              </label>

              <input
                type="text"
                value={
                  editedSubject
                }
                onChange={(event) =>
                  setEditedSubject(
                    event.target.value
                  )
                }
                disabled={
                  chaserSending
                }
              />

            </div>

            {/* MESSAGE */}

            <div className="promise-form-group">

              <label>
                Message / Voice Script
              </label>

              <textarea
                value={
                  editedMessage
                }
                onChange={(event) =>
                  setEditedMessage(
                    event.target.value
                  )
                }
                rows={10}
                disabled={
                  chaserSending
                }
                style={{
                  resize:
                    "vertical",
                  lineHeight:
                    1.6,
                  whiteSpace:
                    "pre-wrap",
                }}
              />

            </div>

            {/* CHANNEL */}

            <div
              style={{
                marginBottom: 20,
              }}
            >

              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    8,
                  fontWeight:
                    600,
                  fontSize:
                    13,
                }}
              >
                Dispatch Channel
              </label>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >

                {/* EMAIL */}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedChannel(
                      "email"
                    )
                  }
                  disabled={
                    chaserSending
                  }
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 7,
                    padding:
                      "11px 10px",
                    borderRadius:
                      10,
                    border:
                      selectedChannel ===
                      "email"
                        ? "2px solid #2563eb"
                        : "1px solid #e2e8f0",
                    background:
                      selectedChannel ===
                      "email"
                        ? "#eff6ff"
                        : "#ffffff",
                    cursor:
                      "pointer",
                    fontWeight:
                      600,
                    fontSize:
                      12,
                  }}
                >
                  <Mail size={16} />
                  Send via Email
                </button>

                {/* WHATSAPP */}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedChannel(
                      "whatsapp"
                    )
                  }
                  disabled={
                    chaserSending
                  }
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 7,
                    padding:
                      "11px 10px",
                    borderRadius:
                      10,
                    border:
                      selectedChannel ===
                      "whatsapp"
                        ? "2px solid #16a34a"
                        : "1px solid #e2e8f0",
                    background:
                      selectedChannel ===
                      "whatsapp"
                        ? "#f0fdf4"
                        : "#ffffff",
                    cursor:
                      "pointer",
                    fontWeight:
                      600,
                    fontSize:
                      12,
                  }}
                >
                  <MessageCircle
                    size={16}
                  />
                  WhatsApp Business
                </button>

                {/* VOICE */}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedChannel(
                      "voice"
                    )
                  }
                  disabled={
                    chaserSending
                  }
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 7,
                    padding:
                      "11px 10px",
                    borderRadius:
                      10,
                    border:
                      selectedChannel ===
                      "voice"
                        ? "2px solid #7c3aed"
                        : "1px solid #e2e8f0",
                    background:
                      selectedChannel ===
                      "voice"
                        ? "#faf5ff"
                        : "#ffffff",
                    cursor:
                      "pointer",
                    fontWeight:
                      600,
                    fontSize:
                      12,
                  }}
                >
                  <Phone size={16} />
                  Hinglish Voice Agent
                </button>

              </div>
            </div>

            {/* SELECTED CHANNEL */}

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 8,
                marginBottom:
                  18,
              }}
            >

              {renderChannelIcon(
                selectedChannel
              )}

              <span
                style={{
                  fontSize: 13,
                  opacity: 0.75,
                }}
              >
                Selected:
              </span>

              <strong
                style={{
                  fontSize: 13,
                }}
              >
                {
                  getChannelLabel(
                    selectedChannel
                  )
                }
              </strong>

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
                  chaserSending
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="feature-action-button"
                onClick={
                  sendChaser
                }
                disabled={
                  chaserSending ||
                  !editedMessage.trim()
                }
              >

                {chaserSending ? (
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

      {/* =======================================================
          AUDIT HISTORY MODAL
      ======================================================= */}

      {auditModal && (
        <div
          className="promise-modal-overlay"
          onClick={closeAuditModal}
        >

          <div
            className="promise-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              maxWidth: 760,
              width: "95%",
            }}
          >

            <div className="promise-modal-header">

              <div>

                <div
                  className="feature-title-row"
                >

                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      background:
                        "#f1f5f9",
                      color:
                        "#334155",
                    }}
                  >
                    <History
                      size={20}
                    />
                  </div>

                  <div>

                    <h3>
                      Audit History
                    </h3>

                    <p>
                      {auditModal.transactionId} •{" "}
                      {
                        auditModal.customerName
                      }
                    </p>

                  </div>

                </div>

              </div>

              <button
                type="button"
                className="promise-modal-close"
                onClick={
                  closeAuditModal
                }
              >
                <X size={20} />
              </button>

            </div>

            {auditModal.logs.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "30px 10px",
                  textAlign:
                    "center",
                  color:
                    "#64748b",
                }}
              >
                <History
                  size={36}
                  style={{
                    marginBottom:
                      10,
                  }}
                />

                <h3
                  style={{
                    color:
                      "#0f172a",
                  }}
                >
                  No audit events found
                </h3>

                <p
                  style={{
                    fontSize:
                      13,
                  }}
                >
                  No recorded recovery actions
                  are available for this transaction.
                </p>
              </div>
            ) : (
              <div
                style={{
                  maxHeight:
                    "60vh",
                  overflowY:
                    "auto",
                }}
              >

                {auditModal.logs.map(
                  (log, index) => {

                    const event =
                      log?.event ||
                      log?.action ||
                      log?.event_type ||
                      log?.type ||
                      "System Event";

                    const timestamp =
                      log?.timestamp ||
                      log?.created_at ||
                      log?.createdAt ||
                      log?.date;

                    const description =
                      log?.description ||
                      log?.message ||
                      log?.details ||
                      log?.reason ||
                      "";

                    return (
                      <div
                        key={
                          log?.id ||
                          `${event}-${index}`
                        }
                        style={{
                          display:
                            "flex",
                          gap: 12,
                          padding:
                            "14px 0",
                          borderBottom:
                            "1px solid #e2e8f0",
                        }}
                      >

                        <div
                          style={{
                            width: 32,
                            height: 32,
                            minWidth: 32,
                            borderRadius:
                              "50%",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            background:
                              "#f1f5f9",
                          }}
                        >
                          <History
                            size={15}
                          />
                        </div>

                        <div
                          style={{
                            flex: 1,
                          }}
                        >

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 10,
                              flexWrap:
                                "wrap",
                            }}
                          >

                            <strong
                              style={{
                                fontSize:
                                  13,
                              }}
                            >
                              {String(
                                event
                              )
                                .replace(
                                  /_/g,
                                  " "
                                )}
                            </strong>

                            {timestamp && (
                              <span
                                style={{
                                  fontSize:
                                    11,
                                  color:
                                    "#64748b",
                                }}
                              >
                                {
                                  formatDate(
                                    timestamp
                                  )
                                }
                              </span>
                            )}

                          </div>

                          {description && (
                            <p
                              style={{
                                margin:
                                  "5px 0 0",
                                fontSize:
                                  12,
                                color:
                                  "#475569",
                                lineHeight:
                                  1.5,
                              }}
                            >
                              {
                                description
                              }
                            </p>
                          )}

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

            <div className="promise-modal-footer">

              <button
                type="button"
                className="feature-refresh-button"
                onClick={
                  closeAuditModal
                }
              >
                Close
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default B2BReceivables;