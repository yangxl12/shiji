# 「拾记」UI 与交互优化方案

> 版本：v1.0 ｜ 状态：方案设计（暂不实施代码修改）
> 范围：仅 UI 界面与交互效果，零业务逻辑变更
> 技术底座：React 19 + Vite 8 + 原生 CSS（无 UI 框架）+ PWA

---

## 1. 现状盘点与问题诊断

### 1.1 界面结构

| 层级 | 内容 |
|---|---|
| 页面 | NoteListPage（随想/学习/待办）、TagsPage（标签）、NoteEditPage（编辑） |
| 导航 | TabBar（底部固定）、note-list-header / tags-header / note-edit-header（顶部 56px） |
| 组件 | NoteCard、FAB、Modal、Toast、SyncSettings（底部弹层）、TagChipNav、TagSelector、BatchActionBar、EmptyState |
| 过渡机制 | `.app-page` 双层固定容器 + CSS transform 滑入滑出；popstate 集成；useSwipeBack 边缘跟手返回 |

### 1.2 问题诊断

| # | 问题 | 具体表现 |
|---|---|---|
| P1 | 样式基建缺失 | 色值硬编码分散于 14 个 CSS 文件（`#1A1A1A` 等重复 40+ 次）；`constants.ts` 的 `COLORS`/`ANIMATION_DURATION` 为死代码；`src/index.css` 为未引入的模板残留（含 `#root{width:1126px}` 等冲突样式） |
| P2 | 视觉同质扁平 | 卡片/按钮/导航均为纯白底 + 1px 边框，无材质区分、无景深层次 |
| P3 | 动效无体系 | 时长混用 0.15/0.2/0.25/0.3/0.35s；easing 曲线 5 种并存无规范；Tab 切换无过渡 |
| P4 | 反馈不完整 | hover 效果零散且未用 `@media (hover:hover)` 区分鼠标/触屏；无 `:focus-visible` 键盘可达性 |
| P5 | 无滚动联动 | 顶栏滚动后无玻璃化/分割线渐显；FAB 不随滚动方向显隐；下拉指示为纯文本 |
| P6 | 缺失现代特性 | 无 `prefers-reduced-motion` 适配；无暗色模式（浏览器夜间体验差）；`backdrop-filter` 全程未使用 |

---

## 2. 设计理念：「墨韵 · 玻璃」（Ink & Glass）

保留品牌既有的**黑白极简基因**（墨色 `#1A1A1A` 是拾记的识别核心），注入**液态玻璃材质**与**克制的色彩氛围**，实现从「扁平极简」到「通透精致」的升级。

四条设计原则：

1. **材质分层**：固定/悬浮层用玻璃（通透），内容层用实体（可读）。玻璃永远只做「窗口」，不做「墙壁」。
2. **墨色为骨，靛紫为韵**：CTA、选中态保持墨黑；靛紫色仅出现在环境光、聚焦环、进行态等低频场景，避免稀释品牌识别度。
3. **动效即反馈**：每个动效必须回答「系统对用户的操作知道多少」——进入、悬停、按下、滚动四个时刻都有回应；无装饰性动画。
4. **性能即设计**：所有动效只触碰 `transform` / `opacity`，玻璃数量限流，低端设备优雅降级——60fps 是硬约束而非目标。

---

## 3. 设计令牌系统（Design Tokens）

新建 `src/styles/tokens.css`，作为唯一视觉真源（Single Source of Truth），在 `main.tsx` 首位引入；所有组件 CSS 改为引用变量。

### 3.1 色彩系统

```css
:root {
  /* ── 中性色阶（冷灰微调，替代散落的 #1A1A1A/#888/#BBB/#CCC）── */
  --ink-900: #1A1A1E;   /* 主文本 / CTA / 选中态 */
  --ink-700: #3D3D43;   /* 次级文本 */
  --ink-500: #6E6E76;   /* 辅助文本 / 图标 */
  --ink-400: #9A9AA2;   /* 占位 / 未选中 Tab */
  --ink-300: #C7C7CE;   /* 弱化信息（时间戳） */
  --hairline: rgba(26, 26, 30, 0.08);  /* 发丝分割线 */

  /* ── 表面层级 ── */
  --bg: #F7F7FA;        /* 页面底色（原 #FAFAFA 微调冷调） */
  --surface: #FFFFFF;   /* 卡片 */
  --surface-2: #F2F2F5; /* 二级表面 / 按钮底 */

  /* ── 品牌与语义 ── */
  --brand: var(--ink-900);          /* 墨黑，品牌行动色 */
  --brand-hue: #6366F1;             /* 靛紫：环境光 / focus 环 / 进行态 */
  --brand-hue-soft: rgba(99, 102, 241, 0.12);
  --danger: #E54D42;                /* 保留现有红 */
  --success: #34A853;

  /* ── 标签色（亮度饱和度微调，适配玻璃底与暗色）── */
  --tag-red: #EF5A4E;
  --tag-orange: #F5822E;
  --tag-yellow: #F0B429;
  --tag-gray: #9A9AA2;
}
```

