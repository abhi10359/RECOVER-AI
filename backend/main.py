# =========================================================
# RECOVERAI - FASTAPI BACKEND
# Version 3.2
# =========================================================

import os
import re
import json
import csv
import io
import datetime as dt

from datetime import datetime, timedelta

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
)

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session

from dotenv import load_dotenv

from google import genai

from database import Base, engine, SessionLocal
from models import Transaction, AuditLog
from services.audit import create_audit_log


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found")
else:
    print("Gemini API key loaded successfully")


# =========================================================
# GEMINI CLIENT
# =========================================================

client = None

if GEMINI_API_KEY:

    try:

        client = genai.Client(
            api_key=GEMINI_API_KEY
        )

        print("Gemini client initialized successfully")

    except Exception as e:

        print(
            "Gemini client initialization error:",
            repr(e)
        )

        client = None


# =========================================================
# GEMINI MODEL
# =========================================================

# Can be overridden in .env:
#
# GEMINI_MODEL=gemini-3.6-flash
#
# Keeping the model configurable makes it easier
# to change later without modifying this file.

GEMINI_MODEL = "gemini-3.6-flash"

print(
    "Gemini model:",
    GEMINI_MODEL
)


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="RecoverAI API",
    description="AI-powered payment recovery and B2B receivables platform",
    version="3.2"
)


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

try:

    Base.metadata.create_all(
        bind=engine
    )

    print(
        "Database initialized successfully"
    )

except Exception as e:

    print(
        "Database initialization error:",
        repr(e)
    )


# =========================================================
# DATABASE SESSION
# =========================================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def clean_string(value, default=None):

    if value is None:
        return default

    value = str(value).strip()

    if value == "":
        return default

    return value


def parse_float(value, default=0.0):

    if value is None or value == "":
        return default

    try:

        return float(value)

    except (
        ValueError,
        TypeError
    ):

        return default


def parse_int(value, default=0):

    if value is None or value == "":
        return default

    try:

        return int(float(value))

    except (
        ValueError,
        TypeError
    ):

        return default


def parse_bool(value, default=False):

    if value is None:
        return default

    if isinstance(value, bool):
        return value

    return str(value).strip().lower() in {
        "true",
        "1",
        "yes",
        "y",
        "on"
    }


def parse_datetime(value):
    """Parse ISO/date strings and normalize timezone-aware values to naive UTC."""
    if isinstance(value, datetime):
        parsed = value
    else:
        if not value:
            return None

        value = str(value).strip()

        try:
            parsed = datetime.fromisoformat(
                value.replace("Z", "+00:00")
            )
        except ValueError:
            try:
                parsed = datetime.strptime(
                    value,
                    "%Y-%m-%d"
                )
            except ValueError:
                return None

    # SQLite/SQLAlchemy fields in this project are naive datetimes.
    # Convert aware timestamps to UTC and then remove tzinfo so comparisons
    # with datetime.utcnow() are safe.
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(
            dt.timezone.utc
        ).replace(tzinfo=None)

    return parsed


def get_transaction(
    transaction_id,
    db
):

    return (
        db.query(Transaction)
        .filter(
            Transaction.transaction_id
            == transaction_id
        )
        .first()
    )


# =========================================================
# GEMINI HELPER
# =========================================================

GEMINI_FALLBACK_MODEL = "gemini-3.6-flash"


def generate_ai_response(prompt):
    """Generate an AI response using Gemini 3.6 Flash only."""

    if not client:
        print("Gemini AI unavailable: client was not initialized.")
        return None

    try:
        print(f"Trying Gemini model: {GEMINI_MODEL}")

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )

        text = getattr(response, "text", None)

        if text:
            print("Gemini response generated using gemini-3.6-flash")
            return text.strip()

        print("Gemini returned an empty response using gemini-3.6-flash")
        return None

    except Exception as e:
        print(
            "Gemini API error using gemini-3.6-flash:",
            type(e).__name__,
            str(e),
        )
        return None

# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health():

    return {

        "status":
            "ok",

        "ai":
            "Gemini"
            if client
            else "Unavailable",

        "model":
            GEMINI_MODEL,
        "fallback_model":
            "gemini-3.6-flash"

    }


# =========================================================
# CREATE TRANSACTION
# =========================================================

@app.post("/api/transactions")
def create_transaction(
    transaction: dict,
    db: Session = Depends(get_db)
):

    required_fields = [

        "transaction_id",
        "customer_name",
        "customer_email",
        "amount",
        "transaction_type",
        "status"

    ]

    for field in required_fields:

        if field not in transaction:

            raise HTTPException(
                status_code=400,
                detail=f"{field} is required"
            )

    transaction_id = clean_string(
        transaction.get(
            "transaction_id"
        )
    )

    if not transaction_id:

        raise HTTPException(
            status_code=400,
            detail="transaction_id cannot be empty"
        )

    # -----------------------------------------------------
    # DUPLICATE CHECK
    # -----------------------------------------------------

    existing = get_transaction(
        transaction_id,
        db
    )

    if existing:

        raise HTTPException(
            status_code=400,
            detail="Transaction already exists."
        )

    # -----------------------------------------------------
    # AMOUNT VALIDATION
    # -----------------------------------------------------

    try:

        amount = float(
            transaction["amount"]
        )

    except (
        ValueError,
        TypeError
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid amount."
        )

    if amount < 0:

        raise HTTPException(
            status_code=400,
            detail="Amount cannot be negative."
        )

    # -----------------------------------------------------
    # CREATE TRANSACTION
    # -----------------------------------------------------

    new_transaction = Transaction(

        transaction_id=transaction_id,

        customer_name=clean_string(
            transaction.get(
                "customer_name"
            )
        ),

        customer_email=clean_string(
            transaction.get(
                "customer_email"
            )
        ),

        amount=amount,

        transaction_type=clean_string(
            transaction.get(
                "transaction_type"
            )
        ),

        status=clean_string(
            transaction.get(
                "status"
            )
        ),

        gateway=clean_string(
            transaction.get(
                "gateway"
            ),
            "Razorpay"
        ),

        error_code=clean_string(
            transaction.get(
                "error_code"
            )
        ),

        error_description=clean_string(
            transaction.get(
                "error_description"
            )
        ),

        failure_reason=clean_string(
            transaction.get(
                "failure_reason"
            )
        ),

        root_cause=clean_string(
            transaction.get(
                "root_cause"
            )
        ),

        severity=clean_string(
            transaction.get(
                "severity"
            )
        ),

        recommended_action=clean_string(
            transaction.get(
                "recommended_action"
            )
        ),

        ai_diagnosis=clean_string(
            transaction.get(
                "ai_diagnosis"
            )
        ),

        recovery_status=clean_string(
            transaction.get(
                "recovery_status"
            ),
            "Not Started"
        ),

        recovery_outcome=clean_string(
            transaction.get(
                "recovery_outcome"
            )
        ),

        recovered_amount=parse_float(
            transaction.get(
                "recovered_amount"
            ),
            0
        ),

        retry_count=parse_int(
            transaction.get(
                "retry_count"
            ),
            0
        ),

        max_retries=parse_int(
            transaction.get(
                "max_retries"
            ),
            3
        ),

        retry_status=clean_string(
            transaction.get(
                "retry_status"
            ),
            "Eligible"
        ),

        promise_to_pay=parse_bool(
            transaction.get(
                "promise_to_pay"
            ),
            False
        ),

        promise_status=clean_string(
            transaction.get(
                "promise_status"
            ),
            "None"
        ),

        preferred_language=clean_string(
            transaction.get(
                "preferred_language"
            ),
            "English"
        ),

        promise_date=parse_datetime(
            transaction.get("promise_date")
        ),

        promise_note=clean_string(
            transaction.get("promise_note")
        ),

        promise_recorded_at=parse_datetime(
            transaction.get("promise_recorded_at")
        ),

        promise_followup_at=parse_datetime(
            transaction.get("promise_followup_at")
        ),

        promise_followup_count=parse_int(
            transaction.get("promise_followup_count"),
            0
        ),

        is_b2b=parse_bool(
            transaction.get("is_b2b"),
            False
        ),

        company_name=clean_string(
            transaction.get("company_name")
        ),

        contact_person=clean_string(
            transaction.get("contact_person")
        ),

        receivables_email=clean_string(
            transaction.get("receivables_email")
        ),

        receivables_phone=clean_string(
            transaction.get("receivables_phone")
        ),

        invoice_number=clean_string(
            transaction.get("invoice_number")
        ),

        invoice_date=parse_datetime(
            transaction.get("invoice_date")
        ),

        due_date=parse_datetime(
            transaction.get("due_date")
        ),

        outstanding_amount=parse_float(
            transaction.get("outstanding_amount"),
            amount
        ),

        receivables_status=clean_string(
            transaction.get("receivables_status"),
            "Not Started"
        ),

        chaser_stage=parse_int(
            transaction.get("chaser_stage"),
            0
        ),

        preferred_outreach_channel=clean_string(
            transaction.get("preferred_outreach_channel"),
            "Email"
        ),

        last_chaser_at=parse_datetime(
            transaction.get("last_chaser_at")
        ),

        next_chaser_at=parse_datetime(
            transaction.get("next_chaser_at")
        ),

        chaser_count=parse_int(
            transaction.get("chaser_count"),
            0
        ),

        last_customer_response=clean_string(
            transaction.get("last_customer_response")
        ),

        customer_response_type=clean_string(
            transaction.get("customer_response_type")
        ),

        extension_days=(
            parse_int(transaction.get("extension_days"), 0)
            if transaction.get("extension_days") not in (None, "")
            else None
        ),

        outreach_paused=parse_bool(
            transaction.get("outreach_paused"),
            False
        ),

        auto_followup_enabled=parse_bool(
            transaction.get("auto_followup_enabled"),
            True
        ),

        pause_reason=clean_string(
            transaction.get("pause_reason")
        ),

        last_action=clean_string(
            transaction.get(
                "last_action"
            )
        ),

        created_at=parse_datetime(
            transaction.get(
                "created_at"
            )
        ) or datetime.utcnow()

    )

    db.add(
        new_transaction
    )

    try:

        db.commit()

        db.refresh(
            new_transaction
        )

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # -----------------------------------------------------
    # AUDIT
    # -----------------------------------------------------

    try:

        create_audit_log(

            db=db,

            transaction_id=
                new_transaction.transaction_id,

            action=
                "Transaction Created",

            actor=
                "System",

            old_value=
                None,

            new_value=
                new_transaction.status,

            details=
                (
                    f"Transaction created for "
                    f"₹{new_transaction.amount}"
                ),

            source=
                "API"

        )

    except Exception as e:

        print(
            "Audit log error:",
            repr(e)
        )

    return {

        "message":
            "Transaction created successfully",

        "transaction_id":
            new_transaction.transaction_id

    }


# =========================================================
# BATCH UPLOAD INFO
# =========================================================

@app.get(
    "/api/transactions/batch-upload/info"
)
def batch_upload_info():

    return {

        "feature":
            "Batch Transaction Upload",

        "supported_formats":
            [
                "CSV",
                "JSON"
            ],

        "endpoint":
            "POST /api/transactions/batch-upload",

        "max_records_per_upload": 500,

        "required_fields": [

            "transaction_id",
            "customer_name",
            "customer_email",
            "amount",
            "transaction_type",
            "status"

        ],

        "optional_fields": [

            "gateway",
            "error_code",
            "error_description",
            "failure_reason",
            "root_cause",
            "severity",
            "recommended_action",
            "ai_diagnosis",
            "recovery_status",
            "recovery_outcome",
            "recovered_amount",
            "retry_count",
            "max_retries",
            "retry_status",
            "promise_to_pay",
            "promise_status",
            "promise_date",
            "promise_note",
            "promise_recorded_at",
            "promise_followup_at",
            "promise_followup_count",
            "is_b2b",
            "company_name",
            "contact_person",
            "receivables_email",
            "receivables_phone",
            "invoice_number",
            "invoice_date",
            "due_date",
            "outstanding_amount",
            "receivables_status",
            "chaser_stage",
            "preferred_outreach_channel",
            "last_chaser_at",
            "next_chaser_at",
            "chaser_count",
            "last_customer_response",
            "customer_response_type",
            "extension_days",
            "outreach_paused",
            "auto_followup_enabled",
            "pause_reason",
            "preferred_language",
            "last_action",
            "created_at"

        ]

    }


# =========================================================
# BATCH CSV / JSON UPLOAD
# =========================================================

