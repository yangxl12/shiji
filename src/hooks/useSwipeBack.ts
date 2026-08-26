import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface SwipeBackOptions {
  /** 手势是否可用（二级页面可见时为 true） */
  enabled: boolean;
  /**
   * 请求返回（例如先保存再返回）。
   * resolve 为 true 表示返回流程已启动，页面随后会关闭；
   * false 表示返回被取消（如保存失败），手势需将页面恢复原状。
   */
  onBack: () => boolean | Promise<boolean>;
  /** 手势被接管时触发（用于切换提示 UI 状态） */
  onGestureStart?: () => void;
}

/** 左侧边缘触发区宽度（px）。安卓系统返回手势占用最外侧约 20px，二者共存不冲突 */
const EDGE_WIDTH = 30;
/** 水平位移超过该值且明显横向占优时才接管手势，避免影响正常滚动 */
const CLAIM_THRESHOLD = 12;
/** 拖出屏幕宽度该比例即确认返回 */
const COMPLETE_RATIO = 0.3;
/** 甩动速度阈值（px/ms） */
const FLING_VELOCITY = 0.6;
/** 松手后的过渡时长（ms） */
const RELEASE_DURATION = 280;

const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

/**
 * 二级页面左侧边缘右滑返回手势（跟手拖拽）。
 *
 * - 仅在左边缘 30px 内起始、且横向位移明显大于纵向时接管，
 *   不影响页面正常滚动与点击；
 * - 接管后对 touchmove 调用 preventDefault，抑制浏览器自带的
 *   边缘返回手势，避免与自定义动画冲突；
 * - 右侧左滑不拦截，交给安卓系统/浏览器返回手势处理（配合
 *   pushState/popstate，两条路径最终都会触发页面滑出动画）。
 */
