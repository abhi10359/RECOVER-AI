import { useState } from "react";

import {
  CreditCard,
  User,
  IndianRupee,
  AlertTriangle,
  Brain,
  RefreshCw,
  Send,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";

function FailedSubscriptionRecovery() {

  const [status, setStatus] = useState("Payment Failed");
  const [loading, setLoading] = useState(false);

  const subscription = {
    subscription_id: "SUB10001",
    customer_name: "Priya Sharma",
    plan: "Premium Monthly",
    amount: 999,
    billing_date: "5 September 2026",
    failure_reason: "Insufficient funds",
    retry_attempts: 1,
    max_retries: 3,
  };

  const recoveryProbability = 84;

  const retryPayment = async () => {

    setLoading(true);

    try {

      const response = await fetch(
        "http://127.0.0.1:8000/api/subscriptions/recover",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            subscription_id:
              subscription.subscription_id,

            customer_name:
              subscription.customer_name,

            amount:
              subscription.amount,

            retry_attempt:
              subscription.retry_attempts + 1,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Subscription recovery failed."
        );
      }

      setStatus("Recovery Initiated");

      alert(
        data.message ||
          "Subscription payment retry initiated."
      );

    } catch (error) {

      console.error(
        "Subscription recovery error:",
        error
      );

      alert(
        error.message ||
          "Unable to recover subscription."
      );

    } finally {

      setLoading(false);

    }
  };


  const sendPaymentLink = () => {

    alert(
      `Payment link sent to ${subscription.customer_name}.`
    );

  };


  return (

    <div className="feature-page">

      {/* HEADER */}

      <div className="feature-page-header">

        <div>

          <div className="feature-title-row">

            <CreditCard size={28} />

            <h2>
              Failed Subscription Recovery
            </h2>

          </div>

          <p>
            Recover recurring subscription payments that fail.
          </p>

        </div>


        <div
          className={`feature-badge ${
            status === "Recovery Initiated"
              ? "success"
              : "danger"
          }`}
        >

          {status === "Recovery Initiated"
            ? "✓ Recovery Initiated"
            : "● Payment Failed"}

        </div>

      </div>


      {/* STATS */}

      <div className="feature-stat-grid">

        <div className="feature-stat-card">

          <span>
            SUBSCRIPTION
          </span>

          <strong
            style={{
              fontSize: 18,
            }}
          >
            {subscription.subscription_id}
          </strong>

        </div>


        <div className="feature-stat-card">

          <span>
            AMOUNT
          </span>

          <strong>
            ₹{subscription.amount.toLocaleString("en-IN")}
          </strong>

        </div>


        <div className="feature-stat-card">

          <span>
            RETRY ATTEMPTS
          </span>

          <strong>
            {subscription.retry_attempts}/
            {subscription.max_retries}
          </strong>

        </div>


        <div className="feature-stat-card">

          <span>
            RECOVERY PROBABILITY
          </span>

          <strong>
            {recoveryProbability}%
          </strong>

        </div>

      </div>


      {/* MAIN CONTENT */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "minmax(0, 1fr) minmax(0, 1fr)",

          gap: 18,
        }}
      >


        {/* SUBSCRIPTION DETAILS */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <h3>
                Subscription Information
              </h3>

              <p>
                Customer and billing details.
              </p>

            </div>

          </div>


          <div
            style={{
              display: "grid",
              gap: 17,
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
                  {subscription.customer_name}
                </strong>

              </div>

            </div>


            {/* PLAN */}

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                SUBSCRIPTION PLAN
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                }}
              >
                {subscription.plan}
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
                BILLING AMOUNT
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
                  {subscription.amount.toLocaleString(
                    "en-IN"
                  )}
                </strong>

              </div>

            </div>


            {/* BILLING DATE */}

            <div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.6,
                }}
              >
                BILLING DATE
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 6,
                }}
              >

                <CalendarDays size={16} />

                <strong>
                  {subscription.billing_date}
                </strong>

              </div>

            </div>


            {/* FAILURE */}

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#fef2f2",
                border:
                  "1px solid #fecaca",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 6,
                }}
              >

                <AlertTriangle size={17} />

                <strong>
                  Payment Failure
                </strong>

              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                }}
              >
                {subscription.failure_reason}
              </p>

            </div>

          </div>

        </div>


        {/* AI RECOVERY */}

        <div className="feature-table-card">

          <div className="feature-section-heading">

            <div>

              <div className="feature-title-row">

                <Brain size={20} />

                <h3>
                  AI Recovery Engine
                </h3>

              </div>

              <p>
                RecoverAI determines the best next action.
              </p>

            </div>

          </div>


          {/* PROBABILITY */}

          <div
            style={{
              padding: 18,
              borderRadius: 12,
              background: "#eff6ff",
              border:
                "1px solid #bfdbfe",
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


          {/* AI REASONING */}

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
                alignItems: "center",
                gap: 8,
                marginBottom: 7,
              }}
            >

              <Brain size={18} />

              <strong>
                AI Recommendation
              </strong>

            </div>

            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Retry the payment after a suitable
              delay. If the retry fails again,
              send a payment link and notify the
              customer.
            </p>

          </div>


          {/* RETRY STATUS */}

          <div
            style={{
              padding: 15,
              borderRadius: 12,
              background: "#fff7ed",
              border:
                "1px solid #fed7aa",
              marginBottom: 15,
            }}
          >

            <strong>
              Retry Sequence
            </strong>

            <p
              style={{
                margin: "7px 0 0",
                fontSize: 13,
              }}
            >
              Attempt {subscription.retry_attempts}
              {" "}of{" "}
              {subscription.max_retries}
              {" "}completed.
            </p>

          </div>


          {/* BUTTONS */}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >

            <button
              type="button"
              className="feature-action-button"
              onClick={retryPayment}
              disabled={loading}
            >

              {loading ? (
                <RefreshCw
                  size={15}
                  className="spin"
                />
              ) : (
                <RefreshCw size={15} />
              )}

              {loading
                ? "Retrying..."
                : "Retry Payment"}

            </button>


            <button
              type="button"
              className="feature-action-button"
              onClick={sendPaymentLink}
            >

              <Send size={15} />

              Send Payment Link

            </button>

          </div>

        </div>

      </div>


      {/* AUTOMATED RECOVERY FLOW */}

      <div
        className="feature-table-card"
        style={{
          marginTop: 18,
        }}
      >

        <div className="feature-section-heading">

          <div>

            <h3>
              Subscription Recovery Sequence
            </h3>

            <p>
              Automated process for recovering failed recurring payments.
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

          <div className="feature-stat-card">

            <strong>
              1
            </strong>

            <p>
              Payment fails
            </p>

          </div>


          <div className="feature-stat-card">

            <strong>
              2
            </strong>

            <p>
              AI identifies failure reason
            </p>

          </div>


          <div className="feature-stat-card">

            <strong>
              3
            </strong>

            <p>
              Smart retry triggered
            </p>

          </div>


          <div className="feature-stat-card">

            <strong>
              4
            </strong>

            <p>
              Subscription recovered
            </p>

          </div>

        </div>

      </div>

    </div>

  );
}

export default FailedSubscriptionRecovery;