@app.post(
    "/api/transactions/batch-upload"
)
async def batch_upload_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )

    filename = (
        file.filename
        .lower()
        .strip()
    )

    if not (
        filename.endswith(".csv")
        or
        filename.endswith(".json")
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Only CSV and JSON files "
                "are supported."
            )
        )

    file_content = await file.read()

    if not file_content:

        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    # -----------------------------------------------------
    # READ CSV
    # -----------------------------------------------------

    if filename.endswith(".csv"):

        try:

            text = file_content.decode(
                "utf-8-sig"
            )

        except UnicodeDecodeError:

            try:

                text = file_content.decode(
                    "utf-8"
                )

            except UnicodeDecodeError:

                raise HTTPException(
                    status_code=400,
                    detail="CSV file encoding is invalid."
                )

        reader = csv.DictReader(
            io.StringIO(text)
        )

        if not reader.fieldnames:

            raise HTTPException(
                status_code=400,
                detail="CSV file has no headers."
            )

        records = list(reader)

    # -----------------------------------------------------
    # READ JSON
    # -----------------------------------------------------

    else:

        try:

            json_data = json.loads(
                file_content.decode(
                    "utf-8-sig"
                )
            )

        except (
            UnicodeDecodeError,
            json.JSONDecodeError
        ) as e:

            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON file: {str(e)}"
            )

        if isinstance(
            json_data,
            list
        ):

            records = json_data

        elif isinstance(
            json_data,
            dict
        ):

            if isinstance(
                json_data.get(
                    "transactions"
                ),
                list
            ):

                records = json_data[
                    "transactions"
                ]

            else:

                records = [
                    json_data
                ]

        else:

            raise HTTPException(
                status_code=400,
                detail=(
                    "JSON must contain an object "
                    "or an array of transactions."
                )
            )

    if not records:

        raise HTTPException(
            status_code=400,
            detail="No transaction records found."
        )

    # -----------------------------------------------------
    # BATCH SIZE LIMIT
    # -----------------------------------------------------
    # Keep uploads bounded so one request cannot overload
    # the database or backend.
    MAX_BATCH_RECORDS = 500

    if len(records) > MAX_BATCH_RECORDS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Maximum {MAX_BATCH_RECORDS} transactions "
                "can be uploaded in one batch."
            )
        )

    required_fields = [

        "transaction_id",
        "customer_name",
        "customer_email",
        "amount",
        "transaction_type",
        "status"

    ]

    imported = 0
    skipped = 0
    errors = []

    # Keeps track of IDs in the current file.
    # This prevents duplicate IDs from being
    # imported twice in the same batch.

    batch_transaction_ids = set()

    # -----------------------------------------------------
    # PROCESS RECORDS
    # -----------------------------------------------------

    for index, raw_record in enumerate(
        records,
        start=1
    ):

        if not isinstance(
            raw_record,
            dict
        ):

            skipped += 1

            errors.append({

                "row":
                    index,

                "error":
                    "Transaction record must be an object."

            })

            continue

        record = {

            str(key).strip():
                value

            for key, value
            in raw_record.items()

        }

        # -------------------------------------------------
        # REQUIRED FIELDS
        # -------------------------------------------------

        missing_fields = [

            field

            for field in required_fields

            if record.get(field) is None
            or
            str(
                record.get(field)
            ).strip() == ""

        ]

        if missing_fields:

            skipped += 1

            errors.append({

                "row":
                    index,

                "transaction_id":
                    record.get(
                        "transaction_id"
                    ),

                "error":
                    (
                        "Missing required fields: "
                        +
                        ", ".join(
                            missing_fields
                        )
                    )

            })

            continue

        transaction_id = clean_string(
            record.get(
                "transaction_id"
            )
        )

        # -------------------------------------------------
        # DUPLICATE IN SAME FILE
        # -------------------------------------------------

        if transaction_id in batch_transaction_ids:

            skipped += 1

            errors.append({

                "row":
                    index,

                "transaction_id":
                    transaction_id,

                "error":
                    "Duplicate transaction ID in uploaded file."

            })

            continue

        batch_transaction_ids.add(
            transaction_id
        )

        # -------------------------------------------------
        # DUPLICATE IN DATABASE
        # -------------------------------------------------

        existing = get_transaction(
            transaction_id,
            db
        )

        if existing:

            skipped += 1

            errors.append({

                "row":
                    index,

                "transaction_id":
                    transaction_id,

                "error":
                    "Transaction already exists."

            })

            continue

        # -------------------------------------------------
        # AMOUNT
        # -------------------------------------------------

        try:

            amount = float(
                record.get(
                    "amount"
                )
            )

            if amount < 0:
                raise ValueError

        except (
            ValueError,
            TypeError
        ):

            skipped += 1

            errors.append({

                "row":
                    index,

                "transaction_id":
                    transaction_id,

                "error":
                    "Invalid amount."

            })

            continue

        # -------------------------------------------------
        # NUMERIC VALUES
        # -------------------------------------------------

        recovered_amount = parse_float(
            record.get(
                "recovered_amount"
            ),
            0
        )

        retry_count = parse_int(
            record.get(
                "retry_count"
            ),
            0
        )

        max_retries = parse_int(
            record.get(
                "max_retries"
            ),
            3
        )

        if max_retries < 0:

            max_retries = 3

        if retry_count < 0:

            retry_count = 0

        # -------------------------------------------------
        # BOOLEAN
        # -------------------------------------------------

        promise_to_pay = parse_bool(
            record.get(
                "promise_to_pay"
            ),
            False
        )

        # -------------------------------------------------
        # CREATE TRANSACTION
        # -------------------------------------------------

        try:

            new_transaction = Transaction(

                transaction_id=
                    transaction_id,

                customer_name=
                    clean_string(
                        record.get(
                            "customer_name"
                        )
                    ),

                customer_email=
                    clean_string(
                        record.get(
                            "customer_email"
                        )
                    ),

                amount=
                    amount,

                transaction_type=
                    clean_string(
                        record.get(
                            "transaction_type"
                        )
                    ),

                status=
                    clean_string(
                        record.get(
                            "status"
                        )
                    ),

                gateway=
                    clean_string(
                        record.get(
                            "gateway"
                        ),
                        "Razorpay"
                    ),

                error_code=
                    clean_string(
                        record.get(
                            "error_code"
                        )
                    ),

                error_description=
                    clean_string(
                        record.get(
                            "error_description"
                        )
                    ),

                failure_reason=
                    clean_string(
                        record.get(
                            "failure_reason"
                        )
                    ),

                root_cause=
                    clean_string(
                        record.get(
                            "root_cause"
                        )
                    ),

                severity=
                    clean_string(
                        record.get(
                            "severity"
                        )
                    ),

                recommended_action=
                    clean_string(
                        record.get(
                            "recommended_action"
                        )
                    ),

                ai_diagnosis=
                    clean_string(
                        record.get(
                            "ai_diagnosis"
                        )
                    ),

                recovery_status=
                    clean_string(
                        record.get(
                            "recovery_status"
                        ),
                        "Not Started"
                    ),

                recovery_outcome=
                    clean_string(
                        record.get(
                            "recovery_outcome"
                        )
                    ),

                recovered_amount=
                    recovered_amount,

                retry_count=
                    retry_count,

                max_retries=
                    max_retries,

                retry_status=
                    clean_string(
                        record.get(
                            "retry_status"
                        ),
                        "Eligible"
                    ),

                promise_to_pay=
                    promise_to_pay,

                promise_status=
                    clean_string(
                        record.get(
                            "promise_status"
                        ),
                        "None"
                    ),

                preferred_language=
                    clean_string(
                        record.get(
                            "preferred_language"
                        ),
                        "English"
                    ),

                last_action=
                    clean_string(
                        record.get(
                            "last_action"
                        )
                    ),

                # -------------------------------------------------
                # PROMISE-TO-PAY / B2B FIELDS
                # -------------------------------------------------
                promise_date=
                    parse_datetime(
                        record.get(
                            "promise_date"
                        )
                    ),

                promise_note=
                    clean_string(
                        record.get(
                            "promise_note"
                        )
                    ),

                promise_recorded_at=
                    parse_datetime(
                        record.get(
                            "promise_recorded_at"
                        )
                    ),

                promise_followup_at=
                    parse_datetime(
                        record.get(
                            "promise_followup_at"
                        )
                    ),

                promise_followup_count=
                    parse_int(
                        record.get(
                            "promise_followup_count"
                        ),
                        0
                    ),

                is_b2b=
                    parse_bool(
                        record.get(
                            "is_b2b"
                        ),
                        False
                    ),

                company_name=
                    clean_string(
                        record.get(
                            "company_name"
                        )
                    ),

                contact_person=
                    clean_string(
                        record.get(
                            "contact_person"
                        )
                    ),

                receivables_email=
                    clean_string(
                        record.get(
                            "receivables_email"
                        )
                    ),

                receivables_phone=
                    clean_string(
                        record.get(
                            "receivables_phone"
                        )
                    ),

                invoice_number=
                    clean_string(
                        record.get(
                            "invoice_number"
                        )
                    ),

                invoice_date=
                    parse_datetime(
                        record.get(
                            "invoice_date"
                        )
                    ),

                due_date=
                    parse_datetime(
                        record.get(
                            "due_date"
                        )
                    ),

                outstanding_amount=
                    parse_float(
                        record.get(
                            "outstanding_amount"
                        ),
                        amount
                    ),

                receivables_status=
                    clean_string(
                        record.get(
                            "receivables_status"
                        ),
                        "Not Started"
                    ),

                chaser_stage=
                    parse_int(
                        record.get(
                            "chaser_stage"
                        ),
                        0
                    ),

                preferred_outreach_channel=
                    clean_string(
                        record.get(
                            "preferred_outreach_channel"
                        ),
                        "Email"
                    ),

                last_chaser_at=
                    parse_datetime(
                        record.get(
                            "last_chaser_at"
                        )
                    ),

                next_chaser_at=
                    parse_datetime(
                        record.get(
                            "next_chaser_at"
                        )
                    ),

                chaser_count=
                    parse_int(
                        record.get(
                            "chaser_count"
                        ),
                        0
                    ),

                last_customer_response=
                    clean_string(
                        record.get(
                            "last_customer_response"
                        )
                    ),

                customer_response_type=
                    clean_string(
                        record.get(
                            "customer_response_type"
                        )
                    ),

                extension_days=
                    parse_int(
                        record.get(
                            "extension_days"
                        ),
                        0
                    ) if record.get(
                        "extension_days"
                    ) not in (None, "") else None,

                outreach_paused=
                    parse_bool(
                        record.get(
                            "outreach_paused"
                        ),
                        False
                    ),

                auto_followup_enabled=
                    parse_bool(
                        record.get(
                            "auto_followup_enabled"
                        ),
                        True
                    ),

                pause_reason=
                    clean_string(
                        record.get(
                            "pause_reason"
                        )
                    ),

                created_at=
                    parse_datetime(
                        record.get(
                            "created_at"
                        )
                    ) or datetime.utcnow()

            )

            db.add(
                new_transaction
            )

            imported += 1

        except Exception as e:

            skipped += 1

            errors.append({

                "row":
                    index,

                "transaction_id":
                    transaction_id,

                "error":
                    str(e)

            })

    # -----------------------------------------------------
    # COMMIT
    # -----------------------------------------------------

    try:

        db.commit()

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Database error while importing "
                f"transactions: {str(e)}"
            )
        )

    # -----------------------------------------------------
    # AUDIT
    # -----------------------------------------------------

    try:

        create_audit_log(

            db=db,

            transaction_id=
                None,

            action=
                "Batch Transaction Upload",

            actor=
                "System",

            old_value=
                None,

            new_value=
                f"{imported} transactions imported",

            details=
                (
                    f"File: {file.filename}; "
                    f"Total records: {len(records)}; "
                    f"Imported: {imported}; "
                    f"Skipped: {skipped}"
                ),

            source=
                "Batch Upload"

        )

    except Exception as e:

        print(
            "Batch audit log error:",
            repr(e)
        )

    return {

        "message":
            "Batch transaction upload completed",

        "filename":
            file.filename,

        "total_records":
            len(records),

        "imported":
            imported,

        "skipped":
            skipped,

        "failed":
            len(errors),

        "errors":
            errors,

        "refresh_required":
            True

    }


# =========================================================
# STATUS NORMALIZATION
# =========================================================

def normalize_transaction_status(transaction):
    """
    Keep payment STATUS and RECOVERY_STATUS consistent.

    Rules:
    - Recovered always means the payment is complete -> Paid.
    - Paid/Success always means the payment is complete -> Recovered,
      unless the row is explicitly an active Promise-to-Pay that has not
      actually been paid.
    - Promise-to-Pay is a collection commitment, not a successful payment.
    """
    recovery = str(
        transaction.recovery_status or ""
    ).strip().lower()

    status = str(
        transaction.status or ""
    ).strip().lower()

    promise_status = str(
        transaction.promise_status or ""
    ).strip().lower()

    promise_active = bool(
        transaction.promise_to_pay
    ) or recovery in {
        "promise to pay",
        "promise-to-pay",
        "promise_to_pay"
    } or promise_status in {
        "active",
        "overdue"
    }

    # A completed recovery is always paid and must never appear as
    # Pending/Failed/Outstanding.
    if recovery == "recovered":
        transaction.status = "Paid"
        if not transaction.recovery_outcome:
            transaction.recovery_outcome = "Payment recovered"
        if not transaction.recovered_amount:
            transaction.recovered_amount = transaction.amount or 0
        transaction.retry_status = "Stopped"
        transaction.promise_status = (
            "Paid"
            if transaction.promise_to_pay or transaction.promise_date
            else transaction.promise_status
        )
        transaction.promise_to_pay = False
        return "Paid"

    # Promise-to-Pay is still unpaid. Never convert it to Paid merely because
    # some old record contained a successful status; an actually completed
    # payment is handled above by the normal payment-state rule.
    if promise_active:
        if status in {"success", "successful", "paid"}:
            # If a row says Paid but is still an active P2P commitment,
            # preserve the real payment state by marking it recovered.
            transaction.status = "Paid"
            transaction.recovery_status = "Recovered"
            transaction.recovery_outcome = (
                transaction.recovery_outcome or "Payment recovered"
            )
            transaction.recovered_amount = (
                transaction.recovered_amount or transaction.amount or 0
            )
            transaction.retry_status = "Stopped"
            transaction.promise_status = "Paid"
            transaction.promise_to_pay = False
            return "Paid"

        if status not in {
            "failed",
            "failure",
            "pending",
            "unpaid",
            "overdue"
        }:
            transaction.status = "Pending"

        return transaction.status

    # A normal successful payment is complete.
    if status in {"success", "successful", "paid"}:
        transaction.status = "Paid"
        if not transaction.recovery_status or recovery in {
            "",
            "not started"
        }:
            transaction.recovery_status = "Recovered"
        if not transaction.recovered_amount:
            transaction.recovered_amount = transaction.amount or 0
        transaction.retry_status = "Stopped"
        return "Paid"

    return transaction.status


# =========================================================
# DATA CONSISTENCY REPAIR
# =========================================================

