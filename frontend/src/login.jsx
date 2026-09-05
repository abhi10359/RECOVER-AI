import { useState } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    setError("");

    // Demo login credentials
    if (
      email === "admin@recoverai.com" &&
      password === "admin123"
    ) {
      onLogin();
    } else {
      setError("Invalid email or password.");
    }
  };

  return (
    <div className="login-page">

      {/* Background decoration */}
      <div className="login-background-circle circle-one"></div>
      <div className="login-background-circle circle-two"></div>

      <div className="login-container">

        {/* Logo / Branding */}
        <div className="login-brand">

          <div className="login-logo">
            🤖
          </div>

          <h1>RecoverAI</h1>

          <p>
            AI Revenue Recovery Platform
          </p>

        </div>

        {/* Login Card */}
        <div className="login-card">

          <div className="login-heading">

            <h2>Welcome Back</h2>

            <p>
              Sign in to continue to your dashboard
            </p>

          </div>

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div className="form-group">

              <label htmlFor="email">
                Email
              </label>

              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
              />

            </div>

            {/* Password */}
            <div className="form-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="password-wrapper">

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (prev) => !prev
                    )
                  }
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>

              </div>

            </div>

            {/* Error */}
            {error && (
              <div className="login-error">
                ⚠️ {error}
              </div>
            )}

            {/* Forgot Password */}
            <div className="login-options">

              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  alert(
                    "Password recovery will be added later."
                  )
                }
              >
                Forgot Password?
              </button>

            </div>

            {/* Login button */}
            <button
              type="submit"
              className="login-button"
            >
              Login
            </button>

          </form>

          {/* Demo credentials */}
          <div className="demo-credentials">

            <p>Demo Credentials</p>

            <span>
              Email: admin@recoverai.com
            </span>

            <span>
              Password: admin123
            </span>

          </div>

        </div>

        {/* Footer */}
        <p className="login-footer">
          RecoverAI © 2026 · Intelligent Revenue Recovery
        </p>

      </div>

    </div>
  );
}

export default Login;