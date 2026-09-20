/** Аватар игрока (Steam) или заглушка с первой буквой ника. size: md | lg. */
function Avatar({ src, name, size = 'md' }) {
  if (!src) {
    return <span className={`avatar avatar--${size} avatar--empty`} aria-hidden="true">{(name || '?').slice(0, 1)}</span>;
  }
  return <img src={src} alt="" className={`avatar avatar--${size}`} loading="lazy" />;
}

export default Avatar;