@app.post("/api/receivables/repair")
def repair_receivables_data(
    db: Session = Depends(get_db)
):
    """
    Repair contradictory payment/recovery states already stored in SQLite.

    Examples fixed:
    - RECOVERY=Recovered + STATUS=Failed -> STATUS=Paid
    - RECOVERY=Recovered + STATUS=Pending -> STATUS=Paid
    - STATUS=Paid/Success -> complete recovery state
    - Promise-to-Pay records remain unpaid unless actually completed
    """

    transactions = db.query(Transaction).all()

    repaired = 0
    recovered_fixed = 0
    promise_fixed = 0

    for transaction in transactions:
        before = (
            transaction.status,
            transaction.recovery_status,
            transaction.recovered_amount,
            transaction.promise_status,
            transaction.promise_to_pay,
        )

        old_recovery = str(
            transaction.recovery_status or ""
        ).strip().lower()

        old_status = str(
            transaction.status or ""
        ).strip().lower()

        if old_recovery == "recovered":
            transaction.status = "Paid"
            transaction.recovered_amount = (
                transaction.amount or 0
            )
            transaction.retry_status = "Stopped"
            recovered_fixed += 1

        elif old_status in {
            "success",
            "successful",
            "paid"
        } and old_recovery not in {
            "promise to pay",
            "promise-to-pay",
            "promise_to_pay"
        }:
            transaction.status = "Paid"
            transaction.recovery_status = "Recovered"
            transaction.recovered_amount = (
                transaction.amount or 0
            )
            transaction.recovery_outcome = (
                transaction.recovery_outcome
                or "Payment recovered"
            )
            transaction.retry_status = "Stopped"
            recovered_fixed += 1

        else:
            normalize_transaction_status(
                transaction
            )

        recovery_now = str(
            transaction.recovery_status or ""
        ).strip().lower()

        if recovery_now in {
            "promise to pay",
            "promise-to-pay",
            "promise_to_pay"
        }:
            if str(
                transaction.status or ""
            ).strip().lower() not in {
                "failed",
                "failure",
                "pending",
                "unpaid",
                "overdue"
            }:
                transaction.status = "Pending"

            transaction.promise_to_pay = True

            if not transaction.promise_status:
                transaction.promise_status = "Active"

            promise_fixed += 1

        after = (
            transaction.status,
            transaction.recovery_status,
            transaction.recovered_amount,
            transaction.promise_status,
            transaction.promise_to_pay,
        )

        if before != after:
            repaired += 1

    db.commit()

    return {
        "message": "Receivables data consistency repair completed.",
        "transactions_checked": len(transactions),
        "records_changed": repaired,
        "recovered_states_fixed": recovered_fixed,
        "promise_states_fixed": promise_fixed,
    }


# =========================================================
# GET ALL TRANSACTIONS
# =========================================================

@app.get("/api/transactions")
def get_transactions(
    db: Session = Depends(get_db)
):
    transactions = (
        db.query(Transaction)
        .order_by(Transaction.id.desc())
        .all()
    )

    changed = False
    for transaction in transactions:
        old_status = transaction.status
        normalize_transaction_status(transaction)
        if transaction.status != old_status:
            changed = True

    if changed:
        db.commit()

    return transactions


# =========================================================
# GET SINGLE TRANSACTION
# =========================================================

@app.get(
    "/api/transactions/{transaction_id}"
)
def get_transaction_endpoint(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    return transaction


# =========================================================
# RECOVER TRANSACTION
# =========================================================

@app.put(
    "/api/transactions/{transaction_id}/recover"
)
def recover_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    if str(
        transaction.status
        or ""
    ).lower() in {"success", "successful", "paid"} or str(
        transaction.recovery_status
        or ""
    ).lower() == "recovered":

        return {

            "message":
                "Transaction is already successful.",

            "transaction_id":
                transaction.transaction_id,

            "recovery_status":
                transaction.recovery_status,

            "recovered_amount":
                transaction.recovered_amount

        }

    old_status = transaction.status

    transaction.recovery_status = (
        "Recovered"
    )

    transaction.status = (
        "Paid"
    )

    transaction.recovery_outcome = (
        "Payment recovered"
    )

    transaction.recovered_amount = (
        transaction.amount or 0
    )

    transaction.last_action = (
        "Transaction recovered"
    )

    transaction.retry_status = (
        "Stopped"
    )

    db.commit()

    db.refresh(
        transaction
    )

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                "Transaction Recovered",

            actor=
                "System",

            old_value=
                old_status,

            new_value=
                "Paid",

            details=
                (
                    "Payment successfully "
                    "recovered by RecoverAI."
                ),

            source=
                "Recovery"

        )

    except Exception as e:

        print(
            "Recovery audit error:",
            repr(e)
        )

    return {

        "message":
            "Transaction recovered successfully",

        "transaction_id":
            transaction.transaction_id,

        "recovery_status":
            transaction.recovery_status,

        "recovered_amount":
            transaction.recovered_amount

    }


# =========================================================
# ERROR PATTERNS
# =========================================================

ERROR_PATTERNS = {

    "INSUFFICIENT_FUNDS": {

        "root_cause":
            "insufficient_funds",

        "severity":
            "medium",

        "recommended_action":
            "retry_later",

        "diagnosis":
            (
                "The payment failed because "
                "there wasn't enough available balance."
            )

    },

    "BANK_TIMEOUT": {

        "root_cause":
            "bank_timeout",

        "severity":
            "medium",

        "recommended_action":
            "retry_after_delay",

        "diagnosis":
            (
                "The bank did not respond in time. "
                "The payment may still have been processed."
            )

    },

    "CARD_EXPIRED": {

        "root_cause":
            "expired_card",

        "severity":
            "high",

        "recommended_action":
            "update_payment_method",

        "diagnosis":
            (
                "The payment failed because "
                "the card has expired."
            )

    },

    "DO_NOT_HONOR": {

        "root_cause":
            "bank_declined",

        "severity":
            "high",

        "recommended_action":
            "try_another_payment_method",

        "diagnosis":
            (
                "The customer's bank declined the payment."
            )

    },

    "AUTHENTICATION_FAILED": {

        "root_cause":
            "authentication_failure",

        "severity":
            "medium",

        "recommended_action":
            "retry_authentication",

        "diagnosis":
            (
                "Payment authentication was unsuccessful."
            )

    },

    "LIMIT_EXCEEDED": {

        "root_cause":
            "transaction_limit_exceeded",

        "severity":
            "medium",

        "recommended_action":
            "use_alternate_payment_method",

        "diagnosis":
            (
                "The payment exceeded the allowed "
                "transaction limit."
            )

    },

    "NETWORK_ERROR": {

        "root_cause":
            "network_failure",

        "severity":
            "low",

        "recommended_action":
            "automatic_retry",

        "diagnosis":
            (
                "A temporary network problem "
                "caused the failure."
            )

    },

    "INVALID_VPA": {

        "root_cause":
            "invalid_upi_id",

        "severity":
            "high",

        "recommended_action":
            "correct_upi_id",

        "diagnosis":
            (
                "The provided UPI ID is invalid."
            )

    },

    "PAYMENT_DECLINED": {

        "root_cause":
            "payment_declined",

        "severity":
            "high",

        "recommended_action":
            "try_alternate_payment_method",

        "diagnosis":
            (
                "The payment was declined by "
                "the payment provider or bank."
            )

    },

    "CARD_DECLINED": {

        "root_cause":
            "card_declined",

        "severity":
            "high",

        "recommended_action":
            "try_another_card",

        "diagnosis":
            (
                "The customer's card was declined."
            )

    },

    "OTP_FAILED": {

        "root_cause":
            "otp_verification_failure",

        "severity":
            "medium",

        "recommended_action":
            "retry_verification",

        "diagnosis":
            (
                "OTP verification was unsuccessful."
            )

    },

    "SESSION_EXPIRED": {

        "root_cause":
            "session_expired",

        "severity":
            "low",

        "recommended_action":
            "restart_payment",

        "diagnosis":
            (
                "The payment session expired "
                "before completion."
            )

    }

}


# =========================================================
# DIAGNOSIS FUNCTION
# =========================================================

def run_diagnosis(transaction):

    error_code = (

        transaction.error_code
        or ""

    ).upper().strip()

    failure_reason = (

        transaction.failure_reason
        or ""

    ).lower().strip()

    error_description = (

        transaction.error_description
        or ""

    ).lower().strip()

    combined_reason = (
        failure_reason
        + " "
        + error_description
    )

    # -----------------------------------------------------
    # ERROR CODE
    # -----------------------------------------------------

    if error_code in ERROR_PATTERNS:

        return ERROR_PATTERNS[
            error_code
        ]

    # -----------------------------------------------------
    # FAILURE REASON
    # -----------------------------------------------------

    if (
        "insufficient" in combined_reason
        or
        "balance" in combined_reason
        or
        "low balance" in combined_reason
    ):

        return ERROR_PATTERNS[
            "INSUFFICIENT_FUNDS"
        ]

    if (
        "timeout" in combined_reason
        or
        "timed out" in combined_reason
    ):

        return ERROR_PATTERNS[
            "BANK_TIMEOUT"
        ]

    if "expired" in combined_reason:

        return ERROR_PATTERNS[
            "CARD_EXPIRED"
        ]

    if "network" in combined_reason:

        return ERROR_PATTERNS[
            "NETWORK_ERROR"
        ]

    if (
        "invalid vpa" in combined_reason
        or
        "invalid upi" in combined_reason
    ):

        return ERROR_PATTERNS[
            "INVALID_VPA"
        ]

    if (
        "authentication" in combined_reason
        or
        "authentication failed" in combined_reason
    ):

        return ERROR_PATTERNS[
            "AUTHENTICATION_FAILED"
        ]

    if (
        "otp" in combined_reason
        and
        (
            "fail" in combined_reason
            or
            "invalid" in combined_reason
        )
    ):

        return ERROR_PATTERNS[
            "OTP_FAILED"
        ]

    if "limit" in combined_reason:

        return ERROR_PATTERNS[
            "LIMIT_EXCEEDED"
        ]

    if (
        "declined" in combined_reason
        or
        "decline" in combined_reason
        or
        "do not honor" in combined_reason
    ):

        return ERROR_PATTERNS[
            "PAYMENT_DECLINED"
        ]

    if "session expired" in combined_reason:

        return ERROR_PATTERNS[
            "SESSION_EXPIRED"
        ]

    # -----------------------------------------------------
    # DEFAULT
    # -----------------------------------------------------

    return {

        "root_cause":
            "unknown_failure",

        "severity":
            "medium",

        "recommended_action":
            "manual_review",

        "diagnosis":
            (
                "We couldn't determine the exact "
                "reason for this payment failure."
            )

    }


# =========================================================
# DIAGNOSE TRANSACTION
# =========================================================

@app.post(
    "/api/transactions/{transaction_id}/diagnose"
)
def diagnose_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    old_root_cause = (
        transaction.root_cause
    )

    result = run_diagnosis(
        transaction
    )

    transaction.root_cause = (
        result["root_cause"]
    )

    transaction.severity = (
        result["severity"]
    )

    transaction.recommended_action = (
        result["recommended_action"]
    )

    transaction.ai_diagnosis = (
        result["diagnosis"]
    )

    transaction.last_action = (
        "AI diagnosis completed"
    )

    db.commit()

    db.refresh(
        transaction
    )

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                "AI Diagnosis Completed",

            actor=
                "AI",

            old_value=
                old_root_cause,

            new_value=
                result["root_cause"],

            details=
                (
                    f"Severity: "
                    f"{result['severity']}; "
                    f"Recommended action: "
                    f"{result['recommended_action']}"
                ),

            source=
                "Diagnosis Engine"

        )

    except Exception as e:

        print(
            "Diagnosis audit error:",
            repr(e)
        )

    return {

        "transaction_id":
            transaction.transaction_id,

        "gateway":
            transaction.gateway,

        "error_code":
            transaction.error_code,

        "error_description":
            transaction.error_description,

        "root_cause":
            transaction.root_cause,

        "severity":
            transaction.severity,

        "recommended_action":
            transaction.recommended_action,

        "diagnosis":
            transaction.ai_diagnosis

    }


# =========================================================
# SMART RETRY
# =========================================================

MAX_RETRIES = 3

DANGEROUS_REASONS = [

    "card_stolen",
    "stolen_card",
    "fraud",
    "suspected_fraud",
    "account_blocked"

]


