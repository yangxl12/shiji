import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 滚动感知 hook：滚动容器滚过阈值后输出 true（rAF 节流 + passive 监听）。
 * 用于顶栏/底栏玻璃化等滚动联动，纯表现层，不触碰业务逻辑。
 *
 * @param ref 滚动容器的 ref（滚动容器在本方案中不重挂载，effect 绑定一次即可）
 * @param threshold 触发阈值（px），默认 8px
 */
export function useScrollState(
  ref: RefObject<HTMLElement | null>,
  threshold = 8,
): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setIsScrolled(el.scrollTop > threshold);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    // 初始位置可能已超过阈值（如恢复滚动位置），统一走 rAF 回调
    onScroll();

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, threshold]);

  return isScrolled;
}
