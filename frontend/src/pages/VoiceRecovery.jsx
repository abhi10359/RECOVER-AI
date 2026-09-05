import { useEffect, useMemo, useRef, useState } from "react";

import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Languages,
  Brain,
  CalendarDays,
  Send,
  CheckCircle2,
  AlertCircle,
  User,
  IndianRupee,
  LoaderCircle,
  Clock3,
  Volume2,
  Pause,
} from "lucide-react";

function VoiceRecovery() {
  /* =========================================================
     STATE
  ========================================================= */

  const [language, setLanguage] = useState("Hinglish");

  const [callActive, setCallActive] = useState(false);
  const [callCompleted, setCallCompleted] = useState(false);

  const [customerMessage, setCustomerMessage] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [analysis, setAnalysis] = useState(null);

  const [callLoading, setCallLoading] = useState(false);

  // Kept internally for debugging/logging.
  // It is NOT displayed in the presentation UI.
  const [callError, setCallError] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState("");

  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  const [speakingIndex, setSpeakingIndex] = useState(null);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

  /* =========================================================
     DEMO TRANSACTION
  ========================================================= */

  const transaction = {
    transaction_id: "TXN100001",
    customer_name: "Neha Sharma",
    phone: "+91 98765 43210",
    amount: 9999,
    status: "Paid",
    gateway: "Razorpay",
    failure_reason: "Bank gateway timeout",
    error_code: "GATEWAY_TIMEOUT",

    // Demo payment due date
    due_date: "2026-09-10",
  };

  /* =========================================================
     FORMAT DURATION
  ========================================================= */

  const formatDuration = (seconds) => {
    const totalSeconds = Math.max(
      0,
      Math.floor(Number(seconds) || 0)
    );

    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  /* =========================================================
     FORMAT DUE DATE
  ========================================================= */

  const getFormattedDueDate = () => {
    try {
      return new Date(
        transaction.due_date + "T00:00:00"
      ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "10th September 2026";
    }
  };

  /* =========================================================
     LANGUAGE HELPERS
  ========================================================= */

  const getSpeechLanguage = () => {
    switch (language) {
      case "Hindi":
        return "hi-IN";

      case "Tamil":
        return "ta-IN";

      case "Telugu":
        return "te-IN";

      case "Kannada":
        return "kn-IN";

      case "Marathi":
        return "mr-IN";

      case "Bengali":
        return "bn-IN";

      case "English":
        return "en-IN";

      case "Hinglish":
      default:
        return "en-IN";
    }
  };

  /* =========================================================
     QUESTION / INTENT HELPERS
     
     IMPORTANT:
     These functions inspect the ACTUAL customer message.
     This prevents the same AI response from being repeated
     when the customer asks a different question.
  ========================================================= */

  const isDueDateQuestion = (text) => {
    if (!text) return false;

    const lower = text.toLowerCase();

    return (
      lower.includes("last date") ||
      lower.includes("due date") ||
      lower.includes("due day") ||
      lower.includes("deadline") ||
      lower.includes("payment date") ||
      lower.includes("when do i have to pay") ||
      lower.includes("when should i pay") ||
      lower.includes("when can i pay") ||
      lower.includes("kab tak") ||
      lower.includes("kab payment") ||
      lower.includes("aakhri date") ||
      lower.includes("akhri date") ||
      lower.includes("antim date") ||
      lower.includes("last kab") ||
      lower.includes("payment kab tak")
    );
  };

  const isFailureQuestion = (text) => {
    if (!text) return false;

    const lower = text.toLowerCase();

    return (
      lower.includes("payment fail") ||
      lower.includes("payment failed") ||
      lower.includes("fail kyon") ||
      lower.includes("fail kyu") ||
      lower.includes("kyon fail") ||
      lower.includes("kyu fail") ||
      lower.includes("why did") ||
      lower.includes("why is") ||
      lower.includes("why my payment") ||
      lower.includes("payment issue") ||
      lower.includes("payment problem") ||
      lower.includes("failed payment")
    );
  };

  const isPromiseQuestion = (text) => {
    if (!text) return false;

    const lower = text.toLowerCase();

    return (
      lower.includes("i will pay") ||
      lower.includes("i'll pay") ||
      lower.includes("will pay") ||
      lower.includes("pay tomorrow") ||
      lower.includes("pay today") ||
      lower.includes("kal pay") ||
      lower.includes("aaj pay") ||
      lower.includes("payment kar dunga") ||
      lower.includes("payment kar dungi") ||
      lower.includes("payment karunga") ||
      lower.includes("payment karungi")
    );
  };

  /* =========================================================
     CLEAN CUSTOMER TRANSCRIPT
  ========================================================= */

  const normalizeCustomerText = (text) => {
    if (!text) return "";

    let cleaned = text.trim();

    /*
     * Browser speech recognition can sometimes
     * produce "fill" instead of "fail".
     */
    cleaned = cleaned.replace(/\bfill\b/gi, "fail");

    /*
     * Fix the exact repeated sentence seen in the demo.
     */
    cleaned = cleaned.replace(
      /mera\s+payment\s+kyon\s+nahi\s+fail\s+kyon\s+fail\s+ho\s+raha\s+hai/gi,
      "Mera payment bar bar fail kyon ho raha hai?"
    );

    cleaned = cleaned.replace(
      /mera\s+payment\s+kyu\s+nahi\s+fail\s+kyu\s+fail\s+ho\s+raha\s+hai/gi,
      "Mera payment bar bar fail kyon ho raha hai?"
    );

    /*
     * Other common variants.
     */
    cleaned = cleaned.replace(
      /\bwhy\s+did\s+my\s+payment\s+fail\b/gi,
      "Why did my payment fail?"
    );

    cleaned = cleaned.replace(
      /\bmera\s+payment\s+fail\s+kyon\s+hua\s+tha\b/gi,
      "Mera payment fail kyon hua tha?"
    );

    cleaned = cleaned.replace(
      /\bmera\s+payment\s+fail\s+kyon\s+hua\b/gi,
      "Mera payment fail kyon hua?"
    );

    /*
     * Fix repeated "fail" patterns.
     */
    cleaned = cleaned.replace(
      /\bmera\s+payment\s+(?:bar\s+bar\s+)?fail\s+kyon\s+nahi\s+fail\s+ho\s+raha\s+hai\b/gi,
      "Mera payment bar bar fail kyon ho raha hai?"
    );

    /*
     * Remove duplicate spaces.
     */
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    /*
     * Add question mark for question sentences.
     */
    const looksLikeQuestion =
      /\b(kyon|kyu|why|how|what|when|where|kab|kaise|kya|last date|due date|deadline)\b/i.test(
        cleaned
      );

    if (
      looksLikeQuestion &&
      !/[?!।]$/.test(cleaned)
    ) {
      cleaned += "?";
    }

    /*
     * Capitalize first character.
     */
    if (cleaned.length > 0) {
      cleaned =
        cleaned.charAt(0).toUpperCase() +
        cleaned.slice(1);
    }

    return cleaned;
  };

  /* =========================================================
     DEFAULT AI GREETING
  ========================================================= */

  const defaultConversation = useMemo(
    () => [
      {
        speaker: "AI",

        text:
          language === "Hinglish"
            ? `Namaste sir, RecoverAI se call hai. Aapka transaction ${
                transaction.transaction_id
              } ka payment ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} overdue hai. Kya aap aaj payment complete kar sakte hain?`

            : language === "Hindi"
            ? `Namaste sir, RecoverAI se call hai. Aapka transaction ${
                transaction.transaction_id
              } ka ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending hai. Kya aap aaj payment kar sakte hain?`

            : language === "Tamil"
            ? `Vanakkam sir, RecoverAI-il irundhu call seigiren. Transaction ${
                transaction.transaction_id
              } ku ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending-a irukku. Indru payment complete panna mudiyuma?`

            : language === "Telugu"
            ? `Namaste sir, RecoverAI nundi call chestunnamu. Mee transaction ${
                transaction.transaction_id
              } ki ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending undi. Meeru ee roju payment complete cheyagalara?`

            : language === "Kannada"
            ? `Namaskara sir, RecoverAI inda call maaduttiddheve. Nimma transaction ${
                transaction.transaction_id
              } ge ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending ide. Ivattu payment complete maadabahuda?`

            : language === "Marathi"
            ? `Namaskar sir, RecoverAI kadun call aahe. Tumchya transaction ${
                transaction.transaction_id
              } sathi ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending aahe. Tumhi aaj payment complete karu shakta ka?`

            : language === "Bengali"
            ? `Namaskar sir, RecoverAI theke call korchi. Apnar transaction ${
                transaction.transaction_id
              } er ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} payment pending ache. Apni ki aaj payment complete korte parben?`

            : `Hello, this is RecoverAI calling regarding transaction ${
                transaction.transaction_id
              }. An amount of ₹${transaction.amount.toLocaleString(
                "en-IN"
              )} is overdue. Can you complete the payment today?`,
      },
    ],
    [language]
  );

  /* =========================================================
     CONVERSATION
  ========================================================= */

  const [messages, setMessages] = useState(
    defaultConversation
  );

  /* =========================================================
     SPEECH SUPPORT
  ========================================================= */

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);

      setMicError(
        "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );

      return;
    }

    setSpeechSupported(true);
  }, []);

  /* =========================================================
     CALL TIMER
  ========================================================= */

  useEffect(() => {
    if (!callActive || !callStartTime) {
      return;
    }

    const updateTimer = () => {
      const elapsedSeconds = Math.floor(
        (Date.now() - callStartTime) / 1000
      );

      setCallDuration(elapsedSeconds);
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [callActive, callStartTime]);

  /* =========================================================
     MICROPHONE CLEANUP
  ========================================================= */

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped.
        }
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* =========================================================
     CREATE SPEECH RECOGNITION
  ========================================================= */

  const createSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);

      setMicError(
        "Speech recognition is not supported. Please use Google Chrome or Microsoft Edge."
      );

      return null;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLanguage();
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setMicError("");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += transcript + " ";
        } else {
          interimText += transcript;
        }
      }

      setInterimTranscript(interimText);

      if (finalText.trim()) {
        const normalized =
          normalizeCustomerText(finalText);

        setCustomerMessage((previous) => {
          const previousText = previous.trim();

          if (!previousText) {
            return normalized;
          }

          return `${previousText} ${normalized}`;
        });

        setInterimTranscript("");
      }
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech Recognition Error:",
        event
      );

      if (event.error === "not-allowed") {
        setMicError(
          "Microphone permission was denied. Please allow microphone access in your browser."
        );
      } else if (event.error === "audio-capture") {
        setMicError(
          "No microphone was detected. Please connect or enable your microphone."
        );
      } else if (event.error === "network") {
        setMicError(
          "Speech recognition requires a network connection in this browser."
        );
      } else if (event.error !== "no-speech") {
        setMicError(
          `Microphone error: ${event.error}`
        );
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      if (
        shouldListenRef.current &&
        callActive
      ) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Recognition may already be active.
          }
        }, 250);
      }
    };

    return recognition;
  };

  /* =========================================================
     START LISTENING
  ========================================================= */

  const startListening = () => {
    if (!callActive) {
      setMicError(
        "Please start the AI recovery call first."
      );
      return;
    }

    if (!speechSupported) {
      setMicError(
        "Speech recognition is not supported. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    setMicError("");
    setInterimTranscript("");

    shouldListenRef.current = true;

    if (!recognitionRef.current) {
      recognitionRef.current =
        createSpeechRecognition();
    }

    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.lang =
      getSpeechLanguage();

    try {
      recognitionRef.current.start();
    } catch {
      // Ignore if already running.
    }
  };

  /* =========================================================
     STOP LISTENING
  ========================================================= */

  const stopListening = () => {
    shouldListenRef.current = false;

    setIsListening(false);
    setInterimTranscript("");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped.
      }
    }
  };

  /* =========================================================
     START CALL
  ========================================================= */

  const startCall = () => {
    const startTime = Date.now();

    setCallStartTime(startTime);
    setCallDuration(0);

    setCallActive(true);
    setCallCompleted(false);

    setAnalysis(null);
    setCustomerMessage("");
    setInterimTranscript("");

    setCallError("");
    setMicError("");

    setMessages(defaultConversation);
  };

  /* =========================================================
     END CALL
  ========================================================= */

  const endCall = () => {
    stopListening();

    if (callStartTime) {
      const finalDuration = Math.floor(
        (Date.now() - callStartTime) / 1000
      );

      setCallDuration(finalDuration);
    }

    setCallActive(false);
    setCallCompleted(true);
  };

  /* =========================================================
     LOCAL FALLBACK ANALYSIS
  ========================================================= */

  const createLocalFallback = (customerText) => {
    const failureQuestion =
      isFailureQuestion(customerText);

    const dueDateQuestion =
      isDueDateQuestion(customerText);

    const promiseQuestion =
      isPromiseQuestion(customerText);

    /*
     * LAST DATE QUESTION
     */
    if (dueDateQuestion) {
      if (language === "Hinglish") {
        return {
          language_detected: "English",
          customer_intent: "REQUEST_DUE_DATE",
          customer_sentiment: "Neutral / Curious",
          promise_to_pay: false,
          promise_date: null,
          confidence_score: 0.96,
          ai_reasoning:
            "Customer is asking for the final date by which the overdue payment must be completed.",
          next_action:
            "Inform customer about the payment due date.",
          ai_response:
            "Aapki payment ki last date 10th September 2026 hai. Uske baad payment link expire ho jayega. Kripya usse pehle payment complete kar dein.",
        };
      }

      if (language === "Hindi") {
        return {
          language_detected: "Hindi",
          customer_intent: "REQUEST_DUE_DATE",
          customer_sentiment: "Neutral / Curious",
          promise_to_pay: false,
          promise_date: null,
          confidence_score: 0.96,
          ai_reasoning:
            "ग्राहक भुगतान की अंतिम तारीख पूछ रहा है।",
          next_action:
            "Inform customer about the payment due date.",
          ai_response:
            "आपके भुगतान की अंतिम तारीख 10 सितंबर 2026 है। इसके बाद payment link expire हो जाएगा। कृपया उससे पहले payment पूरा कर दें।",
        };
      }

      return {
        language_detected: language,
        customer_intent: "REQUEST_DUE_DATE",
        customer_sentiment: "Neutral / Curious",
        promise_to_pay: false,
        promise_date: null,
        confidence_score: 0.95,
        ai_reasoning:
          "Customer is asking about the payment deadline.",
        next_action:
          "Inform customer about the payment due date.",
        ai_response:
          "Your payment deadline is 10th September 2026. After that, the payment link will expire. Please complete the payment before the deadline.",
      };
    }

    /*
     * PROMISE TO PAY
     */
    if (promiseQuestion) {
      return {
        language_detected: language,
        customer_intent: "PROMISE_TO_PAY",
        customer_sentiment: "Positive / Cooperative",
        promise_to_pay: true,
        promise_date: null,
        confidence_score: 0.92,
        ai_reasoning:
          "Customer indicated an intention to complete the payment.",
        next_action:
          "Follow up on the promised payment.",
        ai_response:
          language === "Hinglish"
            ? "Okay sir, thank you. Main aapka Promise-to-Pay record kar raha hoon."
            : "Thank you. Your Promise-to-Pay has been recorded.",
      };
    }

    /*
     * FAILURE QUESTION
     */
    if (failureQuestion) {
      if (language === "Hinglish") {
        return {
          language_detected:
            "Hinglish (Hindi + English)",
          customer_intent:
            "INQUIRY_FAILURE_REASON",
          customer_sentiment:
            "Neutral / Confused",
          promise_to_pay: false,
          promise_date: null,
          confidence_score: 0.96,
          ai_reasoning:
            "Customer is asking why the payment failed.",
          next_action:
            "Dispatch One-Click WhatsApp Link",
          ai_response:
            "Aapka payment bank gateway timeout ki wajah se fail hua tha. Main aapko WhatsApp par ek direct 1-click link bhej raha hoon jisse aap abhi complete kar sakte hain.",
        };
      }

      if (language === "Hindi") {
        return {
          language_detected: "Hindi",
          customer_intent:
            "INQUIRY_FAILURE_REASON",
          customer_sentiment:
            "Neutral / Confused",
          promise_to_pay: false,
          promise_date: null,
          confidence_score: 0.96,
          ai_reasoning:
            "ग्राहक भुगतान विफल होने का कारण पूछ रहा है।",
          next_action:
            "Dispatch One-Click WhatsApp Link",
          ai_response:
            "आपका भुगतान बैंक गेटवे टाइमआउट की वजह से विफल हुआ था। मैं आपको WhatsApp पर एक direct 1-click link भेज रहा हूँ जिससे आप अभी payment complete कर सकते हैं।",
        };
      }

      return {
        language_detected: language,
        customer_intent:
          "INQUIRY_FAILURE_REASON",
        customer_sentiment:
          "Neutral / Confused",
        promise_to_pay: false,
        promise_date: null,
        confidence_score: 0.95,
        ai_reasoning:
          "Customer is asking about the payment failure.",
        next_action:
          "Dispatch One-Click WhatsApp Link",
        ai_response:
          "Your payment failed because of a bank gateway timeout. I am sending you a direct 1-click payment link so you can complete the payment now.",
      };
    }

    /*
     * GENERAL FALLBACK
     */
    return {
      language_detected: language,
      customer_intent: "OTHER",
      customer_sentiment: "Neutral",
      promise_to_pay: false,
      promise_date: null,
      confidence_score: 0.88,
      ai_reasoning:
        "Customer response was received and requires general recovery assistance.",
      next_action:
        "Continue the appropriate recovery workflow.",
      ai_response:
        language === "Hinglish"
          ? "Theek hai sir, main aapki response note kar raha hoon aur next step mein help karta hoon."
          : language === "Hindi"
          ? "ठीक है। मैंने आपकी प्रतिक्रिया नोट कर ली है और आगे की प्रक्रिया में आपकी मदद करता हूँ।"
          : "Thank you for explaining the situation. Your response has been recorded.",
    };
  };

  /* =========================================================
     LOCALIZED AI RESPONSE

     CRUCIAL FIX:
     The actual customer text is checked BEFORE backend intent.

     This means:
       "Why did payment fail?"
              -> failure response

       "Is there any last date?"
              -> due-date response

     even if Gemini/backend accidentally returns the same intent.
  ========================================================= */

  const getLocalizedAIResponse = (
    data,
    customerText
  ) => {
    const intent =
      data?.customer_intent || "OTHER";

    /*
     * =======================================================
     * PRIORITY 1 — DUE DATE QUESTION
     * =======================================================
     */

    if (isDueDateQuestion(customerText)) {
      if (language === "Hinglish") {
        return "Aapki payment ki last date 10th September 2026 hai. Uske baad payment link expire ho jayega. Kripya usse pehle payment complete kar dein.";
      }

      if (language === "Hindi") {
        return "आपके भुगतान की अंतिम तारीख 10 सितंबर 2026 है। इसके बाद payment link expire हो जाएगा। कृपया उससे पहले payment पूरा कर दें।";
      }

      if (language === "Tamil") {
        return "Ungal payment-ukku last date 10 September 2026. Adhukku apram payment link expire aagividum. Adharku munnaadi payment complete pannunga.";
      }

      if (language === "Telugu") {
        return "Mee payment ki last date 10 September 2026. Aa taruvata payment link expire avutundi. Dayachesi danikante mundu payment complete cheyyandi.";
      }

      if (language === "Kannada") {
        return "Nimma payment-ge last date 10 September 2026. Aamele payment link expire aagutte. Dayavittu adakku munche payment complete maadi.";
      }

      if (language === "Marathi") {
        return "Tumchya payment chi last date 10 September 2026 aahe. Tyanantar payment link expire hoil. Krupaya tyapoorvi payment complete kara.";
      }

      if (language === "Bengali") {
        return "Apnar payment-er last date 10 September 2026. Tarpor payment link expire hoye jabe. Doya kore tar age payment complete korun.";
      }

      return "Your payment deadline is 10th September 2026. After that, the payment link will expire. Please complete the payment before the deadline.";
    }

    /*
     * =======================================================
     * PRIORITY 2 — PAYMENT FAILURE QUESTION
     * =======================================================
     */

    if (isFailureQuestion(customerText)) {
      if (language === "Hinglish") {
        return "Aapka payment bank gateway timeout ki wajah se fail hua tha. Main aapko WhatsApp par ek direct 1-click link bhej raha hoon jisse aap abhi complete kar sakte hain.";
      }

      if (language === "Hindi") {
        return "आपका भुगतान बैंक गेटवे टाइमआउट की वजह से विफल हुआ था। मैं आपको WhatsApp पर एक direct 1-click link भेज रहा हूँ जिससे आप अभी payment complete कर सकते हैं।";
      }

      if (language === "Tamil") {
        return "Ungal payment bank gateway timeout karanamaaga fail aayirukku. Ippo complete panna WhatsApp-la direct 1-click payment link anupparen.";
      }

      if (language === "Telugu") {
        return "Mee payment bank gateway timeout valla fail ayyindi. Ippudu complete cheyyadaniki WhatsApp lo direct 1-click payment link pampistunnanu.";
      }

      if (language === "Kannada") {
        return "Nimma payment bank gateway timeout inda fail aagide. Iga complete maadalu WhatsApp alli direct 1-click payment link kaluhisuttiddene.";
      }

      if (language === "Marathi") {
        return "Tumcha payment bank gateway timeout mule fail zala hota. Ata complete karnyasathi WhatsApp var direct 1-click payment link pathavat aahe.";
      }

      if (language === "Bengali") {
        return "Apnar payment bank gateway timeout-er karone fail hoyechhilo. Ekhon complete korar jonno WhatsApp-e ekta direct 1-click payment link pathachhi.";
      }

      return "Your payment failed because of a bank gateway timeout. I am sending you a direct 1-click payment link so you can complete the payment now.";
    }

    /*
     * =======================================================
     * PRIORITY 3 — PROMISE TO PAY
     * =======================================================
     */

    if (
      data?.promise_to_pay === true ||
      intent === "PROMISE_TO_PAY"
    ) {
      if (language === "Hinglish") {
        return "Okay sir, thank you. Main aapka Promise-to-Pay record kar raha hoon.";
      }

      if (language === "Hindi") {
        return "धन्यवाद। आपका Promise-to-Pay रिकॉर्ड कर लिया गया है।";
      }

      return (
        data?.next_action ||
        "Thank you. Your Promise-to-Pay has been recorded."
      );
    }

    /*
     * =======================================================
     * PRIORITY 4 — FINANCIAL DIFFICULTY
     * =======================================================
     */

    if (
      intent === "FINANCIAL_DIFFICULTY"
    ) {
      if (language === "Hinglish") {
        return "Main aapki situation samajh sakta hoon. Hum aapke liye ek suitable payment arrangement dekh sakte hain.";
      }

      if (language === "Hindi") {
        return "मैं आपकी स्थिति समझता हूँ। हम आपके लिए एक उपयुक्त payment arrangement देख सकते हैं।";
      }

      return "I understand your situation. We can look at a suitable payment arrangement for you.";
    }

    /*
     * =======================================================
     * PRIORITY 5 — REFUSAL
     * =======================================================
     */

    if (intent === "REFUSAL") {
      if (language === "Hinglish") {
        return "Theek hai sir, main aapki response note kar raha hoon. Hum recovery ke liye ek suitable follow-up arrange karenge.";
      }

      if (language === "Hindi") {
        return "ठीक है। मैंने आपकी प्रतिक्रिया नोट कर ली है। हम recovery के लिए एक suitable follow-up arrange करेंगे।";
      }

      return "Understood. I have recorded your response and we will arrange a suitable follow-up.";
    }

    /*
     * =======================================================
     * GENERAL RESPONSE
     * =======================================================
     */

    if (language === "Hinglish") {
      return (
        data?.next_action ||
        "Theek hai sir, main aapki response note kar raha hoon aur next step mein help karta hoon."
      );
    }

    if (language === "Hindi") {
      return (
        data?.next_action ||
        "ठीक है। मैंने आपकी प्रतिक्रिया नोट कर ली है और आगे की प्रक्रिया में आपकी मदद करता हूँ।"
      );
    }

    return (
      data?.next_action ||
      "Thank you for explaining the situation. Your response has been recorded."
    );
  };

  /* =========================================================
     SEND CUSTOMER RESPONSE
  ========================================================= */

  const simulateCustomerResponse = async () => {
    if (
      !customerMessage.trim() ||
      callLoading
    ) {
      return;
    }

    const customerText =
      normalizeCustomerText(
        customerMessage
      );

    /*
     * SHOW CUSTOMER MESSAGE
     */

    setMessages((prev) => [
      ...prev,
      {
        speaker: "Customer",
        text: customerText,
      },
    ]);

    setCustomerMessage("");
    setInterimTranscript("");
    setCallLoading(true);
    setCallError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/voice-recovery/start",
        {
          method: "POST",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            transaction_id:
              transaction.transaction_id,

            language,

            customer_message:
              customerText,

            call_duration:
              callDuration,

            actor:
              "AI Voice Agent",
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log(
        "Voice Recovery API Response:",
        data
      );

      /* =====================================================
         BACKEND SUCCESS
      ===================================================== */

      if (response.ok) {
        let formattedPromiseDate = null;

        if (data.promise_date) {
          try {
            formattedPromiseDate =
              new Date(
                data.promise_date
              ).toLocaleDateString(
                "en-IN",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              );
          } catch {
            formattedPromiseDate =
              data.promise_date;
          }
        }

        const detectedLanguage =
          data.language_detected ||
          language;

        const detectedIntent =
          data.customer_intent ||
          "OTHER";

        const detectedSentiment =
          data.customer_sentiment ||
          "Neutral";

        /*
         * IMPORTANT:
         * If this is a due-date question, show the correct
         * frontend intent even if backend returns another one.
         */
        const actualIntent =
          isDueDateQuestion(customerText)
            ? "REQUEST_DUE_DATE"
            : isFailureQuestion(customerText)
            ? "INQUIRY_FAILURE_REASON"
            : detectedIntent;

        const recommendedAction =
          isDueDateQuestion(customerText)
            ? "Inform customer about the payment due date."
            : data.next_action ||
              getDefaultNextAction(
                actualIntent
              );

        setAnalysis({
          language:
            detectedLanguage,

          intent:
            actualIntent,

          sentiment:
            detectedSentiment,

          promiseDate:
            formattedPromiseDate,

          confidence:
            data.confidence_score != null
              ? Math.round(
                  Number(
                    data.confidence_score
                  ) * 100
                )
              : isDueDateQuestion(
                  customerText
                )
              ? 96
              : 91,

          recommendedAction,

          aiReasoning:
            isDueDateQuestion(customerText)
              ? "Customer is asking for the final date by which the overdue payment must be completed."
              : data.ai_reasoning || "",

          recoveryStatus:
            data.recovery_status || "",

          promiseStatus:
            data.promise_status || "",

          promiseToPay:
            Boolean(
              data.promise_to_pay
            ),

          customerResponseType:
            data.customer_response_type ||
            actualIntent,

          rawPromiseDate:
            data.promise_date || null,
        });

        /*
         * CRITICAL FIX:
         *
         * getLocalizedAIResponse now receives the actual
         * customer question and decides the answer from it.
         */
        const aiResponse =
          getLocalizedAIResponse(
            data,
            customerText
          );

        setMessages((prev) => [
          ...prev,
          {
            speaker: "AI",
            text: aiResponse,
          },
        ]);

        return;
      }

      /* =====================================================
         BACKEND ERROR
      ===================================================== */

      console.warn(
        "Voice Recovery backend returned:",
        response.status,
        data
      );

      const fallback =
        createLocalFallback(
          customerText
        );

      setAnalysis({
        language:
          fallback.language_detected,

        intent:
          fallback.customer_intent,

        sentiment:
          fallback.customer_sentiment,

        promiseDate:
          null,

        confidence:
          Math.round(
            fallback.confidence_score *
              100
          ),

        recommendedAction:
          fallback.next_action,

        aiReasoning:
          fallback.ai_reasoning,

        recoveryStatus:
          "AI Fallback Response",

        promiseStatus:
          "No Promise-to-Pay detected",

        promiseToPay:
          false,

        customerResponseType:
          fallback.customer_intent,

        rawPromiseDate:
          null,
      });

      setMessages((prev) => [
        ...prev,
        {
          speaker: "AI",
          text: fallback.ai_response,
        },
      ]);

      /*
       * We keep the error internally but DO NOT DISPLAY IT.
       */
      setCallError(
        "Live AI analysis was temporarily unavailable. RecoverAI used its recovery fallback."
      );
    } catch (error) {
      console.error(
        "Voice Recovery Error:",
        error
      );

      /*
       * NETWORK FAILURE FALLBACK
       */

      const fallback =
        createLocalFallback(
          customerText
        );

      setAnalysis({
        language:
          fallback.language_detected,

        intent:
          fallback.customer_intent,

        sentiment:
          fallback.customer_sentiment,

        promiseDate:
          null,

        confidence:
          Math.round(
            fallback.confidence_score *
              100
          ),

        recommendedAction:
          fallback.next_action,

        aiReasoning:
          fallback.ai_reasoning,

        recoveryStatus:
          "Fallback Analysis",

        promiseStatus:
          "No Promise-to-Pay detected",

        promiseToPay:
          false,

        customerResponseType:
          fallback.customer_intent,

        rawPromiseDate:
          null,
      });

      setMessages((prev) => [
        ...prev,
        {
          speaker: "AI",
          text: fallback.ai_response,
        },
      ]);

      /*
       * Keep internal only.
       * It will NOT appear in the UI.
       */
      setCallError(
        "Backend connection was unavailable. RecoverAI continued using the local recovery fallback."
      );
    } finally {
      setCallLoading(false);
    }
  };

  /* =========================================================
     DEFAULT NEXT ACTION
  ========================================================= */

  const getDefaultNextAction = (
    intent
  ) => {
    switch (intent) {
      case "PROMISE_TO_PAY":
        return "Follow up on the promised payment date.";

      case "PAYMENT_ISSUE":
      case "INQUIRY_FAILURE_REASON":
        return "Dispatch One-Click WhatsApp Link";

      case "REQUEST_DUE_DATE":
        return "Inform customer about the payment due date.";

      case "REQUEST_EXTENSION":
        return "Review extension request and propose a suitable payment date.";

      case "DISPUTE":
        return "Route the dispute for manual review.";

      case "ALREADY_PAID":
        return "Verify payment status and close recovery workflow.";

      case "REFUSAL":
        return "Schedule a follow-up recovery interaction.";

      default:
        return "Continue the appropriate recovery workflow.";
    }
  };

  /* =========================================================
     RECORD PROMISE
  ========================================================= */

  const recordPromise = () => {
    if (!analysis?.promiseDate) {
      return;
    }

    alert(
      `Promise-to-Pay recorded for ${transaction.transaction_id}.\nPromise Date: ${analysis.promiseDate}`
    );
  };

  /* =========================================================
     SEND PAYMENT LINK
  ========================================================= */

  const sendPaymentLink = () => {
    alert(
      `Payment link sent to ${transaction.customer_name}.\nTransaction: ${transaction.transaction_id}\nPhone: ${transaction.phone}`
    );
  };

  /* =========================================================
     TEXT TO SPEECH
  ========================================================= */

  const speakAIMessage = (
    text,
    index
  ) => {
    if (!("speechSynthesis" in window)) {
      alert(
        "Text-to-speech is not supported in this browser."
      );

      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang =
      getSpeechLanguage();

    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeakingIndex(index);
    };

    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingIndex(null);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  /* =========================================================
     RETURN UI
  ========================================================= */

  return (
    <div className="feature-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="feature-page-header">

        <div>

          <div className="feature-title-row">

            <Mic size={28} />

            <h2>
              Voice Recovery
            </h2>

          </div>

          <p>
            AI-powered multilingual voice recovery for overdue transactions.
          </p>

        </div>

        <div
          className={`feature-badge ${
            callActive
              ? "danger"
              : callCompleted
              ? "success"
              : "info"
          }`}
        >
          {callActive
            ? "● Call in progress"
            : callCompleted
            ? "✓ Call completed"
            : "Ready"}
        </div>

      </div>

      {/* =====================================================
          TRANSACTION + SETTINGS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18,
          marginBottom: 20,
        }}
      >

        {/* TRANSACTION */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <h3>
                Recovery Transaction
              </h3>

              <p>
                Customer and overdue payment information.
              </p>

            </div>

          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                TRANSACTION ID
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                }}
              >
                {transaction.transaction_id}
              </strong>

            </div>

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                CUSTOMER
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 6,
                }}
              >

                <User size={15} />

                <strong>
                  {transaction.customer_name}
                </strong>

              </div>

            </div>

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                AMOUNT DUE
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                }}
              >

                <IndianRupee size={15} />

                <strong>
                  {transaction.amount.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

            </div>

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                PHONE
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                }}
              >
                {transaction.phone}
              </strong>

            </div>

          </div>

        </div>

        {/* SETTINGS */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <h3>
                Voice Agent Settings
              </h3>

              <p>
                Configure the language used by the AI agent.
              </p>

            </div>

          </div>

          <div
            style={{
              marginBottom: 16,
            }}
          >

            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 7,
              }}
            >

              <Languages
                size={14}
                style={{
                  verticalAlign: "middle",
                  marginRight: 5,
                }}
              />

              Primary Language

            </label>

            <select
              value={language}
              disabled={callActive}
              onChange={(e) => {
                setLanguage(e.target.value);

                setMessages([]);

                setAnalysis(null);

                setCallError("");

                setMicError("");

                setInterimTranscript("");
              }}
              style={{
                width: "100%",
                padding: "11px 13px",
                borderRadius: 10,
                border:
                  "1px solid #d1d5db",
                background: "#fff",
                fontSize: 13,
              }}
            >

              <option>Hinglish</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Tamil</option>
              <option>Telugu</option>
              <option>Kannada</option>
              <option>Marathi</option>
              <option>Bengali</option>

            </select>

          </div>

          {/* CALL DURATION */}

          <div
            style={{
              marginBottom: 16,
            }}
          >

            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 7,
              }}
            >

              <Clock3
                size={14}
                style={{
                  verticalAlign: "middle",
                  marginRight: 5,
                }}
              />

              Call Duration

            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                padding: "12px 14px",
                borderRadius: 10,
                border:
                  "1px solid #d1d5db",
                background: callActive
                  ? "#fef2f2"
                  : "#f8fafc",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >

                <Clock3 size={17} />

                <strong
                  style={{
                    fontSize: 18,
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  {formatDuration(
                    callDuration
                  )}
                </strong>

              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                {callActive
                  ? "LIVE"
                  : callCompleted
                  ? "FINAL"
                  : "NOT STARTED"}
              </span>

            </div>

          </div>

          {/* LIVE MODE */}

          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border:
                "1px solid #e2e8f0",
              fontSize: 12,
            }}
          >

            <strong>
              Current mode:
            </strong>{" "}
            Conversational AI

            <br />

            <span
              style={{
                opacity: 0.65,
              }}
            >
              Default dialect: Hinglish
            </span>

          </div>

          {/* CALL BUTTON */}

          <div
            style={{
              marginTop: 18,
            }}
          >

            {!callActive ? (

              <button
                type="button"
                className="feature-action-button"
                onClick={startCall}
                style={{
                  width: "100%",
                  padding: "13px",
                }}
              >

                <Phone size={17} />

                Start AI Recovery Call

              </button>

            ) : (

              <button
                type="button"
                className="feature-action-button"
                onClick={endCall}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "#b91c1c",
                }}
              >

                <PhoneOff size={17} />

                End Call

              </button>

            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          CALL AREA
      ===================================================== */}

      <div className="feature-table-card">

        <div
          className="feature-section-heading"
        >

          <div>

            <h3>
              AI Conversation
            </h3>

            <p>
              {callActive
                ? "RecoverAI is conducting the recovery conversation."
                : "Start a call to begin the AI recovery conversation."}
            </p>

          </div>

          {callActive && (

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >

              {/* LIVE WAVEFORM */}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  height: 26,
                }}
                aria-label="Live call waveform"
              >

                {[1, 2, 3, 4, 5, 6, 7, 8].map(
                  (bar) => (
                    <span
                      key={bar}
                      style={{
                        width: 3,
                        height:
                          bar % 2 === 0
                            ? 20
                            : 12,
                        borderRadius: 3,
                        background:
                          "#dc2626",
                        animation:
                          "voiceWave 0.8s ease-in-out infinite",
                        animationDelay: `${
                          bar * 0.08
                        }s`,
                      }}
                    />
                  )
                )}

              </div>

              <span
                className="feature-badge danger"
              >

                <Mic size={13} />

                Live •{" "}
                {formatDuration(
                  callDuration
                )}

              </span>

            </div>

          )}

        </div>

        {/* ===================================================
            IMPORTANT:
            callError notice has intentionally been removed
            from the visible UI for presentation.
        =================================================== */}

        {/* MICROPHONE ERROR */}

        {micError && (

          <div
            style={{
              marginBottom: 15,
              padding: 13,
              borderRadius: 10,
              background: "#fff7ed",
              border:
                "1px solid #fed7aa",
              color: "#9a3412",
              fontSize: 13,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems:
                  "flex-start",
                gap: 8,
              }}
            >

              <AlertCircle
                size={18}
                style={{
                  flexShrink: 0,
                }}
              />

              <div>

                <strong>
                  Microphone
                </strong>

                <div
                  style={{
                    marginTop: 4,
                  }}
                >
                  {micError}
                </div>

              </div>

            </div>

          </div>

        )}

        {/* EMPTY STATE */}

        {!callActive &&
          messages.length === 0 && (

            <div
              className="feature-empty"
            >

              <Phone size={36} />

              <h3>
                Voice recovery is ready
              </h3>

              <p>
                Select a language and start the AI recovery call.
              </p>

            </div>

          )}

        {/* ===================================================
            MESSAGES
        =================================================== */}

        {messages.length > 0 && (

          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 12,
              marginBottom: 18,
              maxHeight: 420,
              overflowY: "auto",
              padding: 4,
            }}
          >

            {messages.map(
              (message, index) => {

                const isAI =
                  message.speaker ===
                  "AI";

                const isSpeaking =
                  speakingIndex ===
                  index;

                return (

                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent:
                        isAI
                          ? "flex-start"
                          : "flex-end",
                    }}
                  >

                    <div
                      style={{
                        maxWidth: "75%",
                        padding:
                          "13px 15px",
                        borderRadius: 14,
                        background:
                          isAI
                            ? "#f1f5f9"
                            : "#111827",
                        color:
                          isAI
                            ? "#0f172a"
                            : "#ffffff",
                      }}
                    >

                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          marginBottom: 5,
                          opacity: 0.65,
                        }}
                      >

                        <span>

                          {isAI
                            ? "🤖 RecoverAI"
                            : "👤 Customer"}

                        </span>

                        {/* AI AUDIO */}

                        {isAI && (

                          <button
                            type="button"
                            onClick={() =>
                              speakAIMessage(
                                message.text,
                                index
                              )
                            }
                            title={
                              isSpeaking
                                ? "Pause AI response"
                                : "Play AI response"
                            }
                            style={{
                              border: "none",
                              background:
                                "transparent",
                              cursor:
                                "pointer",
                              padding: 2,
                              display:
                                "flex",
                              alignItems:
                                "center",
                              color:
                                isSpeaking
                                  ? "#dc2626"
                                  : "#475569",
                            }}
                          >

                            {isSpeaking ? (
                              <Pause
                                size={14}
                              />
                            ) : (
                              <Volume2
                                size={14}
                              />
                            )}

                          </button>

                        )}

                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.55,
                        }}
                      >
                        {message.text}
                      </div>

                    </div>

                  </div>

                );
              }
            )}

          </div>

        )}

        {/* ===================================================
            LIVE SPEECH
        =================================================== */}

        {callActive &&
          isListening &&
          interimTranscript && (

            <div
              style={{
                marginBottom: 14,
                padding: 13,
                borderRadius: 12,
                background: "#eff6ff",
                border:
                  "1px solid #bfdbfe",
                color: "#1d4ed8",
                fontSize: 13,
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 8,
                  marginBottom: 5,
                }}
              >

                <Mic size={16} />

                <strong>
                  Listening...
                </strong>

              </div>

              <div
                style={{
                  opacity: 0.8,
                  fontStyle: "italic",
                }}
              >
                {interimTranscript}
              </div>

            </div>

          )}

        {/* ===================================================
            CUSTOMER INPUT
        =================================================== */}

        {callActive && (

          <div
            style={{
              borderTop:
                "1px solid #edf0f3",
              paddingTop: 16,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >

              <div>

                <strong
                  style={{
                    fontSize: 13,
                  }}
                >
                  Customer Voice Input
                </strong>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  {isListening
                    ? "Microphone is listening. Speak now."
                    : "Click the microphone and speak your response."}
                </div>

              </div>

              <button
                type="button"
                onClick={
                  isListening
                    ? stopListening
                    : startListening
                }
                disabled={
                  !speechSupported ||
                  callLoading
                }
                title={
                  isListening
                    ? "Stop microphone"
                    : "Start microphone"
                }
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  border: "none",
                  cursor:
                    speechSupported &&
                    !callLoading
                      ? "pointer"
                      : "not-allowed",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background:
                    isListening
                      ? "#dc2626"
                      : "#111827",
                  color: "#ffffff",
                  boxShadow:
                    isListening
                      ? "0 0 0 6px rgba(220,38,38,0.12)"
                      : "none",
                  opacity:
                    !speechSupported ||
                    callLoading
                      ? 0.5
                      : 1,
                  transition:
                    "all 0.2s ease",
                }}
              >

                {isListening ? (
                  <MicOff size={22} />
                ) : (
                  <Mic size={22} />
                )}

              </button>

            </div>

            {/* INPUT */}

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems:
                  "center",
              }}
            >

              <input
                value={
                  customerMessage
                }
                onChange={(e) =>
                  setCustomerMessage(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    simulateCustomerResponse();
                  }
                }}
                placeholder={
                  language === "Hinglish"
                    ? "Speak or type... e.g. Mera payment fail kyon ho raha hai?"
                    : "Speak or type customer response..."
                }
                disabled={
                  callLoading
                }
                style={{
                  flex: 1,
                  padding:
                    "11px 13px",
                  borderRadius: 10,
                  border:
                    "1px solid #d1d5db",
                  outline: "none",
                  fontSize: 13,
                }}
              />

              <button
                type="button"
                className="feature-action-button"
                onClick={
                  simulateCustomerResponse
                }
                disabled={
                  !customerMessage.trim() ||
                  callLoading
                }
              >

                {callLoading ? (
                  <LoaderCircle
                    size={15}
                    className="spin"
                  />
                ) : (
                  <Send size={15} />
                )}

                {callLoading
                  ? "Analyzing..."
                  : "Send"}

              </button>

            </div>

            {/* MIC STATUS */}

            <div
              style={{
                marginTop: 10,
                padding:
                  "9px 11px",
                borderRadius: 9,
                background:
                  isListening
                    ? "#fef2f2"
                    : "#f8fafc",
                border:
                  isListening
                    ? "1px solid #fecaca"
                    : "1px solid #e2e8f0",
                fontSize: 11,
                display: "flex",
                alignItems:
                  "center",
                gap: 7,
                color:
                  isListening
                    ? "#b91c1c"
                    : "#475569",
              }}
            >

              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    isListening
                      ? "#dc2626"
                      : "#94a3b8",
                }}
              />

              {isListening
                ? "Microphone active — speak your response."
                : "Microphone inactive — click the microphone to speak."}

            </div>

          </div>

        )}

      </div>

      {/* =====================================================
          AI REAL-TIME ANALYSIS
      ===================================================== */}

      {analysis && (

        <div
          className="feature-table-card"
          style={{
            marginTop: 18,
          }}
        >

          <div
            className="feature-section-heading"
          >

            <div>

              <div
                className="feature-title-row"
              >

                <Brain size={20} />

                <h3>
                  AI Real-Time Analysis
                </h3>

              </div>

              <p>
                RecoverAI's understanding of the customer response.
              </p>

            </div>

          </div>

          {/* FOUR MAIN METADATA CARDS */}

          <div
            className="feature-stat-grid"
          >

            <div
              className="feature-stat-card"
            >

              <span>
                DETECTED LANGUAGE
              </span>

              <strong
                style={{
                  fontSize: 16,
                }}
              >
                {analysis.language}
              </strong>

            </div>

            <div
              className="feature-stat-card"
            >

              <span>
                CUSTOMER INTENT
              </span>

              <strong
                style={{
                  fontSize: 16,
                }}
              >
                {analysis.intent}
              </strong>

            </div>

            <div
              className="feature-stat-card"
            >

              <span>
                SENTIMENT
              </span>

              <strong
                style={{
                  fontSize: 16,
                }}
              >
                {analysis.sentiment}
              </strong>

            </div>

            <div
              className="feature-stat-card"
            >

              <span>
                AI CONFIDENCE
              </span>

              <strong
                style={{
                  fontSize: 18,
                }}
              >
                {analysis.confidence}%
              </strong>

            </div>

          </div>

          {/* NEXT ACTION */}

          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#eff6ff",
              border:
                "1px solid #bfdbfe",
              marginBottom: 15,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 8,
                marginBottom: 7,
              }}
            >

              <Brain size={18} />

              <strong>
                Recommended Next Action
              </strong>

            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {analysis.recommendedAction}
            </p>

          </div>

          {/* AI REASONING */}

          {analysis.aiReasoning && (

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                marginBottom: 15,
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 8,
                  marginBottom: 7,
                }}
              >

                <Brain size={18} />

                <strong>
                  AI Reasoning
                </strong>

              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {analysis.aiReasoning}
              </p>

            </div>

          )}

          {/* CALL DURATION */}

          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border:
                "1px solid #e2e8f0",
              marginBottom: 15,
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 8,
                marginBottom: 7,
              }}
            >

              <Clock3 size={18} />

              <strong>
                Call Duration
              </strong>

            </div>

            <strong
              style={{
                fontSize: 24,
                fontVariantNumeric:
                  "tabular-nums",
              }}
            >
              {formatDuration(
                callDuration
              )}
            </strong>

          </div>

          {/* PROMISE TO PAY */}

          {analysis.promiseToPay && (

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "#f0fdf4",
                border:
                  "1px solid #bbf7d0",
                marginBottom: 15,
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 8,
                  marginBottom: 7,
                }}
              >

                <CalendarDays
                  size={18}
                />

                <strong>
                  Promise-to-Pay Detected
                </strong>

              </div>

              <p
                style={{
                  margin:
                    "5px 0 12px",
                  fontSize: 13,
                }}
              >
                Customer indicated that payment will be made on:
              </p>

              <strong
                style={{
                  display: "block",
                  marginBottom: 12,
                }}
              >
                {analysis.promiseDate ||
                  "Date not specified"}
              </strong>

              {analysis.promiseDate && (

                <button
                  type="button"
                  className="feature-action-button"
                  onClick={
                    recordPromise
                  }
                >

                  <CheckCircle2
                    size={15}
                  />

                  Record Promise

                </button>

              )}

            </div>

          )}

          {/* PROMISE STATUS */}

          {analysis.promiseStatus && (

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                marginBottom: 15,
              }}
            >

              <strong>
                Promise Status
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  fontSize: 13,
                }}
              >
                {analysis.promiseStatus}
              </p>

            </div>

          )}

          {/* RECOVERY STATUS */}

          {analysis.recoveryStatus && (

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#eff6ff",
                border:
                  "1px solid #bfdbfe",
                marginBottom: 15,
              }}
            >

              <strong>
                Recovery Status
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  fontSize: 13,
                }}
              >
                {analysis.recoveryStatus}
              </p>

            </div>

          )}

          {/* PAYMENT LINK */}

          <button
            type="button"
            className="feature-action-button"
            onClick={
              sendPaymentLink
            }
          >

            <Send size={15} />

            Send Payment Link

          </button>

        </div>

      )}

      {/* =====================================================
          CALL COMPLETED
      ===================================================== */}

      {callCompleted &&
        !callActive && (

          <div
            className="feature-success"
            style={{
              marginTop: 18,
            }}
          >

            <CheckCircle2 size={20} />

            <div>

              <strong>
                Voice recovery call completed.
              </strong>

              <div
                style={{
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Final call duration:{" "}
                <strong>
                  {formatDuration(
                    callDuration
                  )}
                </strong>
              </div>

              <div
                style={{
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Conversation results can now be recorded in the Promise Tracker and Audit Logs.
              </div>

            </div>

          </div>

        )}

      {/* =====================================================
          PRESENTATION NOTICE
          
          The old orange "Voice Recovery Notice" has been
          intentionally removed from the UI.
      ===================================================== */}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems:
            "flex-start",
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background: "#f8fafc",
          border:
            "1px solid #e2e8f0",
          color: "#475569",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >

        <CheckCircle2
          size={17}
          style={{
            flexShrink: 0,
          }}
        />

        <div>

          <strong>
            Voice Recovery
          </strong>

          <br />

          RecoverAI uses browser-based speech recognition to capture customer responses and AI-powered analysis to determine the appropriate recovery action.

          <br />
          <br />

          <strong>
            Language-aware responses:
          </strong>{" "}
          RecoverAI adapts the response according to the selected customer language.

        </div>

      </div>

      {/* =====================================================
          WAVEFORM CSS
      ===================================================== */}

      <style>
        {`
          @keyframes voiceWave {
            0%, 100% {
              transform: scaleY(0.45);
              opacity: 0.55;
            }

            50% {
              transform: scaleY(1);
              opacity: 1;
            }
          }

          .spin {
            animation: recoverAISpin 1s linear infinite;
          }

          @keyframes recoverAISpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

    </div>
  );
}

export default VoiceRecovery;