@app.post(
    "/api/transactions/{transaction_id}/retry"
)
def smart_retry(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    status = str(
        transaction.status
        or ""
    ).lower()

    if status == "success":

        return {

            "status":
                "stopped",

            "reason":
                "Transaction is already successful."

        }

    if str(
        transaction.recovery_status
        or ""
    ).lower() == "recovered":

        return {

            "status":
                "stopped",

            "reason":
                "Transaction has already been recovered."

        }

    retry_count = (
        transaction.retry_count
        or 0
    )

    max_retries = (
        transaction.max_retries
        or MAX_RETRIES
    )

    # -----------------------------------------------------
    # MAX RETRIES
    # -----------------------------------------------------

    if retry_count >= max_retries:

        transaction.retry_status = (
            "Exhausted"
        )

        transaction.last_action = (
            "Retry limit exhausted"
        )

        db.commit()

        try:

            create_audit_log(

                db=db,

                transaction_id=
                    transaction.transaction_id,

                action=
                    "Retry Exhausted",

                actor=
                    "System",

                old_value=
                    str(retry_count),

                new_value=
                    "Exhausted",

                details=
                    (
                        f"Maximum retry limit "
                        f"of {max_retries} reached."
                    ),

                source=
                    "Smart Retry"

            )

        except Exception as e:

            print(
                "Retry audit error:",
                repr(e)
            )

        return {

            "status":
                "stopped",

            "reason":
                (
                    f"Maximum retry limit of "
                    f"{max_retries} attempts reached."
                ),

            "retry_count":
                retry_count

        }

    # -----------------------------------------------------
    # SECURITY BLOCK
    # -----------------------------------------------------

    failure_reason = (

        transaction.failure_reason
        or ""

    ).lower()

    error_description = (

        transaction.error_description
        or ""

    ).lower()

    combined_reason = (
        failure_reason
        + " "
        + error_description
    )

    for reason in DANGEROUS_REASONS:

        if reason in combined_reason:

            transaction.retry_status = (
                "Blocked"
            )

            transaction.last_action = (
                "Retry blocked for security"
            )

            db.commit()

            try:

                create_audit_log(

                    db=db,

                    transaction_id=
                        transaction.transaction_id,

                    action=
                        "Retry Blocked",

                    actor=
                        "System",

                    old_value=
                        "Eligible",

                    new_value=
                        "Blocked",

                    details=
                        (
                            "Retry stopped because "
                            "the transaction indicates "
                            "a security-related issue."
                        ),

                    source=
                        "Smart Retry"

                )

            except Exception as e:

                print(
                    "Retry audit error:",
                    repr(e)
                )

            return {

                "status":
                    "stopped",

                "reason":
                    (
                        "Retry stopped because the "
                        "transaction indicates a "
                        "security-related issue."
                    ),

                "retry_count":
                    retry_count

            }

    # -----------------------------------------------------
    # SCHEDULE RETRY
    # -----------------------------------------------------

    old_retry_count = retry_count

    retry_count += 1

    transaction.retry_count = (
        retry_count
    )

    transaction.last_retry_at = (
        datetime.utcnow()
    )

    root_cause = (

        transaction.root_cause
        or ""

    ).lower()

    if root_cause in [

        "bank_timeout",
        "network_failure"

    ]:

        retry_after_minutes = 30

    elif root_cause == "insufficient_funds":

        retry_after_minutes = 1440

    elif root_cause in [

        "expired_card",
        "card_declined",
        "bank_declined",
        "payment_declined",
        "invalid_upi_id"

    ]:

        retry_after_minutes = 120

    else:

        retry_after_minutes = 120

    next_retry = (

        datetime.utcnow()
        +
        timedelta(
            minutes=
                retry_after_minutes
        )

    )

    transaction.next_retry_at = (
        next_retry
    )

    transaction.retry_status = (
        "Scheduled"
    )

    transaction.last_action = (
        f"Retry #{retry_count} scheduled"
    )

    db.commit()

    db.refresh(
        transaction
    )

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                f"Retry #{retry_count} Scheduled",

            actor=
                "System",

            old_value=
                f"Retry count: {old_retry_count}",

            new_value=
                f"Retry count: {retry_count}",

            details=
                (
                    f"Next retry scheduled for "
                    f"{next_retry.isoformat()}"
                ),

            source=
                "Smart Retry"

        )

    except Exception as e:

        print(
            "Retry audit error:",
            repr(e)
        )

    return {

        "status":
            "retry_scheduled",

        "transaction_id":
            transaction.transaction_id,

        "retry_number":
            retry_count,

        "max_retries":
            max_retries,

        "retry_after_minutes":
            retry_after_minutes,

        "next_retry_at":
            next_retry,

        "reason":
            (
                "Retry scheduled using "
                "RecoverAI smart retry rules."
            )

    }


# =========================================================
# PROMISE TO PAY
# =========================================================

@app.post(
    "/api/transactions/{transaction_id}/promise-to-pay"
)
@app.post(
    "/api/transactions/{transaction_id}/promise"
)
def promise_to_pay(
    transaction_id: str,
    data: dict,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    promise_date = data.get(
        "promise_date"
    )

    if not promise_date:

        raise HTTPException(
            status_code=400,
            detail="promise_date is required"
        )

    parsed_date = parse_datetime(
        promise_date
    )

    if not parsed_date:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid promise_date format. "
                "Use YYYY-MM-DD or "
                "YYYY-MM-DDTHH:MM:SS"
            )
        )

    if parsed_date < datetime.utcnow():

        raise HTTPException(
            status_code=400,
            detail="Promise date cannot be in the past."
        )

    old_promise_status = (
        transaction.promise_status
    )

    transaction.promise_to_pay = True

    transaction.promise_date = (
        parsed_date
    )

    transaction.promise_note = data.get(
        "note",
        "Customer promised to pay."
    )

    transaction.promise_status = (
        "Active"
    )

    transaction.promise_recorded_at = (
        datetime.utcnow()
    )

    transaction.promise_followup_at = (
        parsed_date
    )

    transaction.promise_followup_count = (
        transaction.promise_followup_count
        or 0
    )

    transaction.recovery_status = (
        "Promise to Pay"
    )

    # Promise-to-Pay is only valid for an unpaid/outstanding account.
    current_status = str(transaction.status or "").strip().lower()
    current_recovery = str(transaction.recovery_status or "").strip().lower()

    if current_status in {"success", "successful", "paid"} or current_recovery == "recovered":
        raise HTTPException(
            status_code=400,
            detail="Cannot create a Promise-to-Pay for an already paid/recovered transaction."
        )

    if current_status not in {"failed", "failure", "pending", "unpaid", "overdue"}:
        transaction.status = "Pending"

    transaction.last_action = (
        "Promise-to-Pay recorded"
    )

    db.commit()

    db.refresh(
        transaction
    )

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                "Promise-to-Pay Recorded",

            actor=
                "Customer/System",

            old_value=
                old_promise_status,

            new_value=
                parsed_date.isoformat(),

            details=
                (
                    transaction.promise_note
                    or
                    "Customer committed to payment."
                ),

            source=
                "Promise-to-Pay"

        )

    except Exception as e:

        print(
            "Promise audit error:",
            repr(e)
        )

    return {

        "message":
            "Promise-to-Pay recorded",

        "transaction_id":
            transaction.transaction_id,

        "promise_date":
            parsed_date.isoformat(),

        "promise_status":
            transaction.promise_status,

        "recovery_status":
            transaction.recovery_status,

        "next_action":
            (
                "RecoverAI will follow up if "
                "the promised payment date passes."
            )

    }


# =========================================================
# UPDATE PROMISE-TO-PAY
# =========================================================

@app.put(
    "/api/transactions/{transaction_id}/promise-to-pay"
)
def update_promise_to_pay(
    transaction_id: str,
    data: dict,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    promise_date = data.get(
        "promise_date"
    )

    note = data.get(
        "note",
        "Promise-to-Pay commitment updated."
    )

    if not promise_date:

        raise HTTPException(
            status_code=400,
            detail="promise_date is required"
        )

    parsed_date = parse_datetime(
        promise_date
    )

    if not parsed_date:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid promise_date. "
                "Use YYYY-MM-DD."
            )
        )

    if parsed_date < datetime.utcnow():

        raise HTTPException(
            status_code=400,
            detail="Promise date cannot be in the past."
        )

    old_date = transaction.promise_date

    transaction.promise_to_pay = True

    transaction.promise_date = (
        parsed_date
    )

    transaction.promise_note = (
        note
    )

    transaction.promise_status = (
        "Active"
    )

    transaction.promise_recorded_at = (
        datetime.utcnow()
    )

    transaction.promise_followup_at = (
        parsed_date
    )

    transaction.recovery_status = (
        "Promise to Pay"
    )

    current_status = str(transaction.status or "").strip().lower()
    current_recovery = str(transaction.recovery_status or "").strip().lower()

    if current_status in {"success", "successful", "paid"} or current_recovery == "recovered":
        raise HTTPException(
            status_code=400,
            detail="Cannot update a Promise-to-Pay for an already paid/recovered transaction."
        )

    if current_status not in {"failed", "failure", "pending", "unpaid", "overdue"}:
        transaction.status = "Pending"

    transaction.last_action = (
        "Promise-to-Pay commitment updated"
    )

    db.commit()

    db.refresh(
        transaction
    )

    # -----------------------------------------------------
    # AUDIT
    # -----------------------------------------------------

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                "Promise-to-Pay Updated",

            actor=
                "User",

            old_value=
                str(old_date)
                if old_date
                else None,

            new_value=
                parsed_date.isoformat(),

            details=
                (
                    f"Payment commitment updated. "
                    f"Previous date: "
                    f"{old_date or 'None'}. "
                    f"New date: {parsed_date}. "
                    f"Note: {note}"
                ),

            source=
                "Promise-to-Pay Tracker"

        )

    except Exception as e:

        print(
            "Audit log error:",
            repr(e)
        )

    return {

        "message":
            (
                "Promise-to-Pay commitment "
                "updated successfully"
            ),

        "transaction_id":
            transaction.transaction_id,

        "promise_date":
            parsed_date.isoformat(),

        "promise_status":
            transaction.promise_status,

        "recovery_status":
            transaction.recovery_status

    }


# =========================================================
# PROMISE STATUS
# =========================================================

