import { useState } from "react";

import {
  Bot,
  Mic,
  MessageCircle,
} from "lucide-react";

import AIAssistant from "./AIAssistant";
import VoiceRecovery from "./VoiceRecovery";


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
            Intelligent AI support and multilingual voice recovery.
          </p>

        </div>

      </div>


      {/* =====================================================
          AI MODE SWITCHER
      ===================================================== */}

      <div
        style={{
          display: "flex",
          gap: 10,
          padding: 6,
          marginBottom: 20,
          background: "#f1f5f9",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >

        {/* ===================================================
            CHAT
        =================================================== */}

        <button
          type="button"
          onClick={() => setActiveMode("chat")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            border: "0",
            borderRadius: 9,
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

          <MessageCircle size={17} />

          AI Chat Support

        </button>


        {/* ===================================================
            VOICE
        =================================================== */}

        <button
          type="button"
          onClick={() => setActiveMode("voice")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            border: "0",
            borderRadius: 9,
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

          <Mic size={17} />

          Voice Recovery

        </button>

      </div>


      {/* =====================================================
          ACTIVE AI FEATURE
      ===================================================== */}

      {activeMode === "chat" && (

        <AIAssistant />

      )}


      {activeMode === "voice" && (

        <VoiceRecovery />

      )}

    </div>

  );

}


export default AIAssistantHub;