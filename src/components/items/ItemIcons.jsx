/** Значки страницы предметов: линейные, наследуют цвет текста (currentColor), размер задаёт CSS (.items-icon). */

function Icon({ children, ...rest }) {
  return (
    <svg
      className="items-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

/** Стрелка раскрытия: вниз — «развернуть», вверх — «свернуть». */
export function ChevronIcon({ up = false }) {
  return (
    <Icon>
      <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </Icon>
  );
}

/** Душа: ромб с точкой — валюта предметов (тот же знак, что на странице билда). */
export function SoulMark() {
  return (
    <svg className="items-soul" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2 21 12 12 22 3 12Z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.2" fill="var(--soul-dot, #17110c)" />
    </svg>
  );
}