@app.get(
    "/api/transactions/{transaction_id}/promise-status"
)
def promise_status(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    promise_date = (
        transaction.promise_date
    )

    promise_active = bool(
        transaction.promise_to_pay
    )

    if (
        not promise_active
        or
        not promise_date
    ):

        return {

            "transaction_id":
                transaction.transaction_id,

            "promise_status":
                "No active promise",

            "follow_up_required":
                False

        }

    # -----------------------------------------------------
    # PAYMENT COMPLETED
    # -----------------------------------------------------

    if str(
        transaction.status
        or ""
    ).lower() in {"success", "successful", "paid"} or str(
        transaction.recovery_status
        or ""
    ).lower() == "recovered":

        old_status = (
            transaction.promise_status
        )

        transaction.promise_status = (
            "Paid"
        )

        transaction.status = "Paid"
        transaction.recovery_status = "Recovered"
        transaction.recovery_outcome = "Payment recovered"
        transaction.recovered_amount = transaction.amount or 0
        transaction.retry_status = "Stopped"

        transaction.last_action = (
            "Promise-to-Pay fulfilled"
        )

        db.commit()

        try:

            create_audit_log(

                db=db,

                transaction_id=
                    transaction.transaction_id,

                action=
                    "Promise-to-Pay Fulfilled",

                actor=
                    "System",

                old_value=
                    old_status,

                new_value=
                    "Paid",

                details=
                    (
                        "Payment completed before "
                        "or after the promised date."
                    ),

                source=
                    "Promise Tracker"

            )

        except Exception as e:

            print(
                "Promise status audit error:",
                repr(e)
            )

        return {

            "transaction_id":
                transaction.transaction_id,

            "promise_status":
                "Paid",

            "follow_up_required":
                False,

            "message":
                "The payment has already been completed."

        }

    # -----------------------------------------------------
    # OVERDUE
    # -----------------------------------------------------

    now = datetime.utcnow()

    if now > promise_date:

        old_status = (
            transaction.promise_status
        )

        transaction.promise_status = (
            "Overdue"
        )

        transaction.promise_followup_at = (
            now
        )

        transaction.promise_followup_count = (
            transaction.promise_followup_count
            or 0
        ) + 1

        transaction.last_action = (
            "Promise-to-Pay overdue"
        )

        db.commit()

        try:

            create_audit_log(

                db=db,

                transaction_id=
                    transaction.transaction_id,

                action=
                    "Promise-to-Pay Overdue",

                actor=
                    "System",

                old_value=
                    old_status,

                new_value=
                    "Overdue",

                details=
                    (
                        "Promised payment date passed "
                        "without successful payment."
                    ),

                source=
                    "Promise Tracker"

            )

        except Exception as e:

            print(
                "Promise overdue audit error:",
                repr(e)
            )

        return {

            "transaction_id":
                transaction.transaction_id,

            "promise_status":
                "Promise overdue",

            "promise_date":
                promise_date,

            "follow_up_required":
                True,

            "recommended_action":
                "Send a polite payment follow-up."

        }

    # -----------------------------------------------------
    # ACTIVE
    # -----------------------------------------------------

    if transaction.promise_status != "Active":

        transaction.promise_status = (
            "Active"
        )

        db.commit()

    return {

        "transaction_id":
            transaction.transaction_id,

        "promise_status":
            "Promise active",

        "promise_date":
            promise_date,

        "follow_up_required":
            False,

        "message":
            (
                "The promised payment date has "
                "not passed yet."
            )

    }


# =========================================================
# PROMISE-TO-PAY MESSAGE ANALYSIS
# =========================================================

@app.post(
    "/api/promise-to-pay/analyze"
)
def analyze_promise_message(
    data: dict,
    db: Session = Depends(get_db)
):

    message = clean_string(
        data.get(
            "message"
        )
    )

    transaction_id = data.get(
        "transaction_id"
    )

    if not message:

        raise HTTPException(
            status_code=400,
            detail="message is required"
        )

    transaction = None

    if transaction_id:

        transaction = get_transaction(
            transaction_id,
            db
        )

        if not transaction:

            raise HTTPException(
                status_code=404,
                detail="Transaction not found"
            )

    today = datetime.utcnow().strftime(
        "%Y-%m-%d"
    )

    prompt = f"""
You are RecoverAI's Promise-to-Pay assistant.

Analyze the customer's message below.

Customer message:
{message}

Today's date:
{today}

Determine whether the customer is making a payment promise.

Examples:

"I'll pay on Friday"

"I can clear this invoice next Monday"

"Give me 7 days, I'll make the payment"

"I will pay tomorrow"

Return ONLY valid JSON.

If there is a clear promise:

{{
    "is_promise": true,
    "promise_date": "YYYY-MM-DD",
    "confidence": "high",
    "note": "Short description"
}}

If there is no clear promise:

{{
    "is_promise": false,
    "promise_date": null,
    "confidence": "high",
    "note": "No clear payment commitment found"
}}

Rules:

- Do not invent a date.
- If the date cannot be reliably determined, use null.
- Do not return markdown.
- Return JSON only.
"""

    ai_result = generate_ai_response(
        prompt
    )

    if not ai_result:

        return {

            "transaction_id":
                transaction_id,

            "analysis": {

                "is_promise":
                    False,

                "promise_date":
                    None,

                "confidence":
                    "low",

                "note":
                    "AI service is temporarily unavailable."

            }

        }

    try:

        cleaned = ai_result.strip()

        if cleaned.startswith("```"):

            cleaned = re.sub(
                r"```(?:json)?",
                "",
                cleaned,
                flags=re.IGNORECASE
            ).strip()

        if cleaned.endswith("```"):

            cleaned = cleaned[:-3].strip()

        result = json.loads(
            cleaned
        )

    except Exception:

        return {

            "transaction_id":
                transaction_id,

            "analysis": {

                "is_promise":
                    False,

                "promise_date":
                    None,

                "confidence":
                    "low",

                "note":
                    (
                        "The payment commitment "
                        "could not be reliably understood."
                    )

            }

        }

    # -----------------------------------------------------
    # NORMALIZE AI RESULT
    # -----------------------------------------------------

    result["is_promise"] = bool(
        result.get(
            "is_promise",
            False
        )
    )

    if not result.get(
        "is_promise"
    ):

        result["promise_date"] = None

    # -----------------------------------------------------
    # SAVE PROMISE
    # -----------------------------------------------------

    if (
        transaction
        and
        result.get("is_promise")
        and
        result.get("promise_date")
    ):

        parsed_date = parse_datetime(
            result.get(
                "promise_date"
            )
        )

        if parsed_date:

            old_status = (
                transaction.promise_status
            )

            transaction.promise_to_pay = True

            transaction.promise_date = (
                parsed_date
            )

            transaction.promise_note = (
                message
            )

            transaction.promise_status = (
                "Active"
            )

            transaction.promise_recorded_at = (
                datetime.utcnow()
            )

            transaction.promise_followup_at = (
                parsed_date
            )

            transaction.recovery_status = (
                "Promise to Pay"
            )

            transaction.last_customer_response = (
                message
            )

            transaction.customer_response_type = (
                "Promise to Pay"
            )

            transaction.last_action = (
                "AI Promise-to-Pay detected"
            )

            db.commit()

            try:

                create_audit_log(

                    db=db,

                    transaction_id=
                        transaction.transaction_id,

                    action=
                        "AI Promise-to-Pay Detected",

                    actor=
                        "AI",

                    old_value=
                        old_status,

                    new_value=
                        parsed_date.isoformat(),

                    details=
                        (
                            f"Customer message: "
                            f"{message}; "
                            f"Confidence: "
                            f"{result.get('confidence')}"
                        ),

                    source=
                        "AI Promise Analyzer"

                )

            except Exception as e:

                print(
                    "Promise analysis audit error:",
                    repr(e)
                )

    return {

        "transaction_id":
            transaction_id,

        "analysis":
            result

    }



# =========================================================
# HINGLISH VOICE RECOVERY - SIMULATED CALL ANALYSIS
# =========================================================

@app.post("/api/voice-recovery/start")
def start_voice_recovery(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Simulated multilingual voice-recovery call.

    The frontend sends a customer utterance/transcript. Gemini analyzes
    the response, detects language/intent/sentiment, extracts a
    Promise-to-Pay date when present, and records the result through
    the existing transaction fields and audit trail.
    """

    transaction_id = clean_string(
        data.get("transaction_id")
    )
    customer_message = clean_string(
        data.get("customer_message")
    )
    language = clean_string(
        data.get("language"),
        "Hinglish"
    )
    call_duration = parse_int(
        data.get("call_duration"),
        0
    )
    actor = clean_string(
        data.get("actor"),
        "AI Voice Agent"
    )

    if not transaction_id:
        raise HTTPException(
            status_code=400,
            detail="transaction_id is required"
        )

    if not customer_message:
        raise HTTPException(
            status_code=400,
            detail="customer_message is required"
        )

    if call_duration < 0:
        call_duration = 0

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    today = datetime.utcnow().date().isoformat()

    prompt = f"""
You are RecoverAI's multilingual B2B payment recovery assistant.

Analyze this simulated customer voice-call response.

Transaction ID: {transaction_id}
Customer name: {transaction.customer_name or "Customer"}
Outstanding amount: ₹{float(transaction.amount or 0):,.2f}
Selected language: {language}
Today's date: {today}
Customer response: {customer_message}

Classify the response using exactly one intent:
PROMISE_TO_PAY
PAYMENT_ISSUE
DISPUTE
REFUSAL
ALREADY_PAID
REQUEST_EXTENSION
OTHER

Also determine:
- language_detected
- customer_sentiment: Positive, Neutral, or Negative
- promise_to_pay: true or false
- promise_date: YYYY-MM-DD if a concrete payment date is clearly stated, otherwise null
- confidence_score: number from 0 to 1
- ai_reasoning: short explanation

Rules:
- Understand Hinglish naturally.
- Resolve relative dates such as "next Monday" using today's date.
- Do not invent a promise date.
- Do not treat a vague intention as a definite Promise-to-Pay.
- Do not request OTP, PIN, CVV, password, or banking credentials.

Return ONLY valid JSON:
{{
  "language_detected": "Hinglish",
  "customer_intent": "PROMISE_TO_PAY",
  "customer_sentiment": "Neutral",
  "promise_to_pay": true,
  "promise_date": "YYYY-MM-DD",
  "confidence_score": 0.94,
  "ai_reasoning": "Short explanation"
}}
"""

    ai_text = generate_ai_response(prompt)

    if not ai_text:
        raise HTTPException(
            status_code=503,
            detail=(
                "Gemini AI is unavailable. "
                "Check GEMINI_API_KEY and the configured model."
            )
        )

    # Gemini sometimes returns JSON inside a markdown code fence.
    try:
        cleaned = ai_text.strip()

        if "```" in cleaned:
            cleaned = re.sub(
                r"```(?:json)?",
                "",
                cleaned,
                flags=re.IGNORECASE
            ).replace("```", "").strip()

        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start >= 0 and end > start:
            cleaned = cleaned[start:end + 1]

        analysis = json.loads(cleaned)

    except Exception as e:
        print(
            "Voice AI JSON parsing error:",
            repr(e)
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned an invalid "
                "voice-analysis response."
            )
        )

    language_detected = clean_string(
        analysis.get("language_detected"),
        language
    )

    customer_intent = clean_string(
        analysis.get("customer_intent"),
        "OTHER"
    ).upper()

    allowed_intents = {
        "PROMISE_TO_PAY",
        "PAYMENT_ISSUE",
        "DISPUTE",
        "REFUSAL",
        "ALREADY_PAID",
        "REQUEST_EXTENSION",
        "OTHER"
    }

    if customer_intent not in allowed_intents:
        customer_intent = "OTHER"

    customer_sentiment = clean_string(
        analysis.get("customer_sentiment"),
        "Neutral"
    )

    promise_to_pay = parse_bool(
        analysis.get("promise_to_pay"),
        False
    )

    promise_date_raw = analysis.get(
        "promise_date"
    )

    parsed_promise_date = (
        parse_datetime(promise_date_raw)
        if promise_date_raw
        else None
    )

    # A promise date must be valid and in the future.
    if (
        parsed_promise_date
        and parsed_promise_date.date()
        < datetime.utcnow().date()
    ):
        parsed_promise_date = None

    # Do not mark a transaction as PTP without a usable date.
    if not parsed_promise_date:
        promise_to_pay = False

    try:
        confidence_score = float(
            analysis.get(
                "confidence_score",
                0
            )
        )
    except (
        TypeError,
        ValueError
    ):
        confidence_score = 0.0

    confidence_score = max(
        0.0,
        min(1.0, confidence_score)
    )

    ai_reasoning = clean_string(
        analysis.get("ai_reasoning"),
        "Voice recovery response analyzed by RecoverAI."
    )

    old_promise_status = (
        transaction.promise_status
    )

    old_recovery_status = (
        transaction.recovery_status
    )

    # Save voice-call information using fields already
    # supported by the current Transaction model.
    transaction.last_customer_response = (
        customer_message
    )

    transaction.customer_response_type = (
        customer_intent
    )

    transaction.preferred_language = (
        language_detected
    )

    transaction.last_action = (
        "AI Voice Recovery Call Completed"
    )

    if promise_to_pay and parsed_promise_date:
        transaction.promise_to_pay = True
        transaction.promise_date = (
            parsed_promise_date
        )
        transaction.promise_note = (
            customer_message
        )
        transaction.promise_status = "Active"
        transaction.promise_recorded_at = (
            datetime.utcnow()
        )
        transaction.promise_followup_at = (
            parsed_promise_date
        )
        transaction.recovery_status = (
            "Promise to Pay"
        )

    db.commit()
    db.refresh(transaction)

    # Use the existing audit helper instead of assuming
    # optional AuditLog columns exist.
    try:
        audit_details = (
            f"Voice call analyzed. "
            f"Intent={customer_intent}; "
            f"Sentiment={customer_sentiment}; "
            f"Language={language_detected}; "
            f"PromiseToPay={promise_to_pay}; "
            f"PromiseDate="
            f"{parsed_promise_date.isoformat() if parsed_promise_date else 'None'}; "
            f"Confidence={confidence_score:.2f}; "
            f"Duration={call_duration}s; "
            f"Transcript={customer_message}; "
            f"AI Reasoning={ai_reasoning}"
        )

        create_audit_log(
            db=db,
            transaction_id=transaction.transaction_id,
            action="Voice Recovery Call Completed",
            actor=actor,
            old_value=(
                old_promise_status
                or old_recovery_status
                or "Not Started"
            ),
            new_value=(
                parsed_promise_date.isoformat()
                if parsed_promise_date
                else customer_intent
            ),
            details=audit_details,
            source="AI Voice Recovery"
        )

    except Exception as e:
        print(
            "Voice recovery audit error:",
            repr(e)
        )

    return {
        "success": True,
        "transaction_id": transaction.transaction_id,
        "customer_name": transaction.customer_name,
        "language_detected": language_detected,
        "customer_intent": customer_intent,
        "customer_sentiment": customer_sentiment,
        "promise_to_pay": promise_to_pay,
        "promise_date": (
            parsed_promise_date.isoformat()
            if parsed_promise_date
            else None
        ),
        "confidence_score": confidence_score,
        "ai_reasoning": ai_reasoning,
        "call_duration": call_duration,
        "transcript": customer_message,
        "recovery_status": transaction.recovery_status,
        "promise_status": transaction.promise_status,
        "next_action": (
            "Follow up on the promised payment date."
            if promise_to_pay
            else "Continue the appropriate recovery workflow."
        )
    }



# =========================================================
# B2B RECEIVABLES CHASER
# =========================================================

@app.post(
    "/api/receivables/chaser"
)
def receivables_chaser(
    data: dict,
    db: Session = Depends(get_db)
):
    """Generate a B2B chaser in preview mode or record a send action."""

    transaction_id = data.get("transaction_id")
    if not transaction_id:
        raise HTTPException(
            status_code=400,
            detail="transaction_id is required"
        )

    transaction = get_transaction(transaction_id, db)
    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    normalize_transaction_status(transaction)

    if (
        str(transaction.recovery_status or "").strip().lower() == "recovered"
        or str(transaction.status or "").strip().lower() in {"paid", "success", "successful"}
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot send a receivables chaser for a paid/recovered transaction."
        )

    # Normalize channel names used by the frontend.
    raw_channel = clean_string(data.get("channel"), "email").lower()
    channel_aliases = {
        "mail": "email",
        "email": "email",
        "whatsapp business": "whatsapp",
        "whatsapp": "whatsapp",
        "wa": "whatsapp",
        "voice agent": "voice",
        "hinglish voice": "voice",
        "voice": "voice",
    }
    channel = channel_aliases.get(raw_channel, "email")

    stage = parse_int(data.get("stage"), 1)
    if stage not in {1, 2, 3}:
        stage = 1

    request_action = clean_string(data.get("action"), "preview").lower()
    if request_action not in {"preview", "send"}:
        request_action = "preview"

    customer_name = transaction.customer_name or "Customer"
    amount = max(
        float(transaction.outstanding_amount or 0),
        0
    )

    if amount <= 0:
        amount = max(
            float(transaction.amount or 0) - float(transaction.recovered_amount or 0),
            0
        )

    email = (
        transaction.receivables_email
        or transaction.customer_email
        or ""
    )

    escalation_levels = {
        1: {
            "name": "Level 1",
            "label": "Gentle Email Reminder",
        },
        2: {
            "name": "Level 2",
            "label": "Urgent WhatsApp + Voice Chaser",
        },
        3: {
            "name": "Level 3",
            "label": "Executive Account Manager Intervention",
        },
    }
    escalation = escalation_levels[stage]

    if stage == 1:
        tone = "friendly"
        default_subject = "Friendly payment reminder"
        action_text = "Please arrange the payment when convenient."
    elif stage == 2:
        tone = "professional"
        default_subject = "Payment follow-up"
        action_text = "Could you please confirm when we can expect the payment?"
    else:
        tone = "firm but polite"
        default_subject = "Important payment follow-up"
        action_text = "Please confirm the expected payment date so we can update our records."

    if channel == "whatsapp":
        channel_instruction = "Write a concise WhatsApp Business message suitable for chat."
    elif channel == "voice":
        channel_instruction = "Write a short Hinglish voice-agent script that sounds natural when spoken."
    else:
        channel_instruction = "Write a professional email message."

    # Allow the review modal to send an edited message unchanged.
    supplied_message = data.get("message")
    supplied_subject = data.get("subject")

    if request_action == "send" and clean_string(supplied_message):
        message = str(supplied_message).strip()
        subject = clean_string(supplied_subject, default_subject)
    else:
        prompt = f"""
You are RecoverAI, a professional B2B accounts-receivable assistant.

Create a short {tone} payment reminder.

Customer/company:
{customer_name}

Outstanding amount:
₹{amount:,.2f}

Transaction/Invoice ID:
{transaction.transaction_id}

Reminder stage:
{stage} — {escalation['label']}

Channel:
{channel}

{channel_instruction}

Requirements:
- Sound like a real finance professional.
- Be polite and firm when appropriate.
- Do not threaten the customer.
- Do not sound robotic.
- Do not mention AI.
- Keep it under 100 words.
- Clearly mention the outstanding amount.
- Clearly mention the transaction/invoice ID.
- Ask for payment or an expected payment date.
- If the customer needs help, offer to resend the receipt.
- Do not ask for OTP, PIN, CVV, password or banking credentials.
- For voice, use natural Hinglish rather than formal written English.

Return only the message.
"""

        ai_message = generate_ai_response(prompt)
        message = ai_message.strip() if ai_message else (
            f"Hi {customer_name},\n\n"
            f"Just a quick follow-up regarding the outstanding payment of "
            f"₹{amount:,.2f} for transaction {transaction.transaction_id}.\n\n"
            f"{action_text}\n\n"
            f"If you need us to resend the receipt or have any questions, please let us know.\n\n"
            f"Thank you.\nRecoverAI"
        )
        subject = clean_string(supplied_subject, default_subject)

    # Preview must NOT mutate counters, stages, timestamps or audit logs.
    if request_action == "send":
        old_stage = transaction.chaser_stage or 0

        transaction.chaser_stage = stage
        transaction.preferred_outreach_channel = channel
        transaction.last_chaser_at = datetime.utcnow()
        transaction.chaser_count = (transaction.chaser_count or 0) + 1
        transaction.receivables_status = (
            "Escalated" if stage >= 3 else "Active"
        )
        transaction.last_action = (
            f"B2B chaser stage {stage} sent via {channel}"
        )

        # Keep the next follow-up visible to the UI.
        transaction.next_chaser_at = (
            datetime.utcnow()
            + timedelta(
                days=3 if stage == 1 else 2 if stage == 2 else 1
            )
        )

        db.commit()
        db.refresh(transaction)

        try:
            create_audit_log(
                db=db,
                transaction_id=transaction.transaction_id,
                action=f"B2B Chaser Stage {stage}",
                actor="System",
                old_value=f"Stage {old_stage}",
                new_value=f"Stage {stage}",
                details=(
                    f"Channel: {channel}; Destination: {email}; "
                    f"Reminder count: {transaction.chaser_count}"
                ),
                source="B2B Receivables"
            )
        except Exception as e:
            print("B2B audit error:", repr(e))

    return {
        "status": "sent" if request_action == "send" else "preview_generated",
        "action": request_action,
        "feature": "B2B Receivables Chaser",
        "transaction_id": transaction.transaction_id,
        "customer": customer_name,
        "destination": email,
        "channel": channel,
        "stage": stage,
        "escalation_level": escalation["name"],
        "escalation_label": escalation["label"],
        "tone": tone,
        "subject": subject,
        "message": message,
        "next_stage": min(stage + 1, 3),
        "chaser_count": transaction.chaser_count or 0,
        "note": (
            "Preview only. No message was sent and no chaser counter was changed."
            if request_action == "preview"
            else "Message dispatch recorded successfully."
        ),
    }


# =========================================================
# B2B CUSTOMER QUERY
# =========================================================

@app.post(
    "/api/receivables/query"
)
def receivables_query(
    data: dict,
    db: Session = Depends(get_db)
):

    transaction_id = data.get(
        "transaction_id"
    )

    customer_message = clean_string(
        data.get(
            "message"
        )
    )

    if not transaction_id:

        raise HTTPException(
            status_code=400,
            detail="transaction_id is required"
        )

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    if not customer_message:

        raise HTTPException(
            status_code=400,
            detail="message is required"
        )

    prompt = f"""
You are RecoverAI, a friendly B2B accounts-receivable assistant.

Customer:
{transaction.customer_name}

Outstanding amount:
₹{transaction.amount}

Transaction ID:
{transaction.transaction_id}

Customer message:
{customer_message}

Understand the customer's request.

Common requests include:

- resend receipt
- request payment extension
- ask for payment date
- payment already made
- payment issue
- general invoice question

Respond in a friendly professional way.

If the customer asks for an extension:
acknowledge the request and ask for the preferred payment date.

If they ask for the receipt:
say that the request can be forwarded to the finance team.

If they say they already paid:
do not claim that payment was received unless the backend confirms it.

Never ask for:

OTP
PIN
CVV
password
banking credentials

Keep the response under 100 words.
"""

    reply = generate_ai_response(
        prompt
    )

    if not reply:

        reply = (
            "Thanks for letting us know. "
            "I've noted your request and the "
            "finance team can help with the next step."
        )

    transaction.last_customer_response = (
        customer_message
    )

    transaction.last_action = (
        "B2B customer query processed"
    )

    db.commit()

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                "B2B Customer Query",

            actor=
                "Customer/AI",

            old_value=
                None,

            new_value=
                customer_message,

            details=
                (
                    "B2B customer query processed "
                    "by RecoverAI."
                ),

            source=
                "B2B Receivables"

        )

    except Exception as e:

        print(
            "B2B query audit error:",
            repr(e)
        )

    return {

        "transaction_id":
            transaction.transaction_id,

        "customer":
            transaction.customer_name,

        "reply":
            reply,

        "status":
            "query_processed"

    }


# =========================================================
# RECEIVABLES DASHBOARD
# =========================================================

@app.get(
    "/api/receivables/dashboard"
)
def receivables_dashboard(
    db: Session = Depends(get_db)
):
    """
    B2B receivables dashboard.

    The backend deliberately uses Promise-to-Pay fields as a second source
    of truth because older/imported rows may have RECOVERY_STATUS="Promise to Pay"
    without promise_to_pay=True.
    """

    transactions = db.query(Transaction).all()

    unpaid = []
    promises = []

    total_outstanding = 0.0
    promise_count = 0
    overdue_promises = 0
    active_promised_amount = 0.0
    follow_ups_pending = 0

    now = datetime.utcnow()

    aging_counts = {
        "Current": 0,
        "1–30 Days Overdue": 0,
        "31–60 Days Overdue": 0,
        "61–90 Days Overdue": 0,
        "90+ Days (High Risk)": 0,
    }

    def aging_bucket(transaction):
        due_date = getattr(transaction, "due_date", None)

        if not due_date:
            return "Current"

        if due_date.tzinfo is not None:
            due_date = due_date.astimezone(
                dt.timezone.utc
            ).replace(tzinfo=None)

        days_overdue = (
            now.date() - due_date.date()
        ).days

        if days_overdue <= 0:
            return "Current"
        if days_overdue <= 30:
            return "1–30 Days Overdue"
        if days_overdue <= 60:
            return "31–60 Days Overdue"
        if days_overdue <= 90:
            return "61–90 Days Overdue"

        return "90+ Days (High Risk)"

    changed = False

    for transaction in transactions:

        old_status = transaction.status
        old_recovery = transaction.recovery_status
        old_promise_status = transaction.promise_status

        normalize_transaction_status(
            transaction
        )

        if (
            transaction.status != old_status
            or transaction.recovery_status != old_recovery
            or transaction.promise_status != old_promise_status
        ):
            changed = True

        status = str(
            transaction.status or ""
        ).strip().lower()

        recovery_status = str(
            transaction.recovery_status or ""
        ).strip().lower()

        promise_status = str(
            transaction.promise_status or ""
        ).strip().lower()

        # -----------------------------------------------------
        # COMPLETED PAYMENTS ARE NEVER OUTSTANDING
        # -----------------------------------------------------
        if recovery_status == "recovered" or status in {
            "paid",
            "success",
            "successful"
        }:
            continue

        amount = float(
            transaction.amount or 0
        )

        recovered_amount = float(
            transaction.recovered_amount or 0
        )

        outstanding_amount = max(
            amount - recovered_amount,
            0
        )

        # -----------------------------------------------------
        # OUTSTANDING RECEIVABLE
        # -----------------------------------------------------
        if (
            status in {
                "failed",
                "failure",
                "pending",
                "unpaid",
                "overdue"
            }
            and outstanding_amount > 0
        ):
            bucket = aging_bucket(
                transaction
            )

            aging_counts[bucket] += 1
            total_outstanding += (
                outstanding_amount
            )

            unpaid.append({
                "transaction_id":
                    transaction.transaction_id,

                "customer":
                    transaction.customer_name,

                "customer_name":
                    transaction.customer_name,

                "company_name":
                    transaction.company_name,

                "contact_person":
                    transaction.contact_person,

                "amount":
                    amount,

                "outstanding_amount":
                    outstanding_amount,

                "status":
                    transaction.status,

                "recovery_status":
                    transaction.recovery_status,

                "promise_to_pay":
                    bool(transaction.promise_to_pay),

                "promise_status":
                    transaction.promise_status,

                "promise_date":
                    transaction.promise_date,

                "due_date":
                    getattr(
                        transaction,
                        "due_date",
                        None
                    ),

                "aging_bucket":
                    bucket,

                "chaser_stage":
                    transaction.chaser_stage or 0,

                "chaser_count":
                    transaction.chaser_count or 0,

                "preferred_outreach_channel":
                    transaction.preferred_outreach_channel or "email",

                "receivables_status":
                    transaction.receivables_status or "Not Started",

                "receivables_email":
                    transaction.receivables_email or transaction.customer_email,

                "receivables_phone":
                    transaction.receivables_phone or "",

                "invoice_number":
                    transaction.invoice_number,

                "invoice_date":
                    transaction.invoice_date,

                "last_chaser_at":
                    transaction.last_chaser_at,

                "next_chaser_at":
                    transaction.next_chaser_at,
            })

        # -----------------------------------------------------
        # PROMISE-TO-PAY
        # -----------------------------------------------------
        promise_date = transaction.promise_date

        promise_active = (
            bool(transaction.promise_to_pay)
            or recovery_status in {
                "promise to pay",
                "promise-to-pay",
                "promise_to_pay"
            }
            or promise_status in {
                "active",
                "overdue"
            }
        )

        # A Promise-to-Pay can still be counted even when an older row
        # has no boolean promise_to_pay flag. This fixes legacy/imported data.
        if (
            promise_active
            and recovery_status != "recovered"
            and status not in {"paid", "success", "successful"}
        ):
            # If there is no promise status, treat the commitment as active.
            if promise_status not in {
                "active",
                "overdue"
            }:
                transaction.promise_status = "Active"
                promise_status = "active"
                changed = True

            # An explicit date makes overdue detection precise.
            # Without a date, it is an active commitment but cannot be
            # classified as overdue purely from time.
            is_overdue = False

            if promise_date:
                if promise_date.tzinfo is not None:
                    promise_date = promise_date.astimezone(
                        dt.timezone.utc
                    ).replace(tzinfo=None)

                is_overdue = (
                    now > promise_date
                    or promise_status == "overdue"
                )
            else:
                is_overdue = (
                    promise_status == "overdue"
                )

            if is_overdue:
                promise_count += 1
                overdue_promises += 1
            else:
                promise_count += 1

            active_promised_amount += outstanding_amount

            if is_overdue and transaction.promise_status != "Overdue":
                transaction.promise_status = "Overdue"
                changed = True

            chaser_count = int(
                transaction.chaser_count or 0
            )

            follow_up_required = bool(
                is_overdue
                or chaser_count > 0
                or (
                    transaction.promise_followup_at
                    and transaction.promise_followup_at <= now
                )
            )

            if follow_up_required:
                follow_ups_pending += 1

            escalation_level = min(
                max(
                    int(transaction.chaser_stage or 0),
                    0
                ) + 1,
                3
            )

            escalation_labels = {
                1: "Level 1: Gentle Email Reminder",
                2: "Level 2: Urgent WhatsApp + Voice Chaser",
                3: "Level 3: Executive Account Manager Intervention",
            }

            promises.append({
                "transaction_id":
                    transaction.transaction_id,

                "customer":
                    transaction.customer_name,

                "customer_name":
                    transaction.customer_name,

                "company_name":
                    transaction.company_name,

                "amount":
                    amount,

                "outstanding_amount":
                    outstanding_amount,

                "promise_date":
                    promise_date,

                "promise_status":
                    "Overdue" if is_overdue else "Active",

                "channel":
                    transaction.preferred_outreach_channel or "Not specified",

                "note":
                    transaction.promise_note or "",

                "chaser_count":
                    chaser_count,

                "chaser_stage":
                    transaction.chaser_stage or 0,

                "escalation_level":
                    escalation_level,

                "escalation_label":
                    escalation_labels[escalation_level],

                "follow_up_required":
                    follow_up_required,

                "last_action":
                    transaction.last_action or "Promise-to-Pay recorded",
            })

    if changed:
        db.commit()

    return {
        "total_unpaid_accounts":
            len(unpaid),

        "total_outstanding":
            round(
                total_outstanding,
                2
            ),

        "active_promises":
            promise_count,

        "active_promised_amount":
            round(
                active_promised_amount,
                2
            ),

        "overdue_promises":
            overdue_promises,

        "follow_ups_pending":
            follow_ups_pending,

        "receivables":
            unpaid,

        "promises":
            promises,

        "aging_counts":
            aging_counts,
    }


# =========================================================
# B2B AGING FILTER
# =========================================================

@app.get(
    "/api/receivables/aging"
)
def receivables_aging(
    bucket: str = None,
    db: Session = Depends(get_db)
):
    """
    Return B2B receivables for a selected aging bucket.

    Supported buckets:
    Current
    1–30 Days Overdue
    31–60 Days Overdue
    61–90 Days Overdue
    90+ Days (High Risk)
    """

    dashboard = receivables_dashboard(
        db
    )

    receivables = dashboard["receivables"]

    if not bucket:
        return {
            "bucket": "All",
            "count": len(receivables),
            "receivables": receivables,
        }

    normalized = bucket.strip().lower()

    filtered = [
        item
        for item in receivables
        if str(
            item.get("aging_bucket", "")
        ).strip().lower() == normalized
    ]

    return {
        "bucket": bucket,
        "count": len(filtered),
        "receivables": filtered,
    }


# =========================================================
# OUTREACH SIMULATION
# =========================================================

@app.post(
    "/api/transactions/{transaction_id}/outreach"
)
def send_outreach(
    transaction_id: str,
    data: dict,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    channel = clean_string(
        data.get(
            "channel"
        ),
        "SMS"
    )

    language = clean_string(
        data.get(
            "language"
        ),
        "English"
    )

    message = clean_string(
        data.get(
            "message"
        )
    )

    if not message:

        message = (

            f"Hi {transaction.customer_name}, "

            f"your payment of "
            f"₹{transaction.amount} "

            f"could not be completed. "

            f"Please retry using the secure payment option."

        )

    old_channel = (
        transaction.preferred_outreach_channel
    )

    transaction.preferred_outreach_channel = (
        channel
    )

    transaction.last_action = (
        f"Outreach simulated via {channel}"
    )

    db.commit()

    try:

        create_audit_log(

            db=db,

            transaction_id=
                transaction.transaction_id,

            action=
                f"Outreach via {channel}",

            actor=
                "System",

            old_value=
                old_channel,

            new_value=
                channel,

            details=
                (
                    f"Language: {language}; "
                    "Demo outreach generated."
                ),

            source=
                "Outreach"

        )

    except Exception as e:

        print(
            "Outreach audit error:",
            repr(e)
        )

    return {

        "status":
            "simulated",

        "channel":
            channel,

        "language":
            language,

        "customer":
            transaction.customer_name,

        "destination":
            transaction.customer_email,

        "message":
            message,

        "note":
            "Outreach simulated successfully for demo."

    }


# =========================================================
# ANALYTICS
# =========================================================

@app.get(
    "/api/analytics"
)
def analytics(
    db: Session = Depends(get_db)
):

    transactions = (
        db.query(Transaction)
        .all()
    )

    total_transactions = len(
        transactions
    )

    failed_transactions = [

        t

        for t in transactions

        if str(
            t.status
            or ""
        ).lower()

        in [
            "failed",
            "failure"
        ]

    ]

    recovered_transactions = [

        t

        for t in transactions

        if str(
            t.recovery_status
            or ""
        ).lower()

        == "recovered"

    ]

    revenue_at_risk = sum(

        float(
            t.amount
            or
            0
        )

        for t in failed_transactions

    )

    recovered_revenue = sum(

        float(
            t.recovered_amount
            or
            0
        )

        for t in recovered_transactions

    )

    recovery_rate = 0

    if revenue_at_risk > 0:

        recovery_rate = (

            recovered_revenue
            /
            revenue_at_risk

        ) * 100

    success_transactions = [

        t

        for t in transactions

        if str(
            t.status
            or ""
        ).lower()

        in [
            "success",
            "successful",
            "paid"
        ]

    ]

    total_revenue = sum(

        float(
            t.amount
            or
            0
        )

        for t in transactions

    )

    return {

        "total_transactions":
            total_transactions,

        "successful_transactions":
            len(
                success_transactions
            ),

        "failed_transactions":
            len(
                failed_transactions
            ),

        "recovered_transactions":
            len(
                recovered_transactions
            ),

        "total_revenue":
            round(
                total_revenue,
                2
            ),

        "revenue_at_risk":
            round(
                revenue_at_risk,
                2
            ),

        "recovered_revenue":
            round(
                recovered_revenue,
                2
            ),

        "recovery_rate":
            round(
                recovery_rate,
                2
            )

    }


# =========================================================
# ROOT CAUSE ANALYTICS
# =========================================================

@app.get(
    "/api/analytics/root-causes"
)
def root_cause_analytics(
    db: Session = Depends(get_db)
):

    transactions = (
        db.query(Transaction)
        .all()
    )

    result = {}

    for transaction in transactions:

        root_cause = (

            transaction.root_cause
            or
            "unknown_failure"

        )

        if root_cause not in result:

            result[root_cause] = {

                "count":
                    0,

                "amount":
                    0

            }

        result[root_cause][
            "count"
        ] += 1

        result[root_cause][
            "amount"
        ] += float(
            transaction.amount
            or
            0
        )

    # Round amounts

    for key in result:

        result[key]["amount"] = round(
            result[key]["amount"],
            2
        )

    return result


# =========================================================
# RECOVERY OUTCOME ANALYTICS
# =========================================================

@app.get(
    "/api/analytics/recovery-outcomes"
)
def recovery_outcomes(
    db: Session = Depends(get_db)
):

    transactions = (
        db.query(Transaction)
        .all()
    )

    outcomes = {}

    for transaction in transactions:

        outcome = (

            transaction.recovery_status
            or
            "Not Started"

        )

        if outcome not in outcomes:

            outcomes[outcome] = {

                "count":
                    0,

                "amount":
                    0

            }

        outcomes[outcome][
            "count"
        ] += 1

        outcomes[outcome][
            "amount"
        ] += float(
            transaction.amount
            or
            0
        )

    for key in outcomes:

        outcomes[key]["amount"] = round(
            outcomes[key]["amount"],
            2
        )

    return outcomes


# =========================================================
# ALL AUDIT LOGS
# =========================================================

@app.get("/api/audit-logs")
def get_all_audit_logs(
    db: Session = Depends(get_db)
):
    """
    Return all audit logs in reverse chronological order.
    Used by the React Audit UI.
    """

    try:

        audit_logs = (
            db.query(AuditLog)
            .order_by(
                AuditLog.created_at.desc()
            )
            .all()
        )

        logs = []

        for log in audit_logs:

            logs.append({

                "id":
                    log.id,

                "transaction_id":
                    log.transaction_id,

                "timestamp":
                    log.created_at,

                "event":
                    log.action,

                "actor":
                    log.actor,

                "old_value":
                    log.old_value,

                "new_value":
                    log.new_value,

                "description":
                    log.details,

                "source":
                    log.source

            })

        return {

            "total":
                len(logs),

            "logs":
                logs

        }

    except Exception as e:

        print(
            "Audit log retrieval error:",
            repr(e)
        )

        raise HTTPException(

            status_code=500,

            detail=(
                "Failed to fetch audit logs."
            )

        )


# =========================================================
# TRANSACTION AUDIT TRAIL
# =========================================================

@app.get(
    "/api/transactions/{transaction_id}/audit"
)
def transaction_audit(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """
    Return the complete audit timeline
    for a specific transaction.
    """

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(

            status_code=404,

            detail="Transaction not found"

        )

    try:

        audit_logs = (

            db.query(AuditLog)

            .filter(
                AuditLog.transaction_id
                == transaction_id
            )

            .order_by(
                AuditLog.created_at.asc()
            )

            .all()

        )

        timeline = []

        for log in audit_logs:

            timeline.append({

                "id":
                    log.id,

                "transaction_id":
                    log.transaction_id,

                "timestamp":
                    log.created_at,

                "event":
                    log.action,

                "actor":
                    log.actor,

                "old_value":
                    log.old_value,

                "new_value":
                    log.new_value,

                "description":
                    log.details,

                "source":
                    log.source

            })

        return {

            "transaction_id":
                transaction_id,

            "total_events":
                len(timeline),

            "timeline":
                timeline

        }

    except Exception as e:

        print(
            "Transaction audit retrieval error:",
            repr(e)
        )

        raise HTTPException(

            status_code=500,

            detail=(
                "Audit logs could not be loaded."
            )

        )




# =========================================================
# AUDIT TEST
# =========================================================

@app.post(
    "/api/audit/test"
)
def test_audit(
    db: Session = Depends(get_db)
):

    audit = create_audit_log(

        db=db,

        transaction_id=
            "TXN100005",

        action=
            "Test Audit Event",

        actor=
            "System",

        old_value=
            "Pending",

        new_value=
            "In Progress",

        details=
            "Audit trail test completed successfully",

        source=
            "Audit Test"

    )

    return {

        "message":
            "Audit log created",

        "audit_id":
            audit.id

    }


# =========================================================
# AI RECOVERY RECOMMENDATION
# =========================================================

@app.get(
    "/api/transactions/{transaction_id}/recommendation"
)
def recovery_recommendation(
    transaction_id: str,
    db: Session = Depends(get_db)
):

    transaction = get_transaction(
        transaction_id,
        db
    )

    if not transaction:

        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    reason = (

        transaction.failure_reason
        or
        ""

    )

    diagnosis = (

        transaction.ai_diagnosis
        or
        ""

    )

    root_cause = (

        transaction.root_cause
        or
        ""

    )

    error_code = (

        transaction.error_code
        or
        ""

    )

    prompt = f"""
You are RecoverAI, a friendly payment recovery assistant.

Analyze this failed payment.

Transaction ID:
{transaction.transaction_id}

Customer:
{transaction.customer_name}

Amount:
₹{transaction.amount}

Transaction Type:
{transaction.transaction_type}

Gateway:
{transaction.gateway}

Status:
{transaction.status}

Gateway Error Code:
{error_code}

Failure Reason:
{reason}

Detected Root Cause:
{root_cause}

Existing Diagnosis:
{diagnosis}

IMPORTANT:

Give the customer a SHORT and HUMAN explanation.

Use this natural format:

Here's what happened:

<one or two simple sentences>

What you can do:
<ONE clear action>

For now:
<short practical next step>

Rules:

- Maximum 100 words.
- Use simple everyday English.
- Be reassuring.
- Do not blame the customer.
- Do not repeat transaction details unnecessarily.
- Do not give multiple competing actions.
- If the payment may have been debited, clearly tell the customer to check their bank statement before retrying.
- Never claim the payment is recovered unless the backend confirms it.
- Never ask for OTP, PIN, CVV, password or banking credentials.
"""

    recommendation = generate_ai_response(
        prompt
    )

    if recommendation:

        return {

            "transaction_id":
                transaction.transaction_id,

            "failure_reason":
                transaction.failure_reason,

            "root_cause":
                transaction.root_cause,

            "severity":
                transaction.severity,

            "recommendation":
                recommendation,

            "suggested_action":
                transaction.recommended_action
                or
                "Follow the recommended recovery step."

        }

    result = run_diagnosis(
        transaction
    )

    return {

        "transaction_id":
            transaction.transaction_id,

        "failure_reason":
            transaction.failure_reason,

        "root_cause":
            result["root_cause"],

        "severity":
            result["severity"],

        "recommendation":
            result["diagnosis"],

        "suggested_action":
            result["recommended_action"]

    }


# =========================================================
# MULTILINGUAL AI CHATBOT
# =========================================================

# =========================================================
# MULTILINGUAL AI CHATBOT / RECOVERY AGENT
# =========================================================

@app.post(
    "/api/chat"
)
def chatbot(
    data: dict,
    db: Session = Depends(get_db)
):

    message = clean_string(
        data.get("message")
    )

    language = clean_string(
        data.get("language"),
        "English"
    )

    transaction_id = data.get(
        "transaction_id"
    )

    if not message:

        raise HTTPException(
            status_code=400,
            detail="Message is required"
        )

    transaction = None

    transaction_info = (
        "No transaction was selected."
    )

    # -----------------------------------------------------
    # TRANSACTION CONTEXT
    # -----------------------------------------------------

    if transaction_id:

        transaction = get_transaction(
            transaction_id,
            db
        )

        if transaction:

            transaction_info = f"""
Transaction ID:
{transaction.transaction_id}

Customer:
{transaction.customer_name}

Amount:
₹{transaction.amount}

Transaction Type:
{transaction.transaction_type}

Gateway:
{transaction.gateway}

Payment Status:
{transaction.status}

Failure Reason:
{transaction.failure_reason}

Gateway Error Code:
{transaction.error_code}

Error Description:
{transaction.error_description}

Root Cause:
{transaction.root_cause}

Severity:
{transaction.severity}

AI Diagnosis:
{transaction.ai_diagnosis}

Recommended Action:
{transaction.recommended_action}

Recovery Status:
{transaction.recovery_status}

Promise-to-Pay:
{transaction.promise_to_pay}

Promise Date:
{transaction.promise_date}

Promise Status:
{transaction.promise_status}
"""

        else:

            transaction_info = (
                "No transaction was found "
                "for the provided transaction ID."
            )

    # -----------------------------------------------------
    # RECOVERAI CONVERSATIONAL AGENT PROMPT
    # -----------------------------------------------------

    prompt = f"""
You are RecoverAI, an intelligent multilingual
payment recovery and customer support agent.

You are having a real conversation with a customer.

Your goal is to understand the customer's situation,
respond naturally, and guide them toward the correct
next step.

=========================================================
SELECTED LANGUAGE
=========================================================

The selected language is:
{language}

Respond completely in {language}.

If the selected language is Hinglish, use natural
Indian Hinglish. Do not translate word-for-word.

Your response should sound like a real human customer
support agent, not a robotic chatbot.

=========================================================
CUSTOMER MESSAGE
=========================================================

{message}

=========================================================
TRANSACTION INFORMATION
=========================================================

{transaction_info}

=========================================================
PAYMENT STATUS RULES
=========================================================

These rules are extremely important.

1. NEVER invent transaction information.

2. NEVER claim that a transaction is recovered unless
   the backend confirms the recovery status.

3. "Paid" means the payment itself has been successfully
   completed.

4. "Recovered" refers to the recovery workflow/status.
   It does NOT automatically mean the customer needs
   to make another payment.

5. If Payment Status is "Paid":
   - Do NOT ask the customer to pay again.
   - Do NOT call the payment overdue.
   - Do NOT say the payment has failed.
   - Do NOT tell the customer to retry the payment.
   - Instead, acknowledge that the payment is successful.
   - Help with receipt confirmation, transaction details,
     refund questions, disputes, or other relevant issues.

6. If Payment Status is "Failed":
   - Explain that the payment was unsuccessful.
   - Identify the available failure information.
   - Give ONE practical next step.
   - If appropriate, suggest retrying or another payment
     method.

7. If Payment Status is "Pending":
   - Explain that the payment is still being processed.
   - Do not claim it succeeded or failed.
   - Recommend checking the transaction status or waiting
     for confirmation.

8. If Recovery Status is "Recovered":
   - Explain that the recovery workflow has been completed
     if relevant.
   - Do NOT interpret "Recovered" as requiring another
     payment.

9. If Payment Status is "Paid" and Recovery Status is
   "Recovered", treat the transaction as successfully paid
   and successfully handled by the recovery workflow.

10. If the transaction information is unavailable,
    clearly say that you cannot verify the transaction
    rather than inventing an answer.

=========================================================
REAL CONVERSATIONAL BEHAVIOUR
=========================================================

Behave like a real recovery agent.

Understand the meaning of the customer's message before
responding.

Examples:

Customer:
"I already paid."

If backend confirms Paid:
Acknowledge the successful payment and offer help with
confirmation or receipt.

Customer:
"My payment failed."

If backend shows Failed:
Explain the failure and suggest the next appropriate
action.

Customer:
"I'll pay on Friday."

Recognize this as a potential Promise-to-Pay.

Customer:
"I need another 7 days."

Recognize this as a possible payment extension request.

Customer:
"I cannot pay right now."

Respond empathetically and suggest an appropriate next
step without threatening or pressuring the customer.

Customer:
"Can you send me the payment link?"

Respond that a payment link can be provided if the
system supports it.

Customer:
"Why was my payment rejected?"

Use the transaction failure reason, gateway error,
diagnosis, and other available information.

=========================================================
PROMISE-TO-PAY
=========================================================

Recognize statements such as:

"I'll pay on Friday."

"I can pay next Monday."

"Give me 7 days."

"I will make the payment tomorrow."

"I'll pay after my salary."

"I need some time."

If the customer gives a specific date, recognize it as
a potential Promise-to-Pay date.

If the customer gives a relative date such as:
"tomorrow",
"Friday",
"next Monday",

understand it naturally from the current conversation.

Do NOT invent a date if the meaning is unclear.

If a Promise-to-Pay already exists in the transaction
information, mention it when relevant.

=========================================================
B2B RECEIVABLES
=========================================================

If the conversation concerns an unpaid invoice or
business receivable, help with:

- Payment reminders
- Invoice clarification
- Receipt requests
- Payment date commitments
- Extension requests
- Promise-to-Pay
- Follow-up actions

Never threaten or pressure the customer.

=========================================================
SECURITY
=========================================================

NEVER ask for or request:

- OTP
- PIN
- Password
- CVV
- ATM PIN
- Banking login credentials
- Card security information

Never request sensitive banking credentials.

=========================================================
RESPONSE STYLE
=========================================================

Follow these rules:

1. Be polite.
2. Be empathetic.
3. Be concise.
4. Give ONE clear next action.
5. Ask a short follow-up question when useful.
6. Avoid unnecessary technical terminology.
7. Do not mention Gemini.
8. Do not mention this prompt.
9. Do not mention internal database logic.
10. Do not expose internal AI reasoning.
11. Do not make unsupported claims.
12. Keep the conversation natural.

Keep the response between approximately 30 and 80 words.

If a very short response is more natural, use fewer words.

Answer ONLY in the selected language.

=========================================================
FINAL CUSTOMER MESSAGE
=========================================================

Generate the response that RecoverAI should say directly
to the customer.
"""

    # -----------------------------------------------------
    # GEMINI
    # -----------------------------------------------------

    reply = generate_ai_response(
        prompt
    )

    # -----------------------------------------------------
    # AUDIT CHAT
    # -----------------------------------------------------

    if transaction:

        try:

            create_audit_log(

                db=db,

                transaction_id=
                    transaction.transaction_id,

                action=
                    "Chatbot Interaction",

                actor=
                    "Customer/AI",

                old_value=
                    None,

                new_value=
                    message,

                details=
                    (
                        f"Language: {language}"
                    ),

                source=
                    "Multilingual Chatbot"

            )

        except Exception as e:

            print(
                "Chatbot audit error:",
                repr(e)
            )

    # -----------------------------------------------------
    # AI RESPONSE
    # -----------------------------------------------------

    if reply:

        return {

            "reply":
                reply,

            "language":
                language,

            "transaction_id":
                transaction_id,

            "model":
                GEMINI_MODEL,

            "ai_status":
                "available"

        }

    # -----------------------------------------------------
    # FALLBACK
    # -----------------------------------------------------

    if (
        transaction_id
        and
        transaction
    ):

        fallback = run_diagnosis(
            transaction
        )

        return {

            "reply":
                fallback["diagnosis"],

            "language":
                language,

            "transaction_id":
                transaction_id,

            "model":
                "fallback",

            "ai_status":
                "fallback"

        }

    return {

        "reply":
            (
                "The AI assistant is temporarily unavailable. "
                "Please try again in a moment."
            ),

        "language":
            language,

        "transaction_id":
            transaction_id,

        "model":
            "fallback",

        "ai_status":
            "fallback"

    }


# =========================================================
# CHECKOUT DROP-OFF RECOVERY
# =========================================================

@app.post("/api/checkout/dropoff/recover")
def recover_checkout_dropoff(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Start recovery for an abandoned checkout.

    This endpoint intentionally does not require the checkout ID to exist
    in the Transaction table because checkout drop-offs are a separate
    recovery flow from completed/failed payment transactions.

    The React CheckoutDropoffRecovery page sends checkout information here
    and expects a JSON response containing a success message.
    """

    checkout_id = clean_string(data.get("checkout_id"))
    customer_name = clean_string(data.get("customer_name"), "Customer")
    amount = parse_float(data.get("amount"), 0.0)
    product = clean_string(data.get("product"), "Product")

    if not checkout_id:
        raise HTTPException(
            status_code=400,
            detail="checkout_id is required"
        )

    if amount < 0:
        raise HTTPException(
            status_code=400,
            detail="amount cannot be negative"
        )

    # Optional transaction linkage. A checkout ID such as CHK10001 may not
    # exist in the transactions table, so absence must NOT be treated as an
    # error. The checkout recovery UI is allowed to operate independently.
    transaction = get_transaction(checkout_id, db)

    old_status = None

    if transaction:
        old_status = transaction.status

        transaction.recovery_status = "Recovered"
        transaction.status = "Paid"
        transaction.recovery_outcome = "Checkout recovery completed"
        transaction.recovered_amount = transaction.amount or amount
        transaction.last_action = "Checkout drop-off recovery started"
        transaction.retry_status = "Stopped"

        try:
            db.commit()
            db.refresh(transaction)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Database error during checkout recovery: {str(e)}"
            )

        try:
            create_audit_log(
                db=db,
                transaction_id=transaction.transaction_id,
                action="Checkout Recovery",
                actor="System",
                old_value=old_status,
                new_value="Paid",
                details="Checkout drop-off recovery completed.",
                source="Checkout Drop-off Recovery"
            )
        except Exception as e:
            print("Checkout recovery audit error:", repr(e))

    # For a standalone checkout (for example CHK10001), return a successful
    # recovery action without pretending that a real payment was captured.
    return {
        "success": True,
        "message": (
            f"Recovery action started successfully for {customer_name}. "
            f"A payment reminder/link can be sent for {product}."
        ),
        "checkout_id": checkout_id,
        "customer_name": customer_name,
        "amount": amount,
        "recovery_status": "Recovered" if transaction else "Recovery Started",
        "payment_recovered": bool(transaction),
        "next_action": "Send payment link and reminder to the customer.",
    }


# Backward-compatible alias for clients that may use a shorter route.
@app.post("/api/checkout/recover")
def recover_checkout_alias(
    data: dict,
    db: Session = Depends(get_db)
):
    return recover_checkout_dropoff(data=data, db=db)


# =========================================================
# PROMISE-TO-PAY DEMO DATA
# =========================================================

def seed_promise_to_pay_demo_data(db):
    """
    Create/update a small, presentation-ready B2B Promise-to-Pay dataset.

    These demo records are intentionally idempotent. Existing rows with these
    IDs are updated; other user/imported transactions are untouched.
    """

    demo_records = [
        {
            "transaction_id": "TXN100485",
            "customer_name": "Rahul Das",
            "customer_email": "rahul.das@example.com",
            "amount": 125000.0,
            "company_name": "Das Enterprises",
            "contact_person": "Rahul Das",
            "receivables_email": "rahul.das@example.com",
            "receivables_phone": "+91 9000000001",
            "invoice_number": "INV-2026-0485",
            "invoice_date": datetime(2026, 8, 20),
            "due_date": datetime(2026, 9, 10),
            "promise_date": datetime(2026, 9, 15),
            "promise_status": "Active",
            "channel": "Email",
            "note": "Customer confirmed payment after salary credit.",
            "last_action": "Promise-to-Pay recorded",
            "chaser_count": 0,
            "chaser_stage": 0,
        },
        {
            "transaction_id": "TXN100437",
            "customer_name": "Priya Mehta",
            "customer_email": "priya.mehta@example.com",
            "amount": 85000.0,
            "company_name": "Mehta Trading Co.",
            "contact_person": "Priya Mehta",
            "receivables_email": "priya.mehta@example.com",
            "receivables_phone": "+91 9000000002",
            "invoice_number": "INV-2026-0437",
            "invoice_date": datetime(2026, 7, 1),
            "due_date": datetime(2026, 7, 25),
            "promise_date": datetime(2026, 9, 1),
            "promise_status": "Overdue",
            "channel": "WhatsApp",
            "note": "Customer promised payment after the due-date reminder.",
            "last_action": "Chaser Triggered",
            "chaser_count": 1,
            "chaser_stage": 2,
        },
        {
            "transaction_id": "TXN100512",
            "customer_name": "Arjun Kapoor",
            "customer_email": "arjun.kapoor@example.com",
            "amount": 62000.0,
            "company_name": "Kapoor Industrial Supplies",
            "contact_person": "Arjun Kapoor",
            "receivables_email": "arjun.kapoor@example.com",
            "receivables_phone": "+91 9000000003",
            "invoice_number": "INV-2026-0512",
            "invoice_date": datetime(2026, 8, 1),
            "due_date": datetime(2026, 8, 20),
            "promise_date": datetime(2026, 9, 20),
            "promise_status": "Active",
            "channel": "Email",
            "note": "Customer committed to clear the outstanding invoice this month.",
            "last_action": "Promise-to-Pay recorded",
            "chaser_count": 0,
            "chaser_stage": 0,
        },
    ]

    changed = False

    for item in demo_records:
        transaction = get_transaction(
            item["transaction_id"],
            db
        )

        if transaction is None:
            transaction = Transaction(
                transaction_id=item["transaction_id"],
                customer_name=item["customer_name"],
                customer_email=item["customer_email"],
                amount=item["amount"],
                transaction_type="B2B Invoice",
                status="Pending",
                gateway="Razorpay",
                recovery_status="Promise to Pay",
                recovery_outcome=None,
                recovered_amount=0,
                retry_count=0,
                max_retries=3,
                retry_status="Eligible",
                promise_to_pay=True,
                promise_status=item["promise_status"],
                preferred_language="English",
                last_action=item["last_action"],
                created_at=datetime.utcnow(),
            )
            db.add(transaction)

        transaction.customer_name = item["customer_name"]
        transaction.customer_email = item["customer_email"]
        transaction.amount = item["amount"]

        transaction.status = "Pending"
        transaction.recovery_status = "Promise to Pay"
        transaction.recovered_amount = 0
        transaction.recovery_outcome = None

        transaction.promise_to_pay = True
        transaction.promise_date = item["promise_date"]
        transaction.promise_status = item["promise_status"]
        transaction.promise_note = item["note"]
        transaction.promise_recorded_at = datetime.utcnow()
        transaction.promise_followup_at = (
            datetime.utcnow()
            if item["promise_status"].lower() == "overdue"
            else item["promise_date"]
        )
        transaction.promise_followup_count = item["chaser_count"]

        transaction.is_b2b = True
        transaction.company_name = item["company_name"]
        transaction.contact_person = item["contact_person"]
        transaction.receivables_email = item["receivables_email"]
        transaction.receivables_phone = item["receivables_phone"]
        transaction.invoice_number = item["invoice_number"]
        transaction.invoice_date = item["invoice_date"]
        transaction.due_date = item["due_date"]
        transaction.outstanding_amount = item["amount"]

        transaction.receivables_status = (
            "Escalated" if item["chaser_stage"] >= 3 else "Active"
        )
        transaction.chaser_stage = item["chaser_stage"]
        transaction.preferred_outreach_channel = item["channel"]
        transaction.chaser_count = item["chaser_count"]
        transaction.last_action = item["last_action"]
        transaction.auto_followup_enabled = True
        transaction.outreach_paused = False

        changed = True

    if changed:
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

    print("B2B Promise-to-Pay demo data ready: 3 records")


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup_event():

    # Populate a small, idempotent demo set so the Promise-to-Pay
    # tracker is presentation-ready immediately after backend startup.
    db = SessionLocal()
    try:
        seed_promise_to_pay_demo_data(db)
    except Exception as e:
        print("Promise-to-Pay demo seed error:", repr(e))
    finally:
        db.close()

    print("=" * 60)

    print(
        "RecoverAI Backend Started"
    )

    print(
        "Version:",
        "3.2"
    )

    print(
        "AI:",
        "Gemini"
        if client
        else "Unavailable"
    )

    print(
        "Primary model:",
        GEMINI_MODEL
    )

    print(
        "Fallback model:",
        "gemini-3.6-flash"
    )

    print(
        "Features:"
    )

    print(
        "- Payment Recovery"
    )

    print(
        "- AI Root Cause Diagnosis"
    )

    print(
        "- Smart Retry"
    )

    print(
        "- Human-Friendly AI Recommendations"
    )

    print(
        "- Multilingual Chatbot"
    )

    print(
        "- B2B Receivables Chaser"
    )

    print(
        "- Promise-to-Pay Tracker"
    )

    print(
        "- Receivables Dashboard"
    )

    print(
        "- Recovery Analytics"
    )

    print(
        "- Transaction Audit Trail"
    )

    print(
        "- Global Audit Log"
    )

    print("=" * 60)