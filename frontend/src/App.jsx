import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  LogOut,
  X,
  Bot,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  LoaderCircle,
  MessageCircle,
  Mic,
  CheckCircle2,
} from "lucide-react";

/* =========================================================
   LOGIN
========================================================= */

import Login from "./Login";

/* =========================================================
   NAVBAR
========================================================= */

import Navbar from "./components/Navbar";

/* =========================================================
   EXISTING PAGES
========================================================= */

import Overview from "./pages/Overview";
import Analytics from "./pages/Analytics";
import FailedTransactions from "./pages/FailedTransactions";
import AIAssistant from "./pages/AIAssistant";
import AuditLogs from "./pages/AuditLogs";
import B2BReceivables from "./pages/B2BReceivables";
import PromiseToPayTracker from "./pages/PromiseToPayTracker";
import VoiceRecovery from "./pages/VoiceRecovery";

/* =========================================================
   RECOVERY FEATURES
========================================================= */

import CheckoutDropoffRecovery from "./pages/CheckoutDropoffRecovery";
import FailedSubscriptionRecovery from "./pages/FailedSubscriptionRecovery";

/* =========================================================
   API SERVICES
========================================================= */

import {
  checkBackend,
  getRecoveryRecommendation,
} from "./services/api";

/* =========================================================
   GLOBAL CSS
========================================================= */

import "./App.css";


/* =========================================================
   AUDIT LOG HELPER

   Stores frontend/manual actions locally so the Audit Logs
   page can read them immediately.
========================================================= */

const addAuditLog = ({
  action,
  transactionId = null,
  channel = null,
  details = "",
  status = "Success",
}) => {
  try {
    const existingLogs = JSON.parse(
      localStorage.getItem("recoverai_audit_logs") || "[]"
    );

    const newLog = {
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      transaction_id: transactionId,
      channel,
      details,
      status,
      source: "RecoverAI",
    };

    localStorage.setItem(
      "recoverai_audit_logs",
      JSON.stringify([newLog, ...existingLogs])
    );

    // Notify other components/pages immediately.
    window.dispatchEvent(
      new CustomEvent("recoverai-audit-log", {
        detail: newLog,
      })
    );

    return newLog;
  } catch (error) {
    console.error("Unable to create audit log:", error);
    return null;
  }
};


/* =========================================================
   AI ASSISTANT HUB

   Combines:
   1. AI Chat Assistant
   2. Voice Recovery
========================================================= */

