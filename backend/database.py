import os

from sqlalchemy import (
    create_engine,
    inspect,
    text
)

from sqlalchemy.orm import (
    declarative_base,
    sessionmaker
)


# =========================================================
# DATABASE URL
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATABASE_URL = (
    "sqlite:///"
    + os.path.join(
        BASE_DIR,
        "recoverai.db"
    )
)


# =========================================================
# ENGINE
# =========================================================

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    }
)


# =========================================================
# SESSION
# =========================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# =========================================================
# BASE
# =========================================================

Base = declarative_base()


# =========================================================
# DATABASE MIGRATION
# =========================================================

def migrate_database():

    inspector = inspect(engine)

    tables = inspector.get_table_names()


    # =====================================================
    # TRANSACTIONS TABLE
    # =====================================================

    if "transactions" not in tables:

        print(
            "Transactions table does not exist yet."
        )

        return


    # =====================================================
    # GET EXISTING TRANSACTION COLUMNS
    # =====================================================

    existing_columns = {
        column["name"]
        for column in inspector.get_columns(
            "transactions"
        )
    }


    # =====================================================
    # TRANSACTION COLUMNS
    # =====================================================

    required_transaction_columns = {

        # =================================================
        # BASIC RECOVERY
        # =================================================

        "recovery_outcome":
            "TEXT",

        "recovered_amount":
            "FLOAT",


        # =================================================
        # SMART RETRY
        # =================================================

        "retry_count":
            "INTEGER DEFAULT 0",

        "max_retries":
            "INTEGER DEFAULT 3",

        "last_retry_at":
            "DATETIME",

        "next_retry_at":
            "DATETIME",

        "retry_status":
            "TEXT DEFAULT 'Eligible'",


        # =================================================
        # PROMISE TO PAY
        # =================================================

        "promise_to_pay":
            "BOOLEAN DEFAULT 0",

        "promise_date":
            "DATETIME",

        "promise_status":
            "TEXT DEFAULT 'None'",

        "promise_note":
            "TEXT",

        "promise_recorded_at":
            "DATETIME",

        "promise_followup_at":
            "DATETIME",

        "promise_followup_count":
            "INTEGER DEFAULT 0",


        # =================================================
        # B2B RECEIVABLES
        # =================================================

        "is_b2b":
            "BOOLEAN DEFAULT 0",

        "company_name":
            "TEXT",

        "contact_person":
            "TEXT",

        "receivables_email":
            "TEXT",

        "receivables_phone":
            "TEXT",

        "invoice_number":
            "TEXT",

        "invoice_date":
            "DATETIME",

        "due_date":
            "DATETIME",

        "outstanding_amount":
            "FLOAT",

        "receivables_status":
            "TEXT DEFAULT 'Pending'",


        # =================================================
        # RECEIVABLES CHASER
        # =================================================

        "chaser_stage":
            "TEXT DEFAULT 'Initial Reminder'",

        "preferred_outreach_channel":
            "TEXT DEFAULT 'Email'",

        "last_chaser_at":
            "DATETIME",

        "next_chaser_at":
            "DATETIME",

        "chaser_count":
            "INTEGER DEFAULT 0",


        # =================================================
        # CUSTOMER RESPONSE
        # =================================================

        "last_customer_response":
            "TEXT",

        "customer_response_type":
            "TEXT",

        "extension_days":
            "INTEGER DEFAULT 0",


        # =================================================
        # OUTREACH CONTROL
        # =================================================

        "outreach_paused":
            "BOOLEAN DEFAULT 0",

        "auto_followup_enabled":
            "BOOLEAN DEFAULT 1",

        "pause_reason":
            "TEXT",


        # =================================================
        # LANGUAGE
        # =================================================

        "preferred_language":
            "TEXT DEFAULT 'English'",


        # =================================================
        # AUDIT / LAST ACTION
        # =================================================

        "last_action":
            "TEXT",

        "created_at":
            "DATETIME"
    }


    # =====================================================
    # ADD MISSING TRANSACTION COLUMNS
    # =====================================================

    with engine.begin() as connection:

        for column_name, column_type in (
            required_transaction_columns.items()
        ):

            if column_name not in existing_columns:

                sql = (
                    f"ALTER TABLE transactions "
                    f"ADD COLUMN {column_name} "
                    f"{column_type}"
                )

                try:

                    connection.execute(
                        text(sql)
                    )

                    print(
                        f"Added transaction column: "
                        f"{column_name}"
                    )

                except Exception as e:

                    print(
                        f"Could not add transaction "
                        f"column {column_name}: {e}"
                    )


    # =====================================================
    # AUDIT LOG TABLE
    # =====================================================

    inspector = inspect(engine)

    tables = inspector.get_table_names()


    # =====================================================
    # CHECK WHETHER AUDIT LOGS EXISTS
    # =====================================================

    if "audit_logs" not in tables:

        print(
            "audit_logs table does not exist yet."
        )

        # AuditLog model will create the table
        # when Base.metadata.create_all()
        # is called.

    else:

        # =================================================
        # GET EXISTING AUDIT LOG COLUMNS
        # =================================================

        existing_audit_columns = {
            column["name"]
            for column in inspector.get_columns(
                "audit_logs"
            )
        }


        # =================================================
        # REQUIRED AUDIT COLUMNS
        # =================================================

        required_audit_columns = {

            # ---------------------------------------------
            # BASIC AUDIT INFORMATION
            # ---------------------------------------------

            "transaction_id":
                "TEXT",

            "action":
                "TEXT",

            "description":
                "TEXT",


            # ---------------------------------------------
            # TIMESTAMP
            # ---------------------------------------------

            "created_at":
                "DATETIME",


            # ---------------------------------------------
            # ACTION CLASSIFICATION
            # ---------------------------------------------

            "action_type":
                "TEXT DEFAULT 'Triggered'",


            # ---------------------------------------------
            # ACTOR INFORMATION
            # ---------------------------------------------

            "actor":
                "TEXT DEFAULT 'System'",

            "actor_type":
                "TEXT DEFAULT 'SYSTEM'",

            "actor_name":
                "TEXT DEFAULT 'System'",


            # ---------------------------------------------
            # SOURCE SYSTEM
            # ---------------------------------------------

            "source_system":
                "TEXT DEFAULT 'RecoverAI'",


            # ---------------------------------------------
            # SEVERITY
            # ---------------------------------------------

            "severity":
                "TEXT DEFAULT 'INFO'",


            # ---------------------------------------------
            # STATE BEFORE ACTION
            # ---------------------------------------------

            "before_state":
                "TEXT",


            # ---------------------------------------------
            # STATE AFTER ACTION
            # ---------------------------------------------

            "after_state":
                "TEXT",


            # ---------------------------------------------
            # EVENT GROUP
            # ---------------------------------------------

            "event_group_id":
                "TEXT",


            # ---------------------------------------------
            # AI INFORMATION
            # ---------------------------------------------

            "ai_driven":
                "BOOLEAN DEFAULT 0",

            "ai_confidence":
                "FLOAT",

            "ai_reason":
                "TEXT",


            # ---------------------------------------------
            # ADDITIONAL METADATA
            # ---------------------------------------------

            "metadata":
                "TEXT",


            # =================================================
            # HINGLISH / MULTILINGUAL VOICE RECOVERY
            # =================================================

            # Language used/detected during the call
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
            "language_detected":
                "TEXT",

            # Call duration in seconds
            "call_duration":
                "INTEGER",

            # Optional call recording URL
            "recording_url":
                "TEXT",

            # Voice conversation transcript
            "transcript":
                "TEXT",


            # =================================================
            # PROMISE-TO-PAY INFORMATION
            # =================================================

            # Extracted Promise-to-Pay date
            "promise_date":
                "TEXT",

            # Confidence specifically for
            # Promise-to-Pay extraction
            "confidence_score":
                "FLOAT",

            # AI explanation of the decision
            "ai_reasoning":
                "TEXT",


            # =================================================
            # CUSTOMER INTELLIGENCE
            # =================================================

            # Example:
            # PROMISE_TO_PAY
            # PAYMENT_ISSUE
            # DISPUTE
            # REFUSAL
            # ALREADY_PAID
            "customer_intent":
                "TEXT",

            # Example:
            # Positive
            # Neutral
            # Negative
            "customer_sentiment":
                "TEXT"
        }


        # =================================================
        # ADD MISSING AUDIT COLUMNS
        # =================================================

        with engine.begin() as connection:

            for column_name, column_type in (
                required_audit_columns.items()
            ):

                if column_name not in existing_audit_columns:

                    sql = (
                        f"ALTER TABLE audit_logs "
                        f"ADD COLUMN {column_name} "
                        f"{column_type}"
                    )

                    try:

                        connection.execute(
                            text(sql)
                        )

                        print(
                            f"Added audit column: "
                            f"{column_name}"
                        )

                    except Exception as e:

                        print(
                            f"Could not add audit "
                            f"column {column_name}: {e}"
                        )


    # =====================================================
    # CREATE INDEXES FOR AUDIT INVESTIGATION
    # =====================================================

    with engine.begin() as connection:

        audit_indexes = [

            (
                "idx_audit_transaction_id",
                "transaction_id"
            ),

            (
                "idx_audit_action_type",
                "action_type"
            ),

            (
                "idx_audit_actor_type",
                "actor_type"
            ),

            (
                "idx_audit_source_system",
                "source_system"
            ),

            (
                "idx_audit_severity",
                "severity"
            ),

            (
                "idx_audit_created_at",
                "created_at"
            ),

            (
                "idx_audit_event_group",
                "event_group_id"
            ),

            (
                "idx_audit_ai_driven",
                "ai_driven"
            ),

            (
                "idx_audit_language",
                "language_detected"
            ),

            (
                "idx_audit_customer_intent",
                "customer_intent"
            ),

            (
                "idx_audit_promise_date",
                "promise_date"
            )
        ]


        for index_name, column_name in audit_indexes:

            try:

                connection.execute(
                    text(
                        f"""
                        CREATE INDEX IF NOT EXISTS
                        {index_name}
                        ON audit_logs ({column_name})
                        """
                    )
                )

            except Exception as e:

                print(
                    f"Could not create index "
                    f"{index_name}: {e}"
                )


    # =====================================================
    # FINAL MESSAGE
    # =====================================================

    print(
        "RecoverAI database migration completed."
    )