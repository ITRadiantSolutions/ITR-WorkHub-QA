import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const nextMode = isDark ? "light" : "dark";

  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle"
      aria-label={`Switch to ${nextMode} mode`} title={`Switch to ${nextMode} mode`} aria-pressed={isDark}>
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" /></svg>
        )}
      </span>
      <span className="theme-toggle__track" aria-hidden="true"><span className="theme-toggle__thumb" /></span>
      <span className="theme-toggle__label">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
