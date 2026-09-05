from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    Boolean,
    Index,
)

from database import Base


# =========================================================
# TRANSACTION MODEL
# =========================================================

class Transaction(Base):

    __tablename__ = "transactions"

    # =====================================================
    # BASIC TRANSACTION INFORMATION
    # =====================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    transaction_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    customer_name = Column(
        String,
        nullable=True
    )

    customer_email = Column(
        String,
        nullable=True
    )

    amount = Column(
        Float,
        default=0
    )

    transaction_type = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        default="Pending"
    )

    # =====================================================
    # PAYMENT GATEWAY INFORMATION
    # =====================================================

    gateway = Column(
        String,
        default="Razorpay"
    )

    error_code = Column(
        String,
        nullable=True
    )

    error_description = Column(
        Text,
        nullable=True
    )

    failure_reason = Column(
        Text,
        nullable=True
    )

    # =====================================================
    # AI DIAGNOSTICS
    # =====================================================

    root_cause = Column(
        String,
        nullable=True
    )

    severity = Column(
        String,
        nullable=True
    )

    recommended_action = Column(
        String,
        nullable=True
    )

    ai_diagnosis = Column(
        Text,
        nullable=True
    )

    # =====================================================
    # RECOVERY
    # =====================================================

    recovery_status = Column(
        String,
        default="Not Started"
    )

    recovery_outcome = Column(
        String,
        nullable=True
    )

    recovered_amount = Column(
        Float,
        default=0
    )

    # =====================================================
    # SMART RETRY SYSTEM
    # =====================================================

    retry_count = Column(
        Integer,
        default=0
    )

    max_retries = Column(
        Integer,
        default=3
    )

    last_retry_at = Column(
        DateTime,
        nullable=True
    )

    next_retry_at = Column(
        DateTime,
        nullable=True
    )

    retry_status = Column(
        String,
        default="Eligible"
    )

    # =====================================================
    # PROMISE-TO-PAY TRACKER
    # =====================================================

    # True when customer has committed to paying
    promise_to_pay = Column(
        Boolean,
        default=False,
        nullable=False
    )

    # Exact date/time customer promised to pay
    promise_date = Column(
        DateTime,
        nullable=True,
        index=True
    )

    # None / Active / Fulfilled / Overdue / Broken
    promise_status = Column(
        String,
        default="None"
    )

    # Customer's promise message
    promise_note = Column(
        Text,
        nullable=True
    )

    # When the promise was recorded
    promise_recorded_at = Column(
        DateTime,
        nullable=True
    )

    # When RecoverAI should follow up
    promise_followup_at = Column(
        DateTime,
        nullable=True
    )

    # Number of follow-ups after promise
    promise_followup_count = Column(
        Integer,
        default=0
    )

    # =====================================================
    # B2B RECEIVABLES
    # =====================================================

    # Whether transaction is treated as a B2B receivable
    is_b2b = Column(
        Boolean,
        default=False,
        nullable=False,
        index=True
    )

    # Business/company name
    company_name = Column(
        String,
        nullable=True
    )

    # Finance/accounts contact person
    contact_person = Column(
        String,
        nullable=True
    )

    # B2B receivables email
    receivables_email = Column(
        String,
        nullable=True
    )

    # WhatsApp / phone number
    receivables_phone = Column(
        String,
        nullable=True
    )

    # Invoice number
    invoice_number = Column(
        String,
        nullable=True,
        index=True
    )

    # Invoice issue date
    invoice_date = Column(
        DateTime,
        nullable=True
    )

    # =====================================================
    # IMPORTANT FOR AGING BUCKETS
    # =====================================================

    # Invoice payment due date.
    #
    # This is used by main.py to calculate:
    #
    # Current
    # 1-30 Days Overdue
    # 31-60 Days Overdue
    # 61-90 Days Overdue
    # 90+ Days - High Risk
    #
    # Existing database rows may still have NULL here.
    # We will populate those separately.
    due_date = Column(
        DateTime,
        nullable=True,
        index=True
    )

    # Current amount still owed
    outstanding_amount = Column(
        Float,
        default=0
    )

    # =====================================================
    # RECEIVABLE CHASER STATUS
    # =====================================================

    # Not Started / Active / Paused / Paid / Escalated
    receivables_status = Column(
        String,
        default="Not Started"
    )

    # =====================================================
    # ESCALATION STAGE
    # =====================================================

    # 0 = No reminder
    # 1 = Gentle Email Reminder
    # 2 = Urgent WhatsApp + Voice Chaser
    # 3 = Executive Account Manager Intervention
    chaser_stage = Column(
        Integer,
        default=0
    )

    # Email / WhatsApp / Voice / Both
    preferred_outreach_channel = Column(
        String,
        default="Email"
    )

    # Date/time of last reminder
    last_chaser_at = Column(
        DateTime,
        nullable=True
    )

    # Date/time of next reminder
    next_chaser_at = Column(
        DateTime,
        nullable=True
    )

    # Number of reminders
    chaser_count = Column(
        Integer,
        default=0
    )

    # =====================================================
    # CUSTOMER RESPONSE TRACKING
    # =====================================================

    # Last response from customer
    last_customer_response = Column(
        Text,
        nullable=True
    )

    # Examples:
    #
    # Payment promised
    # Receipt requested
    # Extension requested
    # No response
    customer_response_type = Column(
        String,
        nullable=True
    )

    # Requested extension in days
    extension_days = Column(
        Integer,
        nullable=True
    )

    # Pause automated reminders
    outreach_paused = Column(
        Boolean,
        default=False,
        nullable=False
    )

    # =====================================================
    # AUTOMATED FOLLOW-UP
    # =====================================================

    # Automatic follow-up enabled
    auto_followup_enabled = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Reason for pausing automation
    pause_reason = Column(
        String,
        nullable=True
    )

    # =====================================================
    # CUSTOMER LANGUAGE
    # =====================================================

    preferred_language = Column(
        String,
        default="English"
    )

    # =====================================================
    # AUDIT / LAST ACTION
    # =====================================================

    last_action = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # =====================================================
    # DATABASE INDEXES
    # =====================================================

    __table_args__ = (
        Index(
            "ix_transactions_b2b_due_date",
            "is_b2b",
            "due_date"
        ),
        Index(
            "ix_transactions_recovery_status",
            "recovery_status"
        ),
        Index(
            "ix_transactions_promise_status",
            "promise_status"
        ),
        Index(
            "ix_transactions_status_recovery",
            "status",
            "recovery_status"
        ),
    )


