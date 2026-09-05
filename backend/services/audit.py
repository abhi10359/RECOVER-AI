from datetime import datetime

from models import AuditLog


# =========================================================
# CREATE AUDIT LOG
# =========================================================

def create_audit_log(
    db,
    transaction_id,
    action,
    actor="System",
    old_value=None,
    new_value=None,
    details=None,
    source="Backend API"
):
    """
    Create a permanent audit event.

    Audit records should only be created,
    never updated or deleted by normal
    application operations.
    """

    audit = AuditLog(
        transaction_id=transaction_id,
        action=action,
        actor=actor,
        old_value=old_value,
        new_value=new_value,
        details=details,
        source=source,
        created_at=datetime.utcnow()
    )

    db.add(audit)
    db.commit()
    db.refresh(audit)

    return audit