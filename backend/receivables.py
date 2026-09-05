```python
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(
    prefix="/api/receivables",
    tags=["Receivables"]
)


# =========================================================
# DATA MODELS
# =========================================================

class InvoiceCreate(BaseModel):
    invoice_id: str
    customer_name: str
    customer_email: str
    amount: float
    due_date: str


class PromiseCreate(BaseModel):
    invoice_id: str
    customer_name: str
    promised_date: str
    amount: float
    notes: Optional[str] = ""


class CustomerResponse(BaseModel):
    invoice_id: str
    message: str


# =========================================================
# DEMO DATABASE
# =========================================================

invoices = [
    {
        "invoice_id": "INV-1001",
        "customer_name": "ABC Technologies",
        "customer_email": "finance@abctech.com",
        "amount": 85000,
        "due_date": "2026-08-20",
        "status": "Overdue",
        "reminder_count": 2,
        "last_reminder": "2026-08-24",
    },
    {
        "invoice_id": "INV-1002",
        "customer_name": "XYZ Solutions",
        "customer_email": "accounts@xyz.com",
        "amount": 45000,
        "due_date": "2026-08-28",
        "status": "Due Soon",
        "reminder_count": 0,
        "last_reminder": None,
    },
    {
        "invoice_id": "INV-1003",
        "customer_name": "TechNova Pvt Ltd",
        "customer_email": "finance@technova.com",
        "amount": 120000,
        "due_date": "2026-08-15",
        "status": "Promise to Pay",
        "reminder_count": 1,
        "last_reminder": "2026-08-22",
    },
]


promises = [
    {
        "promise_id": "P2P-001",
        "invoice_id": "INV-1003",
        "customer_name": "TechNova Pvt Ltd",
        "amount": 120000,
        "promised_date": "2026-08-29",
        "status": "Active",
        "notes": "Customer promised payment on Friday.",
    }
]


# =========================================================
# GET INVOICES
# =========================================================

@router.get("/")
def get_invoices():
    return invoices


# =========================================================
# GET PROMISES
# =========================================================

@router.get("/promises")
def get_promises():
    return promises


# =========================================================
# CREATE INVOICE
# =========================================================

@router.post("/create")
def create_invoice(invoice: InvoiceCreate):

    new_invoice = {
        "invoice_id": invoice.invoice_id,
        "customer_name": invoice.customer_name,
        "customer_email": invoice.customer_email,
        "amount": invoice.amount,
        "due_date": invoice.due_date,
        "status": "Pending",
        "reminder_count": 0,
        "last_reminder": None,
    }

    invoices.append(new_invoice)

    return {
        "success": True,
        "message": "Invoice created successfully",
        "invoice": new_invoice,
    }


# =========================================================
# SEND REMINDER
# =========================================================

@router.post("/reminder/{invoice_id}")
def send_reminder(invoice_id: str):

    invoice = next(
        (
            item
            for item in invoices
            if item["invoice_id"] == invoice_id
        ),
        None
    )

    if not invoice:
        return {
            "success": False,
            "message": "Invoice not found"
        }

    invoice["reminder_count"] += 1
    invoice["last_reminder"] = datetime.now().strftime(
        "%Y-%m-%d"
    )

    if invoice["reminder_count"] == 1:
        message = (
            f"Hi {invoice['customer_name']}, "
            f"this is a friendly reminder that invoice "
            f"{invoice['invoice_id']} for ₹"
            f"{invoice['amount']:,.2f} is due. "
            f"Please let us know if you need any assistance."
        )

    elif invoice["reminder_count"] == 2:
        message = (
            f"Hi {invoice['customer_name']}, "
            f"we wanted to follow up regarding invoice "
            f"{invoice['invoice_id']} for ₹"
            f"{invoice['amount']:,.2f}. "
            f"Please share an expected payment date."
        )

    else:
        message = (
            f"Dear {invoice['customer_name']}, "
            f"invoice {invoice['invoice_id']} remains unpaid. "
            f"Please arrange payment or contact our finance "
            f"team if you require an extension."
        )

    return {
        "success": True,
        "message": "Reminder generated successfully",
        "channel": "Demo Email",
        "generated_message": message,
        "reminder_count": invoice["reminder_count"],
    }


# =========================================================
# ANALYZE CUSTOMER RESPONSE
# =========================================================

@router.post("/analyze-response")
def analyze_customer_response(response: CustomerResponse):

    message = response.message.lower()

    # -----------------------------------------------
    # PROMISE TO PAY
    # -----------------------------------------------

    promise_words = [
        "i'll pay",
        "i will pay",
        "will pay",
        "pay on",
        "pay by",
        "payment on",
        "payment by",
        "friday",
        "monday",
        "tomorrow",
        "next week",
    ]

    if any(word in message for word in promise_words):

        return {
            "type": "promise_to_pay",
            "detected": True,
            "message": (
                "Promise-to-pay detected. "
                "Follow-up reminders should be paused "
                "until the promised date."
            ),
            "suggested_action": "Create Promise-to-Pay",
        }

    # -----------------------------------------------
    # RECEIPT REQUEST
    # -----------------------------------------------

    if (
        "receipt" in message
        or "invoice copy" in message
        or "resend invoice" in message
    ):

        return {
            "type": "receipt_request",
            "detected": True,
            "message": (
                "Customer requested an invoice or receipt."
            ),
            "suggested_action": "Resend Invoice",
        }

    # -----------------------------------------------
    # EXTENSION REQUEST
    # -----------------------------------------------

    if (
        "extension" in message
        or "more time" in message
        or "7 days" in message
        or "few days" in message
        or "next week" in message
    ):

        return {
            "type": "extension_request",
            "detected": True,
            "message": (
                "Customer appears to be requesting "
                "additional time for payment."
            ),
            "suggested_action": "Request Extension Approval",
        }

    # -----------------------------------------------
    # GENERAL RESPONSE
    # -----------------------------------------------

    return {
        "type": "general",
        "detected": False,
        "message": (
            "No specific payment commitment was detected."
        ),
        "suggested_action": "Manual Review",
    }


# =========================================================
# CREATE PROMISE-TO-PAY
# =========================================================

@router.post("/promises")
def create_promise(promise: PromiseCreate):

    promise_id = f"P2P-{len(promises) + 1:03d}"

    new_promise = {
        "promise_id": promise_id,
        "invoice_id": promise.invoice_id,
        "customer_name": promise.customer_name,
        "amount": promise.amount,
        "promised_date": promise.promised_date,
        "status": "Active",
        "notes": promise.notes,
    }

    promises.append(new_promise)

    return {
        "success": True,
        "message": "Promise-to-Pay created",
        "promise": new_promise,
    }


# =========================================================
# MARK PROMISE AS PAID
# =========================================================

@router.post("/promises/{promise_id}/complete")
def complete_promise(promise_id: str):

    promise = next(
        (
            item
            for item in promises
            if item["promise_id"] == promise_id
        ),
        None
    )

    if not promise:
        return {
            "success": False,
            "message": "Promise not found"
        }

    promise["status"] = "Completed"

    return {
        "success": True,
        "message": "Promise marked as completed",
        "promise": promise,
    }


# =========================================================
# OVERDUE PROMISE CHECK
# =========================================================

@router.get("/promises/overdue")
def get_overdue_promises():

    today = datetime.now().date()

    overdue = []

    for promise in promises:

        if promise["status"] != "Active":
            continue

        try:
            promised_date = datetime.strptime(
                promise["promised_date"],
                "%Y-%m-%d"
            ).date()

            if promised_date < today:
                overdue.append(promise)

        except ValueError:
            continue

    return overdue
```