> 标签色同步修改 `constants.ts` 的 `TAG_COLORS`（该常量仅用于内联样式着色，属样式数据而非业务逻辑）。

### 3.2 字体体系

保留 system-ui 字体栈（零网络成本、原生渲染），建立字号阶梯：

| 令牌 | 规格 | 用途 |
|---|---|---|
| display | 26px / 1.35 / 700 | 编辑页标题（桌面） |
| title-xl | 22px / 1.4 / 700 | 编辑页标题（移动） |
| title | 17px / 1.4 / 600 | 页面标题、计数 |
| body | 16px / 1.75 / 400 | 正文输入 |
| body-sm | 15px / 1.6 / 400 | 弹层正文、空态 |
| caption | 13px / 1.5 / 400 | 辅助说明 |
| micro | 12px / 1.4 / 500 | 时间戳、Tab 标签 |

- 时间戳、批量计数启用 `font-variant-numeric: tabular-nums`，数字变化不抖动。
- 字重收敛为 400 / 500 / 600 / 700 四档。

### 3.3 圆角与阴影

```css
:root {
  --radius-card: 16px;    /* 卡片 12 → 16 */
  --radius-nav: 24px;     /* 玻璃导航浮岛 */
  --radius-modal: 20px;
  --radius-chip: 999px;

  /* 双层柔和阴影：贴地 + 漫射，替代现有单层 */
  --shadow-card: 0 1px 2px rgba(24, 24, 32, 0.04), 0 4px 16px rgba(24, 24, 32, 0.04);
  --shadow-card-hover: 0 2px 4px rgba(24, 24, 32, 0.05), 0 12px 32px rgba(24, 24, 32, 0.10);
  --shadow-float: 0 8px 32px rgba(24, 24, 32, 0.14);   /* FAB / 浮层 */
}
```

### 3.4 动效令牌（替代 5 种混用时长）

```css
:root {
  --dur-fast: 150ms;    /* 微反馈：hover、按压 */
  --dur-base: 240ms;    /* 常规：toast、弹层 */
  --dur-slow: 360ms;    /* 页面级过渡 */
  --dur-page: 320ms;    /* 编辑页滑入 */

  --ease-standard:  cubic-bezier(0.2, 0, 0, 1);       /* 通用 */
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1); /* 进入 */
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15); /* 退出 */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* 微弹：FAB、选中 */
}
```

---

## 4. 液态玻璃（Liquid Glass）规范

### 4.1 材质分层配方

| 层级 | 元素 | 配方 | 说明 |
|---|---|---|---|
| G1 导航玻璃 | TabBar、三个顶栏（滚动态）、BatchActionBar | `rgba(255,255,255,0.62)` + `blur(20px) saturate(180%)` | 背后内容透出但不干扰 |
| G2 浮层玻璃 | Modal、SyncSettings Sheet、Toast | `rgba(255,255,255,0.78)` + `blur(28px) saturate(160%)`（Toast 用深色版 `rgba(28,28,32,0.82)`） | 更实底保证正文可读性 |
| G3 点缀玻璃 | TagChip 选中态、状态胶囊 | `rgba(255,255,255,0.5)` + `blur(12px)` | 轻透 |

**核心配方（G1 示例）：**

```css
.glass-nav {
  background: rgba(255, 255, 255, 0.62);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  /* 上缘 1px 受光高光 + 下缘发丝阴影 = 玻璃「厚度」 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 -1px 0 rgba(26, 26, 30, 0.04),
    0 8px 32px rgba(24, 24, 32, 0.08);
}
```

### 4.2 光学细节（通透感来源）

