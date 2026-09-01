import type { ThemeMode } from '../../hooks/useTheme';
import './ThemeToggle.css';

/** 点击循环顺序：浅色 → 深色 → 跟随系统 */
const MODE_ORDER: ThemeMode[] = ['light', 'dark', 'system'];

const MODE_LABEL: Record<ThemeMode, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zM2 12c0 .55.45 1 1 1h2c.55 0 1-.45 1-1s-.45-1-1-1H3c-.55 0-1 .45-1 1zm18 0c0 .55.45 1 1 1h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1zM4.58 18.01c.39.39 1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41zM17.25 6.17l1.06-1.06c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0z" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13h-2.5l-4.5 10h2.2l.93-2.3h4.74l.93 2.3h2.2l-4.5-10zm-2.62 6l1.37-3.42 1.37 3.42h-2.74z" />
    </svg>
  );
}

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  onToast: (message: string) => void;
}

export function ThemeToggle({ mode, onChange, onToast }: ThemeToggleProps) {
  const handleClick = () => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
    onChange(next);
    onToast(MODE_LABEL[next]);
  };

  return (
    <button
      className="theme-toggle-btn"
      onClick={handleClick}
      aria-label={`主题模式：${MODE_LABEL[mode]}，点击切换`}
      title={MODE_LABEL[mode]}
    >
      {/* key 变化触发重挂载，播放图标入场动画 */}
      <span className="theme-toggle-icon" key={mode}>
        <ThemeIcon mode={mode} />
      </span>
    </button>
  );
}
