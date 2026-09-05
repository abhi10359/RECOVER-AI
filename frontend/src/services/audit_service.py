import json
from datetime import datetime

from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    transaction_id: str,
    action: str,
    description: str,
    actor: str = "System",
    actor_type: str = "Automated",
    source_system: str = "RecoverAI",
    severity: str = "Info",
    before_state=None,
    after_state=None,
    ai_confidence=None,
    decision_reason=None
):
    audit_log = AuditLog(
        transaction_id=transaction_id,
        action=action,
        description=description,

        actor=actor,
        actor_type=actor_type,
        source_system=source_system,
        severity=severity,

        before_state=(
            json.dumps(before_state)
            if before_state is not None
            else None
        ),

        after_state=(
            json.dumps(after_state)
            if after_state is not None
            else None
        ),

        ai_confidence=ai_confidence,
        decision_reason=decision_reason,

        created_at=datetime.utcnow()
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    return audit_log