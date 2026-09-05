import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext({
  showToast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info", title = "", duration = 4000) => {
      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      const newToast = { id, message, type, title };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (msg, title = "Success", duration = 4000) => showToast(msg, "success", title, duration),
    [showToast]
  );

  const error = useCallback(
    (msg, title = "Error", duration = 5000) => showToast(msg, "error", title, duration),
    [showToast]
  );

  const warning = useCallback(
    (msg, title = "Warning", duration = 4500) => showToast(msg, "warning", title, duration),
    [showToast]
  );

  const info = useCallback(
    (msg, title = "Information", duration = 4000) => showToast(msg, "info", title, duration),
    [showToast]
  );

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={20} className="toast-icon-svg" />;
      case "error":
        return <AlertCircle size={20} className="toast-icon-svg" />;
      case "warning":
        return <AlertTriangle size={20} className="toast-icon-svg" />;
      default:
        return <Info size={20} className="toast-icon-svg" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}

      {/* TOAST CONTAINER */}
      <div className="toast-portal" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-item--${toast.type}`}
            role="alert"
          >
            <div className="toast-icon-wrap">{getIcon(toast.type)}</div>

            <div className="toast-content">
              {toast.title && <h4 className="toast-title">{toast.title}</h4>}
              <p className="toast-message">{toast.message}</p>
            </div>

            <button
              className="toast-close-btn"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastContext;
