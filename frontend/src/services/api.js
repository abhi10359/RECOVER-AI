const API_URL = "http://127.0.0.1:8000";

/* =========================================================
   BACKEND HEALTH
========================================================= */

export async function checkBackend() {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Backend request failed");
  }

  return response.json();
}


/* =========================================================
   TRANSACTIONS
========================================================= */

export async function getTransactions() {
  const response = await fetch(`${API_URL}/api/transactions`);

  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }

  return response.json();
}


export async function createTransaction(transaction) {
  const response = await fetch(`${API_URL}/api/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transaction),
  });

  if (!response.ok) {
    throw new Error("Failed to create transaction");
  }

  return response.json();
}


/* =========================================================
   RECOVERY
========================================================= */

export async function recoverTransaction(transactionId) {
  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(transactionId)}/recover`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to recover transaction");
  }

  return response.json();
}


/* =========================================================
   AI RECOVERY RECOMMENDATION
========================================================= */

export async function getRecoveryRecommendation(transaction) {
  const transactionId =
    typeof transaction === "object"
      ? transaction.transaction_id || transaction.id
      : transaction;

  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/recommendation`
  );

  if (!response.ok) {
    throw new Error("Failed to get recovery recommendation");
  }

  return response.json();
}


/* =========================================================
   CHATBOT
========================================================= */

export async function sendChatMessage(
  message,
  language,
  transactionId = null
) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      language,
      transaction_id: transactionId,
    }),
  });

  if (!response.ok) {
    throw new Error("Chatbot request failed");
  }

  return response.json();
}


/* =========================================================
   ALL AUDIT LOGS
========================================================= */

export async function getAuditLogs() {
  const response = await fetch(`${API_URL}/api/audit-logs`);

  if (!response.ok) {
    let errorMessage = "Failed to fetch audit logs";

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


/* =========================================================
   TRANSACTION AUDIT TRAIL
========================================================= */

export async function getTransactionAudit(transactionId) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/audit`
  );

  if (!response.ok) {
    let errorMessage =
      "Failed to fetch transaction audit logs";

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


/* =========================================================
   DIAGNOSIS
========================================================= */

export async function diagnoseTransaction(transactionId) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/diagnose`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    let errorMessage =
      "Failed to diagnose transaction";

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


/* =========================================================
   SMART RETRY
========================================================= */

export async function retryTransaction(transactionId) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/retry`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    let errorMessage =
      "Failed to retry transaction";

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


/* =========================================================
   B2B RECEIVABLES DASHBOARD
========================================================= */

export async function getReceivablesDashboard() {
  const response = await fetch(
    `${API_URL}/api/receivables/dashboard`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to fetch receivables dashboard"
    );
  }

  return response.json();
}


/* =========================================================
   RECEIVABLES CHASER
========================================================= */

/*
  IMPORTANT

  action = "preview"
      → Generate the AI message only.
      → Do NOT send anything.

  action = "send"
      → Send the already-generated message.
*/


export async function generateChaser(
  transactionId,
  stage = 1,
  channel = "email",
  priority = "normal"
) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/receivables/chaser`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        transaction_id: transactionId,
        stage,
        channel,
        priority,

        // Generate only.
        action: "preview",
      }),
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to generate chaser"
    );
  }

  return data;
}


/* =========================================================
   SEND GENERATED CHASER
========================================================= */

export async function sendChaser({
  transactionId,
  stage = 1,
  channel = "email",
  priority = "normal",
  subject = "",
  message = "",
}) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  if (!message) {
    throw new Error(
      "Generated reminder message is required"
    );
  }

  const response = await fetch(
    `${API_URL}/api/receivables/chaser`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        transaction_id: transactionId,
        stage,

        channel: String(channel).toLowerCase(),

        priority: String(priority).toLowerCase(),

        subject,

        message,

        // Actually send.
        action: "send",
      }),
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        "Unable to send chaser"
    );
  }

  return data;
}


/* =========================================================
   PROMISE-TO-PAY STATUS
========================================================= */

export async function getPromiseStatus(transactionId) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/promise-status`
  );

  if (!response.ok) {
    throw new Error(
      "Promise status unavailable"
    );
  }

  return response.json();
}


/* =========================================================
   RECORD PROMISE-TO-PAY
========================================================= */

export async function recordPromise(
  transactionId,
  promiseDate,
  amount
) {
  if (!transactionId) {
    throw new Error("Transaction ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/transactions/${encodeURIComponent(
      transactionId
    )}/promise`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        promise_date: promiseDate,
        amount,
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      "Failed to record promise";

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  return response.json();
}


/* =========================================================
   ANALYTICS — RECOVERY OUTCOMES
========================================================= */

export async function getRecoveryOutcomes() {
  const response = await fetch(
    `${API_URL}/api/analytics/recovery-outcomes`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to fetch recovery outcomes"
    );
  }

  return response.json();
}


/* =========================================================
   DEFAULT API OBJECT
========================================================= */

const api = {
  checkBackend,

  getTransactions,
  createTransaction,

  recoverTransaction,
  getRecoveryRecommendation,

  sendChatMessage,

  getAuditLogs,
  getTransactionAudit,

  diagnoseTransaction,
  retryTransaction,

  getReceivablesDashboard,

  // Chaser
  generateChaser,
  sendChaser,

  // Promise-to-Pay
  getPromiseStatus,
  recordPromise,

  getRecoveryOutcomes,
};

export default api;