/** Значки страницы случайного билда: линейные, наследуют цвет текста (currentColor), размер задаёт CSS (.build-icon). */

function Icon({ children, fill = 'none', ...rest }) {
  return (
    <svg
      className="build-icon"
      viewBox="0 0 24 24"
      fill={fill}
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

export function DiceIcon() {
  return (
    <Icon>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function RerollIcon() {
  return (
    <Icon>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </Icon>
  );
}

export function LinkIcon() {
  return (
    <Icon>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </Icon>
  );
}

export function HistoryIcon() {
  return (
    <Icon>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v4.5H8" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

/** Замок: закрытый — предмет закреплён, открытый — нет. */
export function LockIcon({ locked }) {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.2-2.4'} />
    </Icon>
  );
}

export function ChevronIcon() {
  return (
    <Icon>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

/** Душа: ромб с точкой — валюта предметов. */
export function SoulIcon() {
  return (
    <svg className="build-soul" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2 21 12 12 22 3 12Z" fill="currentColor" />
      <circle cx="12" cy="12" r="3.2" fill="var(--soul-dot, #17110c)" />
    </svg>
  );
}
