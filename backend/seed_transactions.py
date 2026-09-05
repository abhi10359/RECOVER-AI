from datetime import datetime, timedelta
import random

from database import SessionLocal
from models import Transaction


# =========================================================
# SETTINGS
# =========================================================

TOTAL_TRANSACTIONS = 500

random.seed(42)


# =========================================================
# CUSTOMER DATA
# =========================================================

customers = [
    ("Aarav Sharma", "aarav.sharma"),
    ("Rohan Kumar", "rohan.kumar"),
    ("Priya Singh", "priya.singh"),
    ("Ananya Patel", "ananya.patel"),
    ("Arjun Mehta", "arjun.mehta"),
    ("Sneha Verma", "sneha.verma"),
    ("Rahul Gupta", "rahul.gupta"),
    ("Kavya Iyer", "kavya.iyer"),
    ("Aditya Rao", "aditya.rao"),
    ("Neha Sharma", "neha.sharma"),
    ("Vikram Singh", "vikram.singh"),
    ("Pooja Nair", "pooja.nair"),
    ("Karan Malhotra", "karan.malhotra"),
    ("Simran Kaur", "simran.kaur"),
    ("Aisha Khan", "aisha.khan"),
    ("Manish Yadav", "manish.yadav"),
    ("Divya Reddy", "divya.reddy"),
    ("Nikhil Jain", "nikhil.jain"),
    ("Ishita Das", "ishita.das"),
    ("Siddharth Roy", "siddharth.roy"),
    ("Varun Kapoor", "varun.kapoor"),
    ("Meera Krishnan", "meera.krishnan"),
    ("Yash Agarwal", "yash.agarwal"),
    ("Tanvi Shah", "tanvi.shah"),
    ("Harsh Bansal", "harsh.bansal"),
    ("Riya Choudhary", "riya.choudhary"),
    ("Dev Mishra", "dev.mishra"),
    ("Muskan Joshi", "muskan.joshi"),
    ("Akash Sinha", "akash.sinha"),
    ("Nandini Rao", "nandini.rao"),
]


# =========================================================
# TRANSACTION TYPES
# =========================================================

transaction_types = [
    "UPI",
    "Credit Card",
    "Debit Card",
    "Net Banking",
    "Wallet",
]


# =========================================================
# FAILURE REASONS
# =========================================================

failure_reasons = [
    "Insufficient Balance",
    "Network Timeout",
    "Bank Server Down",
    "Transaction Declined",
    "Authentication Failed",
    "Daily Limit Exceeded",
    "Invalid UPI PIN",
    "Payment Gateway Error",
    "Account Blocked",
    "Server Timeout",
]


# =========================================================
# FAILURE PROBABILITY BY TRANSACTION TYPE
#
# This makes the data more realistic.
# =========================================================

failure_probability = {
    "UPI": 0.16,
    "Credit Card": 0.13,
    "Debit Card": 0.15,
    "Net Banking": 0.18,
    "Wallet": 0.11,
}


# =========================================================
# REALISTIC FAILURE REASONS BY TYPE
# =========================================================

failure_patterns = {

    "UPI": [
        "Invalid UPI PIN",
        "Insufficient Balance",
        "Network Timeout",
        "Bank Server Down",
        "Daily Limit Exceeded",
    ],

    "Credit Card": [
        "Transaction Declined",
        "Authentication Failed",
        "Daily Limit Exceeded",
        "Payment Gateway Error",
        "Insufficient Balance",
    ],

    "Debit Card": [
        "Insufficient Balance",
        "Transaction Declined",
        "Bank Server Down",
        "Daily Limit Exceeded",
        "Authentication Failed",
    ],

    "Net Banking": [
        "Bank Server Down",
        "Server Timeout",
        "Authentication Failed",
        "Network Timeout",
        "Transaction Declined",
    ],

    "Wallet": [
        "Insufficient Balance",
        "Payment Gateway Error",
        "Network Timeout",
        "Account Blocked",
    ],
}


# =========================================================
# RECOVERY LOGIC
# =========================================================

def get_recovery_status(failure_reason):

    # Technical problems are highly recoverable
    if failure_reason in [
        "Network Timeout",
        "Server Timeout",
        "Bank Server Down",
        "Payment Gateway Error",
    ]:

        chance = random.random()

        if chance < 0.65:
            return "Recovered"

        elif chance < 0.90:
            return "Processing"

        else:
            return "Not Started"

    # Balance-related failures
    if failure_reason == "Insufficient Balance":

        chance = random.random()

        if chance < 0.30:
            return "Recovered"

        elif chance < 0.55:
            return "Processing"

        else:
            return "Not Started"

    # Authentication problems
    if failure_reason in [
        "Invalid UPI PIN",
        "Authentication Failed",
    ]:

        chance = random.random()

        if chance < 0.45:
            return "Recovered"

        elif chance < 0.70:
            return "Processing"

        else:
            return "Not Started"

    # Limits
    if failure_reason == "Daily Limit Exceeded":

        chance = random.random()

        if chance < 0.20:
            return "Recovered"

        elif chance < 0.40:
            return "Processing"

        else:
            return "Not Started"

    # Account blocked
    if failure_reason == "Account Blocked":

        chance = random.random()

        if chance < 0.10:
            return "Recovered"

        elif chance < 0.30:
            return "Processing"

        else:
            return "Not Started"

    # Transaction declined
    if failure_reason == "Transaction Declined":

        chance = random.random()

        if chance < 0.35:
            return "Recovered"

        elif chance < 0.65:
            return "Processing"

        else:
            return "Not Started"

    return "Not Started"