1. **上缘高光**：`inset 0 1px 0 rgba(255,255,255,0.65)` 模拟顶面反光——玻璃质感的灵魂。
2. **边缘描边**：外层 `1px solid rgba(255,255,255,0.5)`（暗色模式换 `rgba(255,255,255,0.12)`）。
3. **饱和度提升**：`saturate(180%)` 让背景色透过玻璃后更「湿润」，避免灰白浑浊。
4. **环境底色（玻璃的土壤）**：玻璃必须透出色彩才成立。`body` 增加两枚极淡的靛紫/玫红氛围光斑（透明度 5–7%），`fixed` 定位于 `.app::before`，不随滚动重绘：

```css
.app::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(48rem 32rem at 12% -8%, rgba(99, 102, 241, 0.07), transparent 60%),
    radial-gradient(40rem 28rem at 88% 108%, rgba(236, 72, 153, 0.05), transparent 60%),
    var(--bg);
}
```

5. **卡片镜面高光（可选增强，仅 `hover:hover` 设备）**：hover 时 `::after` 层叠加随光标的 `radial-gradient`（CSS 变量 `--mx/--my`，由一次 `mousemove` 委托写入，`background-position` 变化不触发重排）。

### 4.3 性能红线（玻璃不掉帧的前提）

- **同屏 `backdrop-filter` ≤ 3 个**：TabBar + 当前顶栏 + 至多一个浮层。**列表卡片禁用玻璃**（实体白卡 + 描边 + 双层阴影），这是 60fps 的关键决策。
- 玻璃元素均为 `fixed/sticky`，滚动时不重绘自身。
- Sheet/Modal 打开时其背后的玻璃元素正常（被遮罩覆盖，浏览器自动优化）。

### 4.4 降级策略

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-nav { background: rgba(255, 255, 255, 0.96); }  /* 不支持时提高实底 */
}
```

Firefox 103+ / Chrome 76+ / Safari 9+（-webkit- 前缀）均已支持，降级仅为兜底。

---

## 5. 组件级重塑细则

> 以下均为 CSS 层改造；涉及 TSX 的仅限「新增 className / aria 属性」，不动任何逻辑、状态与数据流。

### 5.1 TabBar —— 玻璃浮岛

- **现状**：全宽白底 + 上边框，紧贴屏幕底。
- **方案**：改为悬浮玻璃岛——`left/right/bottom: 12px`（含 safe-area）、圆角 `--radius-nav`、G1 玻璃配方；同步将列表滚动区 `padding-bottom` 由 `calc(56px + safe + 80px)` 调整为 `calc(浮岛高度 + safe + 32px)`。
- **激活指示**：当前 Tab 底部增加墨色 8% 胶囊底（`border-radius: 999px`），激活图标播放一次 `scale 1→1.12→1` 弹性微动（`--ease-spring`，240ms）。
- **切换过渡**：胶囊底用 `transform` 滑动指示（仅 CSS，兄弟元素结构不变时以背景伪元素 + `transition` 实现位置跟随）。

### 5.2 顶部导航（列表/标签/编辑页）—— 滚动感知玻璃

- **现状**：常显白底 + `#F0F0F0` 下边框。
- **方案**：置顶时**透明融入背景**（无边框）；滚动超过 8px 后玻璃化（G1 配方 + 发丝分割线渐显）。
- **实现路径**：
  - 首选（渐进增强）：CSS `animation-timeline: scroll()` 驱动背景透明度与阴影渐变，零 JS；
  - 降级：新增通用 `useScrollState` hook（rAF 节流 + passive 监听，输出 `is-scrolled` class），三个页面滚动容器各自挂载——独立 hook，不触碰现有组件逻辑。
- 标题文字在滚动态获得 `-0.01em` 字距收紧，强化「吸附」心理暗示。

### 5.3 NoteCard —— 实体卡片 + 三态反馈 + 首屏编排

- 圆角 12→16px；新增 `1px solid var(--hairline)` 描边 + 双层阴影；移除桌面 hover 变灰底（`#F7F7F8`）改为：
  - **hover**（`@media (hover:hover)`）：`translateY(-2px)` + 阴影切至 `--shadow-card-hover`（阴影变化经预渲染伪元素 `opacity` 切换，避免 box-shadow 过渡掉帧）；
  - **active**：`scale(0.985)` + 阴影收回，`--dur-fast`；
  - **focus-visible**：2px 靛紫外环。
