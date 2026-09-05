import { useState } from "react";
import {
  ShoppingCart,
  User,
  IndianRupee,
  Brain,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock3,
  XCircle,
} from "lucide-react";

function CheckoutDropoffRecovery() {
  const [status, setStatus] = useState("Abandoned");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [paymentLinkSent, setPaymentLinkSent] = useState(false);
  const [recoveredAt, setRecoveredAt] = useState(null);

  const checkout = {
    checkout_id: "CHK10001",
    customer_name: "Rahul Sharma",
    amount: 2999,
    product: "Premium Product",
    phone: "+91 XXXXX XXXXX",
    abandoned_minutes: 18,
    failure_reason: "Payment gateway timeout",
  };

  const recoveryProbability = 78;

  const recommendedAction =
    "Send a payment link and reminder to the customer.";

  // ============================================================
  // SHOW MESSAGE
  // ============================================================

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  // ============================================================
  // START RECOVERY
  // ============================================================

  const handleRecovery = async () => {
    if (loading || status === "Recovered") {
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const recoveryPayload = {
        checkout_id: checkout.checkout_id,
        customer_name: checkout.customer_name,
        amount: checkout.amount,
        product: checkout.product,
        phone: checkout.phone,
        failure_reason: checkout.failure_reason,
      };

      console.log(
        "Starting checkout recovery...",
        recoveryPayload
      );

      const controller = new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000);

      let response;

      try {
        response = await fetch(
          "http://127.0.0.1:8000/api/checkout/dropoff/recover",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(recoveryPayload),
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      console.log(
        "Recovery API response status:",
        response.status
      );

      // ========================================================
      // READ RESPONSE SAFELY
      // ========================================================

      let data = {};

      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error(
            "JSON parsing error:",
            jsonError
          );

          data = {};
        }
      } else {
        try {
          const text = await response.text();

          if (text) {
            data = {
              message: text,
            };
          }
        } catch (textError) {
          console.error(
            "Response reading error:",
            textError
          );
        }
      }

      console.log(
        "Recovery API response:",
        data
      );

      // ========================================================
      // BACKEND ERROR
      // ========================================================

      if (!response.ok) {
        const backendMessage =
          data?.detail ||
          data?.message ||
          `Recovery failed. Server returned status ${response.status}.`;

        throw new Error(backendMessage);
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      const recoveryTime = new Date();

      setStatus("Recovered");
      setRecoveredAt(recoveryTime);

      showMessage(
        data?.message ||
          "Checkout recovery action completed successfully.",
        "success"
      );
    } catch (error) {
      console.error(
        "Checkout recovery error:",
        error
      );

      // ========================================================
      // CONNECTION ERROR
      // ========================================================

      if (error?.name === "AbortError") {
        showMessage(
          "Recovery request timed out. Please check whether the FastAPI backend is running.",
          "error"
        );
      } else if (
        error?.message === "Failed to fetch" ||
        error?.message?.includes("NetworkError")
      ) {
        showMessage(
          "Unable to connect to the FastAPI backend. Make sure your server is running on http://127.0.0.1:8000.",
          "error"
        );
      } else {
        showMessage(
          error?.message ||
            "Unable to start checkout recovery.",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SEND PAYMENT LINK
  // ============================================================

  const sendPaymentLink = () => {
    if (paymentLinkSent) {
      return;
    }

    console.log(
      "Sending payment link to:",
      checkout.customer_name
    );

    setPaymentLinkSent(true);

    showMessage(
      `Payment link sent to ${checkout.customer_name}.`,
      "success"
    );
  };

  // ============================================================
  // RESET RECOVERY
  // ============================================================

  const resetRecovery = () => {
    setStatus("Abandoned");
    setRecoveredAt(null);
    setMessage("");
    setMessageType("");
    setPaymentLinkSent(false);
    setLoading(false);
  };

  // ============================================================
  // FORMAT RECOVERY TIME
  // ============================================================

  const formatRecoveryTime = (date) => {
    if (!date) {
      return "";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // ============================================================
  // STATUS HELPERS
  // ============================================================

  const isRecovered = status === "Recovered";

  return (
    <div className="feature-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="feature-page-header">

        <div>

          <div className="feature-title-row">

            <ShoppingCart size={28} />

            <h2>
              Checkout Drop-off Recovery
            </h2>

          </div>

          <p>
            Recover customers who abandon checkout before
            completing payment.
          </p>

        </div>

        <div
          className={`feature-badge ${
            isRecovered
              ? "success"
              : "warning"
          }`}
        >
          {isRecovered
            ? "✓ Recovered"
            : "● Checkout Abandoned"}
        </div>

      </div>


      {/* ======================================================
          SUCCESS / ERROR MESSAGE
      ====================================================== */}

      {message && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 16px",
            borderRadius: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,

            background:
              messageType === "success"
                ? "#f0fdf4"
                : "#fef2f2",

            border:
              messageType === "success"
                ? "1px solid #bbf7d0"
                : "1px solid #fecaca",

            color:
              messageType === "success"
                ? "#166534"
                : "#991b1b",
          }}
        >

          {messageType === "success" ? (
            <CheckCircle2
              size={20}
              style={{
                flexShrink: 0,
                marginTop: 1,
              }}
            />
          ) : (
            <XCircle
              size={20}
              style={{
                flexShrink: 0,
                marginTop: 1,
              }}
            />
          )}

          <div>

            <strong
              style={{
                display: "block",
                marginBottom: 3,
              }}
            >
              {messageType === "success"
                ? "Recovery Successful"
                : "Recovery Failed"}
            </strong>

            <span
              style={{
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {message}
            </span>

          </div>

        </div>
      )}


      {/* ======================================================
          RECOVERY TIME
      ====================================================== */}

      {isRecovered && recoveredAt && (
        <div
          style={{
            marginBottom: 18,
            padding: "12px 15px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#065f46",
            fontSize: 13,
          }}
        >

          <Clock3 size={16} />

          <span>
            Checkout recovered on{" "}
            <strong>
              {formatRecoveryTime(recoveredAt)}
            </strong>
          </span>

        </div>
      )}


      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="feature-stat-grid">

        {/* CHECKOUT ID */}

        <div className="feature-stat-card">

          <span>
            CHECKOUT ID
          </span>

          <strong
            style={{
              fontSize: 18,
            }}
          >
            {checkout.checkout_id}
          </strong>

        </div>


        {/* AMOUNT */}

        <div className="feature-stat-card">

          <span>
            AMOUNT
          </span>

          <strong>
            ₹
            {checkout.amount.toLocaleString(
              "en-IN"
            )}
          </strong>

        </div>


        {/* ABANDONED AFTER */}

        <div className="feature-stat-card">

          <span>
            ABANDONED AFTER
          </span>

          <strong>
            {checkout.abandoned_minutes} min
          </strong>

        </div>


        {/* RECOVERY PROBABILITY */}

        <div className="feature-stat-card">

          <span>
            RECOVERY PROBABILITY
          </span>

          <strong>
            {recoveryProbability}%
          </strong>

        </div>

      </div>


      {/* ======================================================
          CUSTOMER + AI SECTION
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18,
        }}
      >

        {/* ====================================================
            CUSTOMER INFORMATION
        ==================================================== */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <h3>
                Checkout Information
              </h3>

              <p>
                Details of the abandoned checkout.
              </p>

            </div>

          </div>


          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >

            {/* CUSTOMER */}

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
                  gap: 7,
                  marginTop: 6,
                }}
              >

                <User size={16} />

                <strong>
                  {checkout.customer_name}
                </strong>

              </div>

            </div>


            {/* PHONE */}

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
                {checkout.phone}
              </strong>

            </div>


            {/* PRODUCT */}

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                PRODUCT
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                }}
              >
                {checkout.product}
              </strong>

            </div>


            {/* AMOUNT */}

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                AMOUNT
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 6,
                }}
              >

                <IndianRupee size={16} />

                <strong>
                  {checkout.amount.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

            </div>


            {/* DROP-OFF REASON */}

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                DROP-OFF REASON
              </span>

              <p
                style={{
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {checkout.failure_reason}
              </p>

            </div>

          </div>

        </div>


        {/* ====================================================
            AI RECOVERY RECOMMENDATION
        ==================================================== */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <div className="feature-title-row">

                <Brain size={20} />

                <h3>
                  AI Recovery Recommendation
                </h3>

              </div>

              <p>
                RecoverAI analyzes the abandoned
                checkout.
              </p>

            </div>

          </div>


          {/* ==================================================
              RECOVERY PROBABILITY
          ================================================== */}

          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              marginBottom: 15,
            }}
          >

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.6,
              }}
            >
              RECOVERY PROBABILITY
            </span>

            <strong
              style={{
                display: "block",
                fontSize: 32,
                marginTop: 6,
              }}
            >
              {recoveryProbability}%
            </strong>

          </div>


          {/* ==================================================
              DROP-OFF REASON
          ================================================== */}

          <div
            style={{
              padding: 15,
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
                gap: 8,
                alignItems: "center",
                marginBottom: 7,
              }}
            >

              <AlertTriangle size={18} />

              <strong>
                Drop-off Reason
              </strong>

            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13,
              }}
            >
              {checkout.failure_reason}
            </p>

          </div>


          {/* ==================================================
              RECOMMENDED ACTION
          ================================================== */}

          <div
            style={{
              padding: 15,
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
                gap: 8,
                alignItems: "center",
                marginBottom: 7,
              }}
            >

              <Brain size={18} />

              <strong>
                Recommended Action
              </strong>

            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {recommendedAction}
            </p>

          </div>


          {/* ==================================================
              RECOVERY STATUS
          ================================================== */}

          {loading && (
            <div
              style={{
                padding: 15,
                borderRadius: 12,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                marginBottom: 15,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >

              <RefreshCw
                size={18}
                className="spin"
              />

              <div>

                <strong
                  style={{
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Recovery in progress
                </strong>

                <span
                  style={{
                    fontSize: 13,
                  }}
                >
                  RecoverAI is processing this
                  abandoned checkout...
                </span>

              </div>

            </div>
          )}


          {/* ==================================================
              RECOVERED STATUS
          ================================================== */}

          {isRecovered && (
            <div
              style={{
                padding: 15,
                borderRadius: 12,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                marginBottom: 15,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >

              <CheckCircle2
                size={20}
              />

              <div>

                <strong
                  style={{
                    display: "block",
                    marginBottom: 3,
                  }}
                >
                  Checkout Successfully Recovered
                </strong>

                <span
                  style={{
                    fontSize: 13,
                  }}
                >
                  The recovery action has been
                  successfully completed.
                </span>

              </div>

            </div>
          )}


          {/* ==================================================
              ACTION BUTTONS
          ================================================== */}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >

            {/* SEND PAYMENT LINK */}

            <button
              type="button"
              className="feature-action-button"
              onClick={sendPaymentLink}
              disabled={
                loading ||
                paymentLinkSent
              }
              style={{
                opacity:
                  loading ||
                  paymentLinkSent
                    ? 0.7
                    : 1,
                cursor:
                  loading ||
                  paymentLinkSent
                    ? "not-allowed"
                    : "pointer",
              }}
            >

              {paymentLinkSent ? (
                <CheckCircle2
                  size={15}
                />
              ) : (
                <Send
                  size={15}
                />
              )}

              {paymentLinkSent
                ? "Payment Link Sent"
                : "Send Payment Link"}

            </button>


            {/* START RECOVERY */}

            <button
              type="button"
              className="feature-action-button"
              onClick={handleRecovery}
              disabled={
                loading ||
                isRecovered
              }
              style={{
                opacity:
                  loading ||
                  isRecovered
                    ? 0.7
                    : 1,

                cursor:
                  loading ||
                  isRecovered
                    ? "not-allowed"
                    : "pointer",

                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >

              {loading ? (
                <RefreshCw
                  size={15}
                  className="spin"
                />
              ) : (
                <CheckCircle2
                  size={15}
                />
              )}

              {loading
                ? "Recovering..."
                : isRecovered
                ? "Recovered"
                : "Start Recovery"}

            </button>


            {/* RESET */}

            {isRecovered && (
              <button
                type="button"
                className="feature-action-button"
                onClick={resetRecovery}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >

                <RefreshCw
                  size={15}
                />

                Reset

              </button>
            )}

          </div>

        </div>

      </div>


      {/* ======================================================
          RECOVERY WORKFLOW
      ====================================================== */}

      <div
        className="feature-table-card"
        style={{
          marginTop: 18,
        }}
      >

        <div className="feature-section-heading">

          <div>

            <h3>
              Recovery Workflow
            </h3>

            <p>
              Automated checkout recovery process.
            </p>

          </div>

        </div>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >

          {/* STEP 1 */}

          <div
            className="feature-stat-card"
            style={{
              border:
                isRecovered
                  ? "1px solid #bbf7d0"
                  : undefined,
            }}
          >

            <strong>
              1
            </strong>

            <p>
              Checkout abandoned
            </p>

          </div>


          {/* STEP 2 */}

          <div
            className="feature-stat-card"
            style={{
              border:
                isRecovered
                  ? "1px solid #bbf7d0"
                  : undefined,
            }}
          >

            <strong>
              2
            </strong>

            <p>
              AI identifies reason
            </p>

          </div>


          {/* STEP 3 */}

          <div
            className="feature-stat-card"
            style={{
              border:
                isRecovered
                  ? "1px solid #bbf7d0"
                  : undefined,
            }}
          >

            <strong>
              3
            </strong>

            <p>
              Recovery action triggered
            </p>

          </div>


          {/* STEP 4 */}

          <div
            className="feature-stat-card"
            style={{
              border:
                isRecovered
                  ? "1px solid #bbf7d0"
                  : undefined,
            }}
          >

            <strong>
              4
            </strong>

            <p>
              {isRecovered
                ? "Payment recovered ✓"
                : "Payment recovered"}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

export default CheckoutDropoffRecovery;