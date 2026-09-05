import os

from dotenv import load_dotenv
from google import genai


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


# =========================================================
# GEMINI CLIENT
# =========================================================

client = None

if GEMINI_API_KEY:
    client = genai.Client(
        api_key=GEMINI_API_KEY
    )


GEMINI_MODEL = "gemini-3.6-flash"


# =========================================================
# CHATBOT FUNCTION
# =========================================================

def get_chat_response(
    message,
    language="English",
    transaction_info=""
):

    prompt = f"""
You are RecoverAI, an intelligent financial
transaction recovery assistant.

The user selected this language:

{language}

IMPORTANT:
Respond completely in {language}.

User message:
{message}

Transaction information:
{transaction_info}

Your responsibilities:

- Explain payment failures clearly.
- Explain transaction status.
- Explain the root cause when available.
- Suggest safe recovery actions.
- Tell the user what to do next.
- Be polite and reassuring.
- Keep the response concise and easy to understand.

SECURITY RULES:

Never ask for:

- OTP
- PIN
- Password
- CVV
- ATM PIN
- Banking login credentials
- Card security information

Never claim that a transaction has been
recovered unless the backend confirms it.

If the question is unrelated to payments,
politely explain that RecoverAI primarily
helps with payment transaction recovery.

Answer ONLY in the selected language.
"""

    # =====================================================
    # GEMINI
    # =====================================================

    if client:

        try:

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt
            )

            return response.text

        except Exception as e:

            print(
                "Gemini chatbot error:",
                repr(e)
            )

    # =====================================================
    # FALLBACK
    # =====================================================

    return (
        "Sorry, the AI service is temporarily "
        "unavailable. Please try again."
    )