- 标签色点：8px 圆点外扩同色 12% 光环（`box-shadow: 0 0 0 4px`），暗色模式下依然可辨。
- **首屏入场**：`translateY(12px) + opacity:0 → 1`，卡片按索引 28ms 递进（CSS `--i` 变量控制 `transition-delay`），第 8 张起不再延迟（长列表保护）；仅首屏可视卡片参与，Tab 切换不重播。
- 批量模式勾选：勾选路径 `stroke-dashoffset` 描画动画 + 胶囊底 `--ease-spring` 缩放。
- 长按/滑动逻辑（touch 事件绑定）完全不动——hover 效果不改变命中区域与事件行为。

### 5.4 FAB —— 墨色晶体的光学升级

- 墨色纵向微渐变（`#2A2A2E → #1A1A1E`）+ `inset` 顶部高光 = 墨色晶体；
- hover：`scale(1.06)` + 阴影扩散；active：`scale(0.94)`；
- 页面进入：`scale(0) → 1` 弹性入场（`--ease-spring`，300ms，延迟 100ms 错峰）；
- 滚动联动：向下滚动时 `translateY(+120%)` 沉底隐藏、向上滚动回浮（见 §6.4）。

### 5.5 Modal —— 玻璃卡片 + 背景景深

- 遮罩：`rgba(20,20,24,0.32)` + `backdrop-filter: blur(8px)`（背景内容虚化，聚焦对话）；
- 卡片：G2 玻璃、圆角 20px；入场 `scale(0.92)→1 + fade`，`--ease-decelerate` 240ms；退出 200ms `--ease-accelerate`（现仅 200ms ease-out 单曲线）；
- 按钮体系：主按钮墨色胶囊（高 44px、圆角 12px）、次按钮 `--surface-2`、危险按钮语义红；hover 亮度 +4%，active scale 0.97。

### 5.6 Toast —— 深色玻璃胶囊

- `rgba(28,28,32,0.82)` + `blur(16px)` + 上缘微高光；圆角 999px；进出保持现有位移方向，曲线统一为 `--ease-standard`；多条时纵向堆叠（现有逻辑不变，仅容器布局）。

### 5.7 SyncSettings 弹层

- Sheet：G2 玻璃 + 顶部 36×4px grabber 把手（暗示可拖动关闭的视觉语言，本期不做拖拽逻辑）；桌面对话框化保持现有断点行为；
- 输入框：focus 态描边换 `--brand-hue` + 外扩 `--brand-hue-soft` 光环，替代纯黑描边。

### 5.8 TagChipNav / TagSelector

- 选中 chip：G3 玻璃白底 + 原色系描边保留；
- 横向溢出边缘加 `mask-image` 线性渐隐，提示可滑动（现状内容被硬切断）；
- TagSelector 选中态：色环 `scale` 扩散动画替代瞬间跳变，✓ 描画动画同 NoteCard。

### 5.9 EmptyState / BatchActionBar / 加载态

- EmptyState：图标 6s `float` 漂浮微动（`translateY ±4px`，reduced-motion 下停用）+ 首次入场 fade-rise；
- BatchActionBar：G1 玻璃化，下滑入场改 `--ease-decelerate`，计数数字启用 `tabular-nums`；
- 加载态：`加载中...` 升级为呼吸圆点动画（纯 CSS）。

### 5.10 NoteEditPage

- 顶栏/底栏滚动玻璃化（同 5.2）；
- 正文排版维持现有桌面增强（26px 标题 / 17px 正文 1.9 行高），行高与字距并入字体令牌；
- 底栏操作按钮 hover/active 三态补全（现有桌面 hover 保留，统一令牌曲线）。

---

## 6. 交互动效系统

### 6.1 页面过渡（列表 ⇄ 编辑）

- **进入**：编辑页 `translateX(100%)→0`，`--dur-page` + `--ease-decelerate`（先快后缓，符合「内容到达」心智）；列表页同步 `scale(0.96) + opacity 0.7` 制造后退景深（现为 0.98/0.85，拉开层次）；
- **返回**：280ms `--ease-accelerate`（先缓后快，内容快速让路）；松手跟手拖拽（useSwipeBack）保持不变，仅将松手过渡曲线与上述统一（`RELEASE_DURATION` 与 easing 常量对齐令牌）；
- **阴影景深**：编辑页大投影经伪元素预渲染、随过渡 `opacity` 渐显（替代 box-shadow 过渡）；
- Tab 切换（随想/学习/待办/标签）：内容区 150ms cross-fade（现有为无过渡的瞬间切换）。

