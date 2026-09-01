import { useCallback, useEffect, useState } from 'react';

/** 主题模式：浅色 / 深色 / 跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ynote-theme';

const DARK_MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

function getSystemTheme(): 'light' | 'dark' {
  return DARK_MEDIA.matches ? 'dark' : 'light';
}

function readStoredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // localStorage 不可用时回退跟随系统
  }
  return 'system';
}

/**
 * 主题管理：将实际主题写入 <html data-theme>（tokens.css 据此切换明暗令牌）。
 * - mode 持久化到 localStorage，默认 system
 * - system 模式下监听系统偏好变化，实时跟随
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // 跟随系统：监听系统偏好变化（仅 system 模式下生效）
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    DARK_MEDIA.addEventListener('change', onChange);
    return () => DARK_MEDIA.removeEventListener('change', onChange);
  }, []);

  const resolved = mode === 'system' ? systemTheme : mode;

  // 实际主题变化 → 写入 <html data-theme> 并同步状态栏颜色
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#121216' : '#F7F7FA';
  }, [resolved]);

  const updateMode = useCallback((next: ThemeMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存储失败仅影响持久化，不影响本次会话
    }
  }, []);

  return { themeMode: mode, resolvedTheme: resolved, setThemeMode: updateMode };
}