function AIAssistantHub() {
  const [activeMode, setActiveMode] = useState("chat");

  return (
    <div className="feature-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="feature-page-header">

        <div>

          <div className="feature-title-row">

            <Bot size={28} />

            <h2>
              AI Assistant
            </h2>

          </div>

          <p>
            Intelligent customer support and voice-based
            transaction recovery.
          </p>

        </div>


        {/* MODE BADGE */}

        <div
          className={`feature-badge ${
            activeMode === "voice"
              ? "danger"
              : "info"
          }`}
        >
          {activeMode === "voice"
            ? "● Voice Recovery"
            : "● AI Chat"}
        </div>

      </div>


      {/* =====================================================
          MODE SELECTOR
      ===================================================== */}

      <div
        className="ai-mode-selector"
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          padding: 6,
          background: "#f1f5f9",
          borderRadius: 12,
          width: "fit-content",
        }}
      >

        {/* CHAT */}

        <button
          type="button"
          className={`ai-mode-button ${
            activeMode === "chat"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveMode("chat");

            addAuditLog({
              action: "AI Assistant Mode Changed",
              channel: "AI Chat",
              details:
                "User switched to AI Chat Assistant.",
            });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            background:
              activeMode === "chat"
                ? "#111827"
                : "transparent",
            color:
              activeMode === "chat"
                ? "#ffffff"
                : "#475569",
          }}
        >

          <MessageCircle size={16} />

          Chat Assistant

        </button>


        {/* VOICE */}

        <button
          type="button"
          className={`ai-mode-button ${
            activeMode === "voice"
              ? "active"
              : ""
          }`}
          onClick={() => {
            setActiveMode("voice");

            addAuditLog({
              action: "AI Assistant Mode Changed",
              channel: "Voice Recovery",
              details:
                "User switched to Voice Recovery.",
            });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            background:
              activeMode === "voice"
                ? "#111827"
                : "transparent",
            color:
              activeMode === "voice"
                ? "#ffffff"
                : "#475569",
          }}
        >

          <Mic size={16} />

          Voice Recovery

        </button>

      </div>


      {/* =====================================================
          CHAT ASSISTANT
      ===================================================== */}

      {activeMode === "chat" && (
        <div>
          <AIAssistant />
        </div>
      )}


      {/* =====================================================
          VOICE RECOVERY
      ===================================================== */}

      {activeMode === "voice" && (
        <div>
          <VoiceRecovery />
        </div>
      )}

    </div>
  );
}


/* =========================================================
   MAIN APP
========================================================= */

function App() {

  /* =========================================================
     LOGIN
  ========================================================= */

  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      localStorage.getItem(
        "recoverai_logged_in"
      ) === "true"
  );


  /* =========================================================
     BACKEND STATUS
  ========================================================= */

  const [backendStatus, setBackendStatus] =
    useState("Checking...");


  /* =========================================================
     AI DRAWER
  ========================================================= */

  const [showAIDrawer, setShowAIDrawer] =
    useState(false);

  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  const [recommendation, setRecommendation] =
    useState(null);

  const [recommendationLoading, setRecommendationLoading] =
    useState(false);

  const [smartRecoveryLoading, setSmartRecoveryLoading] =
    useState(false);

  const [smartRecoveryMessage, setSmartRecoveryMessage] =
    useState("");


  /* =========================================================
     CHECK BACKEND
  ========================================================= */

  useEffect(() => {

    checkBackend()

      .then((data) => {

        setBackendStatus(
          data?.status === "ok"
            ? "Backend Connected"
            : "Backend Connection Failed"
        );

      })

      .catch(() => {

        setBackendStatus(
          "Backend Connection Failed"
        );

      });

  }, []);


  /* =========================================================
     PREVENT BACKGROUND SCROLL WHEN DRAWER IS OPEN
  ========================================================= */

  useEffect(() => {

    if (showAIDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };

  }, [showAIDrawer]);


  /* =========================================================
     ESCAPE KEY CLOSES DRAWER
  ========================================================= */

  useEffect(() => {

    const handleKeyDown = (event) => {

      if (
        event.key === "Escape" &&
        showAIDrawer
      ) {
        closeAIDrawer();
      }

    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };

  }, [showAIDrawer]);


  /* =========================================================
     LOGIN
  ========================================================= */

  const handleLogin = () => {

    localStorage.setItem(
      "recoverai_logged_in",
      "true"
    );

    setIsLoggedIn(true);

  };


  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = () => {

    localStorage.removeItem(
      "recoverai_logged_in"
    );

    setIsLoggedIn(false);

    setShowAIDrawer(false);

    setSelectedTransaction(null);

    setRecommendation(null);

    setRecommendationLoading(false);

    setSmartRecoveryLoading(false);

    setSmartRecoveryMessage("");

  };


  /* =========================================================
     OPEN AI RECOMMENDATION DRAWER
  ========================================================= */

  const openAIDrawer = async (transaction) => {

    if (!transaction) {
      return;
    }


    const transactionId =
      transaction.transaction_id ||
      transaction.id;


    if (!transactionId) {

      console.error(
        "Transaction ID is missing."
      );

      return;
    }


    setSelectedTransaction(transaction);

    setShowAIDrawer(true);

    setRecommendation(null);

    setRecommendationLoading(true);

    setSmartRecoveryMessage("");


    try {

      const result =
        await getRecoveryRecommendation(
          transactionId
        );

      setRecommendation(result);

    }

    catch (error) {

      console.error(
        "AI recommendation error:",
        error
      );

      setRecommendation({
        error:
          error?.message ||
          "Unable to generate AI recommendation."
      });

    }

    finally {

      setRecommendationLoading(false);

    }

  };


  /* =========================================================
     CLOSE AI DRAWER
  ========================================================= */

  const closeAIDrawer = () => {

    if (smartRecoveryLoading) {
      return;
    }

    setShowAIDrawer(false);

    setSelectedTransaction(null);

    setRecommendation(null);

    setRecommendationLoading(false);

    setSmartRecoveryLoading(false);

    setSmartRecoveryMessage("");

  };


  /* =========================================================
     EXECUTE SMART RECOVERY

     Uses existing transaction recovery endpoint:
     /api/transactions/{transaction_id}/recover
  ========================================================= */

  const executeSmartRecovery = async () => {

    if (!selectedTransaction) {
      return;
    }


    const transactionId =
      selectedTransaction.transaction_id ||
      selectedTransaction.id;


    if (!transactionId) {

      setSmartRecoveryMessage(
        "Transaction ID is missing."
      );

      return;
    }


    setSmartRecoveryLoading(true);

    setSmartRecoveryMessage("");


    try {

      const response = await fetch(
        `http://127.0.0.1:8000/api/transactions/${encodeURIComponent(
          transactionId
        )}/recover`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );


      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }


      if (!response.ok) {

        throw new Error(
          data?.detail ||
          data?.message ||
          "Smart recovery failed."
        );

      }


      /* =====================================================
         UPDATE LOCAL TRANSACTION STATE
      ===================================================== */

      setSelectedTransaction((previous) => ({
        ...previous,
        recovery_status:
          "Recovered",
        status:
          "Success",
      }));


      /* =====================================================
         AUDIT LOG
      ===================================================== */

      addAuditLog({
        action: "Smart Recovery Executed",
        transactionId,
        channel:
          "Multi-Channel Recovery",
        details:
          "Smart Recovery executed: send recovery link and trigger recovery workflow.",
        status: "Success",
      });


      setSmartRecoveryMessage(
        "Smart recovery executed successfully."
      );


      /* =====================================================
         REFRESH TRANSACTION RECOMMENDATION

         This is optional. If the endpoint is not available,
         the success state above still remains visible.
      ===================================================== */

      try {

        const refreshed =
          await getRecoveryRecommendation(
            transactionId
          );

        if (refreshed) {
          setRecommendation(refreshed);
        }

      } catch (refreshError) {

        console.warn(
          "Recommendation refresh skipped:",
          refreshError
        );

      }

    }

    catch (error) {

      console.error(
        "Smart recovery error:",
        error
      );


      addAuditLog({
        action: "Smart Recovery Attempted",
        transactionId,
        channel:
          "Multi-Channel Recovery",
        details:
          error?.message ||
          "Smart recovery failed.",
        status: "Failed",
      });


      setSmartRecoveryMessage(
        error?.message ||
        "Unable to execute smart recovery."
      );

    }

    finally {

      setSmartRecoveryLoading(false);

    }

  };


  /* =========================================================
     LOGIN SCREEN
  ========================================================= */

  if (!isLoggedIn) {

    return (
      <Login
        onLogin={handleLogin}
      />
    );

  }


  /* =========================================================
     MAIN APPLICATION
  ========================================================= */

  return (

    <BrowserRouter>

      {/* =====================================================
          SHARED FEATURE PAGE STYLES
      ===================================================== */}

      <style>{`

        .feature-page {
          padding: 8px 0 30px;
        }

        .feature-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
        }

        .feature-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .feature-title-row h2 {
          margin: 0;
        }

        .feature-page-header p,
        .feature-section-heading p {
          margin: 5px 0 0;
          opacity: 0.7;
        }

        .feature-refresh-button,
        .feature-action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          text-decoration: none;
          cursor: pointer;
          font: inherit;
        }

        .feature-refresh-button {
          background: white;
          border: 1px solid #d1d5db;
          color: #111827;
        }

        .feature-refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .feature-stat-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .feature-stat-card,
        .feature-table-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow:
            0 4px 16px rgba(0,0,0,0.04);
        }

        .feature-stat-card {
          padding: 18px;
        }

        .feature-stat-card span {
          display: block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .06em;
          opacity: .6;
        }

        .feature-stat-card strong {
          display: block;
          margin-top: 8px;
          font-size: 24px;
        }

        .feature-table-card {
          padding: 20px;
          overflow: hidden;
        }

        .feature-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 16px;
        }

        .feature-section-heading h3 {
          margin: 0;
        }

        .feature-count {
          padding: 7px 10px;
          border-radius: 999px;
          background: #f3f4f6;
          font-size: 13px;
          white-space: nowrap;
        }

        .responsive-table {
          width: 100%;
          overflow-x: auto;
        }

        .feature-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        .feature-table th,
        .feature-table td {
          padding: 13px 10px;
          border-bottom:
            1px solid #edf0f3;
          text-align: left;
          vertical-align: middle;
        }

        .feature-table th {
          font-size: 11px;
          letter-spacing: .05em;
          opacity: .6;
          text-transform: uppercase;
        }

        .feature-table td strong {
          font-weight: 700;
        }

        .feature-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 9px;
          border-radius: 999px;
          background: #f3f4f6;
          font-size: 12px;
          white-space: nowrap;
        }

        .feature-badge.warning {
          background: #fff7ed;
          color: #9a3412;
        }

        .feature-badge.danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .feature-badge.success {
          background: #f0fdf4;
          color: #15803d;
        }

        .feature-badge.info {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .feature-action-button {
          background: #111827;
          color: white;
          font-size: 12px;
        }

        .feature-action-button:hover {
          opacity: 0.9;
        }

        .feature-action-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .feature-loading,
        .feature-empty,
        .feature-error,
        .feature-success {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 35px 20px;
          text-align: center;
          flex-direction: column;
        }

        .feature-error {
          color: #b91c1c;
          background: #fef2f2;
          border-radius: 12px;
        }

        .feature-success {
          color: #166534;
          background: #f0fdf4;
          border-radius: 12px;
          flex-direction: row;
          justify-content: flex-start;
          margin-bottom: 18px;
        }

        .feature-empty h3,
        .feature-empty p {
          margin: 0;
        }

        .spin {
          animation:
            recoverai-spin 1s linear infinite;
        }

        @keyframes recoverai-spin {

          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }

        }

        /* =====================================================
           RECOVERY FEATURE CARDS
        ===================================================== */

        .recovery-feature-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 20px;
        }

        .recovery-feature-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow:
            0 4px 16px rgba(0,0,0,0.04);
        }

        .recovery-feature-card h3 {
          margin: 0;
        }

        .recovery-feature-card p {
          margin: 6px 0 0;
          opacity: 0.7;
          font-size: 13px;
          line-height: 1.5;
        }

        /* =====================================================
           AI DRAWER
        ===================================================== */

        .ai-drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          justify-content: flex-end;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(3px);
          animation: ai-overlay-in 0.2s ease;
        }

        .ai-drawer {
          position: relative;
          width: min(560px, 94vw);
          height: 100vh;
          background: #ffffff;
          box-shadow:
            -12px 0 40px rgba(0,0,0,0.18);
          overflow-y: auto;
          animation: ai-drawer-in 0.25s ease;
        }

        .ai-drawer-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 20px;
          background: rgba(255,255,255,0.96);
          border-bottom: 1px solid #e5e7eb;
          backdrop-filter: blur(10px);
        }

        .ai-drawer-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-drawer-title h2 {
          margin: 0;
          font-size: 20px;
          color: #111827;
        }

        .ai-drawer-title p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .ai-drawer-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
        }

        .ai-drawer-close {
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #475569;
          cursor: pointer;
        }

        .ai-drawer-close:hover {
          background: #e5e7eb;
          color: #111827;
        }

        .ai-transaction-info {
          margin: 20px;
          padding: 14px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f8fafc;
        }

        .ai-transaction-info span {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          color: #64748b;
        }

        .ai-transaction-info strong {
          display: block;
          margin-top: 5px;
          color: #111827;
          font-size: 15px;
        }

        .ai-recommendation-content {
          padding: 0 20px 110px;
        }

        .ai-analysis-loading {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .ai-analysis-loading h3 {
          margin: 15px 0 5px;
          color: #111827;
        }

        .ai-analysis-loading p {
          max-width: 380px;
          margin: 0;
          color: #64748b;
          line-height: 1.6;
          font-size: 13px;
        }

        .ai-loading-circle {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
        }

        .ai-probability-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 20px;
          margin-bottom: 14px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #111827,
            #1e293b
          );
          color: white;
        }

        .ai-probability-card span {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          opacity: .7;
        }

        .ai-probability-card h3 {
          margin: 5px 0 0;
          font-size: 32px;
        }

        .probability-label {
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          font-size: 11px;
          white-space: nowrap;
        }

        .ai-info-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 13px;
          background: #ffffff;
        }

        .ai-info-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f1f5f9;
          color: #334155;
        }

        .ai-info-card span,
        .ai-history-card span {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          color: #64748b;
        }

        .ai-info-card p {
          margin: 5px 0 0;
          color: #334155;
          line-height: 1.55;
          font-size: 13px;
        }

        .ai-history-card {
          padding: 16px;
          margin-bottom: 12px;
          border-radius: 13px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .ai-history-card h3 {
          margin: 6px 0;
          color: #111827;
          font-size: 14px;
        }

        .ai-history-card p {
          margin: 0;
          color: #475569;
          line-height: 1.55;
          font-size: 13px;
        }

        /* =====================================================
           SMART RECOVERY CTA
        ===================================================== */

        .smart-recovery-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
          padding: 14px 20px;
          border-top: 1px solid #e5e7eb;
          background: rgba(255,255,255,.96);
          backdrop-filter: blur(10px);
        }

        .smart-recovery-button {
          width: 100%;
          min-height: 48px;
          border: none;
          border-radius: 12px;
          padding: 13px 16px;
          background: #111827;
          color: white;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition:
            transform .15s ease,
            opacity .15s ease,
            background .15s ease;
        }

        .smart-recovery-button:hover {
          background: #1f2937;
          transform: translateY(-1px);
        }

        .smart-recovery-button:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .smart-recovery-success {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f0fdf4;
          color: #166534;
          font-size: 12px;
          font-weight: 700;
        }

        .smart-recovery-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 700;
        }

        @keyframes ai-overlay-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes ai-drawer-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 900px) {

          .feature-stat-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .feature-page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .recovery-feature-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 520px) {

          .feature-stat-grid {
            grid-template-columns: 1fr;
          }

          .ai-drawer {
            width: 100vw;
          }

          .ai-drawer-header {
            padding: 15px;
          }

          .ai-recommendation-content {
            padding-left: 15px;
            padding-right: 15px;
          }

          .smart-recovery-footer {
            padding: 12px 15px;
          }

        }

      `}</style>


      {/* =====================================================
          APPLICATION
      ===================================================== */}

      <div className="app">


        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="header">

          <div>

            <h1>
              RecoverAI
            </h1>

            <p>
              Intelligent Transaction Recovery System
            </p>

          </div>


          <div className="header-right">


            {/* BACKEND STATUS */}

            <div
              className={`
                backend-status
                ${
                  backendStatus ===
                  "Backend Connected"
                    ? "connected"
                    : "disconnected"
                }
              `}
            >

              <span
                className="status-dot"
              />

              {backendStatus}

            </div>


            {/* LOGOUT */}

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >

              <LogOut size={16} />

              Logout

            </button>

          </div>

        </header>


        {/* ===================================================
            NAVBAR
        =================================================== */}

        <Navbar
          onLogout={handleLogout}
        />


        {/* ===================================================
            APPLICATION ROUTES
        =================================================== */}

        <main className="container">

          <Routes>


            {/* =================================================
                OVERVIEW
            ================================================= */}

            <Route
              path="/"
              element={
                <Overview />
              }
            />


            {/* =================================================
                ANALYTICS
            ================================================= */}

            <Route
              path="/analytics"
              element={
                <Analytics />
              }
            />


            {/* =================================================
                FAILED TRANSACTIONS
            ================================================= */}

            <Route
              path="/failed-transactions"
              element={
                <FailedTransactions
                  onAIRecommendation={
                    openAIDrawer
                  }
                />
              }
            />


            {/* =================================================
                CHECKOUT DROP-OFF RECOVERY

                IMPORTANT:
                This now matches Navbar.jsx:
                /checkout-dropoff
            ================================================= */}

            <Route
              path="/checkout-dropoff"
              element={
                <CheckoutDropoffRecovery />
              }
            />


            {/* =================================================
                BACKWARD COMPATIBILITY

                Old URL also works.
            ================================================= */}

            <Route
              path="/checkout-recovery"
              element={
                <Navigate
                  to="/checkout-dropoff"
                  replace
                />
              }
            />


            {/* =================================================
                FAILED SUBSCRIPTIONS

                IMPORTANT:
                This now matches Navbar.jsx:
                /failed-subscriptions
            ================================================= */}

            <Route
              path="/failed-subscriptions"
              element={
                <FailedSubscriptionRecovery />
              }
            />


            {/* =================================================
                BACKWARD COMPATIBILITY
            ================================================= */}

            <Route
              path="/subscription-recovery"
              element={
                <Navigate
                  to="/failed-subscriptions"
                  replace
                />
              }
            />


            {/* =================================================
                AI ASSISTANT

                Includes:
                - AI Chat
                - Voice Recovery
            ================================================= */}

            <Route
              path="/ai-assistant"
              element={
                <AIAssistantHub />
              }
            />


            {/* =================================================
                B2B RECEIVABLES
            ================================================= */}

            <Route
              path="/b2b-receivables"
              element={
                <B2BReceivables />
              }
            />


            {/* =================================================
                PROMISE TO PAY
            ================================================= */}

            <Route
              path="/promise-tracker"
              element={
                <PromiseToPayTracker />
              }
            />


            {/* =================================================
                VOICE RECOVERY

                Old URL redirects to AI Assistant.
            ================================================= */}

            <Route
              path="/voice-recovery"
              element={
                <Navigate
                  to="/ai-assistant"
                  replace
                />
              }
            />


            {/* =================================================
                AUDIT LOGS
            ================================================= */}

            <Route
              path="/audit-logs"
              element={
                <AuditLogs />
              }
            />


            {/* =================================================
                UNKNOWN ROUTE
            ================================================= */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </main>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <footer>

          <p>
            RecoverAI © 2026 |
            Intelligent Transaction Recovery
          </p>

        </footer>


        {/* ===================================================
            AI RECOMMENDATION DRAWER
        =================================================== */}

        {showAIDrawer &&
          selectedTransaction && (

          <div
            className="ai-drawer-overlay"
            onClick={closeAIDrawer}
          >

            <div
              className="ai-drawer"
              onClick={(event) =>
                event.stopPropagation()
              }
            >


              {/* ===========================================
                  DRAWER HEADER
              =========================================== */}

              <div
                className="ai-drawer-header"
              >

                <div
                  className="ai-drawer-title"
                >

                  <div
                    className="ai-drawer-icon"
                  >

                    <Bot size={22} />

                  </div>


                  <div>

                    <h2>
                      AI Recommendation
                    </h2>

                    <p>
                      Intelligent recovery analysis
                    </p>

                  </div>

                </div>


                <button
                  type="button"
                  className="ai-drawer-close"
                  onClick={closeAIDrawer}
                  aria-label="Close AI recommendation"
                  disabled={smartRecoveryLoading}
                >

                  <X size={20} />

                </button>

              </div>


              {/* ===========================================
                  TRANSACTION INFO
              =========================================== */}

              <div
                className="ai-transaction-info"
              >

                <span>
                  TRANSACTION
                </span>

                <strong>

                  {
                    selectedTransaction
                      .transaction_id ||
                    selectedTransaction.id ||
                    "Transaction"
                  }

                </strong>

              </div>


              {/* ===========================================
                  AI CONTENT
              =========================================== */}

              <div
                className="ai-recommendation-content"
              >


                {/* =========================================
                    LOADING
                ========================================= */}

                {recommendationLoading && (

                  <div
                    className="ai-analysis-loading"
                  >

                    <div
                      className="ai-loading-circle"
                    >

                      <LoaderCircle
                        size={30}
                        className="spin"
                      />

                    </div>

                    <h3>
                      Analyzing transaction...
                    </h3>

                    <p>
                      Our AI is analyzing the
                      transaction and preparing
                      a recovery recommendation.
                    </p>

                  </div>

                )}


                {/* =========================================
                    ERROR
                ========================================= */}

                {!recommendationLoading &&
                  recommendation?.error && (

                  <div
                    className="ai-analysis-loading"
                  >

                    <div
                      className="ai-loading-circle"
                    >

                      <AlertTriangle
                        size={28}
                      />

                    </div>

                    <h3>
                      Recommendation unavailable
                    </h3>

                    <p>
                      {recommendation.error}
                    </p>

                  </div>

                )}


                {/* =========================================
                    SUCCESSFUL RECOMMENDATION
                ========================================= */}

                {!recommendationLoading &&
                  recommendation &&
                  !recommendation.error && (

                  <>


                    {/* =================================
                        RECOVERY PROBABILITY
                    ================================= */}

                    <div
                      className="ai-probability-card"
                    >

                      <div>

                        <span>
                          RECOVERY PROBABILITY
                        </span>

                        <h3>

                          {(() => {

                            const value =
                              recommendation.probability ??
                              recommendation.recovery_probability;

                            if (
                              value === null ||
                              value === undefined ||
                              value === ""
                            ) {
                              return "—";
                            }

                            const stringValue =
                              String(value);

                            return stringValue.endsWith("%")
                              ? stringValue
                              : `${stringValue}%`;

                          })()}

                        </h3>

                      </div>


                      <div
                        className="probability-label"
                      >

                        AI Prediction

                      </div>

                    </div>


                    {/* =================================
                        PROBLEM
                    ================================= */}

                    <div
                      className="ai-info-card"
                    >

                      <div
                        className="ai-info-icon"
                      >

                        <AlertTriangle
                          size={18}
                        />

                      </div>


                      <div>

                        <span>
                          PROBLEM
                        </span>

                        <p>

                          {
                            recommendation.problem ??
                            recommendation.failure_reason ??
                            selectedTransaction.failure_reason ??
                            "No specific problem identified."
                          }

                        </p>

                      </div>

                    </div>


                    {/* =================================
                        RECOMMENDED ACTION
                    ================================= */}

                    <div
                      className="ai-info-card"
                    >

                      <div
                        className="ai-info-icon"
                      >

                        <Lightbulb
                          size={18}
                        />

                      </div>


                      <div>

                        <span>
                          RECOMMENDED ACTION
                        </span>

                        <p>

                          {
                            recommendation.recommended_action ??
                            recommendation.action ??
                            "Review the transaction and retry the recovery process."
                          }

                        </p>

                      </div>

                    </div>


                    {/* =================================
                        NEXT STEP
                    ================================= */}

                    <div
                      className="ai-info-card"
                    >

                      <div
                        className="ai-info-icon"
                      >

                        <ArrowRight
                          size={18}
                        />

                      </div>


                      <div>

                        <span>
                          NEXT STEP
                        </span>

                        <p>

                          {
                            recommendation.next_step ??
                            recommendation.next_action ??
                            "Proceed with the recommended recovery action."
                          }

                        </p>

                      </div>

                    </div>


                    {/* =================================
                        TRANSACTION HISTORY
                    ================================= */}

                    {recommendation.history && (

                      <div
                        className="ai-history-card"
                      >

                        <span>
                          TRANSACTION HISTORY
                        </span>

                        <h3>
                          {recommendation.history}
                        </h3>

                        <p>
                          Previous transaction
                          recovery information
                        </p>

                      </div>

                    )}


                    {/* =================================
                        AI REASONING
                    ================================= */}

                    {(
                      recommendation.ai_reasoning ||
                      recommendation.reasoning ||
                      recommendation.explanation
                    ) && (

                      <div
                        className="ai-history-card"
                      >

                        <span>
                          WHY THIS RECOMMENDATION?
                        </span>

                        <h3>
                          AI Explanation
                        </h3>

                        <p>

                          {
                            recommendation.ai_reasoning ??
                            recommendation.reasoning ??
                            recommendation.explanation
                          }

                        </p>

                      </div>

                    )}

                  </>

                )}


                {/* =========================================
                    NO RECOMMENDATION
                ========================================= */}

                {!recommendationLoading &&
                  !recommendation && (

                  <div
                    className="ai-analysis-loading"
                  >

                    <div
                      className="ai-loading-circle"
                    >

                      <Bot size={28} />

                    </div>

                    <h3>
                      Preparing recommendation
                    </h3>

                    <p>
                      Please wait while the
                      AI analyzes this transaction.
                    </p>

                  </div>

                )}

              </div>


              {/* =================================================
                  SMART RECOVERY FOOTER

                  Primary CTA requested:
                  Execute Smart Recovery
                  (Send Link & Trigger Call)
              ================================================= */}

              {!recommendationLoading &&
                recommendation &&
                !recommendation.error && (

                <div
                  className="smart-recovery-footer"
                >

                  {/* SUCCESS MESSAGE */}

                  {smartRecoveryMessage &&
                    !smartRecoveryMessage
                      .toLowerCase()
                      .includes("unable") &&
                    !smartRecoveryMessage
                      .toLowerCase()
                      .includes("failed") && (

                    <div
                      className="smart-recovery-success"
                    >

                      <CheckCircle2
                        size={16}
                      />

                      {smartRecoveryMessage}

                    </div>

                  )}


                  {/* ERROR MESSAGE */}

                  {smartRecoveryMessage &&
                    (
                      smartRecoveryMessage
                        .toLowerCase()
                        .includes("unable") ||
                      smartRecoveryMessage
                        .toLowerCase()
                        .includes("failed") ||
                      smartRecoveryMessage
                        .toLowerCase()
                        .includes("missing")
                    ) && (

                    <div
                      className="smart-recovery-error"
                    >

                      <AlertTriangle
                        size={16}
                      />

                      {smartRecoveryMessage}

                    </div>

                  )}


                  <button
                    type="button"
                    className="smart-recovery-button"
                    onClick={executeSmartRecovery}
                    disabled={
                      smartRecoveryLoading
                    }
                  >

                    {smartRecoveryLoading ? (

                      <>
                        <LoaderCircle
                          size={18}
                          className="spin"
                        />

                        Executing Smart Recovery...

                      </>

                    ) : (

                      <>
                        <ArrowRight
                          size={18}
                        />

                        Execute Smart Recovery
                        (Send Link & Trigger Call)

                      </>

                    )}

                  </button>

                </div>

              )}

            </div>

          </div>

        )}

      </div>

    </BrowserRouter>
  );
}


export default App;