### 6.2 进出场编排原则

- 进入自预期方向（下级页面自右、弹层自下、卡片自下微升）；退出向来路方向；
- 同屏多元素按 28ms 阶梯错峰，总量 ≤ 8 个参与编排；
- 弹层类（Modal/Sheet）退出动画完整播完再卸载（现有 SyncSettings/Modal 均为条件渲染直接卸载——**仅补退出动画 class，不改卸载时机逻辑**，详见 §8 风险）。

### 6.3 三态反馈矩阵（全组件覆盖）

| 状态 | 规范 | 时长/曲线 |
|---|---|---|
| hover | 仅 `@media (hover:hover)` 内生效；`transform` 位移/缩放或伪元素 opacity 变化 | 120–150ms / standard |
| active | 触屏与鼠标通用；`scale(0.96~0.985)` 收缩 | ≤100ms / standard |
| focus-visible | 2px `--brand-hue` 外环 + 2px offset；仅键盘触发 | 即时 |

> 所有 hover 规则包裹 `@media (hover: hover) and (pointer: fine)`，触屏设备不背 hover 包袱、不出现「粘滞高亮」。

### 6.4 滚动联动

| 场景 | 效果 | 实现 |
|---|---|---|
| 顶栏 | 滚动 >8px 玻璃化 + 分割线渐显 | CSS `animation-timeline: scroll()`，降级 JS class |
| FAB | 下滑沉底隐藏 / 上滑回浮 | rAF 节流方向判定（新增独立 hook），`transform + opacity` |
| 卡片 | 进入视口时 fade-rise（300ms） | CSS `animation-timeline: view()`，`@supports` 不支持则直接显示 |
| 下拉刷新 | 文案指示升级为描边进度环，随拉动填充 | 现有拉动逻辑不动，仅替换指示器视觉（SVG `stroke-dashoffset`） |
| TabBar | 列表触及底部时浮岛轻微下沉 4px（呼吸感） | `animation-timeline: scroll()`，可选 |

### 6.5 手势协同（零改动声明）

侧滑返回、长按多选、下拉刷新、popstate 集成等既有手势逻辑**一字不改**；所有新动效不新增全局监听（除滚动联动的 passive 监听）、不改变事件命中区域、不遮挡 `touch-action`。

---

## 7. 性能保障（60fps 硬约束）

1. **只动 `transform/opacity`**：阴影经伪元素预渲染切换；颜色/背景过渡控制在非滚动场景（hover、focus）。
2. **`backdrop-filter` 限流**：同屏 ≤3（§4.3），列表卡片实体化。
3. **`will-change` 按需**：仅动画进行期间（class 切换控制），避免常驻合成层内存开销。
4. **滚动监听全部 `passive` + rAF 节流**，一帧内合并读写。
5. **长列表保护**：stagger 编排仅首屏；`animation-timeline` 降级直显；不引入逐卡片 JS 计时。
6. **`prefers-reduced-motion: reduce`**：全局关闭位移/缩放动画，仅保留 opacity 过渡，时长压缩至 100ms 内。
7. **验收指标**：过渡期间帧率 ≥55fps（DevTools Performance，4x CPU 节流）；滚动无长任务（>50ms）；Lighthouse Performance 不低于现状（≥90）；CLS = 0（所有动效零布局位移）。

---

## 8. 兼容性

| 特性 | Chrome/Edge | Safari | Firefox | 降级 |
|---|---|---|---|---|
| backdrop-filter | 76+ ✓ | 9+（-webkit-）✓ | 103+ ✓ | 实底 0.96（@supports） |
| animation-timeline | 115+ ✓ | 26+ ◐ | ◐ | JS class / 直接显示 |
| :focus-visible | ✓ | ✓ | ✓ | — |
| tabular-nums | ✓ | ✓ | ✓ | — |
| @media (hover) | ✓ | ✓ | ✓ | — |

目标：最近两个大版本主流浏览器；移动端保留现有 safe-area 冻结机制（`main.tsx` 逻辑不动）。

---

