import { useEffect, useRef, useState } from 'react';

/** 方向判定阈值：小于该位移不判定方向，避免抖动 */
const DIRECTION_THRESHOLD = 4;
/** 向下滚动超过该距离后才允许隐藏（页面顶部小幅滚动不隐藏） */
const HIDE_MIN_SCROLL = 32;

/**
 * FAB 滚动联动：列表向下滚动时沉底隐藏、向上滚动回浮。
 *
 * scroll 事件不冒泡，但可在 window 上以捕获方式监听任意内部滚动容器；
 * rAF 节流，仅输出布尔状态（由 CSS 用 transform + opacity 消费）。
 * FAB 仅在列表页可见时挂载，因此无需额外开关。
 */
export function useFabAutoHide(): boolean {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      // 弹层（同步面板/对话框）内部滚动不联动 FAB
      if (target.closest('.sync-overlay, .modal-overlay')) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = target.scrollTop;
        const dy = y - lastYRef.current;
        lastYRef.current = y;
        if (dy > DIRECTION_THRESHOLD && y > HIDE_MIN_SCROLL) {
          setHidden(true);
        } else if (dy < -DIRECTION_THRESHOLD) {
          setHidden(false);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return hidden;
}
