import { useEffect, useMemo, useState } from "react";

import {
  TrendingUp,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  ShieldAlert,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  Sparkles,
  Activity,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { getTransactions } from "../services/api";

// =========================================================
// COLORS
// =========================================================

const STATUS_COLORS = {
  Success: "#10b981",
  Paid: "#10b981",
  Failed: "#ef4444",
  Pending: "#f59e0b",
};

const RECOVERY_COLORS = {
  Recovered: "#10b981",
  Processing: "#3b82f6",
  "Not Started": "#94a3b8",
  "Promise to Pay": "#8b5cf6",
  Failed: "#ef4444",
};

const PALETTE = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

// =========================================================
// HELPERS
// =========================================================

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatINR(value) {
  const amount = safeNumber(value);

  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactINR(value) {
  const amount = safeNumber(value);

  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }

  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(amount)}`;
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// =========================================================
// NORMALIZE VALUES
// =========================================================

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (status === "paid" || status === "success" || status === "successful") {
    return "Success";
  }

  if (status === "failed" || status === "failure") {
    return "Failed";
  }

  if (status === "pending" || status === "processing") {
    return "Pending";
  }

  return value ? String(value).trim() : "Pending";
}

function normalizeRecoveryStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (status === "recovered" || status === "resolved") {
    return "Recovered";
  }

  if (status === "processing" || status === "in progress") {
    return "Processing";
  }

  if (
    status === "promise to pay" ||
    status === "promise_to_pay" ||
    status === "promisetopay" ||
    status === "ptp"
  ) {
    return "Promise to Pay";
  }

  if (status === "failed" || status === "failure") {
    return "Failed";
  }

  return "Not Started";
}

// =========================================================
// TOOLTIP
// =========================================================

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="analytics-tooltip">
      {label && (
        <p className="analytics-tooltip-label">{label}</p>
      )}

      {payload.map((entry, index) => (
        <div
          key={`tooltip-item-${index}`}
          className="analytics-tooltip-row"
        >
          <span
            className="analytics-tooltip-dot"
            style={{
              backgroundColor:
                entry.color ||
                entry.payload?.fill ||
                "#3b82f6",
            }}
          />

          <span className="analytics-tooltip-name">
            {entry.name}:
          </span>

          <strong className="analytics-tooltip-val">
            {entry.dataKey === "transactionCount"
              ? entry.value
              : formatINR(entry.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

// =========================================================
// DONUT TOOLTIP
// =========================================================

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0];

  return (
    <div className="analytics-tooltip">
      <div className="analytics-tooltip-row">
        <span
          className="analytics-tooltip-dot"
          style={{
            backgroundColor:
              data.payload?.fill || "#3b82f6",
          }}
        />

        <span className="analytics-tooltip-name">
          {data.name}:
        </span>

        <strong className="analytics-tooltip-val">
          {data.value} {data.value === 1 ? "txn" : "txns"}
        </strong>
      </div>

      {data.payload?.percent !== undefined && (
        <div
          className="analytics-tooltip-row"
          style={{ marginTop: 4 }}
        >
          <span className="analytics-tooltip-name">
            Share:
          </span>

          <strong className="analytics-tooltip-val">
            {(data.payload.percent * 100).toFixed(1)}%
          </strong>
        </div>
      )}

      {data.payload?.amount !== undefined && (
        <div
          className="analytics-tooltip-row"
          style={{ marginTop: 4 }}
        >
          <span
            className="analytics-tooltip-name"
            style={{ color: "#64748b" }}
          >
            Volume:
          </span>

          <strong
            className="analytics-tooltip-val"
            style={{ color: "#0f172a" }}
          >
            {formatINR(data.payload.amount)}
          </strong>
        </div>
      )}
    </div>
  );
}

// =========================================================
// ANALYTICS
// =========================================================

function Analytics() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =======================================================
  // LOAD DATA
  // =======================================================

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
    } catch (err) {
      console.error("Analytics loading error:", err);

      setError(
        "Failed to load analytics data. Make sure backend is connected."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // =======================================================
  // KPI CALCULATIONS
  // =======================================================

  const metrics = useMemo(() => {
    const totalTxns = transactions.length;

    const totalVol = transactions.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    // Normalize statuses once so Paid/Success are treated equally.
    const normalizedTransactions = transactions.map(
      (transaction) => ({
        ...transaction,
        normalizedStatus: normalizeStatus(
          transaction.status
        ),
        normalizedRecoveryStatus:
          normalizeRecoveryStatus(
            transaction.recovery_status
          ),
      })
    );

    // -------------------------------------------------------
    // TRANSACTION STATUS
    // -------------------------------------------------------

    const successfulList = normalizedTransactions.filter(
      (transaction) =>
        transaction.normalizedStatus === "Success"
    );

    const failedList = normalizedTransactions.filter(
      (transaction) =>
        transaction.normalizedStatus === "Failed"
    );

    const pendingList = normalizedTransactions.filter(
      (transaction) =>
        transaction.normalizedStatus === "Pending"
    );

    const successfulCount = successfulList.length;
    const failedCount = failedList.length;
    const pendingCount = pendingList.length;

    const successfulVol = successfulList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    const failedVol = failedList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    const pendingVol = pendingList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    // -------------------------------------------------------
    // RECOVERY STATUS
    // -------------------------------------------------------

    const recoveredList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedRecoveryStatus ===
          "Recovered"
      );

    const processingList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedRecoveryStatus ===
          "Processing"
      );

    const promiseToPayList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedRecoveryStatus ===
          "Promise to Pay"
      );

    const recoveryFailedList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedRecoveryStatus ===
          "Failed"
      );

    const notStartedList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedRecoveryStatus ===
          "Not Started"
      );

    const recoveredCount = recoveredList.length;

    const recoveredVol = recoveredList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    const processingVol = processingList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    const promiseToPayVol = promiseToPayList.reduce(
      (sum, transaction) =>
        sum + safeNumber(transaction.amount),
      0
    );

    // -------------------------------------------------------
    // REAL RECOVERY RATE
    // -------------------------------------------------------
    //
    // A recovery rate must NOT be:
    //
    // recovered / currently failed
    //
    // That caused the previous 450%.
    //
    // Instead, count transactions that actually entered
    // a recovery workflow:
    //
    // Recovered + Processing + Promise to Pay + Recovery Failed
    //
    // Not Started is excluded because no recovery workflow
    // has started for those transactions.
    // -------------------------------------------------------

    const recoveryAttemptedCount =
      recoveredList.length +
      processingList.length +
      promiseToPayList.length +
      recoveryFailedList.length;

    const recoveryRate =
      recoveryAttemptedCount > 0
        ? Math.round(
            (recoveredCount /
              recoveryAttemptedCount) *
              100
          )
        : 0;

    // -------------------------------------------------------
    // CURRENT AT-RISK VALUE
    // -------------------------------------------------------
    //
    // Only unresolved failed transactions are at risk.
    // Recovered transactions are NOT counted as risk.
    // -------------------------------------------------------

    const currentFailedList =
      normalizedTransactions.filter(
        (transaction) =>
          transaction.normalizedStatus === "Failed" &&
          transaction.normalizedRecoveryStatus !==
            "Recovered"
      );

    const currentFailedCount =
      currentFailedList.length;

    const currentFailedVol =
      currentFailedList.reduce(
        (sum, transaction) =>
          sum + safeNumber(transaction.amount),
        0
      );

    // -------------------------------------------------------
    // AVERAGES
    // -------------------------------------------------------

    const avgTxnValue =
      totalTxns > 0
        ? Math.round(totalVol / totalTxns)
        : 0;

    const avgRecovered =
      recoveredCount > 0
        ? Math.round(
            recoveredVol / recoveredCount
          )
        : 0;

    const recoveryAttemptedVol =
      recoveredVol +
      processingVol +
      promiseToPayVol +
      recoveryFailedList.reduce(
        (sum, transaction) =>
          sum + safeNumber(transaction.amount),
        0
      );

    const recoveryValueRate =
      recoveryAttemptedVol > 0
        ? Math.round(
            (recoveredVol /
              recoveryAttemptedVol) *
              100
          )
        : 0;

    return {
      totalTxns,
      totalVol,

      successfulCount,
      successfulVol,

      failedCount,
      failedVol,

      pendingCount,
      pendingVol,

      recoveredCount,
      recoveredVol,

      processingCount: processingList.length,
      processingVol,

      promiseToPayCount:
        promiseToPayList.length,
      promiseToPayVol,

      recoveryFailedCount:
        recoveryFailedList.length,

      notStartedCount:
        notStartedList.length,

      recoveryAttemptedCount,

      recoveryRate,
      recoveryValueRate,

      avgTxnValue,
      avgRecovered,

      currentFailedCount,
      currentFailedVol,
    };
  }, [transactions]);

  // =======================================================
  // REVENUE TRAJECTORY
  // =======================================================

  const trendChartData = useMemo(() => {
    if (!transactions.length) {
      return [];
    }

    const sortedTransactions = [...transactions].sort(
      (a, b) => {
        const dateA =
          parseDate(a.created_at)?.getTime() || 0;

        const dateB =
          parseDate(b.created_at)?.getTime() || 0;

        return dateA - dateB;
      }
    );

    let totalProcessed = 0;
    let recovered = 0;
    let failed = 0;

    const allPoints = [];

    sortedTransactions.forEach(
      (transaction, index) => {
        const amount = safeNumber(
          transaction.amount
        );

        const status = normalizeStatus(
          transaction.status
        );

        const recoveryStatus =
          normalizeRecoveryStatus(
            transaction.recovery_status
          );

        totalProcessed += amount;

        if (recoveryStatus === "Recovered") {
          recovered += amount;
        }

        // Only unresolved failed amount contributes
        // to the failed/risk trajectory.
        if (
          status === "Failed" &&
          recoveryStatus !== "Recovered"
        ) {
          failed += amount;
        }

        allPoints.push({
          label: `Txn ${index + 1}`,
          totalVol: totalProcessed,
          recoveredVol: recovered,
          failedVol: failed,
          transactionCount: index + 1,
        });
      }
    );

    // Keep the beginning and end plus evenly spaced points.
    const MAX_POINTS = 12;

    if (allPoints.length <= MAX_POINTS) {
      return allPoints;
    }

    const selectedPoints = [];

    const step =
      (allPoints.length - 1) /
      (MAX_POINTS - 1);

    for (let i = 0; i < MAX_POINTS; i++) {
      const index = Math.round(i * step);

      selectedPoints.push(
        allPoints[index]
      );
    }

    return selectedPoints;
  }, [transactions]);

  // =======================================================
  // RECOVERY DONUT
  // =======================================================

  const recoveryDonutData = useMemo(() => {
    const counts = {
      Recovered: {
        count: 0,
        amount: 0,
      },
      Processing: {
        count: 0,
        amount: 0,
      },
      "Promise to Pay": {
        count: 0,
        amount: 0,
      },
      "Not Started": {
        count: 0,
        amount: 0,
      },
      Failed: {
        count: 0,
        amount: 0,
      },
    };

    transactions.forEach((transaction) => {
      const status = normalizeRecoveryStatus(
        transaction.recovery_status
      );

      if (!counts[status]) {
        counts[status] = {
          count: 0,
          amount: 0,
        };
      }

      counts[status].count += 1;

      counts[status].amount += safeNumber(
        transaction.amount
      );
    });

    const total =
      transactions.length || 1;

    return Object.keys(counts)
      .filter(
        (key) =>
          counts[key].count > 0
      )
      .map((key) => ({
        name: key,
        value: counts[key].count,
        amount: counts[key].amount,
        percent:
          counts[key].count / total,
        fill:
          RECOVERY_COLORS[key] ||
          "#94a3b8",
      }));
  }, [transactions]);

  // =======================================================
  // TRANSACTION STATUS DONUT
  // =======================================================

  const statusDonutData = useMemo(() => {
    const counts = {
      Success: {
        count: 0,
        amount: 0,
      },
      Failed: {
        count: 0,
        amount: 0,
      },
      Pending: {
        count: 0,
        amount: 0,
      },
    };

    transactions.forEach((transaction) => {
      const status = normalizeStatus(
        transaction.status
      );

      if (!counts[status]) {
        counts[status] = {
          count: 0,
          amount: 0,
        };
      }

      counts[status].count += 1;

      counts[status].amount += safeNumber(
        transaction.amount
      );
    });

    const total =
      transactions.length || 1;

    return Object.keys(counts)
      .filter(
        (key) =>
          counts[key].count > 0
      )
      .map((key) => ({
        name: key,
        value: counts[key].count,
        amount: counts[key].amount,
        percent:
          counts[key].count / total,
        fill:
          STATUS_COLORS[key] ||
          "#94a3b8",
      }));
  }, [transactions]);

  // =======================================================
  // FAILURE REASONS
  // =======================================================

  const failureReasonData = useMemo(() => {
    const reasons = {};

    transactions
      .filter(
        (transaction) =>
          normalizeStatus(
            transaction.status
          ) === "Failed" &&
          normalizeRecoveryStatus(
            transaction.recovery_status
          ) !== "Recovered"
      )
      .forEach((transaction) => {
        const reason =
          transaction.failure_reason ||
          transaction.root_cause ||
          transaction.error_message ||
          "Unspecified Error";

        const cleanReason = String(reason).trim();

        const shortReason =
          cleanReason.length > 28
            ? cleanReason.substring(0, 26) + "..."
            : cleanReason;

        if (!reasons[shortReason]) {
          reasons[shortReason] = {
            reason: shortReason,
            count: 0,
            amount: 0,
          };
        }

        reasons[shortReason].count += 1;

        reasons[shortReason].amount +=
          safeNumber(
            transaction.amount
          );
      });

    return Object.values(reasons)
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, 6);
  }, [transactions]);

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="page analytics-page">

      {/* HEADER */}

      <section className="section-header analytics-header">
        <div>

          <div className="analytics-title-badge">
            <Sparkles size={16} />

            <span>
              AI PERFORMANCE DASHBOARD
            </span>
          </div>

          <h2>
            Transaction & Recovery Analytics
          </h2>

          <p>
            Real-time financial telemetry,
            recovery performance, and
            transaction risk analysis.
          </p>

        </div>

        <button
          className="refresh-button"
          onClick={loadTransactions}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={
              loading ? "spinning" : ""
            }
          />

          {loading
            ? "Refreshing..."
            : "Refresh Telemetry"}
        </button>

      </section>

      {/* ERROR */}

      {error && (
        <div className="message-box error-box">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* KPI CARDS */}

      <section className="analytics-kpi-grid">

        {/* REVENUE RECOVERED */}

        <div className="analytics-kpi-card highlight-card">

          <div className="analytics-kpi-header">

            <div className="analytics-kpi-icon icon-success">
              <IndianRupee size={22} />
            </div>

            <span className="analytics-badge badge-success">

              <ArrowUpRight size={14} />

              {metrics.recoveryRate}% Recovery

            </span>

          </div>

          <div className="analytics-kpi-body">

            <span className="analytics-kpi-label">
              TOTAL REVENUE RECOVERED
            </span>

            <h3 className="analytics-kpi-value value-emerald">
              {formatINR(
                metrics.recoveredVol
              )}
            </h3>

            <p className="analytics-kpi-sub">

              <strong>
                {metrics.recoveredCount}
              </strong>{" "}
              recovered out of{" "}
              <strong>
                {metrics.recoveryAttemptedCount}
              </strong>{" "}
              recovery cases

            </p>

          </div>

          <div className="analytics-kpi-progress">

            <div
              className="analytics-kpi-progress-bar"
              style={{
                width: `${Math.min(
                  metrics.recoveryRate,
                  100
                )}%`,
              }}
            />

          </div>

        </div>

        {/* TOTAL VOLUME */}

        <div className="analytics-kpi-card">

          <div className="analytics-kpi-header">

            <div className="analytics-kpi-icon icon-primary">
              <Layers size={22} />
            </div>

            <span className="analytics-badge badge-neutral">
              {metrics.totalTxns} Total Txns
            </span>

          </div>

          <div className="analytics-kpi-body">

            <span className="analytics-kpi-label">
              TOTAL TRANSACTION VOLUME
            </span>

            <h3 className="analytics-kpi-value">
              {formatINR(
                metrics.totalVol
              )}
            </h3>

            <p className="analytics-kpi-sub">

              Average transaction value:{" "}

              <strong>
                {formatINR(
                  metrics.avgTxnValue
                )}
              </strong>

            </p>

          </div>

        </div>

        {/* RECOVERY RATE */}

        <div className="analytics-kpi-card">

          <div className="analytics-kpi-header">

            <div className="analytics-kpi-icon icon-info">
              <Activity size={22} />
            </div>

            <span className="analytics-badge badge-info">
              Efficiency
            </span>

          </div>

          <div className="analytics-kpi-body">

            <span className="analytics-kpi-label">
              RECOVERY SUCCESS RATE
            </span>

            <h3 className="analytics-kpi-value">

              {metrics.recoveryRate}

              <span className="analytics-unit">
                %
              </span>

            </h3>

            <p className="analytics-kpi-sub">

              {metrics.recoveredCount} recovered from{" "}
              {metrics.recoveryAttemptedCount} cases

            </p>

          </div>

        </div>

        {/* CURRENT AT RISK */}

        <div className="analytics-kpi-card">

          <div className="analytics-kpi-header">

            <div className="analytics-kpi-icon icon-danger">
              <ShieldAlert size={22} />
            </div>

            <span className="analytics-badge badge-danger">
              {metrics.currentFailedCount} At Risk
            </span>

          </div>

          <div className="analytics-kpi-body">

            <span className="analytics-kpi-label">
              CURRENT AT-RISK VALUE
            </span>

            <h3 className="analytics-kpi-value value-rose">
              {formatINR(
                metrics.currentFailedVol
              )}
            </h3>

            <p className="analytics-kpi-sub">

              Currently unresolved failed transactions:{" "}
              <strong>
                {metrics.currentFailedCount}
              </strong>

            </p>

          </div>

        </div>

      </section>

      {/* CHART GRID */}

      <div className="analytics-charts-grid">

        {/* RECOVERY STATUS */}

        <div className="analytics-chart-card">

          <div className="chart-card-header">

            <div>

              <h3>
                Recovery Status Breakdown
              </h3>

              <p>
                Current state of transactions
                in the recovery workflow
              </p>

            </div>

            <div className="chart-header-icon">
              <PieIcon size={20} />
            </div>

          </div>

          <div className="analytics-donut-wrap">

            {recoveryDonutData.length > 0 ? (

              <div className="analytics-donut-container">

                <ResponsiveContainer
                  width="100%"
                  height={260}
                >

                  <PieChart>

                    <Tooltip
                      content={
                        <DonutTooltip />
                      }
                    />

                    <Pie
                      data={
                        recoveryDonutData
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >

                      {recoveryDonutData.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-rec-${index}`}
                            fill={entry.fill}
                            stroke="none"
                          />
                        )
                      )}

                    </Pie>

                  </PieChart>

                </ResponsiveContainer>

                <div className="donut-center-label">

                  <span className="donut-center-num">
                    {metrics.recoveredCount}
                  </span>

                  <span className="donut-center-text">
                    Recovered
                  </span>

                </div>

              </div>

            ) : (

              <div className="chart-empty">
                No recovery status records
              </div>

            )}

            <div className="analytics-legend">

              {recoveryDonutData.map(
                (item) => (
                  <div
                    key={item.name}
                    className="analytics-legend-item"
                  >

                    <div className="analytics-legend-left">

                      <span
                        className="analytics-legend-pill"
                        style={{
                          backgroundColor:
                            item.fill,
                        }}
                      />

                      <span className="analytics-legend-name">
                        {item.name}
                      </span>

                    </div>

                    <div className="analytics-legend-right">

                      <strong>
                        {item.value}
                      </strong>

                      <span className="analytics-legend-pct">
                        (
                        {(
                          item.percent *
                          100
                        ).toFixed(0)}
                        %)
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        </div>

        {/* TRANSACTION STATUS */}

        <div className="analytics-chart-card">

          <div className="chart-card-header">

            <div>

              <h3>
                Transaction Status Distribution
              </h3>

              <p>
                Current status of all transactions
              </p>

            </div>

            <div className="chart-header-icon">
              <BarChart3 size={20} />
            </div>

          </div>

          <div className="analytics-donut-wrap">

            {statusDonutData.length > 0 ? (

              <div className="analytics-donut-container">

                <ResponsiveContainer
                  width="100%"
                  height={260}
                >

                  <PieChart>

                    <Tooltip
                      content={
                        <DonutTooltip />
                      }
                    />

                    <Pie
                      data={
                        statusDonutData
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >

                      {statusDonutData.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-status-${index}`}
                            fill={entry.fill}
                            stroke="none"
                          />
                        )
                      )}

                    </Pie>

                  </PieChart>

                </ResponsiveContainer>

                <div className="donut-center-label">

                  <span className="donut-center-num">
                    {metrics.totalTxns}
                  </span>

                  <span className="donut-center-text">
                    Total Txns
                  </span>

                </div>

              </div>

            ) : (

              <div className="chart-empty">
                No transaction status records
              </div>

            )}

            <div className="analytics-legend">

              {statusDonutData.map(
                (item) => (
                  <div
                    key={item.name}
                    className="analytics-legend-item"
                  >

                    <div className="analytics-legend-left">

                      <span
                        className="analytics-legend-pill"
                        style={{
                          backgroundColor:
                            item.fill,
                        }}
                      />

                      <span className="analytics-legend-name">
                        {item.name}
                      </span>

                    </div>

                    <div className="analytics-legend-right">

                      <strong>
                        {item.value}
                      </strong>

                      <span className="analytics-legend-pct">
                        (
                        {(
                          item.percent *
                          100
                        ).toFixed(0)}
                        %)
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        </div>

        {/* REVENUE TRAJECTORY */}

        <div className="analytics-chart-card full-chart">

          <div className="chart-card-header">

            <div>

              <h3>
                Transaction & Recovery Value Trajectory (₹)
              </h3>

              <p>
                Cumulative processed, recovered,
                and currently at-risk transaction value
              </p>

            </div>

            <div className="chart-header-icon">
              <TrendingUp size={20} />
            </div>

          </div>

          <div
            className="chart-container"
            style={{
              minHeight: 360,
              width: "100%",
              overflow: "hidden",
            }}
          >

            {trendChartData.length > 0 ? (

              <ResponsiveContainer
                width="100%"
                height={340}
              >

                <AreaChart
                  data={trendChartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 20,
                  }}
                >

                  <defs>

                    <linearGradient
                      id="analyticsTotalGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.22}
                      />

                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0}
                      />
                    </linearGradient>

                    <linearGradient
                      id="analyticsRecoveredGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.28}
                      />

                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0}
                      />
                    </linearGradient>

                    <linearGradient
                      id="analyticsFailedGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#ef4444"
                        stopOpacity={0.18}
                      />

                      <stop
                        offset="95%"
                        stopColor="#ef4444"
                        stopOpacity={0}
                      />
                    </linearGradient>

                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                    axisLine={{
                      stroke: "#e2e8f0",
                    }}
                    tickLine={false}
                    minTickGap={30}
                  />

                  <YAxis
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                    axisLine={{
                      stroke: "#e2e8f0",
                    }}
                    tickLine={false}
                    width={80}
                    tickFormatter={
                      formatCompactINR
                    }
                  />

                  <Tooltip
                    content={
                      <CustomTooltip />
                    }
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{
                      paddingBottom: 18,
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="totalVol"
                    name="Total Processed"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#analyticsTotalGradient)"
                    fillOpacity={1}
                    dot={{ r: 4 }}
                    activeDot={{ r: 7 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="recoveredVol"
                    name="Revenue Recovered"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#analyticsRecoveredGradient)"
                    fillOpacity={1}
                    dot={{ r: 4 }}
                    activeDot={{ r: 7 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="failedVol"
                    name="Current At-Risk Value"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    fill="url(#analyticsFailedGradient)"
                    fillOpacity={1}
                    dot={{ r: 4 }}
                    activeDot={{ r: 7 }}
                  />

                </AreaChart>

              </ResponsiveContainer>

            ) : (

              <div className="chart-empty">

                {loading
                  ? "Loading transaction telemetry..."
                  : "No transaction data available"}

              </div>

            )}

          </div>

        </div>

        {/* FAILURE REASONS */}

        <div className="analytics-chart-card full-chart">

          <div className="chart-card-header">

            <div>

              <h3>
                Failure Reason Diagnostic Analysis
              </h3>

              <p>
                Most common unresolved failure
                reasons in the current dataset
              </p>

            </div>

            <div className="chart-header-icon">
              <CheckCircle2 size={20} />
            </div>

          </div>

          <div className="chart-container">

            {failureReasonData.length > 0 ? (

              <ResponsiveContainer
                width="100%"
                height={320}
              >

                <BarChart
                  data={failureReasonData}
                  margin={{
                    top: 15,
                    right: 20,
                    left: 10,
                    bottom: 55,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="reason"
                    tick={{
                      fill: "#64748b",
                      fontSize: 11,
                    }}
                    axisLine={{
                      stroke: "#e2e8f0",
                    }}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                    axisLine={{
                      stroke: "#e2e8f0",
                    }}
                    tickLine={false}
                  />

                  <Tooltip
                    content={
                      <CustomTooltip />
                    }
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{
                      paddingBottom: 12,
                    }}
                  />

                  <Bar
                    dataKey="count"
                    name="Unresolved Incidents"
                    fill="#6366f1"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  >

                    {failureReasonData.map(
                      (_, index) => (
                        <Cell
                          key={`cell-bar-${index}`}
                          fill={
                            PALETTE[
                              index %
                                PALETTE.length
                            ]
                          }
                        />
                      )
                    )}

                  </Bar>

                </BarChart>

              </ResponsiveContainer>

            ) : (

              <div className="chart-empty">
                No unresolved failure diagnostic logs found
              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default Analytics;