## 9. 实施路线图（四个可独立验收的阶段）

### Phase 1 —— 令牌地基（低风险）
- 新建 `src/styles/tokens.css` 并在 `main.tsx` 引入（+1 行）；
- 全部组件 CSS 硬编码色值迁移至令牌；删除死文件 `src/index.css`；清理 `constants.ts` 死令牌（`COLORS`/`ANIMATION_DURATION`），`TAG_COLORS` 对齐新色值；
- **验收**：像素级回归（改动前后截图 diff 仅允许色值等价偏移），零布局变化。

### Phase 2 —— 玻璃材质
- 环境氛围光背景；TabBar 浮岛化；三个顶栏滚动玻璃化；Modal/Sheet/Toast 玻璃化；FAB 墨晶化；`@supports` 降级。
- **验收**：玻璃元素同屏 ≤3；低端设备（4x CPU 节流）滚动 ≥55fps。

### Phase 3 —— 动效系统
- 动效令牌全量替换；页面过渡曲线升级；三态反馈矩阵补全（含 focus-visible、reduced-motion）；卡片/弹层/Toast 编排动画。
- **验收**：动效清单逐项过检（§6.3 矩阵）；键盘 Tab 导航全程可见焦点。

### Phase 4 —— 滚动联动与打磨
- 顶栏/FAB/卡片/下拉指示滚动联动；TabBar 呼吸感；（可选加分项）`prefers-color-scheme` 暗色模式——令牌化后仅需一组变量覆盖 + 玻璃暗色配方，成本极低。
- **验收**：全量回归 + 性能指标达标（§7.7）。

### 文件改动预估

| 类型 | 文件 | 性质 |
|---|---|---|
| 新增 | `src/styles/tokens.css`、`src/hooks/useScrollState.ts`（若不用纯 CSS 路线） | 样式/表现层 |
| 修改 | 14 个组件 CSS + `App.css` | 纯样式 |
| 微调 | `NoteCard.tsx` 等 3–4 个 TSX（新增 className/aria、stagger 索引变量） | 不动逻辑 |
| 对齐 | `constants.ts`（TAG_COLORS 色值）、`useSwipeBack.ts`（仅 easing 常量对齐令牌数值） | 样式常量 |
| 删除 | `src/index.css` | 死文件 |
| 不动 | `App.tsx` 状态机/popstate/手势、`db/`、`sync/`、`utils/` 业务 | **零业务变更** |

### 风险与规避

| 风险 | 规避 |
|---|---|
| 玻璃化顶栏在长列表滚动掉帧 | 顶栏 sticky + 限流；性能预算卡口，不达标回退实底 |
| Modal/Sheet 退出动画与条件渲染卸载时机 | 本期不改编卸载逻辑，退出动画作为 Phase 3 单独验证项，异常即回退「直接卸载」 |
| TabBar 浮岛化影响各页 `padding-bottom` 计算 | Phase 2 集中校对三个页面滚动区留白，逐页截图验收 |
| 动效与长按/侧滑手势冲突 | 动效只用 transform/opacity，不碰事件与命中区域；真机回归长按多选与侧滑返回 |

---

## 10. 验收清单

**视觉**
- [ ] 全站无硬编码色值，统一引用令牌
- [ ] 玻璃三层层级清晰，文字对比度 ≥4.5:1
- [ ] 排版遵循字体阶梯，时间/计数 tabular-nums

**动效**
- [ ] 时长/曲线全站仅用 4 档令牌
- [ ] 页面过渡、Tab 切换、三态反馈、滚动联动逐项生效
- [ ] `prefers-reduced-motion` 下动画收敛

**玻璃**
- [ ] 同屏 backdrop-filter ≤3，卡片为实体材质
- [ ] 不支持浏览器实底降级无破相

**性能**
- [ ] 4x CPU 节流下过渡 ≥55fps、滚动无长任务
- [ ] CLS = 0，Lighthouse ≥90

**兼容**
- [ ] Chrome / Edge / Safari / Firefox 最新两个大版本过检
- [ ] 触屏（无粘滞 hover）、鼠标、键盘三模式可用

**业务回归（零变更证明）**
- [ ] 笔记增删改查、标签、批量操作、同步、返回保存链路全部回归通过
- [ ] 长按多选、侧滑返回、下拉刷新、popstate 返回行为与现状一致
