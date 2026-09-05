# ============================================================
# RecoverAI Root-Cause & Diagnostics Engine
# ============================================================


ERROR_PATTERNS = {

    "INSUFFICIENT_FUNDS": {
        "root_cause": "insufficient_funds",
        "severity": "medium",
        "recommended_action": "retry_later",
    },

    "BANK_TIMEOUT": {
        "root_cause": "bank_timeout",
        "severity": "medium",
        "recommended_action": "retry_after_delay",
    },

    "CARD_EXPIRED": {
        "root_cause": "expired_card",
        "severity": "high",
        "recommended_action": "update_payment_method",
    },

    "DO_NOT_HONOR": {
        "root_cause": "bank_declined",
        "severity": "high",
        "recommended_action": "try_another_payment_method",
    },

    "AUTHENTICATION_FAILED": {
        "root_cause": "authentication_failure",
        "severity": "medium",
        "recommended_action": "retry_authentication",
    },

    "LIMIT_EXCEEDED": {
        "root_cause": "transaction_limit_exceeded",
        "severity": "medium",
        "recommended_action": "use_alternate_payment_method",
    },

    "NETWORK_ERROR": {
        "root_cause": "network_failure",
        "severity": "low",
        "recommended_action": "automatic_retry",
    },

    "INVALID_VPA": {
        "root_cause": "invalid_upi_id",
        "severity": "high",
        "recommended_action": "correct_upi_id",
    },

    "PAYMENT_DECLINED": {
        "root_cause": "payment_declined",
        "severity": "high",
        "recommended_action": "try_alternate_payment_method",
    },

    "CARD_DECLINED": {
        "root_cause": "card_declined",
        "severity": "high",
        "recommended_action": "try_another_card",
    },

    "OTP_FAILED": {
        "root_cause": "otp_verification_failure",
        "severity": "medium",
        "recommended_action": "retry_verification",
    },

    "SESSION_EXPIRED": {
        "root_cause": "session_expired",
        "severity": "low",
        "recommended_action": "restart_payment",
    },
}


def diagnose_transaction(transaction):

    error_code = (
        transaction.error_code or ""
    ).upper().strip()

    failure_reason = (
        transaction.failure_reason or ""
    ).lower()

    # --------------------------------------------------------
    # First check gateway error code
    # --------------------------------------------------------

    if error_code in ERROR_PATTERNS:

        result = ERROR_PATTERNS[error_code]

    else:

        # ----------------------------------------------------
        # Fallback keyword detection
        # ----------------------------------------------------

        if (
            "insufficient" in failure_reason
            or "balance" in failure_reason
        ):
            result = {
                "root_cause": "insufficient_funds",
                "severity": "medium",
                "recommended_action": "retry_later",
            }

        elif (
            "timeout" in failure_reason
            or "timed out" in failure_reason
        ):
            result = {
                "root_cause": "bank_timeout",
                "severity": "medium",
                "recommended_action": "retry_after_delay",
            }

        elif (
            "expired" in failure_reason
        ):
            result = {
                "root_cause": "expired_card",
                "severity": "high",
                "recommended_action": "update_payment_method",
            }

        elif (
            "network" in failure_reason
        ):
            result = {
                "root_cause": "network_failure",
                "severity": "low",
                "recommended_action": "automatic_retry",
            }

        elif (
            "declined" in failure_reason
            or "decline" in failure_reason
        ):
            result = {
                "root_cause": "payment_declined",
                "severity": "high",
                "recommended_action": "try_alternate_payment_method",
            }

        else:

            result = {
                "root_cause": "unknown_failure",
                "severity": "medium",
                "recommended_action": "manual_review",
            }

    # --------------------------------------------------------
    # Generate human-readable diagnosis
    # --------------------------------------------------------

    diagnosis_messages = {

        "insufficient_funds":
            "The payment failed because the customer's available balance was insufficient.",

        "bank_timeout":
            "The payment failed because the issuing bank did not respond within the expected time.",

        "expired_card":
            "The payment failed because the customer's card has expired.",

        "bank_declined":
            "The customer's bank declined the payment.",

        "authentication_failure":
            "The payment could not be completed because authentication failed.",

        "transaction_limit_exceeded":
            "The payment exceeded the allowed transaction limit.",

        "network_failure":
            "The payment failed because of a temporary network or connectivity problem.",

        "invalid_upi_id":
            "The payment failed because the provided UPI ID is invalid.",

        "payment_declined":
            "The payment was declined by the payment provider or issuing bank.",

        "card_declined":
            "The customer's card was declined for this transaction.",

        "otp_verification_failure":
            "The payment failed because OTP verification was unsuccessful.",

        "session_expired":
            "The payment session expired before the transaction was completed.",

        "unknown_failure":
            "The exact reason for the payment failure could not be determined.",
    }

    result["diagnosis"] = diagnosis_messages.get(
        result["root_cause"],
        "The transaction could not be completed."
    )

    return result