# =========================================================
# IMMUTABLE AUDIT TRAIL
# =========================================================

class AuditLog(Base):

    __tablename__ = "audit_logs"

    # =====================================================
    # PRIMARY KEY
    # =====================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # =====================================================
    # TRANSACTION ASSOCIATION
    # =====================================================

    transaction_id = Column(
        String,
        index=True,
        nullable=True
    )

    # =====================================================
    # AUDIT ACTION
    # =====================================================

    # Examples:
    #
    # Transaction Created
    # AI Diagnosis Completed
    # Retry Scheduled
    # Transaction Recovered
    # Promise-to-Pay Recorded
    # B2B Reminder Generated
    # B2B Reminder Sent
    # Escalation Triggered
    #
    action = Column(
        String,
        nullable=False
    )

    # =====================================================
    # ACTOR
    # =====================================================

    # System / AI Engine / Smart Retry Engine /
    # Admin / Customer
    actor = Column(
        String,
        nullable=False,
        default="System"
    )

    # =====================================================
    # STATE CHANGE
    # =====================================================

    old_value = Column(
        Text,
        nullable=True
    )

    new_value = Column(
        Text,
        nullable=True
    )

    # =====================================================
    # ADDITIONAL DETAILS
    # =====================================================

    details = Column(
        Text,
        nullable=True
    )

    # =====================================================
    # SOURCE
    # =====================================================

    # API / UI / System / Admin
    source = Column(
        String,
        nullable=True
    )

    # =====================================================
    # TIMESTAMP
    # =====================================================

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True
    )