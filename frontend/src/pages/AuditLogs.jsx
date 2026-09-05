import { useEffect, useMemo, useState } from "react";

import {
  ShieldCheck,
  RefreshCw,
  LoaderCircle,
  AlertCircle,
  FileText,
  User,
  Database,
  Clock3,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  Activity,
  History,
} from "lucide-react";

import { getAuditLogs } from "../services/api";
import { exportToCSV } from "../utils/csvExport";
import { useToast } from "../context/ToastContext";


function AuditLogs() {
  const toast = useToast();

  /* =========================================================
     STATE
  ========================================================= */

  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [actionFilter, setActionFilter] = useState("All");

  const [actorFilter, setActorFilter] = useState("All");

  const [sourceFilter, setSourceFilter] = useState("All");

  const [grouped, setGrouped] = useState(true);

  const [expandedTransactions, setExpandedTransactions] = useState({});

  const [selectedLog, setSelectedLog] = useState(null);

  const [showDrawer, setShowDrawer] = useState(false);

  const [aiWhy, setAiWhy] = useState("");

  const [aiLoading, setAiLoading] = useState(false);

  /* =========================================================
     LOAD AUDIT LOGS
  ========================================================= */

  const loadAuditLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getAuditLogs();

      const receivedLogs = Array.isArray(data)
        ? data
        : Array.isArray(data?.logs)
        ? data.logs
        : [];

      setLogs(receivedLogs);
    } catch (err) {
      console.error("Audit logs error:", err);

      const errMsg =
        err.message ||
        "Could not load audit logs. Make sure the backend is running.";

      setError(errMsg);

      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  /* =========================================================
     DATE FORMATTER
  ========================================================= */

  const formatDate = (value) => {
    if (!value) return "—";

    try {
      return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return String(value);
    }
  };

  /* =========================================================
     ACTION CLASS
  ========================================================= */

  const getActionClass = (action = "") => {
    const value = String(action).toLowerCase();

    if (
      value.includes("recover") ||
      value.includes("success") ||
      value.includes("paid") ||
      value.includes("complete")
    ) {
      return "success";
    }

    if (
      value.includes("fail") ||
      value.includes("error") ||
      value.includes("delete")
    ) {
      return "danger";
    }

    if (
      value.includes("update") ||
      value.includes("change") ||
      value.includes("recommend") ||
      value.includes("diagnos")
    ) {
      return "info";
    }

    return "warning";
  };

  /* =========================================================
     ACTION ICON
  ========================================================= */

  const getActionIcon = (action = "") => {
    const value = String(action).toLowerCase();

    if (
      value.includes("recover") ||
      value.includes("success") ||
      value.includes("paid")
    ) {
      return <CheckCircle2 size={15} />;
    }

    if (
      value.includes("fail") ||
      value.includes("error")
    ) {
      return <AlertTriangle size={15} />;
    }

    if (
      value.includes("recommend") ||
      value.includes("ai")
    ) {
      return <Sparkles size={15} />;
    }

    return <Activity size={15} />;
  };

  /* =========================================================
     NORMALIZE LOG
  ========================================================= */

  const normalizeLog = (log) => {
    return {
      ...log,

      id: log.id,

      transaction_id:
        log.transaction_id ||
        log.transactionId ||
        "Unknown",

      action:
        log.action ||
        log.event ||
        "Event",

      actor:
        log.actor ||
        log.user ||
        "System",

      source:
        log.source ||
        "RecoverAI Core",

      description:
        log.description ||
        log.details ||
        "No description available.",

      created_at:
        log.created_at ||
        log.time ||
        log.timestamp ||
        null,

      old_value:
        log.old_value ??
        log.oldValue ??
        null,

      new_value:
        log.new_value ??
        log.newValue ??
        null,
    };
  };

  const normalizedLogs = useMemo(() => {
    return logs.map(normalizeLog);
  }, [logs]);

  /* =========================================================
     UNIQUE FILTER OPTIONS
  ========================================================= */

  const uniqueActions = useMemo(() => {
    return Array.from(
      new Set(
        normalizedLogs
          .map((log) => log.action)
          .filter(Boolean)
      )
    ).sort();
  }, [normalizedLogs]);

  const uniqueActors = useMemo(() => {
    return Array.from(
      new Set(
        normalizedLogs
          .map((log) => log.actor)
          .filter(Boolean)
      )
    ).sort();
  }, [normalizedLogs]);

  const uniqueSources = useMemo(() => {
    return Array.from(
      new Set(
        normalizedLogs
          .map((log) => log.source)
          .filter(Boolean)
      )
    ).sort();
  }, [normalizedLogs]);

  /* =========================================================
     FILTER LOGS
  ========================================================= */

  const filteredLogs = useMemo(() => {
    let result = [...normalizedLogs];

    if (actionFilter !== "All") {
      result = result.filter(
        (log) =>
          String(log.action).toLowerCase() ===
          actionFilter.toLowerCase()
      );
    }

    if (actorFilter !== "All") {
      result = result.filter(
        (log) =>
          String(log.actor).toLowerCase() ===
          actorFilter.toLowerCase()
      );
    }

    if (sourceFilter !== "All") {
      result = result.filter(
        (log) =>
          String(log.source).toLowerCase() ===
          sourceFilter.toLowerCase()
      );
    }

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();

      result = result.filter((log) => {
        return [
          log.id,
          log.transaction_id,
          log.action,
          log.actor,
          log.source,
          log.description,
          log.old_value,
          log.new_value,
        ]
          .filter(
            (value) =>
              value !== null &&
              value !== undefined
          )
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(search)
          );
      });
    }

    return result;
  }, [
    normalizedLogs,
    searchTerm,
    actionFilter,
    actorFilter,
    sourceFilter,
  ]);

  /* =========================================================
     GROUP LOGS BY TRANSACTION
  ========================================================= */

  const groupedLogs = useMemo(() => {
    const groups = {};

    filteredLogs.forEach((log) => {
      const transactionId =
        log.transaction_id || "Unknown Transaction";

      if (!groups[transactionId]) {
        groups[transactionId] = [];
      }

      groups[transactionId].push(log);
    });

    return Object.entries(groups);
  }, [filteredLogs]);

  /* =========================================================
     TOGGLE TRANSACTION GROUP
  ========================================================= */

  const toggleTransaction = (transactionId) => {
    setExpandedTransactions((previous) => ({
      ...previous,
      [transactionId]:
        !previous[transactionId],
    }));
  };

  /* =========================================================
     OPEN DETAIL DRAWER
  ========================================================= */

  const openDrawer = (log) => {
    setSelectedLog(log);

    setAiWhy("");

    setShowDrawer(true);
  };

  /* =========================================================
     CLOSE DRAWER
  ========================================================= */

  const closeDrawer = () => {
    setShowDrawer(false);

    setSelectedLog(null);

    setAiWhy("");

    setAiLoading(false);
  };

  /* =========================================================
     AI WHY
  ========================================================= */

  const generateAIWhy = async () => {
    if (!selectedLog) return;

    setAiLoading(true);

    setAiWhy("");

    try {
      const transactionId =
        selectedLog.transaction_id;

      if (
        !transactionId ||
        transactionId === "Unknown"
      ) {
        throw new Error(
          "No transaction ID is available for this audit event."
        );
      }

      /*
       * Uses the existing diagnosis endpoint
       * already present in your RecoverAI backend.
       */

      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${encodeURIComponent(
          transactionId
        )}/diagnose`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Unable to generate AI explanation."
        );
      }

      /*
       * Different backend responses can use
       * different property names.
       */

      const explanation =
        data?.explanation ||
        data?.diagnosis ||
        data?.reason ||
        data?.message ||
        data?.details ||
        data?.result;

      if (explanation) {
        setAiWhy(String(explanation));
      } else {
        /*
         * Fallback explanation based on audit data.
         */

        setAiWhy(
          `This ${selectedLog.action} event was recorded for transaction ${transactionId}. The event was triggered by ${selectedLog.actor} through ${selectedLog.source}. ${
            selectedLog.description ||
            "The audit record contains no additional explanation."
          }`
        );
      }
    } catch (err) {
      console.error(
        "AI Why error:",
        err
      );

      /*
       * Fallback so the drawer still gives
       * useful information even if AI endpoint
       * is unavailable.
       */

      setAiWhy(
        `The audit event "${selectedLog.action}" was recorded for transaction ${
          selectedLog.transaction_id ||
          "Unknown"
        }. It was triggered by ${
          selectedLog.actor ||
          "System"
        } from ${
          selectedLog.source ||
          "RecoverAI Core"
        }. ${
          selectedLog.description ||
          "No additional explanation is available."
        }`
      );

      toast.info(
        "AI explanation unavailable. Showing audit-based explanation."
      );
    } finally {
      setAiLoading(false);
    }
  };

  /* =========================================================
     EXPORT CSV
  ========================================================= */

  const handleExportCSV = () => {
    if (
      !filteredLogs ||
      filteredLogs.length === 0
    ) {
      toast.info(
        "No audit logs available to export."
      );

      return;
    }

    const columns = [
      {
        key: "id",
        label: "Log ID",
      },

      {
        key: "created_at",
        label: "Timestamp",

        formatter: (val) =>
          val
            ? new Date(val).toLocaleString(
                "en-IN"
              )
            : "—",
      },

      {
        key: "action",
        label: "Action",
      },

      {
        key: "transaction_id",
        label: "Transaction ID",
      },

      {
        key: "actor",
        label: "Actor / Trigger",

        formatter: (val) =>
          val || "System",
      },

      {
        key: "source",
        label: "Source",

        formatter: (val) =>
          val || "RecoverAI Core",
      },

      {
        key: "old_value",
        label: "Old Value",

        formatter: (val) =>
          val ?? "—",
      },

      {
        key: "new_value",
        label: "New Value",

        formatter: (val) =>
          val ?? "—",
      },

      {
        key: "description",
        label: "Details",

        formatter: (val) =>
          val || "—",
      },
    ];

    const dateStr =
      new Date()
        .toISOString()
        .slice(0, 10);

    exportToCSV(
      filteredLogs,
      `audit_logs_${dateStr}.csv`,
      columns
    );

    toast.success(
      "Audit logs exported to CSV successfully."
    );
  };

  /* =========================================================
     RESET FILTERS
  ========================================================= */

  const resetFilters = () => {
    setSearchTerm("");

    setActionFilter("All");

    setActorFilter("All");

    setSourceFilter("All");
  };

  /* =========================================================
     STATISTICS
  ========================================================= */

  const recoveryCount = normalizedLogs.filter(
    (log) =>
      String(log.action)
        .toLowerCase()
        .includes("recover")
  ).length;

  const aiCount = normalizedLogs.filter(
    (log) => {
      const action =
        String(log.action).toLowerCase();

      return (
        action.includes("recommend") ||
        action.includes("ai") ||
        action.includes("diagnos")
      );
    }
  ).length;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="feature-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="feature-page-header">

        <div>

          <div className="feature-title-row">

            <ShieldCheck size={28} />

            <h2>
              Audit Logs
            </h2>

          </div>

          <p>
            Immutable event history of transactions,
            AI recovery triggers, and system audits.
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
            className="feature-action-button"
            onClick={handleExportCSV}
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="feature-refresh-button"
            onClick={loadAuditLogs}
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

            Refresh

          </button>

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (

        <div className="feature-error">

          <AlertCircle size={20} />

          <span>
            {error}
          </span>

        </div>

      )}


      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading && (

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

                  <div className="skeleton-line skeleton-line--sub" />

                </div>

              )
            )}

          </div>

          <div className="feature-table-card">

            <div className="skeleton-table">

              {[1, 2, 3, 4, 5, 6].map(
                (item) => (

                  <div
                    key={item}
                    className="skeleton-table-row"
                  >

                    <div
                      className="skeleton-shimmer skeleton-cell"
                      style={{
                        width: "18%",
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
                        width: "14%",
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

                    <div
                      className="skeleton-shimmer skeleton-cell"
                      style={{
                        width: "15%",
                      }}
                    />

                  </div>

                )
              )}

            </div>

          </div>

        </>

      )}


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      {!loading && !error && (

        <>

          {/* =================================================
              STATISTICS
          ================================================= */}

          <div className="feature-stat-grid">

            <div className="feature-stat-card">

              <span>
                TOTAL AUDIT EVENTS
              </span>

              <strong>
                {logs.length}
              </strong>

            </div>


            <div className="feature-stat-card">

              <span>
                RECOVERY ACTIONS
              </span>

              <strong>
                {recoveryCount}
              </strong>

            </div>


            <div className="feature-stat-card">

              <span>
                AI EVENTS
              </span>

              <strong>
                {aiCount}
              </strong>

            </div>


            <div className="feature-stat-card">

              <span>
                TRANSACTIONS TRACKED
              </span>

              <strong>
                {
                  new Set(
                    normalizedLogs
                      .map(
                        (log) =>
                          log.transaction_id
                      )
                      .filter(Boolean)
                  ).size
                }
              </strong>

            </div>

          </div>


          {/* =================================================
              FILTER CONTROLS
          ================================================= */}

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              marginBottom: 18,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >

              {/* SEARCH */}

              <div
                style={{
                  flex: "1 1 280px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#f8fafc",
                  padding: "9px 13px",
                  borderRadius: 10,
                  border:
                    "1px solid #e2e8f0",
                }}
              >

                <Search
                  size={16}
                  style={{
                    color: "#94a3b8",
                  }}
                />

                <input
                  type="text"
                  placeholder="Search transaction, action, actor, details..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 13,
                    background:
                      "transparent",
                  }}
                />

              </div>


              {/* ACTION */}

              <select
                value={actionFilter}
                onChange={(e) =>
                  setActionFilter(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "9px 12px",
                  borderRadius: 10,
                  border:
                    "1px solid #e2e8f0",
                  background:
                    "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >

                <option value="All">
                  All Actions
                </option>

                {uniqueActions.map(
                  (action) => (

                    <option
                      key={action}
                      value={action}
                    >
                      {action}
                    </option>

                  )
                )}

              </select>


              {/* ACTOR */}

              <select
                value={actorFilter}
                onChange={(e) =>
                  setActorFilter(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "9px 12px",
                  borderRadius: 10,
                  border:
                    "1px solid #e2e8f0",
                  background:
                    "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >

                <option value="All">
                  All Actors
                </option>

                {uniqueActors.map(
                  (actor) => (

                    <option
                      key={actor}
                      value={actor}
                    >
                      {actor}
                    </option>

                  )
                )}

              </select>


              {/* SOURCE */}

              <select
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "9px 12px",
                  borderRadius: 10,
                  border:
                    "1px solid #e2e8f0",
                  background:
                    "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >

                <option value="All">
                  All Sources
                </option>

                {uniqueSources.map(
                  (source) => (

                    <option
                      key={source}
                      value={source}
                    >
                      {source}
                    </option>

                  )
                )}

              </select>


              {/* GROUP BUTTON */}

              <button
                type="button"
                className="feature-refresh-button"
                onClick={() =>
                  setGrouped(
                    (value) => !value
                  )
                }
              >

                <History size={15} />

                {grouped
                  ? "Grouped"
                  : "Flat View"}

              </button>


              {/* RESET */}

              {(searchTerm ||
                actionFilter !==
                  "All" ||
                actorFilter !==
                  "All" ||
                sourceFilter !==
                  "All") && (

                <button
                  type="button"
                  className="feature-refresh-button"
                  onClick={
                    resetFilters
                  }
                >
                  Clear Filters
                </button>

              )}

            </div>

          </div>


          {/* =================================================
              ACTIVITY HISTORY
          ================================================= */}

          <div className="feature-table-card">

            <div className="feature-section-heading">

              <div>

                <h3>
                  Activity History
                </h3>

                <p>
                  Click any event to inspect
                  the complete audit record.
                </p>

              </div>

              <div className="feature-count">

                {filteredLogs.length} of{" "}
                {logs.length} event
                {logs.length === 1
                  ? ""
                  : "s"}

              </div>

            </div>


            {/* EMPTY */}

            {filteredLogs.length === 0 ? (

              <div className="feature-empty">

                <FileText size={34} />

                <h3>
                  No audit events found
                </h3>

                <p>
                  Try changing your search
                  query or filters.
                </p>

              </div>

            ) : grouped ? (

              /* =================================================
                 GROUPED VIEW
              ================================================= */

              <div>

                {groupedLogs.map(
                  ([transactionId, transactionLogs]) => {

                    const isExpanded =
                      expandedTransactions[
                        transactionId
                      ] !== false;

                    return (

                      <div
                        key={
                          transactionId
                        }
                        style={{
                          border:
                            "1px solid #e5e7eb",
                          borderRadius: 12,
                          marginBottom: 12,
                          overflow:
                            "hidden",
                        }}
                      >

                        {/* TRANSACTION HEADER */}

                        <button
                          type="button"
                          onClick={() =>
                            toggleTransaction(
                              transactionId
                            )
                          }
                          style={{
                            width: "100%",
                            border: "none",
                            background:
                              "#f8fafc",
                            padding:
                              "14px 16px",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                          }}
                        >

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 10,
                            }}
                          >

                            {isExpanded ? (
                              <ChevronDown
                                size={18}
                              />
                            ) : (
                              <ChevronRight
                                size={18}
                              />
                            )}

                            <div>

                              <strong>
                                {transactionId}
                              </strong>

                              <div
                                style={{
                                  fontSize:
                                    12,
                                  color:
                                    "#64748b",
                                  marginTop:
                                    3,
                                }}
                              >
                                {
                                  transactionLogs.length
                                }{" "}
                                audit event
                                {transactionLogs.length ===
                                1
                                  ? ""
                                  : "s"}
                              </div>

                            </div>

                          </div>

                          <span className="feature-badge info">
                            <Activity
                              size={13}
                            />

                            Transaction
                              History

                          </span>

                        </button>


                        {/* EVENTS */}

                        {isExpanded && (

                          <div
                            className="responsive-table"
                          >

                            <table
                              className="feature-table"
                              style={{
                                minWidth:
                                  1050,
                              }}
                            >

                              <thead>

                                <tr>

                                  <th>
                                    Time
                                  </th>

                                  <th>
                                    Action
                                  </th>

                                  <th>
                                    Actor
                                  </th>

                                  <th>
                                    Details
                                  </th>

                                  <th>
                                    Source
                                  </th>

                                  <th>
                                    View
                                  </th>

                                </tr>

                              </thead>


                              <tbody>

                                {transactionLogs.map(
                                  (
                                    log,
                                    index
                                  ) => (

                                    <tr
                                      key={
                                        log.id ??
                                        `${transactionId}-${index}`
                                      }
                                    >

                                      <td
                                        style={{
                                          whiteSpace:
                                            "nowrap",
                                        }}
                                      >

                                        <div
                                          style={{
                                            display:
                                              "flex",
                                            alignItems:
                                              "center",
                                            gap: 6,
                                          }}
                                        >

                                          <Clock3
                                            size={
                                              14
                                            }
                                            style={{
                                              color:
                                                "#94a3b8",
                                            }}
                                          />

                                          {formatDate(
                                            log.created_at
                                          )}

                                        </div>

                                      </td>


                                      <td>

                                        <span
                                          className={`feature-badge ${getActionClass(
                                            log.action
                                          )}`}
                                        >

                                          {getActionIcon(
                                            log.action
                                          )}

                                          {
                                            log.action
                                          }

                                        </span>

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
                                            size={
                                              14
                                            }
                                            style={{
                                              color:
                                                "#64748b",
                                            }}
                                          />

                                          {
                                            log.actor
                                          }

                                        </div>

                                      </td>


                                      <td
                                        style={{
                                          maxWidth:
                                            350,
                                          overflow:
                                            "hidden",
                                          textOverflow:
                                            "ellipsis",
                                          whiteSpace:
                                            "nowrap",
                                        }}
                                      >
                                        {
                                          log.description
                                        }
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

                                          <Database
                                            size={
                                              14
                                            }
                                            style={{
                                              color:
                                                "#64748b",
                                            }}
                                          />

                                          {
                                            log.source
                                          }

                                        </div>

                                      </td>


                                      <td>

                                        <button
                                          type="button"
                                          className="feature-action-button"
                                          onClick={() =>
                                            openDrawer(
                                              log
                                            )
                                          }
                                        >
                                          View Details
                                        </button>

                                      </td>

                                    </tr>

                                  )
                                )}

                              </tbody>

                            </table>

                          </div>

                        )}

                      </div>

                    );
                  }
                )}

              </div>

            ) : (

              /* =================================================
                 FLAT VIEW
              ================================================= */

              <div className="responsive-table">

                <table className="feature-table">

                  <thead>

                    <tr>

                      <th>
                        Time
                      </th>

                      <th>
                        Transaction
                      </th>

                      <th>
                        Action
                      </th>

                      <th>
                        Actor
                      </th>

                      <th>
                        Details
                      </th>

                      <th>
                        Source
                      </th>

                      <th>
                        View
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredLogs.map(
                      (log, index) => (

                        <tr
                          key={
                            log.id ??
                            `${log.transaction_id}-${index}`
                          }
                        >

                          <td
                            style={{
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {formatDate(
                              log.created_at
                            )}
                          </td>


                          <td>

                            <strong>
                              {
                                log.transaction_id
                              }
                            </strong>

                          </td>


                          <td>

                            <span
                              className={`feature-badge ${getActionClass(
                                log.action
                              )}`}
                            >

                              {getActionIcon(
                                log.action
                              )}

                              {
                                log.action
                              }

                            </span>

                          </td>


                          <td>

                            {
                              log.actor
                            }

                          </td>


                          <td>

                            {
                              log.description
                            }

                          </td>


                          <td>

                            {
                              log.source
                            }

                          </td>


                          <td>

                            <button
                              type="button"
                              className="feature-action-button"
                              onClick={() =>
                                openDrawer(
                                  log
                                )
                              }
                            >
                              View
                            </button>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </>

      )}


      {/* =====================================================
          DETAIL DRAWER
      ===================================================== */}

      {showDrawer &&
        selectedLog && (

          <div
            onClick={closeDrawer}
            style={{
              position:
                "fixed",
              inset: 0,
              background:
                "rgba(15, 23, 42, 0.45)",
              zIndex: 9999,
              display:
                "flex",
              justifyContent:
                "flex-end",
            }}
          >

            <div
              onClick={(e) =>
                e.stopPropagation()
              }
              style={{
                width:
                  "min(520px, 100vw)",
                height:
                  "100%",
                background:
                  "#ffffff",
                boxShadow:
                  "-10px 0 35px rgba(0,0,0,0.15)",
                display:
                  "flex",
                flexDirection:
                  "column",
              }}
            >

              {/* DRAWER HEADER */}

              <div
                style={{
                  padding:
                    "20px",
                  borderBottom:
                    "1px solid #e5e7eb",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 15,
                }}
              >

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 12,
                  }}
                >

                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius:
                        12,
                      background:
                        "#f1f5f9",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >

                    <ShieldCheck
                      size={22}
                    />

                  </div>

                  <div>

                    <h2
                      style={{
                        margin: 0,
                        fontSize:
                          19,
                      }}
                    >
                      Audit Event
                    </h2>

                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        fontSize:
                          12,
                        color:
                          "#64748b",
                      }}
                    >
                      Complete event details
                    </p>

                  </div>

                </div>


                <button
                  type="button"
                  onClick={
                    closeDrawer
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "#f1f5f9",
                    borderRadius:
                      9,
                    width: 36,
                    height: 36,
                    cursor:
                      "pointer",
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                  }}
                >

                  <X size={18} />

                </button>

              </div>


              {/* DRAWER CONTENT */}

              <div
                style={{
                  padding:
                    "20px",
                  overflowY:
                    "auto",
                  flex: 1,
                }}
              >

                {/* ACTION */}

                <div
                  style={{
                    marginBottom:
                      20,
                  }}
                >

                  <span
                    style={{
                      display:
                        "block",
                      fontSize:
                        10,
                      fontWeight:
                        800,
                      letterSpacing:
                        ".08em",
                      color:
                        "#64748b",
                      marginBottom:
                        8,
                    }}
                  >
                    ACTION
                  </span>

                  <span
                    className={`feature-badge ${getActionClass(
                      selectedLog.action
                    )}`}
                  >

                    {getActionIcon(
                      selectedLog.action
                    )}

                    {
                      selectedLog.action
                    }

                  </span>

                </div>


                {/* TRANSACTION */}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 14,
                    marginBottom:
                      20,
                  }}
                >

                  <div>

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                          10,
                        fontWeight:
                          800,
                        color:
                          "#64748b",
                        letterSpacing:
                          ".06em",
                        marginBottom:
                          6,
                      }}
                    >
                      TRANSACTION ID
                    </span>

                    <strong
                      style={{
                        wordBreak:
                          "break-all",
                      }}
                    >
                      {
                        selectedLog.transaction_id
                      }
                    </strong>

                  </div>


                  <div>

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                          10,
                        fontWeight:
                          800,
                        color:
                          "#64748b",
                        letterSpacing:
                          ".06em",
                        marginBottom:
                          6,
                      }}
                    >
                      LOG ID
                    </span>

                    <strong>
                      {
                        selectedLog.id ??
                        "—"
                      }
                    </strong>

                  </div>

                </div>


                {/* ACTOR + SOURCE */}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 14,
                    marginBottom:
                      20,
                  }}
                >

                  <div>

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                          10,
                        fontWeight:
                          800,
                        color:
                          "#64748b",
                        letterSpacing:
                          ".06em",
                        marginBottom:
                          6,
                      }}
                    >
                      ACTOR
                    </span>

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
                        size={15}
                      />

                      {
                        selectedLog.actor
                      }

                    </div>

                  </div>


                  <div>

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                          10,
                        fontWeight:
                          800,
                        color:
                          "#64748b",
                        letterSpacing:
                          ".06em",
                        marginBottom:
                          6,
                      }}
                    >
                      SOURCE
                    </span>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 6,
                      }}
                    >

                      <Database
                        size={15}
                      />

                      {
                        selectedLog.source
                      }

                    </div>

                  </div>

                </div>


                {/* TIME */}

                <div
                  style={{
                    padding:
                      14,
                    background:
                      "#f8fafc",
                    borderRadius:
                      10,
                    marginBottom:
                      20,
                  }}
                >

                  <span
                    style={{
                      display:
                        "block",
                      fontSize:
                        10,
                      fontWeight:
                        800,
                      color:
                        "#64748b",
                      letterSpacing:
                        ".06em",
                      marginBottom:
                        6,
                    }}
                  >
                    TIMESTAMP
                  </span>

                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 7,
                    }}
                  >

                    <Clock3
                      size={16}
                    />

                    {
                      formatDate(
                        selectedLog.created_at
                      )
                    }

                  </div>

                </div>


                {/* OLD / NEW VALUES */}

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 12,
                    marginBottom:
                      20,
                  }}
                >

                  <div
                    style={{
                      padding:
                        14,
                      border:
                        "1px solid #fee2e2",
                      borderRadius:
                        10,
                      background:
                        "#fffafa",
                    }}
                  >

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                        10,
                        fontWeight:
                          800,
                        color:
                          "#991b1b",
                        marginBottom:
                          7,
                      }}
                    >
                      OLD VALUE
                    </span>

                    <div
                      style={{
                        wordBreak:
                          "break-word",
                        fontSize:
                          13,
                      }}
                    >
                      {selectedLog.old_value ??
                        "—"}
                    </div>

                  </div>


                  <div
                    style={{
                      padding:
                        14,
                      border:
                        "1px solid #dcfce7",
                      borderRadius:
                        10,
                      background:
                        "#f7fff9",
                    }}
                  >

                    <span
                      style={{
                        display:
                          "block",
                        fontSize:
                          10,
                        fontWeight:
                          800,
                        color:
                          "#166534",
                        marginBottom:
                          7,
                      }}
                    >
                      NEW VALUE
                    </span>

                    <div
                      style={{
                        wordBreak:
                          "break-word",
                        fontSize:
                          13,
                      }}
                    >
                      {selectedLog.new_value ??
                        "—"}
                    </div>

                  </div>

                </div>


                {/* DESCRIPTION */}

                <div
                  style={{
                    marginBottom:
                      22,
                  }}
                >

                  <span
                    style={{
                      display:
                        "block",
                      fontSize:
                        10,
                      fontWeight:
                        800,
                      color:
                        "#64748b",
                      letterSpacing:
                        ".06em",
                      marginBottom:
                        8,
                    }}
                  >
                    DESCRIPTION
                  </span>

                  <div
                    style={{
                      padding:
                        14,
                      background:
                        "#f8fafc",
                      borderRadius:
                        10,
                      fontSize:
                        13,
                      lineHeight:
                        1.6,
                    }}
                  >
                    {
                      selectedLog.description
                    }
                  </div>

                </div>


                {/* =================================================
                    AI WHY
                ================================================= */}

                <div
                  style={{
                    border:
                      "1px solid #dbeafe",
                    borderRadius:
                      14,
                    overflow:
                      "hidden",
                    marginTop:
                      10,
                  }}
                >

                  <div
                    style={{
                      padding:
                        "14px 16px",
                      background:
                        "#eff6ff",
                      display:
                        "flex",
                        alignItems:
                        "center",
                        gap: 9,
                    }}
                  >

                    <Sparkles
                      size={18}
                    />

                    <div>

                      <strong>
                        AI Why
                      </strong>

                      <div
                        style={{
                          fontSize:
                            11,
                          color:
                            "#64748b",
                          marginTop:
                            2,
                        }}
                      >
                        Understand why this
                        event occurred
                      </div>

                    </div>

                  </div>


                  <div
                    style={{
                      padding:
                        16,
                    }}
                  >

                    {!aiWhy &&
                      !aiLoading && (

                        <button
                          type="button"
                          className="feature-action-button"
                          onClick={
                            generateAIWhy
                          }
                          style={{
                            width:
                              "100%",
                            padding:
                              "12px",
                            justifyContent:
                              "center",
                          }}
                        >

                          <Sparkles
                            size={16}
                          />

                          Explain with AI

                        </button>

                      )}


                    {aiLoading && (

                      <div
                        style={{
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          gap: 10,
                          padding:
                            "15px 5px",
                          textAlign:
                            "center",
                        }}
                      >

                        <LoaderCircle
                          size={25}
                          className="spin"
                        />

                        <strong>
                          AI is analyzing
                          this event...
                        </strong>

                        <span
                          style={{
                            fontSize:
                              12,
                            color:
                              "#64748b",
                          }}
                        >
                          Reviewing transaction
                          history and audit
                          information.
                        </span>

                      </div>

                    )}


                    {aiWhy &&
                      !aiLoading && (

                        <div>

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "flex-start",
                              gap: 9,
                              lineHeight:
                                1.6,
                              fontSize:
                                13,
                            }}
                          >

                            <Sparkles
                              size={17}
                              style={{
                                flexShrink:
                                  0,
                                marginTop:
                                  3,
                              }}
                            />

                            <span>
                              {aiWhy}
                            </span>

                          </div>


                          <button
                            type="button"
                            className="feature-refresh-button"
                            onClick={
                              generateAIWhy
                            }
                            style={{
                              marginTop:
                                14,
                              width:
                                "100%",
                            }}
                          >

                            <RefreshCw
                              size={14}
                            />

                            Regenerate Explanation

                          </button>

                        </div>

                    )}

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}

export default AuditLogs;