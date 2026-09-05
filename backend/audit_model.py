from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float
)

from database import Base


class AuditLog(Base):

    __tablename__ = "audit_logs"

    # =========================================================
    # BASIC AUDIT INFORMATION
    # =========================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    transaction_id = Column(
        String,
        index=True
    )

    # Example:
    # Triggered, Completed, Failed,
    # Escalated, Overdue, CALL_COMPLETED,
    # PROMISE_MADE, LANGUAGE_DETECTED
    action = Column(
        String,
        index=True
    )

    # Human-readable explanation
    description = Column(
        Text
    )

    # Who/what performed the action
    # Example:
    # System, AI Voice Agent, Admin
    actor = Column(
        String,
        default="System"
    )

    # AI, SYSTEM, HUMAN, AI_VOICE_AGENT
    actor_type = Column(
        String,
        default="SYSTEM"
    )

    # Example:
    # PromiseEngine
    # RecoveryEngine
    # PaymentGateway
    # VoiceRecoveryEngine
    source_system = Column(
        String
    )

    # INFO, SUCCESS, WARNING, CRITICAL
    severity = Column(
        String,
        default="INFO"
    )

    # =========================================================
    # TRANSACTION STATE
    # =========================================================

    # State before the event
    before_state = Column(
        Text
    )

    # State after the event
    after_state = Column(
        Text
    )

    # =========================================================
    # AI INFORMATION
    # =========================================================

    # AI confidence score
    ai_confidence = Column(
        String
    )

    # Explanation for AI decision
    ai_reason = Column(
        Text
    )

    # =========================================================
    # HINGLISH / MULTILINGUAL VOICE RECOVERY
    # =========================================================

    # Language detected/used during the call
    #
    # Examples:
    # Hinglish
    # English
    # Hindi
    # Tamil
    # Tanglish
    # Telugu
    # Kannada
    # Marathi
    # Bengali
    # Auto-Detected
    language_detected = Column(
        String,
        index=True
    )

    # Call duration in seconds
    call_duration = Column(
        Integer
    )

    # Optional URL of the call recording
    recording_url = Column(
        Text
    )

    # Full/partial voice conversation transcript
    transcript = Column(
        Text
    )

    # =========================================================
    # PROMISE-TO-PAY INFORMATION
    # =========================================================

    # Extracted Promise-to-Pay date
    #
    # Stored as text initially so that
    # natural language dates can also be preserved.
    #
    # Example:
    # "2026-09-14"
    promise_date = Column(
        String
    )

    # AI confidence specifically for
    # Promise-to-Pay extraction
    confidence_score = Column(
        Float
    )

    # AI explanation/reasoning
    # Example:
    # "Customer clearly stated that payment
    # will be made next Monday."
    ai_reasoning = Column(
        Text
    )

    # =========================================================
    # EVENT TIMESTAMP
    # =========================================================

    created_at = Column(
        DateTime
    )