# RECOVER-AI
# 🚀 RECOVER-AI

### AI-Powered Revenue Recovery & Transaction Intelligence Platform

RECOVER-AI is an intelligent revenue recovery platform designed to help businesses identify failed transactions, recover lost revenue, track receivables, and improve payment success rates using AI-powered insights.

The platform combines a **FastAPI backend**, **React frontend**, database management, AI assistance, audit tracking, and analytics dashboards to provide a complete recovery management solution.

---

## ✨ Features

### 🤖 AI Recovery Assistant

* AI-powered chatbot for revenue recovery assistance
* Provides intelligent suggestions for failed transactions
* Helps users analyze recovery opportunities

### 💳 Failed Transaction Recovery

* Identify failed payment transactions
* Track recovery status
* Manage failed subscription payments
* Improve transaction success rates

### 📊 Analytics Dashboard

* Revenue recovery overview
* Transaction performance insights
* Recovery statistics visualization
* Data-driven decision making

### 🧾 B2B Receivables Management

* Track outstanding receivables
* Manage payment commitments
* Monitor customer payment status

### 🔍 Audit & Activity Tracking

* Maintain transaction audit logs
* Monitor system activities
* Improve transparency and accountability

### 📅 Promise To Pay Tracker

* Track customer payment commitments
* Monitor pending payments
* Improve collection efficiency

### 📁 Data Management

* Transaction database management
* CSV upload support
* Export recovery reports

---

# 🏗️ Project Architecture

```
RECOVER-AI/
│
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── database.py             # Database configuration
│   ├── models.py               # Database models
│   ├── chatbot.py              # AI assistant logic
│   ├── audit_model.py          # Audit models
│   ├── receivables.py          # Receivable management
│   ├── diagonisis.py           # Transaction diagnosis
│   ├── seed_transactions.py    # Database seed data
│   │
│   └── services/
│       └── audit.py            # Audit service
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Application pages
│   │   ├── components/         # Reusable components
│   │   ├── services/           # API services
│   │   └── context/            # React contexts
│   │
│   └── package.json
│
└── README.md
```

---

# 🛠️ Tech Stack

## Frontend

* React.js
* Vite
* React Router
* Recharts
* Lucide Icons

## Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite Database

## AI Integration

* Google Gemini AI

## Development Tools

* Git
* GitHub
* VS Code

---

# ⚙️ Installation & Setup

## 1. Clone Repository

```bash
git clone https://github.com/abhi10359/RECOVER-AI.git

cd RECOVER-AI
```

---

# Backend Setup

Navigate to backend:

```bash
cd backend
```

Create virtual environment:

```bash
python -m venv venv
```

Activate environment:

### Windows

```bash
venv\Scripts\activate
```

### Linux/Mac

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create environment file:

```
.env
```

Add your AI API key:

```
GEMINI_API_KEY=your_api_key_here
```

Run backend server:

```bash
uvicorn main:app --reload
```

Backend will run at:

```
http://127.0.0.1:8000
```

---

# Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Frontend will run at:

```
http://localhost:5173
```

---

# 📸 Application Modules

## Dashboard

Provides an overview of:

* Recovery performance
* Failed transactions
* Revenue insights

## AI Assistant

Allows users to interact with the recovery intelligence system.

## Failed Transactions

Helps identify and manage unsuccessful payment attempts.

## Receivables

Tracks B2B payments and outstanding balances.

## Audit Logs

Maintains a transparent record of system activities.

---

# 🔐 Environment Variables

Create a `.env` file inside the backend folder:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

Never commit `.env` files to GitHub.

---

# 🔮 Future Enhancements

* Advanced machine learning prediction models
* Automated customer communication
* Payment gateway integration
* Cloud deployment
* Real-time recovery notifications
* Advanced fraud detection

---

# 🤝 Contribution

Contributions are welcome.

Steps:

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Added new feature"
```

4. Push changes

```bash
git push origin feature-name
```

5. Create a Pull Request

---

# 👨‍💻 Author

**Abhinav Sharma**

GitHub:
https://github.com/abhi10359

---

# ⭐ Support

If you find this project useful, consider giving it a ⭐ on GitHub.

---

## License

This project is developed for educational and demonstration purposes.
