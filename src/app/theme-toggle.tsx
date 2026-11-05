"use client";

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("swapgap-theme", nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle light and dark theme"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path className="theme-sun" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.41 1.41m12.72 0-1.42-1.41M7.05 7.05 5.64 5.64M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path className="theme-moon" d="M19.5 15.1A7.5 7.5 0 0 1 8.9 4.5 7.5 7.5 0 1 0 19.5 15.1Z" />
      </svg>
    </button>
  );
}
