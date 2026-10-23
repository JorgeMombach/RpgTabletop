import { dismissToast, useApp } from "../store";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>{t.text}</span>
          {t.action && (
            <button
              className="btn small"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn" aria-label="Fechar" onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
