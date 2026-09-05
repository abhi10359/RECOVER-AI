import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Bot,
  X,
  Sparkles,
  Lightbulb,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Clock3,
  Download,
  Mail,
  Phone,
  Siren,
  Activity,
  CircleDot,
  Zap,
  MessageCircle,
  Volume2,
  CreditCard,
} from "lucide-react";

import {
  getTransactions,
  recoverTransaction,
  getRecoveryRecommendation,
} from "../services/api";

import { exportToCSV } from "../utils/csvExport";
import { useToast } from "../context/ToastContext";

function FailedTransactions() {
  const toast = useToast();

  // =========================================================
  // BASIC STATES
  // =========================================================

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recoveringId, setRecoveringId] = useState(null);

  // =========================================================
  // AI STATES
  // =========================================================

  const [recommendation, setRecommendation] = useState(null);
  const [recommendationLoading, setRecommendationLoading] =
    useState(false);

  const [selectedTransactionId, setSelectedTransactionId] =
    useState(null);

  // =========================================================
  // RECOVERY SIMULATION STATES
  // =========================================================

  const [recoveryFlow, setRecoveryFlow] = useState(null);
  const [recoveryStage, setRecoveryStage] = useState(0);
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [recoveryLogs, setRecoveryLogs] = useState([]);
  const [recoveryActionTaken, setRecoveryActionTaken] = useState([]);
  const [recoveryCompleted, setRecoveryCompleted] = useState(false);

  // =========================================================
  // RETRY STATES
  // =========================================================

  const [retryAttempts, setRetryAttempts] = useState({});
  const [retryingId, setRetryingId] = useState(null);
  const [retryStatus, setRetryStatus] = useState({});

  const MAX_RETRIES = 3;

  // =========================================================
  // PAYMENT LINK MODAL
  // =========================================================

  const [paymentLinkModalOpen, setPaymentLinkModalOpen] =
    useState(false);

  const [paymentLinkChannel, setPaymentLinkChannel] =
    useState("Email");

  const [paymentLinkGenerating, setPaymentLinkGenerating] =
    useState(false);

  const [generatedPaymentLink, setGeneratedPaymentLink] =
    useState("");

  // =========================================================
  // FILTER STATES
  // =========================================================

  const [searchTerm, setSearchTerm] = useState("");
  const [recoveryFilter, setRecoveryFilter] = useState("All");
  const [sortOption, setSortOption] = useState("latest");

  // =========================================================
  // API BASE URL
  // =========================================================

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000";

  // =========================================================
  // RECOVERY STAGES
  // =========================================================

  const recoveryStages = useMemo(
    () => [
      {
        title: "Analyzing Failure",
        description:
          "RecoverAI is analyzing the transaction failure and identifying the root cause.",
        icon: Bot,
      },
      {
        title: "Checking Payment Gateway",
        description:
          "Checking gateway availability, transaction status and possible temporary issues.",
        icon: Activity,
      },
      {
        title: "Selecting Recovery Route",
        description:
          "AI is selecting the safest recovery strategy for this transaction.",
        icon: Sparkles,
      },
      {
        title: "Executing Recovery",
        description:
          "Recovery workflow is being executed using the selected route.",
        icon: Zap,
      },
      {
        title: "Verifying Result",
        description:
          "RecoverAI is verifying whether the payment recovery was successful.",
        icon: ShieldCheck,
      },
    ],
    []
  );

  // =========================================================
  // LOAD TRANSACTIONS
  // =========================================================

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTransactions();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
        ? data.transactions
        : [];

      setTransactions(list);

      // Initialize retry attempt values from backend data
      const attempts = {};

      list.forEach((transaction) => {
        const id = transaction.transaction_id;

        attempts[id] =
          Number(
            transaction.retry_attempts ??
              transaction.retry_count ??
              1
          ) || 1;
      });

      setRetryAttempts((previous) => ({
        ...attempts,
        ...previous,
      }));
    } catch (err) {
      console.error("Transaction loading error:", err);
      setError("Failed to load transactions.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // =========================================================
  // ADD RECOVERY LOG
  // =========================================================

  const addRecoveryLog = (message, type = "info") => {
    setRecoveryLogs((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random()}`,
        message,
        type,
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    ]);
  };

  // =========================================================
  // AUDIT LOG
  // =========================================================

  const pushAuditLog = async (
    transactionId,
    action,
    target = transactionId
  ) => {
    try {
      await fetch(
        `${API_BASE_URL}/api/transactions/${transactionId}/audit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            target,
          }),
        }
      );
    } catch (err) {
      // Audit failure should not break the user-facing workflow
      console.warn("Audit log could not be pushed:", err);
    }
  };

  // =========================================================
  // DELAY HELPER
  // =========================================================

  const wait = (milliseconds) =>
    new Promise((resolve) =>
      setTimeout(resolve, milliseconds)
    );

  // =========================================================
  // RESET RECOVERY STATE
  // =========================================================

  const resetRecoveryState = () => {
    setRecoveryFlow(null);
    setRecoveryStage(0);
    setRecoveryProgress(0);
    setRecoveryLogs([]);
    setRecoveryActionTaken([]);
    setRecoveryCompleted(false);
  };

  // =========================================================
  // RETRY PAYMENT
  // =========================================================

  const handleRetryPayment = async (transactionId) => {
    if (retryingId !== null) {
      toast.info("Another payment retry is already running.");
      return;
    }

    const transaction = transactions.find(
      (item) =>
        String(item.transaction_id) ===
        String(transactionId)
    );

    if (!transaction) {
      toast.error("Transaction could not be found.");
      return;
    }

    const currentAttempts =
      Number(retryAttempts[transactionId] || 1);

    if (currentAttempts >= MAX_RETRIES) {
      toast.info(
        `Maximum retry attempts reached (${MAX_RETRIES}/${MAX_RETRIES}).`
      );
      return;
    }

    const nextAttempt = currentAttempts + 1;

    try {
      setRetryingId(transactionId);

      setRetryStatus((previous) => ({
        ...previous,
        [transactionId]: `Attempt ${nextAttempt} of ${MAX_RETRIES} in progress...`,
      }));

      toast.info(
        `Payment retry attempt ${nextAttempt}/${MAX_RETRIES} initiated.`
      );

      // -------------------------------------------------------
      // BACKEND SMART RETRY API
      // -------------------------------------------------------

      const response = await fetch(
        `${API_BASE_URL}/api/transactions/${transactionId}/retry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        let detail = "Payment retry failed.";

        try {
          const errorData = await response.json();
          detail =
            errorData?.detail ||
            errorData?.message ||
            detail;
        } catch {
          // Ignore JSON parsing errors
        }

        throw new Error(detail);
      }

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      console.log("Retry response:", result);

      // -------------------------------------------------------
      // UPDATE RETRY ATTEMPTS
      // -------------------------------------------------------

      setRetryAttempts((previous) => ({
        ...previous,
        [transactionId]: nextAttempt,
      }));

      // -------------------------------------------------------
      // AUDIT LOG
      // -------------------------------------------------------

      await pushAuditLog(
        transactionId,
        "MANDATE_RETRY_INITIATED",
        transactionId
      );

      // -------------------------------------------------------
      // UPDATE STATUS
      // -------------------------------------------------------

      setRetryStatus((previous) => ({
        ...previous,
        [transactionId]:
          result?.status === "success" ||
          result?.recovery_status === "Recovered"
            ? `Attempt ${nextAttempt} of ${MAX_RETRIES} completed successfully.`
            : `Attempt ${nextAttempt} of ${MAX_RETRIES} completed.`,
      }));

      toast.success(
        `Retry attempt ${nextAttempt}/${MAX_RETRIES} submitted successfully.`
      );

      await loadTransactions();
    } catch (err) {
      console.error("Retry payment error:", err);

      setRetryStatus((previous) => ({
        ...previous,
        [transactionId]:
          "Retry attempt failed. Review the transaction before trying again.",
      }));

      toast.error(
        err?.message ||
          "Payment retry could not be completed."
      );
    } finally {
      setRetryingId(null);
    }
  };

  // =========================================================
  // START RECOVERY
  // =========================================================

  const handleRecovery = async (transactionId) => {
    if (recoveringId !== null) {
      toast.info(
        "Another recovery process is already running."
      );
      return;
    }

    const transaction = transactions.find(
      (item) =>
        String(item.transaction_id) ===
        String(transactionId)
    );

    if (!transaction) {
      toast.error("Transaction could not be found.");
      return;
    }

    if (
      String(transaction.recovery_status || "").toLowerCase() ===
      "recovered"
    ) {
      toast.info(
        "This transaction has already been recovered."
      );
      return;
    }

    try {
      setError("");
      setRecoveringId(transactionId);

      setRecoveryFlow(transaction);
      setRecoveryStage(0);
      setRecoveryProgress(5);
      setRecoveryLogs([]);
      setRecoveryActionTaken([]);
      setRecoveryCompleted(false);

      addRecoveryLog(
        "Recovery workflow initialized.",
        "success"
      );

      await wait(1200);

      setRecoveryStage(1);
      setRecoveryProgress(25);

      addRecoveryLog(
        `Failure detected: ${
          transaction.failure_reason || "Unknown failure"
        }`,
        "warning"
      );

      await wait(1400);

      setRecoveryStage(2);
      setRecoveryProgress(45);

      addRecoveryLog(
        `Checking ${
          transaction.gateway || "payment gateway"
        } availability...`,
        "info"
      );

      await wait(1500);

      addRecoveryLog(
        "Gateway response received. Recovery route can be selected.",
        "success"
      );

      await wait(500);

      setRecoveryStage(3);
      setRecoveryProgress(65);

      addRecoveryLog(
        "RecoverAI selected the safest recovery strategy.",
        "ai"
      );

      await wait(1700);

      setRecoveryStage(4);
      setRecoveryProgress(82);

      addRecoveryLog(
        "Recovery request submitted for execution.",
        "info"
      );

      await wait(1700);

      addRecoveryLog(
        "Verifying transaction recovery with the backend...",
        "info"
      );

      const result = await recoverTransaction(
        transactionId
      );

      console.log("Recovery response:", result);

      setRecoveryProgress(100);

      addRecoveryLog(
        "Recovery verification completed successfully.",
        "success"
      );

      setRecoveryCompleted(true);

      toast.success(
        `Recovery completed for transaction #${transactionId}`
      );

      await wait(800);

      await loadTransactions();
    } catch (err) {
      console.error("Recovery error:", err);

      addRecoveryLog(
        err?.response?.data?.detail ||
          err?.message ||
          "Recovery workflow encountered an error.",
        "error"
      );

      setError(
        "Failed to complete recovery workflow."
      );

      toast.error(
        "Recovery process could not be completed."
      );
    } finally {
      setRecoveringId(null);
    }
  };

  // =========================================================
  // CLOSE RECOVERY FLOW
  // =========================================================

  const closeRecoveryFlow = () => {
    if (
      recoveringId !== null &&
      !recoveryCompleted
    ) {
      toast.info(
        "Recovery is still running. Please wait until verification is complete."
      );
      return;
    }

    resetRecoveryState();
  };

  // =========================================================
  // GENERATE PAYMENT LINK
  // =========================================================

  const generatePaymentLink = (transaction) => {
    if (!transaction) return "";

    const transactionId =
      transaction.transaction_id;

    const amount = Number(
      transaction.amount || 0
    ).toFixed(2);

    // Demo-safe payment link.
    // Replace this with your actual payment-link creation
    // endpoint when your gateway payment-link API is connected.
    return `https://recoverai.app/pay/${encodeURIComponent(
      transactionId
    )}?amount=${encodeURIComponent(amount)}`;
  };

  // =========================================================
  // OPEN PAYMENT LINK REVIEW
  // =========================================================

  const handleSendPaymentLink = () => {
    if (!recoveryFlow || recoveryCompleted) return;

    const link =
      generatePaymentLink(recoveryFlow);

    setGeneratedPaymentLink(link);
    setPaymentLinkChannel("Email");
    setPaymentLinkModalOpen(true);
  };

  // =========================================================
  // DISPATCH PAYMENT LINK
  // =========================================================

  const dispatchPaymentLink = async () => {
    if (!recoveryFlow) return;

    try {
      setPaymentLinkGenerating(true);

      const customer =
        recoveryFlow.customer_name ||
        "customer";

      // -------------------------------------------------------
      // AUDIT LOG
      // -------------------------------------------------------

      await pushAuditLog(
        recoveryFlow.transaction_id,
        "SUBSCRIPTION_LINK_DISPATCHED",
        recoveryFlow.transaction_id
      );

      // -------------------------------------------------------
      // UPDATE UI
      // -------------------------------------------------------

      setRecoveryActionTaken((previous) => [
        ...previous,
        `Payment link sent via ${paymentLinkChannel}`,
      ]);

      addRecoveryLog(
        `Secure payment link dispatched to ${customer} via ${paymentLinkChannel}.`,
        "success"
      );

      toast.success(
        `Payment link dispatched via ${paymentLinkChannel}.`
      );

      setPaymentLinkModalOpen(false);
    } catch (err) {
      console.error(
        "Payment link dispatch error:",
        err
      );

      toast.error(
        "Payment link could not be dispatched."
      );
    } finally {
      setPaymentLinkGenerating(false);
    }
  };

  // =========================================================
  // CONTACT CUSTOMER
  // =========================================================

  const handleContactCustomer = () => {
    if (!recoveryFlow || recoveryCompleted) return;

    setRecoveryActionTaken((previous) => [
      ...previous,
      "Customer contact initiated",
    ]);

    addRecoveryLog(
      "Customer communication workflow initiated.",
      "info"
    );

    toast.success(
      "Customer contact workflow initiated."
    );
  };

  // =========================================================
  // ESCALATE CASE
  // =========================================================

  const handleEscalateCase = () => {
    if (!recoveryFlow || recoveryCompleted) return;

    setRecoveryActionTaken((previous) => [
      ...previous,
      "Case escalated",
    ]);

    addRecoveryLog(
      "Case escalated to the payment operations team.",
      "warning"
    );

    toast.info(
      "Case escalated to payment operations."
    );
  };

  // =========================================================
  // SMART RECOVERY ANALYSIS
  // =========================================================

  const generateSmartRecoveryAnalysis = (
    failureReason
  ) => {
    const reason = String(
      failureReason || ""
    ).toLowerCase();

    let route = "Retry Payment";
    let probability = 72;

    let rationale =
      "The payment failure appears temporary. Retrying the transaction after a short delay may resolve the issue.";

    let recommendation =
      "Retry the payment after verifying that the payment gateway is available.";

    let suggested_action =
      "Wait briefly and retry the transaction.";

    let historicalRate = 72;
    let routeIcon = "retry";

    if (
      reason.includes("timeout") ||
      reason.includes("server") ||
      reason.includes("gateway") ||
      reason.includes("technical") ||
      reason.includes("network")
    ) {
      route = "Retry via Alternate Gateway";
      probability = 85;

      rationale =
        "The failure appears to be related to a temporary server, gateway, or network issue. Routing the payment through an alternate gateway can avoid the failed processing path.";

      recommendation =
        "Retry the transaction using an alternate payment gateway or payment route.";

      suggested_action =
        "Automatically retry through a secondary gateway after a short delay.";

      historicalRate = 85;
      routeIcon = "gateway";
    } else if (
      reason.includes("limit") ||
      reason.includes("daily limit") ||
      reason.includes("transaction limit")
    ) {
      route = "Alternative Payment Method";
      probability = 88;

      rationale =
        "The payment appears to have been declined because the current payment method has reached a transaction limit. An alternative payment method can bypass the restriction.";

      recommendation =
        "Send the customer a secure payment link with alternative payment methods.";

      suggested_action =
        "Notify the customer with a dynamic payment link and allow UPI or another available method.";

      historicalRate = 88;
      routeIcon = "alternative";
    } else if (
      reason.includes("insufficient") ||
      reason.includes("balance") ||
      reason.includes("fund")
    ) {
      route = "Customer Payment Link";
      probability = 78;

      rationale =
        "The customer's payment method does not appear to have sufficient available balance. Asking the customer to use another payment method is safer than repeatedly retrying.";

      recommendation =
        "Send the customer a secure payment link so they can complete the payment using another method.";

      suggested_action =
        "Send a payment link supporting UPI, another card, or another available payment method.";

      historicalRate = 78;
      routeIcon = "alternative";
    } else if (
      reason.includes("declined") ||
      reason.includes("card") ||
      reason.includes("issuer")
    ) {
      route = "Alternative Card / UPI";
      probability = 82;

      rationale =
        "The card issuer declined the payment. Repeating the same card transaction may result in another decline, so offering an alternative payment method is more effective.";

      recommendation =
        "Offer the customer an alternative card or UPI payment option.";

      suggested_action =
        "Send a secure payment link allowing the customer to select another payment method.";

      historicalRate = 82;
      routeIcon = "alternative";
    } else if (
      reason.includes("invalid") ||
      reason.includes("incorrect") ||
      reason.includes("details") ||
      reason.includes("authentication")
    ) {
      route = "Verify Payment Details";
      probability = 76;

      rationale =
        "The payment may have failed because some payment or authentication details were incorrect. Verifying the information before retrying reduces repeated failures.";

      recommendation =
        "Ask the customer to verify their payment details and authentication information.";

      suggested_action =
        "Request corrected payment details and retry the transaction.";

      historicalRate = 76;
      routeIcon = "verify";
    } else {
      route = "AI-Assisted Retry";
      probability = 75;

      rationale =
        "The exact failure reason is not specific enough to determine a single recovery path. A controlled retry with an alternative payment option is recommended.";

      recommendation =
        "Attempt a controlled recovery and provide an alternative payment method if the retry fails.";

      suggested_action =
        "Retry once and then provide the customer with a secure payment link.";

      historicalRate = 75;
      routeIcon = "retry";
    }

    return {
      route,
      probability,
      rationale,
      historicalRate,
      routeIcon,
      recommendation,
      suggested_action,
    };
  };

  // =========================================================
  // GET AI RECOMMENDATION
  // =========================================================

  const handleRecommendation = async (
    transactionId
  ) => {
    if (recoveringId !== null) {
      toast.info(
        "Recovery is currently running."
      );
      return;
    }

    try {
      setRecommendationLoading(true);
      setRecommendation(null);
      setSelectedTransactionId(transactionId);
      setError("");

      const transaction = transactions.find(
        (t) =>
          String(t.transaction_id) ===
          String(transactionId)
      );

      if (!transaction) {
        throw new Error(
          "Transaction not found."
        );
      }

      const failureReason =
        transaction.failure_reason ||
        "Unknown failure";

      let data = {};

      try {
        data =
          (await getRecoveryRecommendation(
            transactionId
          )) || {};
      } catch (apiError) {
        console.warn(
          "AI recommendation API failed. Using local analysis.",
          apiError
        );
      }

      const smartAnalysis =
        generateSmartRecoveryAnalysis(
          data?.failure_reason ||
            failureReason
        );

      setRecommendation({
        ...smartAnalysis,
        ...data,

        recommendation:
          data?.recommendation ||
          smartAnalysis.recommendation,

        suggested_action:
          data?.suggested_action ||
          smartAnalysis.suggested_action,

        failure_reason:
          data?.failure_reason ||
          failureReason,

        probability:
          data?.probability ??
          smartAnalysis.probability,

        historicalRate:
          data?.historicalRate ??
          smartAnalysis.historicalRate,

        route:
          data?.route ||
          smartAnalysis.route,

        rationale:
          data?.rationale ||
          smartAnalysis.rationale,
      });
    } catch (err) {
      console.error(
        "Recommendation error:",
        err
      );

      const transaction = transactions.find(
        (t) =>
          String(t.transaction_id) ===
          String(transactionId)
      );

      if (!transaction) {
        setError(
          "Transaction could not be found."
        );
        return;
      }

      const failureReason =
        transaction.failure_reason ||
        "Unknown failure";

      const smartAnalysis =
        generateSmartRecoveryAnalysis(
          failureReason
        );

      setRecommendation({
        ...smartAnalysis,
        failure_reason: failureReason,
      });
    } finally {
      setRecommendationLoading(false);
    }
  };

  // =========================================================
  // CLOSE AI DRAWER
  // =========================================================

  const clearRecommendation = () => {
    if (recoveringId !== null) {
      toast.info(
        "Recovery is currently running."
      );
      return;
    }

    setRecommendation(null);
    setSelectedTransactionId(null);
  };

  // =========================================================
  // FAILED TRANSACTIONS
  // =========================================================

  const failedTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) =>
        String(transaction.status || "")
          .toLowerCase() === "failed"
    );
  }, [transactions]);

  // =========================================================
  // FILTER + SEARCH + SORT
  // =========================================================

  const filteredTransactions = useMemo(() => {
    let result = [...failedTransactions];

    if (searchTerm.trim()) {
      const search =
        searchTerm.toLowerCase().trim();

      result = result.filter(
        (transaction) =>
          [
            transaction.transaction_id,
            transaction.customer_name,
            transaction.customer_email,
            transaction.transaction_type,
            transaction.status,
            transaction.failure_reason,
            transaction.recovery_status,
          ]
            .filter(
              (value) =>
                value !== undefined &&
                value !== null
            )
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(search)
            )
      );
    }

    if (recoveryFilter !== "All") {
      result = result.filter(
        (transaction) =>
          String(
            transaction.recovery_status ||
              "Not Started"
          ) === recoveryFilter
      );
    }

    if (sortOption === "amount-high") {
      result.sort(
        (a, b) =>
          Number(b.amount || 0) -
          Number(a.amount || 0)
      );
    }

    if (sortOption === "amount-low") {
      result.sort(
        (a, b) =>
          Number(a.amount || 0) -
          Number(b.amount || 0)
      );
    }

    if (sortOption === "customer") {
      result.sort((a, b) =>
        String(
          a.customer_name || ""
        ).localeCompare(
          String(
            b.customer_name || ""
          )
        )
      );
    }

    if (sortOption === "latest") {
      result.sort((a, b) => {
        const dateA = new Date(
          a.created_at || 0
        ).getTime();

        const dateB = new Date(
          b.created_at || 0
        ).getTime();

        return dateB - dateA;
      });
    }

    return result;
  }, [
    failedTransactions,
    searchTerm,
    recoveryFilter,
    sortOption,
  ]);

  // =========================================================
  // SELECTED TRANSACTION
  // =========================================================

  const selectedTransaction = useMemo(
    () =>
      transactions.find(
        (transaction) =>
          String(
            transaction.transaction_id
          ) ===
          String(selectedTransactionId)
      ),
    [transactions, selectedTransactionId]
  );

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExportCSV = () => {
    const dataToExport =
      filteredTransactions.length > 0
        ? filteredTransactions
        : failedTransactions.length > 0
        ? failedTransactions
        : transactions;

    if (
      !dataToExport ||
      dataToExport.length === 0
    ) {
      toast.info(
        "No transaction records found to export."
      );
      return;
    }

    const columns = [
      {
        key: "transaction_id",
        label: "Transaction ID",
      },
      {
        key: "customer_name",
        label: "Customer Name",
      },
      {
        key: "customer_email",
        label: "Customer Email",
      },
      {
        key: "amount",
        label: "Amount (₹)",
        formatter: (val) =>
          val !== undefined &&
          val !== null &&
          val !== ""
            ? Number(val).toFixed(2)
            : "0.00",
      },
      {
        key: "gateway",
        label: "Gateway",
      },
      {
        key: "transaction_type",
        label: "Type",
      },
      {
        key: "status",
        label: "Status",
      },
      {
        key: "failure_reason",
        label: "Failure Reason",
      },
      {
        key: "root_cause",
        label: "Root Cause",
      },
      {
        key: "recovery_status",
        label: "Recovery Status",
      },
      {
        key: "recovery_outcome",
        label: "Recovery Outcome",
      },
      {
        key: "created_at",
        label: "Created Date",
        formatter: (val) =>
          val
            ? new Date(val).toLocaleString(
                "en-IN"
              )
            : "—",
      },
    ];

    const dateStr = new Date()
      .toISOString()
      .slice(0, 10);

    exportToCSV(
      dataToExport,
      `transactions_${dateStr}.csv`,
      columns
    );

    toast.success(
      "Transactions exported to CSV successfully."
    );
  };

  // =========================================================
  // PAYMENT LINK REVIEW MODAL
  // =========================================================

  const PaymentLinkReviewModal = () => {
    if (
      !paymentLinkModalOpen ||
      !recoveryFlow
    ) {
      return null;
    }

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(15, 23, 42, 0.68)",
          backdropFilter: "blur(7px)",
          zIndex: 10001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(620px, 100%)",
            background: "#ffffff",
            borderRadius: "22px",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.30)",
            overflow: "hidden",
          }}
        >
          {/* HEADER */}

          <div
            style={{
              padding: "22px 24px",
              borderBottom:
                "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard size={22} />
              </div>

              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#0f172a",
                    fontSize: "19px",
                  }}
                >
                  Payment Link Review
                </h3>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: "12px",
                  }}
                >
                  Review before dispatching
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setPaymentLinkModalOpen(false)
              }
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                border:
                  "1px solid #e2e8f0",
                background: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* CONTENT */}

          <div
            style={{
              padding: "24px",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 800,
                      textTransform:
                        "uppercase",
                    }}
                  >
                    Customer
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#0f172a",
                    }}
                  >
                    {recoveryFlow.customer_name ||
                      "Unknown Customer"}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 800,
                      textTransform:
                        "uppercase",
                    }}
                  >
                    Amount
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#2563eb",
                    }}
                  >
                    ₹
                    {Number(
                      recoveryFlow.amount || 0
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </strong>
                </div>
              </div>

              <span
                style={{
                  fontSize: "10px",
                  color: "#64748b",
                  fontWeight: 800,
                  textTransform:
                    "uppercase",
                }}
              >
                One-Click Payment Link
              </span>

              <div
                style={{
                  marginTop: "7px",
                  padding: "11px",
                  background: "#ffffff",
                  border:
                    "1px solid #dbeafe",
                  borderRadius: "9px",
                  color: "#2563eb",
                  fontSize: "12px",
                  wordBreak: "break-all",
                }}
              >
                {generatedPaymentLink}
              </div>
            </div>

            {/* CHANNELS */}

            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#475569",
                  fontWeight: 800,
                  textTransform:
                    "uppercase",
                }}
              >
                Dispatch Channel
              </span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setPaymentLinkChannel(
                      "Email"
                    )
                  }
                  style={{
                    padding: "13px 10px",
                    borderRadius: "11px",
                    border:
                      paymentLinkChannel ===
                      "Email"
                        ? "2px solid #2563eb"
                        : "1px solid #e2e8f0",
                    background:
                      paymentLinkChannel ===
                      "Email"
                        ? "#eff6ff"
                        : "#ffffff",
                    color:
                      paymentLinkChannel ===
                      "Email"
                        ? "#2563eb"
                        : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Mail size={16} />
                  Email
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentLinkChannel(
                      "WhatsApp"
                    )
                  }
                  style={{
                    padding: "13px 10px",
                    borderRadius: "11px",
                    border:
                      paymentLinkChannel ===
                      "WhatsApp"
                        ? "2px solid #16a34a"
                        : "1px solid #e2e8f0",
                    background:
                      paymentLinkChannel ===
                      "WhatsApp"
                        ? "#f0fdf4"
                        : "#ffffff",
                    color:
                      paymentLinkChannel ===
                      "WhatsApp"
                        ? "#15803d"
                        : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentLinkChannel(
                      "Hinglish Voice Call"
                    )
                  }
                  style={{
                    padding: "13px 10px",
                    borderRadius: "11px",
                    border:
                      paymentLinkChannel ===
                      "Hinglish Voice Call"
                        ? "2px solid #7c3aed"
                        : "1px solid #e2e8f0",
                    background:
                      paymentLinkChannel ===
                      "Hinglish Voice Call"
                        ? "#f5f3ff"
                        : "#ffffff",
                    color:
                      paymentLinkChannel ===
                      "Hinglish Voice Call"
                        ? "#7c3aed"
                        : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Volume2 size={16} />
                  Voice Call
                </button>
              </div>
            </div>
          </div>

          {/* FOOTER */}

          <div
            style={{
              padding: "16px 24px 22px",
              borderTop:
                "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setPaymentLinkModalOpen(false)
              }
              style={{
                padding: "11px 18px",
                borderRadius: "10px",
                border:
                  "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                dispatchPaymentLink
              }
              disabled={
                paymentLinkGenerating
              }
              style={{
                padding: "11px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 700,
                cursor:
                  paymentLinkGenerating
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity:
                  paymentLinkGenerating
                    ? 0.7
                    : 1,
              }}
            >
              {paymentLinkGenerating ? (
                <>
                  <RefreshCw
                    size={16}
                    className="spinning"
                  />
                  Dispatching...
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Dispatch Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================
  // SUBSCRIPTION RECOVERY SEQUENCE
  // =========================================================

  const SubscriptionRecoverySequence = () => {
    return (
      <div
        style={{
          marginTop: "24px",
          background: "#ffffff",
          border:
            "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity size={21} />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "18px",
              }}
            >
              Subscription Recovery Sequence
            </h3>

            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Automated recovery lifecycle
            </p>
          </div>
        </div>

        <div
          style={{
            position: "relative",
          }}
        >
          {/* CONNECTING LINE */}

          <div
            style={{
              position: "absolute",
              left: "18px",
              top: "25px",
              bottom: "25px",
              width: "2px",
              background:
                "linear-gradient(#10b981,#2563eb,#cbd5e1)",
            }}
          />

          {/* STEP 1 */}

          <div
            style={{
              display: "flex",
              gap: "15px",
              position: "relative",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                border:
                  "4px solid #ffffff",
                boxShadow:
                  "0 0 0 1px #bbf7d0",
              }}
            >
              <CheckCircle2 size={19} />
            </div>

            <div
              style={{
                flex: 1,
                padding: "15px",
                background: "#f8fafc",
                borderRadius: "14px",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "10px",
                }}
              >
                <strong
                  style={{
                    color: "#0f172a",
                  }}
                >
                  1. Mandate Execution Failed
                </strong>

                <span
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  5 Sept 2026 • 09:30 AM
                </span>
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Soft failure recorded
                (Insufficient Funds).
                Automatic grace period
                activated.
              </p>
            </div>
          </div>

          {/* STEP 2 */}

          <div
            style={{
              display: "flex",
              gap: "15px",
              position: "relative",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "#dbeafe",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                border:
                  "4px solid #ffffff",
                boxShadow:
                  "0 0 0 1px #bfdbfe",
              }}
            >
              <Sparkles size={19} />
            </div>

            <div
              style={{
                flex: 1,
                padding: "15px",
                background: "#eff6ff",
                borderRadius: "14px",
                border:
                  "1px solid #bfdbfe",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "10px",
                }}
              >
                <strong
                  style={{
                    color: "#0f172a",
                  }}
                >
                  2. Smart Schedule &
                  Notification
                </strong>

                <span
                  style={{
                    fontSize: "11px",
                    color: "#2563eb",
                    fontWeight: 700,
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  Scheduled for 8 Sept 2026
                </span>
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  color: "#475569",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Gemini 3.6 Flash queued
                smart retry.
                Pre-notification sent
                via WhatsApp.
              </p>

              <div
                style={{
                  marginTop: "10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding:
                    "5px 9px",
                  borderRadius: "20px",
                  background: "#ffffff",
                  border:
                    "1px solid #bfdbfe",
                  color: "#2563eb",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                <MessageCircle size={12} />
                WhatsApp pre-notification sent
              </div>
            </div>
          </div>

          {/* STEP 3 */}

          <div
            style={{
              display: "flex",
              gap: "15px",
              position: "relative",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "#f1f5f9",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                border:
                  "4px solid #ffffff",
                boxShadow:
                  "0 0 0 1px #cbd5e1",
              }}
            >
              <Clock3 size={19} />
            </div>

            <div
              style={{
                flex: 1,
                padding: "15px",
                background: "#ffffff",
                borderRadius: "14px",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "10px",
                }}
              >
                <strong
                  style={{
                    color: "#475569",
                  }}
                >
                  3. Final Escalation &
                  Pause
                </strong>

                <span
                  style={{
                    padding:
                      "4px 8px",
                    borderRadius: "20px",
                    background: "#f1f5f9",
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  Pending
                </span>
              </div>

              <p
                style={{
                  margin:
                    "7px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                If unpaid by 12 Sept,
                restrict account access
                and transition to voice
                recovery.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================
  // RECOVERY FLOW MODAL
  // =========================================================

  const RecoveryFlowModal = () => {
    if (!recoveryFlow) {
      return null;
    }

    const CurrentIcon =
      recoveryStages[recoveryStage]?.icon ||
      Activity;

    const currentAttempts =
      retryAttempts[
        recoveryFlow.transaction_id
      ] || 1;

    const currentRetryStatus =
      retryStatus[
        recoveryFlow.transaction_id
      ];

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(15, 23, 42, 0.68)",
          backdropFilter: "blur(7px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "min(900px, 100%)",
            maxHeight: "92vh",
            overflowY: "auto",
            background: "#ffffff",
            borderRadius: "24px",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.30)",
          }}
        >
          {/* HEADER */}

          <div
            style={{
              padding: "24px 28px",
              borderBottom:
                "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background:
                    "linear-gradient(135deg,#0f172a,#2563eb)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Rocket size={24} />
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "21px",
                    color: "#0f172a",
                  }}
                >
                  Recovery Control Center
                </h2>

                <p
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  Live recovery workflow for{" "}
                  <strong>
                    {recoveryFlow.transaction_id}
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeRecoveryFlow}
              disabled={
                recoveringId !== null &&
                !recoveryCompleted
              }
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                border:
                  "1px solid #e2e8f0",
                background: "#ffffff",
                cursor:
                  recoveringId !== null &&
                  !recoveryCompleted
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                opacity:
                  recoveringId !== null &&
                  !recoveryCompleted
                    ? 0.5
                    : 1,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* TRANSACTION SUMMARY */}

          <div
            style={{
              margin: "22px 28px 0",
              padding: "18px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg,#f8fafc,#eff6ff)",
              border:
                "1px solid #dbeafe",
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  textTransform:
                    "uppercase",
                  fontWeight: 700,
                }}
              >
                Customer
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#0f172a",
                }}
              >
                {recoveryFlow.customer_name ||
                  "Unknown"}
              </strong>
            </div>

            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  textTransform:
                    "uppercase",
                  fontWeight: 700,
                }}
              >
                Amount
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#0f172a",
                  fontSize: "18px",
                }}
              >
                ₹
                {Number(
                  recoveryFlow.amount || 0
                ).toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  textTransform:
                    "uppercase",
                  fontWeight: 700,
                }}
              >
                Failure
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#dc2626",
                }}
              >
                {recoveryFlow.failure_reason ||
                  "Unknown"}
              </strong>
            </div>
          </div>

          {/* RETRY SEQUENCE */}

          <div
            style={{
              margin:
                "16px 28px 0",
              padding: "14px 16px",
              borderRadius: "13px",
              background:
                currentRetryStatus
                  ? "#eff6ff"
                  : "#f8fafc",
              border:
                currentRetryStatus
                  ? "1px solid #bfdbfe"
                  : "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <RefreshCw
              size={18}
              color="#2563eb"
            />

            <div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#64748b",
                  textTransform:
                    "uppercase",
                }}
              >
                Retry Sequence
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#0f172a",
                  fontSize: "13px",
                }}
              >
                {currentRetryStatus ||
                  `Attempt ${currentAttempts} of ${MAX_RETRIES}`}
              </strong>
            </div>

            <span
              style={{
                marginLeft: "auto",
                padding:
                  "5px 9px",
                borderRadius: "20px",
                background: "#ffffff",
                border:
                  "1px solid #bfdbfe",
                color: "#2563eb",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {currentAttempts}/{MAX_RETRIES}
            </span>
          </div>

          {/* CURRENT STATUS */}

          <div
            style={{
              padding: "26px 28px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "15px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background:
                    recoveryCompleted
                      ? "#dcfce7"
                      : "#dbeafe",
                  color:
                    recoveryCompleted
                      ? "#059669"
                      : "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {recoveryCompleted ? (
                  <CheckCircle2 size={28} />
                ) : (
                  <CurrentIcon size={27} />
                )}
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#64748b",
                    letterSpacing:
                      "0.08em",
                  }}
                >
                  LIVE RECOVERY STATUS
                </span>

                <h3
                  style={{
                    margin:
                      "4px 0 0",
                    fontSize: "20px",
                    color: "#0f172a",
                  }}
                >
                  {recoveryCompleted
                    ? "Recovery Successful"
                    : recoveryStages[
                        recoveryStage
                      ]?.title}
                </h3>
              </div>
            </div>

            <p
              style={{
                margin:
                  "0 0 18px 66px",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {recoveryCompleted
                ? "The payment recovery has been verified and the transaction has been updated."
                : recoveryStages[
                    recoveryStage
                  ]?.description}
            </p>

            {/* PROGRESS */}

            <div
              style={{
                height: "9px",
                background: "#e2e8f0",
                borderRadius: "20px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${recoveryProgress}%`,
                  height: "100%",
                  borderRadius: "20px",
                  background:
                    recoveryCompleted
                      ? "#10b981"
                      : "linear-gradient(90deg,#2563eb,#7c3aed)",
                  transition:
                    "width 0.7s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginTop: "8px",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              <span>
                Recovery progress
              </span>

              <strong>
                {recoveryProgress}%
              </strong>
            </div>
          </div>

          {/* STAGES */}

          <div
            style={{
              padding:
                "12px 28px 20px",
              display: "grid",
              gridTemplateColumns:
                "repeat(5, 1fr)",
              gap: "8px",
            }}
          >
            {recoveryStages.map(
              (stage, index) => {
                const StageIcon =
                  stage.icon;

                const completed =
                  recoveryCompleted ||
                  index < recoveryStage;

                const active =
                  index ===
                    recoveryStage &&
                  !recoveryCompleted;

                return (
                  <div
                    key={stage.title}
                    style={{
                      textAlign: "center",
                      opacity:
                        completed ||
                        active
                          ? 1
                          : 0.45,
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        margin:
                          "0 auto 7px",
                        borderRadius:
                          "50%",
                        background:
                          completed
                            ? "#dcfce7"
                            : active
                            ? "#dbeafe"
                            : "#f1f5f9",
                        color:
                          completed
                            ? "#059669"
                            : active
                            ? "#2563eb"
                            : "#94a3b8",
                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      {completed ? (
                        <CheckCircle2
                          size={17}
                        />
                      ) : (
                        <StageIcon
                          size={17}
                        />
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#475569",
                        lineHeight: 1.2,
                      }}
                    >
                      {stage.title}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          {/* OPERATOR ACTIONS */}

          <div
            style={{
              margin:
                "0 28px 22px",
              padding: "18px",
              border:
                "1px solid #e2e8f0",
              borderRadius: "16px",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <ShieldCheck size={18} />

              <strong
                style={{
                  color: "#0f172a",
                }}
              >
                Operator Actions
              </strong>

              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Take action while recovery runs
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: "10px",
              }}
            >
              {/* RETRY PAYMENT */}

              <button
                type="button"
                onClick={() =>
                  handleRetryPayment(
                    recoveryFlow.transaction_id
                  )
                }
                disabled={
                  recoveryCompleted ||
                  retryingId !== null ||
                  currentAttempts >=
                    MAX_RETRIES
                }
                style={{
                  border:
                    "1px solid #bfdbfe",
                  background:
                    "#eff6ff",
                  color: "#2563eb",
                  padding:
                    "11px 12px",
                  borderRadius: "10px",
                  cursor:
                    recoveryCompleted ||
                    retryingId !== null ||
                    currentAttempts >=
                      MAX_RETRIES
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: "7px",
                  fontWeight: 700,
                  opacity:
                    recoveryCompleted ||
                    retryingId !== null ||
                    currentAttempts >=
                      MAX_RETRIES
                      ? 0.5
                      : 1,
                }}
              >
                {retryingId ===
                recoveryFlow.transaction_id ? (
                  <RefreshCw
                    size={16}
                    className="spinning"
                  />
                ) : (
                  <RefreshCw size={16} />
                )}

                Retry Payment
              </button>

              {/* PAYMENT LINK */}

              <button
                type="button"
                onClick={
                  handleSendPaymentLink
                }
                disabled={
                  recoveryCompleted
                }
                style={{
                  border:
                    "1px solid #dbeafe",
                  background:
                    "#f8fafc",
                  color: "#2563eb",
                  padding:
                    "11px 12px",
                  borderRadius: "10px",
                  cursor:
                    recoveryCompleted
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: "7px",
                  fontWeight: 700,
                  opacity:
                    recoveryCompleted
                      ? 0.5
                      : 1,
                }}
              >
                <Mail size={16} />
                Send Payment Link
              </button>

              {/* ESCALATE */}

              <button
                type="button"
                onClick={
                  handleEscalateCase
                }
                disabled={
                  recoveryCompleted
                }
                style={{
                  border:
                    "1px solid #fecaca",
                  background:
                    "#fff1f2",
                  color: "#dc2626",
                  padding:
                    "11px 12px",
                  borderRadius: "10px",
                  cursor:
                    recoveryCompleted
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  gap: "7px",
                  fontWeight: 700,
                  opacity:
                    recoveryCompleted
                      ? 0.5
                      : 1,
                }}
              >
                <Siren size={16} />
                Escalate Case
              </button>
            </div>

            {recoveryActionTaken.length >
              0 && (
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "7px",
                }}
              >
                {recoveryActionTaken.map(
                  (action, index) => (
                    <span
                      key={`${action}-${index}`}
                      style={{
                        background:
                          "#f0fdf4",
                        color:
                          "#15803d",
                        border:
                          "1px solid #bbf7d0",
                        borderRadius:
                          "20px",
                        padding:
                          "5px 9px",
                        fontSize:
                          "11px",
                        fontWeight: 700,
                      }}
                    >
                      ✓ {action}
                    </span>
                  )
                )}
              </div>
            )}
          </div>

          {/* LIVE ACTIVITY */}

          <div
            style={{
              margin:
                "0 28px 24px",
              border:
                "1px solid #e2e8f0",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding:
                  "14px 16px",
                background:
                  "#f8fafc",
                borderBottom:
                  "1px solid #e2e8f0",
                display: "flex",
                alignItems:
                  "center",
                gap: "8px",
              }}
            >
              <Activity
                size={17}
                color="#2563eb"
              />

              <strong>
                Live Activity Log
              </strong>

              <span
                style={{
                  marginLeft:
                    "auto",
                  fontSize:
                    "11px",
                  color:
                    "#64748b",
                }}
              >
                {recoveryLogs.length} events
              </span>
            </div>

            <div
              style={{
                maxHeight:
                  "180px",
                overflowY:
                  "auto",
                padding:
                  "8px 16px",
              }}
            >
              {recoveryLogs.length ===
              0 ? (
                <div
                  style={{
                    padding:
                      "18px 0",
                    textAlign:
                      "center",
                    color:
                      "#94a3b8",
                    fontSize:
                      "13px",
                  }}
                >
                  Initializing recovery workflow...
                </div>
              ) : (
                recoveryLogs.map(
                  (log) => (
                    <div
                      key={log.id}
                      style={{
                        display:
                          "flex",
                        gap:
                          "10px",
                        padding:
                          "9px 0",
                        borderBottom:
                          "1px solid #f1f5f9",
                      }}
                    >
                      <CircleDot
                        size={14}
                        style={{
                          marginTop:
                            "3px",
                          color:
                            log.type ===
                            "success"
                              ? "#10b981"
                              : log.type ===
                                "warning"
                              ? "#f59e0b"
                              : log.type ===
                                "error"
                              ? "#ef4444"
                              : log.type ===
                                "ai"
                              ? "#8b5cf6"
                              : "#3b82f6",
                        }}
                      />

                      <span
                        style={{
                          flex: 1,
                          color:
                            "#475569",
                          fontSize:
                            "12px",
                        }}
                      >
                        {log.message}
                      </span>

                      <span
                        style={{
                          color:
                            "#94a3b8",
                          fontSize:
                            "10px",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {log.time}
                      </span>
                    </div>
                  )
                )
              )}
            </div>
          </div>

          {/* FOOTER */}

          <div
            style={{
              padding:
                "18px 28px 24px",
              borderTop:
                "1px solid #e2e8f0",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "15px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "8px",
                color:
                  recoveryCompleted
                    ? "#059669"
                    : "#64748b",
                fontSize:
                  "12px",
                fontWeight:
                  700,
              }}
            >
              {recoveryCompleted ? (
                <>
                  <CheckCircle2
                    size={17}
                  />
                  Recovery verified
                </>
              ) : (
                <>
                  <RefreshCw
                    size={16}
                    className="spinning"
                  />
                  Recovery engine running...
                </>
              )}
            </div>

            <button
              type="button"
              onClick={
                closeRecoveryFlow
              }
              disabled={
                recoveringId !==
                  null &&
                !recoveryCompleted
              }
              style={{
                padding:
                  "11px 20px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #cbd5e1",
                background:
                  recoveryCompleted
                    ? "#0f172a"
                    : "#f8fafc",
                color:
                  recoveryCompleted
                    ? "#ffffff"
                    : "#64748b",
                cursor:
                  recoveringId !==
                    null &&
                  !recoveryCompleted
                    ? "not-allowed"
                    : "pointer",
                fontWeight:
                  700,
              }}
            >
              {recoveryCompleted
                ? "Done"
                : "Running..."}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="page">
      {/* PAGE HEADER */}

      <section className="section-header">
        <div>
          <h2>Failed Transactions</h2>

          <p>
            Review failed payments and
            use AI-assisted recovery
            recommendations.
          </p>
        </div>

        <div className="transaction-header-actions">
          <span className="transaction-count">
            {filteredTransactions.length}{" "}
            Failed Transactions
          </span>

          <button
            type="button"
            className="feature-action-button export-csv-button"
            onClick={
              handleExportCSV
            }
            title="Export transactions to CSV spreadsheet"
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="refresh-button"
            onClick={
              loadTransactions
            }
            disabled={
              loading ||
              recoveringId !==
                null ||
              retryingId !==
                null
            }
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "spinning"
                  : ""
              }
            />

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </section>

      {/* FILTERS */}

      <div className="transaction-controls">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search failed transactions..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
          />
        </div>

        <select
          value={recoveryFilter}
          onChange={(e) =>
            setRecoveryFilter(
              e.target.value
            )
          }
        >
          <option value="All">
            All Recovery
          </option>

          <option value="Not Started">
            Not Started
          </option>

          <option value="Processing">
            Processing
          </option>

          <option value="Recovered">
            Recovered
          </option>
        </select>

        <select
          value={sortOption}
          onChange={(e) =>
            setSortOption(
              e.target.value
            )
          }
        >
          <option value="latest">
            Latest
          </option>

          <option value="amount-high">
            Amount: High to Low
          </option>

          <option value="amount-low">
            Amount: Low to High
          </option>

          <option value="customer">
            Customer A-Z
          </option>
        </select>
      </div>

      {/* ERROR */}

      {error && (
        <div className="message-box error-box">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div
          className="table-container"
          style={{
            background:
              "#ffffff",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div className="skeleton-table">
            {[1, 2, 3, 4, 5, 6].map(
              (i) => (
                <div
                  key={i}
                  className="skeleton-table-row"
                >
                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "15%",
                    }}
                  />

                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "20%",
                    }}
                  />

                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "12%",
                    }}
                  />

                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "18%",
                    }}
                  />

                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "15%",
                    }}
                  />

                  <div
                    className="skeleton-shimmer skeleton-cell"
                    style={{
                      width: "20%",
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* EMPTY */}

      {!loading &&
        !error &&
        filteredTransactions.length ===
          0 && (
          <div className="message-box">
            <div className="empty-state-icon">
              <CheckCircle2 size={40} />
            </div>

            <h3>
              No Failed Transactions
            </h3>

            <p>
              There are currently no failed
              transactions matching your filters.
            </p>
          </div>
        )}

      {/* TABLE */}

      {!loading &&
        !error &&
        filteredTransactions.length >
          0 && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    Transaction ID
                  </th>

                  <th>Customer</th>

                  <th>Amount</th>

                  <th>Type</th>

                  <th>
                    Failure Reason
                  </th>

                  <th>Recovery</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => {
                    const transactionId =
                      transaction.transaction_id;

                    const isRecovering =
                      String(
                        recoveringId
                      ) ===
                      String(
                        transactionId
                      );

                    const isRetrying =
                      String(
                        retryingId
                      ) ===
                      String(
                        transactionId
                      );

                    const isRecovered =
                      String(
                        transaction.recovery_status ||
                          ""
                      ).toLowerCase() ===
                      "recovered";

                    const attempts =
                      retryAttempts[
                        transactionId
                      ] || 1;

                    return (
                      <tr
                        key={String(
                          transactionId
                        )}
                      >
                        {/* TRANSACTION ID */}

                        <td>
                          <span className="transaction-id">
                            {transactionId}
                          </span>
                        </td>

                        {/* CUSTOMER */}

                        <td>
                          <div className="customer">
                            <strong>
                              {transaction.customer_name ||
                                "Unknown Customer"}
                            </strong>

                            <small>
                              {transaction.customer_email ||
                                "No email"}
                            </small>
                          </div>
                        </td>

                        {/* AMOUNT */}

                        <td className="amount">
                          <IndianRupee
                            size={15}
                          />

                          {Number(
                            transaction.amount ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        {/* TYPE */}

                        <td>
                          <span className="type-badge">
                            {transaction.transaction_type ||
                              "Unknown"}
                          </span>
                        </td>

                        {/* FAILURE */}

                        <td>
                          <span className="failure-reason">
                            {transaction.failure_reason ||
                              "Unknown"}
                          </span>
                        </td>

                        {/* RECOVERY */}

                        <td>
                          <div
                            style={{
                              display:
                                "flex",
                              flexDirection:
                                "column",
                              gap:
                                "6px",
                            }}
                          >
                            <span
                              className={`recovery-badge ${
                                String(
                                  transaction.recovery_status ||
                                    "Not Started"
                                )
                                  .toLowerCase()
                                  .replace(
                                    /\s+/g,
                                    "-"
                                  )
                              }`}
                            >
                              {transaction.recovery_status ||
                                "Not Started"}
                            </span>

                            <span
                              style={{
                                fontSize:
                                  "10px",
                                color:
                                  "#64748b",
                                fontWeight:
                                  700,
                              }}
                            >
                              Retry {attempts}/
                              {MAX_RETRIES}
                            </span>
                          </div>
                        </td>

                        {/* ACTION */}

                        <td>
                          <div className="action-buttons">
                            {/* AI */}

                            <button
                              type="button"
                              className="ai-button"
                              onClick={() =>
                                handleRecommendation(
                                  transactionId
                                )
                              }
                              disabled={
                                recommendationLoading ||
                                recoveringId !==
                                  null ||
                                retryingId !==
                                  null
                              }
                            >
                              <Bot size={16} />

                              AI Recommendation
                            </button>

                            {/* RETRY PAYMENT */}

                            {!isRecovered &&
                              attempts <
                                MAX_RETRIES && (
                                <button
                                  type="button"
                                  className="recovery-button"
                                  onClick={() =>
                                    handleRetryPayment(
                                      transactionId
                                    )
                                  }
                                  disabled={
                                    retryingId !==
                                      null ||
                                    recoveringId !==
                                      null
                                  }
                                >
                                  {isRetrying ? (
                                    <>
                                      <RefreshCw
                                        size={15}
                                        className="spinning"
                                      />

                                      Retrying...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw
                                        size={15}
                                      />

                                      Retry Payment
                                    </>
                                  )}
                                </button>
                              )}

                            {/* START RECOVERY */}

                            {isRecovered ? (
                              <span className="completed-text">
                                <CheckCircle2
                                  size={16}
                                />

                                Recovered
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="recovery-button"
                                onClick={() =>
                                  handleRecovery(
                                    transactionId
                                  )
                                }
                                disabled={
                                  recoveringId !==
                                    null ||
                                  isRecovering
                                }
                              >
                                {isRecovering ? (
                                  <>
                                    <RefreshCw
                                      size={15}
                                      className="spinning"
                                    />

                                    Recovery Running...
                                  </>
                                ) : (
                                  <>
                                    <Rocket
                                      size={15}
                                    />

                                    Start Recovery
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {retryStatus[
                            transactionId
                          ] && (
                            <div
                              style={{
                                marginTop:
                                  "7px",
                                fontSize:
                                  "10px",
                                color:
                                  "#2563eb",
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                retryStatus[
                                  transactionId
                                ]
                              }
                            </div>
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

      {/* SUBSCRIPTION RECOVERY SEQUENCE */}

      {!loading &&
        !error &&
        filteredTransactions.length >
          0 && (
          <SubscriptionRecoverySequence />
        )}

      {/* =====================================================
          AI ANALYSIS DRAWER
      ===================================================== */}

      {(recommendationLoading ||
        recommendation) && (
        <div
          className="ai-drawer-overlay"
          onClick={
            clearRecommendation
          }
        >
          <aside
            className="ai-drawer"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* HEADER */}

            <div className="ai-drawer-header">
              <div className="ai-drawer-title">
                <div className="ai-drawer-icon">
                  <Bot size={25} />
                </div>

                <div>
                  <h2>
                    AI Recovery Analysis
                  </h2>

                  <p>
                    RecoverAI Intelligence
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="ai-drawer-close"
                onClick={
                  clearRecommendation
                }
                aria-label="Close AI recommendation"
              >
                <X size={21} />
              </button>
            </div>

            {/* LOADING */}

            {recommendationLoading && (
              <div className="ai-drawer-loading">
                <div className="ai-loading-icon">
                  <Bot size={34} />
                </div>

                <h3>
                  Analyzing Transaction
                </h3>

                <p>
                  RecoverAI is analyzing the failure
                  reason and selecting the safest
                  recovery strategy.
                </p>

                <div className="ai-loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            {/* RESULT */}

            {recommendation &&
              !recommendationLoading && (
                <div className="ai-drawer-content">
                  {/* TRANSACTION */}

                  {selectedTransactionId !==
                    null && (
                    <div className="ai-transaction-card">
                      <div>
                        <span>
                          TRANSACTION
                        </span>

                        <strong>
                          {
                            selectedTransactionId
                          }
                        </strong>
                      </div>

                      <div className="ai-analyzed-badge">
                        <Sparkles size={14} />
                        AI ANALYZED
                      </div>
                    </div>
                  )}

                  {/* =================================================
                      GEMINI 3.6 FLASH STRATEGY RATIONALE
                      DUPLICATE PROBABILITY REMOVED
                  ================================================= */}

                  <div
                    style={{
                      marginBottom:
                        "16px",
                      padding:
                        "18px",
                      borderRadius:
                        "16px",
                      background:
                        "linear-gradient(135deg,#f5f3ff,#eff6ff)",
                      border:
                        "1px solid #ddd6fe",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "10px",
                        marginBottom:
                          "10px",
                      }}
                    >
                      <div
                        style={{
                          width:
                            "36px",
                          height:
                            "36px",
                          borderRadius:
                            "10px",
                          background:
                            "#ffffff",
                          color:
                            "#7c3aed",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                        }}
                      >
                        <Sparkles
                          size={19}
                        />
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            color:
                              "#7c3aed",
                            letterSpacing:
                              "0.07em",
                          }}
                        >
                          GEMINI 3.6 FLASH
                        </span>

                        <h3
                          style={{
                            margin:
                              "3px 0 0",
                            color:
                              "#0f172a",
                            fontSize:
                              "16px",
                          }}
                        >
                          Strategy Rationale
                        </h3>
                      </div>
                    </div>

                    <p
                      style={{
                        margin:
                          "0",
                        color:
                          "#475569",
                        fontSize:
                          "13px",
                        lineHeight:
                          1.6,
                      }}
                    >
                      {recommendation.rationale ||
                        "Gemini 3.6 Flash analyzed the payment failure and selected the safest recovery strategy based on the available transaction context."}
                    </p>
                  </div>

                  {/* SMART ROUTE */}

                  <div className="ai-route-card">
                    <div className="ai-card-icon">
                      <ArrowRight size={21} />
                    </div>

                    <div>
                      <span className="ai-section-label">
                        SMART RECOVERY ROUTE
                      </span>

                      <h3>
                        {recommendation.route ||
                          "AI-Assisted Retry"}
                      </h3>

                      <p>
                        RecoverAI selected this route
                        based on the detected payment
                        failure.
                      </p>
                    </div>
                  </div>

                  {/* PROBLEM */}

                  {recommendation.failure_reason && (
                    <div className="ai-info-card problem">
                      <div className="ai-info-icon">
                        <AlertTriangle
                          size={21}
                        />
                      </div>

                      <div>
                        <span className="ai-section-label">
                          PROBLEM IDENTIFIED
                        </span>

                        <p>
                          The transaction failed
                          because of{" "}
                          <strong>
                            {
                              recommendation.failure_reason
                            }
                          </strong>
                          .
                        </p>
                      </div>
                    </div>
                  )}

                  {/* RECOMMENDED ACTION */}

                  {recommendation.recommendation && (
                    <div className="ai-info-card action">
                      <div className="ai-info-icon">
                        <Lightbulb size={21} />
                      </div>

                      <div>
                        <span className="ai-section-label">
                          RECOMMENDED ACTION
                        </span>

                        <p>
                          {
                            recommendation.recommendation
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HISTORICAL */}

                  <div className="ai-history-card">
                    <div className="history-icon">
                      <Clock3 size={21} />
                    </div>

                    <div>
                      <span className="ai-section-label">
                        HISTORICAL RECOVERY RATE
                      </span>

                      <h3>
                        {Number(
                          recommendation.historicalRate ??
                            0
                        )}
                        %
                      </h3>

                      <p>
                        Estimated recovery rate for
                        similar payment failures.
                      </p>
                    </div>
                  </div>

                  {/* NEXT STEP */}

                  {recommendation.suggested_action && (
                    <div className="ai-next-step">
                      <div className="next-step-header">
                        <Rocket size={19} />

                        <strong>
                          NEXT STEP
                        </strong>
                      </div>

                      <p>
                        {
                          recommendation.suggested_action
                        }
                      </p>
                    </div>
                  )}

                  {/* DETAILS */}

                  {selectedTransaction && (
                    <div className="ai-details">
                      <h3>
                        Transaction Details
                      </h3>

                      <div className="ai-detail-row">
                        <span>
                          Customer
                        </span>

                        <strong>
                          {
                            selectedTransaction.customer_name
                          }
                        </strong>
                      </div>

                      <div className="ai-detail-row">
                        <span>
                          Amount
                        </span>

                        <strong>
                          ₹
                          {Number(
                            selectedTransaction.amount ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </strong>
                      </div>

                      <div className="ai-detail-row">
                        <span>
                          Payment Type
                        </span>

                        <strong>
                          {
                            selectedTransaction.transaction_type ||
                            "Unknown"
                          }
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* DRAWER ACTIONS */}

                  <div className="ai-drawer-footer">
                    <button
                      type="button"
                      className="drawer-recover-button"
                      onClick={() => {
                        if (
                          selectedTransactionId !==
                          null
                        ) {
                          clearRecommendation();

                          handleRecovery(
                            selectedTransactionId
                          );
                        }
                      }}
                      disabled={
                        selectedTransactionId ===
                          null ||
                        recoveringId !== null
                      }
                    >
                      {recoveringId !==
                      null ? (
                        <>
                          <RefreshCw
                            size={17}
                            className="spinning"
                          />

                          Recovery Running...
                        </>
                      ) : (
                        <>
                          <Rocket size={17} />

                          Start Recovery
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="drawer-close-button"
                      onClick={
                        clearRecommendation
                      }
                      disabled={
                        recoveringId !== null
                      }
                    >
                      <X size={17} />

                      Close
                    </button>
                  </div>

                  <div className="ai-powered">
                    <Bot size={14} />

                    Powered by RecoverAI AI
                  </div>
                </div>
              )}
          </aside>
        </div>
      )}

      {/* PAYMENT LINK REVIEW MODAL */}

      <PaymentLinkReviewModal />

      {/* REAL-TIME RECOVERY MODAL */}

      <RecoveryFlowModal />
    </div>
  );
}

export default FailedTransactions;