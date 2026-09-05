import { useEffect, useState } from "react";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  IndianRupee,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

import {
  getTransactions,
} from "../services/api";

function Overview() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTransactions();

      setTransactions(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const totalTransactions = transactions.length;

  const failedTransactions = transactions.filter(
    (transaction) =>
      transaction.status === "Failed"
  ).length;

  const recoveredTransactions = transactions.filter(
    (transaction) =>
      transaction.recovery_status === "Recovered"
  ).length;

  const pendingTransactions = transactions.filter(
    (transaction) =>
      transaction.recovery_status === "Not Started" ||
      transaction.recovery_status === "Processing"
  ).length;

  const totalTransactionValue = transactions.reduce(
    (total, transaction) =>
      total + Number(transaction.amount || 0),
    0
  );

  const recoverySuccessRate =
    totalTransactions > 0
      ? Math.round(
          (recoveredTransactions / totalTransactions) * 100
        )
      : 0;

  // Sort by created_at descending and take last 10
  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    })
    .slice(0, 10);

  const statusBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "failed") return "rt-badge rt-badge--failed";
    if (s === "success") return "rt-badge rt-badge--success";
    if (s === "pending") return "rt-badge rt-badge--pending";
    return "rt-badge rt-badge--default";
  };

  const recoveryBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "recovered") return "rt-badge rt-badge--success";
    if (s === "processing") return "rt-badge rt-badge--processing";
    if (s === "not started") return "rt-badge rt-badge--default";
    return "rt-badge rt-badge--default";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="page">

      <section className="welcome-section">

        <div>
          <h2>
            Transaction Recovery Dashboard
          </h2>

          <p>
            Monitor your transactions and manage
            their recovery status.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadTransactions}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "spinning" : ""}
          />

          {loading ? "Refreshing..." : "Refresh"}
        </button>

      </section>

      {error && (
        <div className="message-box error-box">
          <p>{error}</p>
        </div>
      )}

      <section className="stats-grid">

        {/* TOTAL */}

        <div className="stat-card modern-card total-card">

          <div className="stat-card-top">

            <div className="stat-icon total-icon">
              <BarChart3 size={24} />
            </div>

            <span className="stat-label">
              TRANSACTIONS
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              {totalTransactions}
            </h3>

            <p>
              Total Transactions
            </p>

          </div>

          <div className="stat-footer">
            <span>
              All recorded transactions
            </span>
          </div>

        </div>

        {/* FAILED */}

        <div className="stat-card modern-card failed-card">

          <div className="stat-card-top">

            <div className="stat-icon failed-icon">
              <AlertTriangle size={24} />
            </div>

            <span className="stat-label">
              ATTENTION
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              {failedTransactions}
            </h3>

            <p>
              Failed Transactions
            </p>

          </div>

          <div className="stat-footer">
            <span>
              Requires recovery
            </span>
          </div>

        </div>

        {/* RECOVERED */}

        <div className="stat-card modern-card recovered-card">

          <div className="stat-card-top">

            <div className="stat-icon recovered-icon">
              <CheckCircle2 size={24} />
            </div>

            <span className="stat-label">
              SUCCESS
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              {recoveredTransactions}
            </h3>

            <p>
              Recovered
            </p>

          </div>

          <div className="stat-footer">
            <span>
              Successfully recovered
            </span>
          </div>

        </div>

        {/* PENDING */}

        <div className="stat-card modern-card pending-card">

          <div className="stat-card-top">

            <div className="stat-icon pending-icon">
              <Clock3 size={24} />
            </div>

            <span className="stat-label">
              IN PROGRESS
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              {pendingTransactions}
            </h3>

            <p>
              Pending Recovery
            </p>

          </div>

          <div className="stat-footer">
            <span>
              Awaiting recovery
            </span>
          </div>

        </div>

        {/* VALUE */}

        <div className="stat-card modern-card value-card">

          <div className="stat-card-top">

            <div className="stat-icon value-icon">
              <IndianRupee size={24} />
            </div>

            <span className="stat-label">
              VALUE
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              ₹
              {totalTransactionValue.toLocaleString(
                "en-IN"
              )}
            </h3>

            <p>
              Total Transaction Value
            </p>

          </div>

          <div className="stat-footer">
            <span>
              Combined transaction amount
            </span>
          </div>

        </div>

        {/* SUCCESS RATE */}

        <div className="stat-card modern-card rate-card">

          <div className="stat-card-top">

            <div className="stat-icon rate-icon">
              <TrendingUp size={24} />
            </div>

            <span className="stat-label">
              PERFORMANCE
            </span>

          </div>

          <div className="stat-card-content">

            <h3>
              {recoverySuccessRate}%
            </h3>

            <p>
              Recovery Success Rate
            </p>

          </div>

          <div className="stat-footer">
            <span>
              Recovery performance
            </span>
          </div>

        </div>

      </section>

      {/* =========================================================
          RECENT TRANSACTIONS
          ========================================================= */}

      <section className="rt-section">

        <div className="rt-header">

          <div>
            <h3 className="rt-title">
              Recent Transactions
            </h3>
            <p className="rt-subtitle">
              Last {recentTransactions.length} transactions across all channels
            </p>
          </div>

          <span className="rt-count-badge">
            Showing {recentTransactions.length} of {totalTransactions}
          </span>

        </div>

        {loading ? (

          <div className="rt-skeleton-wrap">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rt-skeleton-row">
                <div className="rt-skeleton rt-skeleton--id" />
                <div className="rt-skeleton rt-skeleton--name" />
                <div className="rt-skeleton rt-skeleton--amount" />
                <div className="rt-skeleton rt-skeleton--badge" />
                <div className="rt-skeleton rt-skeleton--badge" />
                <div className="rt-skeleton rt-skeleton--date" />
              </div>
            ))}
          </div>

        ) : recentTransactions.length === 0 ? (

          <div className="rt-empty">
            <CheckCircle2 size={36} />
            <p>No transactions found</p>
          </div>

        ) : (

          <div className="rt-table-wrap">
            <table className="rt-table">

              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Recovery</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {recentTransactions.map((txn) => (
                  <tr key={txn.transaction_id || txn.id}>

                    <td>
                      <span className="rt-txn-id">
                        {txn.transaction_id || txn.id || "—"}
                      </span>
                    </td>

                    <td>
                      <span className="rt-customer">
                        {txn.customer_name || txn.customer || "—"}
                      </span>
                    </td>

                    <td>
                      <span className="rt-amount">
                        ₹{Number(txn.amount || 0).toLocaleString("en-IN")}
                      </span>
                    </td>

                    <td>
                      <span className={statusBadgeClass(txn.status)}>
                        {txn.status || "—"}
                      </span>
                    </td>

                    <td>
                      <span className={recoveryBadgeClass(txn.recovery_status)}>
                        {txn.recovery_status || "Not Started"}
                      </span>
                    </td>

                    <td>
                      <span className="rt-date">
                        {formatDate(txn.created_at)}
                      </span>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        )}

      </section>

      <section className="overview-info">

        <div className="overview-card">

          <div className="overview-card-icon">
            <CheckCircle2 size={25} />
          </div>

          <div>
            <h3>
              Recovery System Active
            </h3>

            <p>
              RecoverAI is monitoring your
              transactions and identifying failed
              payments that may require recovery.
            </p>
          </div>

        </div>

        <div className="overview-card">

          <div className="overview-card-icon">
            <AlertTriangle size={25} />
          </div>

          <div>
            <h3>
              Need assistance?
            </h3>

            <p>
              Visit the AI Assistant section to
              communicate with RecoverAI in multiple
              languages.
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}

export default Overview;