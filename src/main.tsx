import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

/**
 * 冻结底部安全区高度：安卓手势条（小横条）显隐会使
 * env(safe-area-inset-bottom) 动态变化，导致底部 TabBar 等固定元素抖动。
 * 启动时读取一次并固化为 CSS 变量，之后布局不再随之变化。
 */
function freezeSafeAreaBottom() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
    'padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0
  probe.remove()
  document.documentElement.style.setProperty('--safe-area-bottom', `${inset}px`)
}
freezeSafeAreaBottom()

// Register service worker for PWA (only in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // 站点部署在子路径（vite base，如 /shiji/），SW 必须按 BASE_URL 注册
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.log('SW registration failed: ', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