# =========================================================
# CREATE DATABASE SESSION
# =========================================================

db = SessionLocal()


try:

    # -----------------------------------------------------
    # CHECK EXISTING DATA
    # -----------------------------------------------------

    existing_count = db.query(Transaction).count()

    print()
    print("==========================================")
    print("        RECOVERAI DATA GENERATOR")
    print("==========================================")
    print()

    print(
        f"Existing transactions in database: "
        f"{existing_count}"
    )

    print(
        f"Generating {TOTAL_TRANSACTIONS} new transactions..."
    )

    print()


    # -----------------------------------------------------
    # GENERATE TRANSACTIONS
    # -----------------------------------------------------

    transactions = []


    for i in range(1, TOTAL_TRANSACTIONS + 1):

        # -------------------------------------------------
        # CUSTOMER
        # -------------------------------------------------

        customer_name, email_name = random.choice(
            customers
        )

        customer_email = (
            f"{email_name}"
            f"{random.randint(1, 999)}"
            "@gmail.com"
        )


        # -------------------------------------------------
        # TRANSACTION ID
        # -------------------------------------------------

        transaction_id = (
            f"TXN"
            f"{existing_count + i:06d}"
        )


        # -------------------------------------------------
        # TRANSACTION TYPE
        # -------------------------------------------------

        transaction_type = random.choice(
            transaction_types
        )


        # -------------------------------------------------
        # AMOUNT
        #
        # Different probability ranges make the
        # dataset look more realistic.
        # -------------------------------------------------

        amount_probability = random.random()

        if amount_probability < 0.50:

            amount = random.uniform(
                100,
                5000
            )

        elif amount_probability < 0.85:

            amount = random.uniform(
                5000,
                25000
            )

        elif amount_probability < 0.97:

            amount = random.uniform(
                25000,
                75000
            )

        else:

            amount = random.uniform(
                75000,
                250000
            )


        amount = round(amount, 2)


        # -------------------------------------------------
        # STATUS
        # -------------------------------------------------

        failure_chance = failure_probability[
            transaction_type
        ]


        if random.random() > failure_chance:

            # SUCCESSFUL TRANSACTION

            status = "Success"

            failure_reason = None

            recovery_status = "Recovered"


        else:

            # FAILED TRANSACTION

            status = "Failed"

            failure_reason = random.choice(
                failure_patterns[
                    transaction_type
                ]
            )

            recovery_status = get_recovery_status(
                failure_reason
            )


        # -------------------------------------------------
        # OCCASIONAL PENDING TRANSACTIONS
        # -------------------------------------------------

        if status == "Success":

            if random.random() < 0.05:

                status = "Pending"

                failure_reason = None

                recovery_status = "Not Started"


        # -------------------------------------------------
        # CREATED DATE
        #
        # Data spread across the last 180 days.
        # -------------------------------------------------

        days_ago = random.randint(
            0,
            180
        )

        hours_ago = random.randint(
            0,
            23
        )

        minutes_ago = random.randint(
            0,
            59
        )

        seconds_ago = random.randint(
            0,
            59
        )


        created_at = (
            datetime.now()
            - timedelta(
                days=days_ago,
                hours=hours_ago,
                minutes=minutes_ago,
                seconds=seconds_ago,
            )
        )


        # -------------------------------------------------
        # CREATE TRANSACTION OBJECT
        # -------------------------------------------------

        transaction = Transaction(

            transaction_id=transaction_id,

            customer_name=customer_name,

            customer_email=customer_email,

            amount=amount,

            transaction_type=transaction_type,

            status=status,

            failure_reason=failure_reason,

            created_at=created_at,

            recovery_status=recovery_status,
        )


        transactions.append(transaction)


    # -----------------------------------------------------
    # INSERT ALL RECORDS
    # -----------------------------------------------------

    db.add_all(transactions)

    db.commit()


    # -----------------------------------------------------
    # STATISTICS
    # -----------------------------------------------------

    total = len(transactions)

    successful = sum(
        1
        for t in transactions
        if t.status == "Success"
    )

    failed = sum(
        1
        for t in transactions
        if t.status == "Failed"
    )

    pending = sum(
        1
        for t in transactions
        if t.status == "Pending"
    )

    recovered = sum(
        1
        for t in transactions
        if t.recovery_status == "Recovered"
    )

    processing = sum(
        1
        for t in transactions
        if t.recovery_status == "Processing"
    )

    not_started = sum(
        1
        for t in transactions
        if t.recovery_status == "Not Started"
    )


    # -----------------------------------------------------
    # DISPLAY RESULTS
    # -----------------------------------------------------

    print()
    print("==========================================")
    print("       DATA GENERATION COMPLETED")
    print("==========================================")

    print()

    print(
        f"New Transactions Added : {total}"
    )

    print(
        f"Successful Transactions: {successful}"
    )

    print(
        f"Failed Transactions    : {failed}"
    )

    print(
        f"Pending Transactions   : {pending}"
    )

    print()

    print(
        f"Recovered              : {recovered}"
    )

    print(
        f"Processing             : {processing}"
    )

    print(
        f"Not Started            : {not_started}"
    )

    print()

    final_count = db.query(
        Transaction
    ).count()

    print(
        f"Total Database Records : {final_count}"
    )

    print()

    print("==========================================")


except Exception as e:

    db.rollback()

    print()
    print("ERROR:")
    print(e)
    print()


finally:

    db.close()