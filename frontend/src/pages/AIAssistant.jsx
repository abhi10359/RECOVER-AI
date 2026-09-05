import { useEffect, useRef, useState } from "react";

import {
  Bot,
  Send,
  RefreshCw,
  Trash2,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  AlertCircle,
} from "lucide-react";

import { sendChatMessage } from "../services/api";

function AIAssistant() {
  /* =========================================================
     LANGUAGE
  ========================================================= */

  const [selectedLanguage, setSelectedLanguage] =
    useState("English");

  /* =========================================================
     CHAT
  ========================================================= */

  const [chatInput, setChatInput] =
    useState("");

  const [chatLoading, setChatLoading] =
    useState(false);

  const [chatMessages, setChatMessages] =
    useState([]);

  /* =========================================================
     VOICE
  ========================================================= */

  const [isListening, setIsListening] =
    useState(false);

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const [voiceError, setVoiceError] =
    useState("");

  const recognitionRef =
    useRef(null);

  /* =========================================================
     GREETINGS
  ========================================================= */

  const greetings = {
    English:
      "Hello! I'm RecoverAI. How can I help you with your transaction?",

    Hindi:
      "नमस्ते! मैं RecoverAI हूँ। मैं आपके लेन-देन में कैसे मदद कर सकता हूँ?",

    Tamil:
      "வணக்கம்! நான் RecoverAI. உங்கள் பரிவர்த்தனையில் நான் எப்படி உதவலாம்?",

    Telugu:
      "నమస్కారం! నేను RecoverAI. మీ లావాదేవీ విషయంలో నేను ఎలా సహాయం చేయగలను?",

    Kannada:
      "ನಮಸ್ಕಾರ! ನಾನು RecoverAI. ನಿಮ್ಮ ವಹಿವಾಟಿನಲ್ಲಿ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",

    Malayalam:
      "നമസ്കാരം! ഞാൻ RecoverAI ആണ്. നിങ്ങളുടെ ഇടപാടിൽ എങ്ങനെ സഹായിക്കാം?",

    Bengali:
      "নমস্কার! আমি RecoverAI। আপনার লেনদেনে আমি কীভাবে সাহায্য করতে পারি?",

    Marathi:
      "नमस्कार! मी RecoverAI आहे. तुमच्या व्यवहारात मी कशी मदत करू शकतो?",

    Gujarati:
      "નમસ્તે! હું RecoverAI છું. તમારા વ્યવહારમાં હું કેવી રીતે મદદ કરી શકું?",

    Punjabi:
      "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ RecoverAI ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਲੈਣ-ਦੇਣ ਵਿੱਚ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",

    Odia:
      "ନମସ୍କାର! ମୁଁ RecoverAI। ଆପଣଙ୍କ କାରବାରରେ ମୁଁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",

    Assamese:
      "নমস্কাৰ! মই RecoverAI। আপোনাৰ লেনদেনত মই কেনেকৈ সহায় কৰিব পাৰোঁ?",

    Urdu:
      "السلام علیکم! میں RecoverAI ہوں۔ میں آپ کے لین دین میں کیسے مدد کر سکتا ہوں؟",
  };

  const languages =
    Object.keys(greetings);

  /* =========================================================
     SPEECH LANGUAGE MAPPING
  ========================================================= */

  const speechLanguages = {
    English: "en-IN",
    Hindi: "hi-IN",
    Tamil: "ta-IN",
    Telugu: "te-IN",
    Kannada: "kn-IN",
    Malayalam: "ml-IN",
    Bengali: "bn-IN",
    Marathi: "mr-IN",
    Gujarati: "gu-IN",
    Punjabi: "pa-IN",
    Odia: "or-IN",
    Assamese: "as-IN",
    Urdu: "ur-IN",
  };

  /* =========================================================
     INITIAL CHAT
  ========================================================= */

  useEffect(() => {
    setChatMessages([
      {
        sender: "bot",
        text: greetings.English,
      },
    ]);
  }, []);

  /* =========================================================
     TEXT TO SPEECH
  ========================================================= */

  const speakAIResponse = (text) => {
    if (!text) {
      return;
    }

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      setVoiceError(
        "Text-to-Speech is not supported by this browser."
      );

      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(text);

      utterance.lang =
        speechLanguages[selectedLanguage] ||
        "en-IN";

      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(
        utterance
      );
    } catch (error) {
      console.error(
        "Text-to-Speech error:",
        error
      );

      setIsSpeaking(false);
    }
  };

  /* =========================================================
     STOP SPEAKING
  ========================================================= */

  const stopSpeaking = () => {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  };

  /* =========================================================
     SEND MESSAGE TO GEMINI
  ========================================================= */

  const sendMessageToAI = async (message) => {
    if (
      !message ||
      !message.trim() ||
      chatLoading
    ) {
      return;
    }

    const userMessage =
      message.trim();

    /* -------------------------------------------------------
       SHOW USER MESSAGE
    ------------------------------------------------------- */

    setChatMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: userMessage,
      },
    ]);

    setChatLoading(true);
    setVoiceError("");

    try {
      /* -----------------------------------------------------
         SEND MESSAGE TO BACKEND

         /api/chat
         ↓
         FastAPI
         ↓
         Gemini
      ----------------------------------------------------- */

      const data =
        await sendChatMessage(
          userMessage,
          selectedLanguage,
          null
        );

      const aiResponse =
        data?.reply ||
        "I could not generate a response. Please try again.";

      /* -----------------------------------------------------
         DISPLAY GEMINI RESPONSE
      ----------------------------------------------------- */

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: aiResponse,
        },
      ]);

      /* -----------------------------------------------------
         TEXT TO SPEECH

         Gemini response is automatically
         played through the speakers.
      ----------------------------------------------------- */

      speakAIResponse(
        aiResponse
      );

    } catch (error) {
      console.error(
        "RecoverAI error:",
        error
      );

      const errorMessage =
        "Sorry, I couldn't connect to the AI service. Please try again.";

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: errorMessage,
        },
      ]);

    } finally {
      setChatLoading(false);
    }
  };

  /* =========================================================
     NORMAL TEXT SEND
  ========================================================= */

  const handleSendMessage = async () => {
    if (
      !chatInput.trim() ||
      chatLoading
    ) {
      return;
    }

    const message =
      chatInput.trim();

    setChatInput("");

    await sendMessageToAI(
      message
    );
  };

  /* =========================================================
     SPEECH TO TEXT
  ========================================================= */

  const startListening = () => {
    setVoiceError("");

    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    /* -------------------------------------------------------
       CHECK BROWSER SUPPORT
    ------------------------------------------------------- */

    if (!SpeechRecognition) {
      setVoiceError(
        "Speech-to-Text is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );

      return;
    }

    /* -------------------------------------------------------
       STOP EXISTING RECOGNITION
    ------------------------------------------------------- */

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    /* -------------------------------------------------------
       CREATE RECOGNITION
    ------------------------------------------------------- */

    const recognition =
      new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.lang =
      speechLanguages[selectedLanguage] ||
      "en-IN";

    /* -------------------------------------------------------
       RECOGNITION START
    ------------------------------------------------------- */

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError("");
    };

    /* -------------------------------------------------------
       SPEECH RESULT
    ------------------------------------------------------- */

    recognition.onresult = (
      event
    ) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]
            .transcript;
      }

      transcript =
        transcript.trim();

      /* -----------------------------------------------------
         SHOW LIVE TRANSCRIPT
      ----------------------------------------------------- */

      setChatInput(
        transcript
      );

      /* -----------------------------------------------------
         FINAL TRANSCRIPT
      ----------------------------------------------------- */

      const lastResult =
        event.results[
          event.results.length - 1
        ];

      if (
        lastResult &&
        lastResult.isFinal
      ) {
        const finalTranscript =
          transcript.trim();

        if (
          finalTranscript
        ) {
          setChatInput("");

          /* -----------------------------------------------
             SEND TRANSCRIPT TO GEMINI
          ----------------------------------------------- */

          sendMessageToAI(
            finalTranscript
          );
        }
      }
    };

    /* -------------------------------------------------------
       RECOGNITION ERROR
    ------------------------------------------------------- */

    recognition.onerror = (
      event
    ) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setIsListening(false);

      if (
        event.error ===
        "not-allowed"
      ) {
        setVoiceError(
          "Microphone permission was denied. Please allow microphone access in your browser."
        );
      } else if (
        event.error ===
        "no-speech"
      ) {
        setVoiceError(
          "No speech detected. Please try speaking again."
        );
      } else if (
        event.error ===
        "audio-capture"
      ) {
        setVoiceError(
          "No microphone was detected. Please check your microphone."
        );
      } else {
        setVoiceError(
          "Speech recognition failed. Please try again."
        );
      }
    };

    /* -------------------------------------------------------
       RECOGNITION END
    ------------------------------------------------------- */

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current =
      recognition;

    /* -------------------------------------------------------
       START MICROPHONE
    ------------------------------------------------------- */

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "Unable to start speech recognition:",
        error
      );

      setIsListening(false);
    }
  };

  /* =========================================================
     STOP LISTENING
  ========================================================= */

  const stopListening = () => {
    if (
      recognitionRef.current
    ) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    setIsListening(false);
  };

  /* =========================================================
     MICROPHONE BUTTON
  ========================================================= */

  const handleVoiceButton = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  /* =========================================================
     LANGUAGE CHANGE
  ========================================================= */

  const handleLanguageChange = (
    newLanguage
  ) => {
    stopSpeaking();
    stopListening();

    setSelectedLanguage(
      newLanguage
    );

    setChatMessages([
      {
        sender: "bot",
        text: greetings[newLanguage],
      },
    ]);

    setChatInput("");
    setVoiceError("");
  };

  /* =========================================================
     CLEAR CHAT
  ========================================================= */

  const handleClearChat = () => {
    stopSpeaking();
    stopListening();

    setChatMessages([
      {
        sender: "bot",
        text: greetings[selectedLanguage],
      },
    ]);

    setChatInput("");
    setVoiceError("");
  };

  /* =========================================================
     CLEANUP
  ========================================================= */

  useEffect(() => {
    return () => {
      try {
        if (
          recognitionRef.current
        ) {
          recognitionRef.current.stop();
        }
      } catch {
        // Ignore
      }

      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="page ai-assistant-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <section className="ai-page-header">

        <div className="ai-page-title">

          <div className="ai-page-icon">
            <Bot size={32} />
          </div>

          <div>
            <h2>
              RecoverAI Assistant
            </h2>

            <p>
              Your intelligent multilingual
              transaction recovery assistant.
            </p>
          </div>

        </div>

        <div className="ai-online">
          <span></span>
          AI Online
        </div>

      </section>


      {/* =====================================================
          MAIN LAYOUT
      ===================================================== */}

      <div className="ai-assistant-layout">

        {/* ===================================================
            INFORMATION PANEL
        =================================================== */}

        <div className="ai-info-panel">

          <div className="ai-info-icon">
            <Sparkles size={30} />
          </div>

          <h3>
            How can I help?
          </h3>

          <p>
            Ask RecoverAI about failed payments,
            transaction recovery, payment issues,
            or recommended next steps.
          </p>


          {/* =================================================
              VOICE STATUS
          ================================================= */}

          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 12,

              background:
                isListening
                  ? "#fef2f2"
                  : isSpeaking
                  ? "#eff6ff"
                  : "#f8fafc",

              border:
                isListening
                  ? "1px solid #fecaca"
                  : isSpeaking
                  ? "1px solid #bfdbfe"
                  : "1px solid #e2e8f0",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
              }}
            >

              {isListening ? (
                <Mic size={17} />
              ) : isSpeaking ? (
                <Volume2 size={17} />
              ) : (
                <Bot size={17} />
              )}

              {isListening
                ? "Listening..."
                : isSpeaking
                ? "RecoverAI is speaking..."
                : "Voice Assistant Ready"}

            </div>

            <p
              style={{
                margin: "7px 0 0",
                fontSize: 12,
                opacity: 0.7,
                lineHeight: 1.5,
              }}
            >

              {isListening
                ? "Speak your message. Your transcript will automatically be sent to Gemini."
                : isSpeaking
                ? "The AI response is being played through your speakers."
                : "Click the microphone to speak with RecoverAI."}

            </p>

          </div>


          {/* =================================================
              SUGGESTIONS
          ================================================= */}

          <div className="ai-suggestions">

            <button
              onClick={() =>
                setChatInput(
                  "Why did my payment fail?"
                )
              }
            >
              Why did my payment fail?
            </button>

            <button
              onClick={() =>
                setChatInput(
                  "How can I recover my failed transaction?"
                )
              }
            >
              How can I recover a failed transaction?
            </button>

            <button
              onClick={() =>
                setChatInput(
                  "What should I do if my payment is pending?"
                )
              }
            >
              What should I do if my payment is pending?
            </button>

          </div>

        </div>


        {/* ===================================================
            CHAT
        =================================================== */}

        <div className="full-ai-chat">

          {/* =================================================
              CHAT HEADER
          ================================================= */}

          <div className="full-ai-chat-header">

            <div className="chatbot-title-area">

              <img
                src="/chatbot-logo.png"
                alt="RecoverAI"
                className="chatbot-header-logo"
              />

              <div>

                <h3>
                  RecoverAI
                </h3>

                <span>
                  AI Transaction Assistant
                </span>

              </div>

            </div>


            {/* LANGUAGE SELECTOR */}

            <select
              value={
                selectedLanguage
              }
              onChange={(e) =>
                handleLanguageChange(
                  e.target.value
                )
              }
              disabled={
                chatLoading ||
                isListening
              }
            >

              {languages.map(
                (language) => (
                  <option
                    key={language}
                    value={language}
                  >
                    {language}
                  </option>
                )
              )}

            </select>

          </div>


          {/* =================================================
              VOICE ERROR
          ================================================= */}

          {voiceError && (

            <div
              style={{
                margin:
                  "12px 15px 0",

                padding: 12,

                borderRadius: 10,

                background:
                  "#fef2f2",

                border:
                  "1px solid #fecaca",

                color:
                  "#b91c1c",

                display: "flex",

                gap: 8,

                alignItems:
                  "flex-start",

                fontSize: 12,
              }}
            >

              <AlertCircle
                size={16}
                style={{
                  flexShrink: 0,
                }}
              />

              <span>
                {voiceError}
              </span>

            </div>

          )}


          {/* =================================================
              CHAT MESSAGES
          ================================================= */}

          <div className="full-ai-messages">

            {chatMessages.map(
              (message, index) => (

                <div
                  key={index}
                  className={
                    message.sender === "user"
                      ? "chat-message user"
                      : "chat-message bot"
                  }
                  style={{
                    position:
                      "relative",
                  }}
                >

                  {message.text}


                  {/* AI SPEAKER BUTTON */}

                  {message.sender ===
                    "bot" && (

                    <button
                      type="button"
                      onClick={() =>
                        speakAIResponse(
                          message.text
                        )
                      }
                      title="Play AI response"

                      style={{
                        marginLeft: 8,
                        border: "none",
                        background:
                          "transparent",
                        cursor: "pointer",
                        padding: 2,
                        verticalAlign:
                          "middle",
                      }}
                    >

                      <Volume2
                        size={14}
                      />

                    </button>

                  )}

                </div>

              )
            )}


            {/* =================================================
                THINKING
            ================================================= */}

            {chatLoading && (

              <div className="chat-message bot thinking-message">

                <RefreshCw
                  size={15}
                  className="spinning"
                />

                Thinking...

              </div>

            )}

          </div>


          {/* =================================================
              VOICE WAVEFORM
          ================================================= */}

          {isListening && (

            <div
              style={{
                display: "flex",
                justifyContent:
                  "center",
                alignItems:
                  "center",
                gap: 5,
                padding:
                  "12px 0",
                borderTop:
                  "1px solid #edf0f3",
              }}
            >

              {[
                12,
                22,
                32,
                18,
                28,
                38,
                24,
                14,
                30,
                20,
                35,
                16,
              ].map(
                (height, index) => (

                  <span
                    key={index}
                    style={{
                      display:
                        "block",

                      width: 4,

                      height,

                      borderRadius: 5,

                      background:
                        "#ef4444",

                      animation:
                        "voiceWave 0.8s ease-in-out infinite alternate",

                      animationDelay:
                        `${index * 0.07}s`,
                    }}
                  />

                )
              )}

            </div>

          )}


          {/* =================================================
              SPEAKING STATUS
          ================================================= */}

          {isSpeaking && (

            <div
              style={{
                display: "flex",
                justifyContent:
                  "center",
                alignItems:
                  "center",
                gap: 8,
                padding: 10,
                borderTop:
                  "1px solid #edf0f3",
                fontSize: 12,
                color:
                  "#2563eb",
              }}
            >

              <Volume2
                size={16}
              />

              RecoverAI is speaking...

              <button
                type="button"
                onClick={
                  stopSpeaking
                }
                style={{
                  border:
                    "none",

                  background:
                    "#eff6ff",

                  padding:
                    "5px 9px",

                  borderRadius: 7,

                  cursor:
                    "pointer",

                  fontSize: 11,
                }}
              >

                <VolumeX
                  size={13}
                  style={{
                    verticalAlign:
                      "middle",

                    marginRight: 4,
                  }}
                />

                Stop

              </button>

            </div>

          )}


          {/* =================================================
              INPUT AREA
          ================================================= */}

          <div className="full-ai-input">

            {/* TEXT INPUT */}

            <input
              type="text"

              placeholder={
                isListening
                  ? "Listening to you..."
                  : selectedLanguage ===
                    "English"
                  ? "Ask RecoverAI..."
                  : `Ask RecoverAI in ${selectedLanguage}...`
              }

              value={
                chatInput
              }

              onChange={(e) =>
                setChatInput(
                  e.target.value
                )
              }

              onKeyDown={(e) => {

                if (
                  e.key === "Enter"
                ) {
                  handleSendMessage();
                }

              }}

              disabled={
                chatLoading
              }
            />


            {/* =================================================
                MICROPHONE
            ================================================= */}

            <button
              type="button"

              onClick={
                handleVoiceButton
              }

              disabled={
                chatLoading
              }

              title={
                isListening
                  ? "Stop listening"
                  : "Speak to RecoverAI"
              }

              style={{
                background:
                  isListening
                    ? "#dc2626"
                    : "#f1f5f9",

                color:
                  isListening
                    ? "#ffffff"
                    : "#0f172a",

                border:
                  "none",

                cursor:
                  chatLoading
                    ? "not-allowed"
                    : "pointer",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                minWidth: 42,

                height: 42,

                borderRadius: 10,
              }}
            >

              {isListening ? (
                <MicOff
                  size={19}
                />
              ) : (
                <Mic
                  size={19}
                />
              )}

            </button>


            {/* =================================================
                SEND
            ================================================= */}

            <button
              type="button"

              onClick={
                handleSendMessage
              }

              disabled={
                chatLoading ||
                !chatInput.trim()
              }

              title="Send message"
            >

              {chatLoading ? (

                <RefreshCw
                  size={19}
                  className="spinning"
                />

              ) : (

                <Send
                  size={19}
                />

              )}

            </button>

          </div>


          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="full-ai-footer">

            <span>
              Powered by RecoverAI AI
            </span>

            <button
              type="button"
              onClick={
                handleClearChat
              }
            >

              <Trash2
                size={14}
              />

              Clear Chat

            </button>

          </div>

        </div>

      </div>


      {/* =====================================================
          VOICE INFORMATION
      ===================================================== */}

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background:
            "#f8fafc",
          border:
            "1px solid #e2e8f0",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >

        <strong>
          🎙️ Voice Recovery
        </strong>

        <p
          style={{
            margin:
              "6px 0 0",
            opacity: 0.7,
          }}
        >

          Speak using the microphone button.
          Your speech is converted to text,
          sent to the RecoverAI backend,
          analyzed by Gemini, and the AI response
          is automatically played through your speakers.

        </p>

      </div>


      {/* =====================================================
          WAVEFORM ANIMATION
      ===================================================== */}

      <style>
        {`
          @keyframes voiceWave {
            from {
              transform: scaleY(0.45);
              opacity: 0.55;
            }

            to {
              transform: scaleY(1);
              opacity: 1;
            }
          }
        `}
      </style>

    </div>
  );
}

export default AIAssistant;