export function useSwipeBack(
  pageRef: RefObject<HTMLDivElement | null>,
  behindRef: RefObject<HTMLDivElement | null>,
  hintRef: RefObject<HTMLDivElement | null>,
  { enabled, onBack, onGestureStart }: SwipeBackOptions,
): void {
  const optionsRef = useRef({ enabled, onBack, onGestureStart });
  useEffect(() => {
    optionsRef.current = { enabled, onBack, onGestureStart };
  });

  const stateRef = useRef({
    touchId: null as number | null,
    claimed: false,
    finishing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    baseLeft: 0,
    curX: 0,
    width: 1,
  });

  // 监听器在 enabled 变为 true（编辑页打开，容器必然已渲染）时绑定，
  // 避免初始 loading 阶段容器尚未挂载导致拿不到 DOM。
  useEffect(() => {
    const page = pageRef.current;
    if (!enabled || !page) return;
    const g = stateRef.current;

    const clearInlineStyles = () => {
      page.style.transition = '';
      page.style.transform = '';
      const behind = behindRef.current;
      if (behind) {
        behind.style.transition = '';
        behind.style.opacity = '';
        behind.style.transform = '';
        behind.style.pointerEvents = '';
      }
      const hint = hintRef.current;
      if (hint) {
        hint.style.transition = '';
        hint.style.opacity = '';
        hint.style.transform = '';
        hint.style.animation = '';
      }
    };

    const setHintProgress = (p: number) => {
      const hint = hintRef.current;
      if (!hint) return;
      hint.style.opacity = String(Math.min(0.95, p * 3));
      hint.style.transform = `scale(${0.65 + 0.45 * Math.min(1, p * 2)})`;
    };

    const applyDrag = (x: number) => {
      g.curX = x;
      page.style.transform = `translateX(${x}px)`;
      const p = x / g.width;
      const behind = behindRef.current;
      if (behind) {
        behind.style.opacity = String(0.85 + 0.15 * p);
        behind.style.transform = `scale(${0.98 + 0.02 * p})`;
      }
      setHintProgress(p);
    };

    /** 返回流程被取消时，把页面滑回原位 */
    const restorePage = () => {
      g.finishing = false;
      page.style.transform = 'translateX(0)';
      const behind = behindRef.current;
      if (behind) {
        behind.style.opacity = '';
        behind.style.transform = '';
        behind.style.pointerEvents = '';
      }
      const hint = hintRef.current;
      if (hint) hint.style.opacity = '0';
      window.setTimeout(clearInlineStyles, RELEASE_DURATION + 40);
    };

    const endGesture = (forceCancel: boolean) => {
      if (g.touchId === null) return;
      if (!g.claimed) {
        g.touchId = null;
        return;
      }
      g.claimed = false;
      g.touchId = null;

      const p = Math.min(1, Math.max(0, g.curX / g.width));
      const dragged = g.curX - g.baseLeft;
      const fling = g.velocity > FLING_VELOCITY && dragged > g.width * 0.1;
      const complete = !forceCancel && (p >= COMPLETE_RATIO || fling);

      page.style.transition = `transform ${RELEASE_DURATION}ms ${EASE}`;
      const behind = behindRef.current;
      if (behind) {
        behind.style.transition = `opacity 0.35s ${EASE}, transform 0.35s ${EASE}`;
      }
      const hint = hintRef.current;
      if (hint) hint.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

      if (complete) {
        g.finishing = true;
        page.style.transform = 'translateX(100%)';
        if (behind) {
          behind.style.opacity = '1';
          behind.style.transform = 'scale(1)';
          // 返回流程进行中，避免误触底层列表
          behind.style.pointerEvents = 'none';
        }
        if (hint) hint.style.opacity = '0';
        void Promise.resolve(optionsRef.current.onBack())
          .then((ok) => {
            if (!ok) restorePage();
            // 返回成功时 enabled 将变为 false，由下方 effect 统一清理内联样式
          })
          .catch(() => restorePage());
      } else {
        page.style.transform = `translateX(${g.baseLeft}px)`;
        if (behind) {
          behind.style.opacity = '';
          behind.style.transform = '';
        }
        if (hint) hint.style.opacity = '0';
        window.setTimeout(clearInlineStyles, RELEASE_DURATION + 40);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!optionsRef.current.enabled || g.finishing || g.touchId !== null) return;
      const t = e.touches[0];
      if (!t || t.clientX > EDGE_WIDTH) return;
      // 遮罩层（如确认弹窗）打开时不响应边缘手势
      if (e.target instanceof Element && e.target.closest('.modal-overlay')) return;
      g.touchId = t.identifier;
      g.claimed = false;
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.lastX = t.clientX;
      g.lastT = performance.now();
      g.velocity = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (g.touchId === null || g.finishing || !optionsRef.current.enabled) return;
      const t = Array.from(e.changedTouches).find((c) => c.identifier === g.touchId);
      if (!t) return;

      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;

      if (!g.claimed) {
        // 横向位移明显大于纵向时才接管，否则交还给浏览器（正常滚动）
        if (dx < CLAIM_THRESHOLD || dx <= Math.abs(dy)) return;
        g.claimed = true;
        g.width = window.innerWidth || 1;
        // 以页面当前实际位置为基准，避免打断进行中的过渡动画
        g.baseLeft = Math.max(0, page.getBoundingClientRect().left);
        g.curX = g.baseLeft;
        page.style.transition = 'none';
        const behind = behindRef.current;
        if (behind) behind.style.transition = 'none';
        const hint = hintRef.current;
        if (hint) {
          hint.style.animation = 'none';
          hint.style.transition = 'none';
        }
        optionsRef.current.onGestureStart?.();
      }

      // 接管后阻止默认行为：页面滚动、浏览器自带的边缘返回手势
      if (e.cancelable) e.preventDefault();

      const now = performance.now();
      const dt = now - g.lastT;
      if (dt > 0) {
        const v = (t.clientX - g.lastX) / dt;
        g.velocity = g.velocity * 0.75 + v * 0.25;
      }
      g.lastX = t.clientX;
      g.lastT = now;

      const x = Math.min(g.width, Math.max(0, g.baseLeft + Math.max(0, dx)));
      applyDrag(x);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (g.touchId === null) return;
      if (!Array.from(e.changedTouches).some((c) => c.identifier === g.touchId)) return;
      endGesture(false);
    };

    const onTouchCancel = (e: TouchEvent) => {
      if (g.touchId === null) return;
      if (!Array.from(e.changedTouches).some((c) => c.identifier === g.touchId)) return;
      endGesture(true);
    };

    page.addEventListener('touchstart', onTouchStart, { passive: true });
    page.addEventListener('touchmove', onTouchMove, { passive: false });
    page.addEventListener('touchend', onTouchEnd);
    page.addEventListener('touchcancel', onTouchCancel);
    return () => {
      page.removeEventListener('touchstart', onTouchStart);
      page.removeEventListener('touchmove', onTouchMove);
      page.removeEventListener('touchend', onTouchEnd);
      page.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, pageRef, behindRef, hintRef]);

  // 页面关闭（enabled=false）后清理手势遗留的内联样式。
  // effect 在 React 提交后执行，此时可见类已被移除，清理不会引起闪烁。
  useEffect(() => {
    if (enabled) return;
    const g = stateRef.current;
    g.touchId = null;
    g.claimed = false;
    g.finishing = false;
    const page = pageRef.current;
    if (page) {
      page.style.transition = '';
      page.style.transform = '';
    }
    const behind = behindRef.current;
    if (behind) {
      behind.style.transition = '';
      behind.style.opacity = '';
      behind.style.transform = '';
      behind.style.pointerEvents = '';
    }
    const hint = hintRef.current;
    if (hint) {
      hint.style.transition = '';
      hint.style.opacity = '';
      hint.style.transform = '';
      hint.style.animation = '';
    }
  }, [enabled, pageRef, behindRef, hintRef]);
}
