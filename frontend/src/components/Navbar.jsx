import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  Building2,
  CalendarCheck,
  Bot,
  ShieldCheck,
  ShoppingCart,
  CreditCard,
} from "lucide-react";


function Navbar() {

  /* =========================================================
     NAVIGATION LINK CLASS
  ========================================================= */

  const linkClass = ({ isActive }) =>
    `navbar-link ${isActive ? "active" : ""}`;


  return (

    <nav className="navbar">

      {/* =====================================================
          NAVBAR BRAND
      ===================================================== */}

      <div className="navbar-brand">

        <div className="navbar-logo">
          R
        </div>

        <div>

          <h2>
            RecoverAI
          </h2>

          <span>
            Transaction Recovery
          </span>

        </div>

      </div>


      {/* =====================================================
          NAVIGATION LINKS
      ===================================================== */}

      <div className="navbar-links">


        {/* ===================================================
            OVERVIEW
        =================================================== */}

        <NavLink
          to="/"
          end
          className={linkClass}
        >

          <LayoutDashboard size={18} />

          <span>
            Overview
          </span>

        </NavLink>


        {/* ===================================================
            ANALYTICS
        =================================================== */}

        <NavLink
          to="/analytics"
          className={linkClass}
        >

          <BarChart3 size={18} />

          <span>
            Analytics
          </span>

        </NavLink>


        {/* ===================================================
            FAILED TRANSACTIONS
        =================================================== */}

        <NavLink
          to="/failed-transactions"
          className={linkClass}
        >

          <AlertTriangle size={18} />

          <span>
            Failed Transactions
          </span>

        </NavLink>


        {/* ===================================================
            CHECKOUT DROP-OFF RECOVERY
        =================================================== */}

        <NavLink
          to="/checkout-recovery"
          className={linkClass}
        >

          <ShoppingCart size={18} />

          <span>
            Checkout Drop-off
          </span>

        </NavLink>


        {/* ===================================================
            FAILED SUBSCRIPTION RECOVERY
        =================================================== */}

        <NavLink
          to="/subscription-recovery"
          className={linkClass}
        >

          <CreditCard size={18} />

          <span>
            Failed Subscriptions
          </span>

        </NavLink>


        {/* ===================================================
            B2B RECEIVABLES
        =================================================== */}

        <NavLink
          to="/b2b-receivables"
          className={linkClass}
        >

          <Building2 size={18} />

          <span>
            B2B Receivables
          </span>

        </NavLink>


        {/* ===================================================
            PROMISE TO PAY
        =================================================== */}

        <NavLink
          to="/promise-tracker"
          className={linkClass}
        >

          <CalendarCheck size={18} />

          <span>
            Promise-to-Pay
          </span>

        </NavLink>


        {/* ===================================================
            AI ASSISTANT
        =================================================== */}

        <NavLink
          to="/ai-assistant"
          className={linkClass}
        >

          <Bot size={18} />

          <span>
            AI Assistant
          </span>

        </NavLink>


        {/* ===================================================
            AUDIT LOGS
        =================================================== */}

        <NavLink
          to="/audit-logs"
          className={linkClass}
        >

          <ShieldCheck size={18} />

          <span>
            Audit Logs
          </span>

        </NavLink>


      </div>

    </nav>

  );

}


export default Navbar;