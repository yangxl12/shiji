import { useEffect, useState } from 'react';

/**
 * 低于该高度视为地址栏/手势条收缩造成的抖动，不当作软键盘。
 * 手机软键盘高度普遍 ≥ 250px，140px 足以过滤浏览器工具栏的显隐变化。
 */
const KEYBOARD_MIN_HEIGHT = 140;

/** 焦点是否落在会唤起软键盘的元素上（输入框 / contenteditable 编辑器） */
function isTextEditing(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/**
 * 软键盘遮挡高度（px），即「布局视口底部 - 视觉视口底部」。
 *
 * 背景：移动端软键盘弹出时，各浏览器对视口的处理并不一致——
 * - iOS Safari：只收缩视觉视口，布局视口不变，position:fixed 的底栏会被键盘遮住，
 *   本值即为键盘高度，可用它把底栏抬到键盘上方；
 * - Android Chrome（viewport 声明 interactive-widget=resizes-content）：
 *   布局视口同步收缩，fixed 底栏本就贴在键盘上方，此时本值恒为 0，不会产生二次偏移。
 *
 * 用法：把返回值写进 CSS 变量（如 --kb-inset），底栏与页面容器用它兜底。
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    // 极老浏览器无 visualViewport：无法测量，保持 0（沿用原有 fixed 行为）
    if (!vv) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const hidden = window.innerHeight - (vv.offsetTop + vv.height);
      const focused = isTextEditing(document.activeElement);

      setInset((prev) => {
        let next = 0;
        if (hidden > KEYBOARD_MIN_HEIGHT) {
          // 键盘收起时 blur 可能早于键盘动画结束：保持原值，避免底栏先掉下去再弹回
          next = focused ? Math.round(hidden) : prev;
        }
        return prev === next ? prev : next;
      });
    };

    // 视觉视口尺寸/位置变化 + 窗口 resize 都要重算；rAF 合并同帧多次触发
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return inset;
}
