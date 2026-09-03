# 项目长期记忆（shiji / ynote）

## 协作约定

- **代码改完必须直接 commit + push**（`AGENTS.md` 中的 MUST 规则，2026-09-03 由用户加入）。
  不要等用户说"提交/推送"，改完即推；提交格式 `type(scope): 中文描述`。
  推送机制见用户级记忆（HTTPS + `127.0.0.1:7888` 代理）。
- `AGENTS.md` 是协作规范的唯一来源，每轮会自动注入上下文；本文件只做索引，
  不复制其条文，避免两处不一致。

## 技术栈

- React 19 + TypeScript + Vite 8，IndexedDB（idb）本地存储，Tiptap v3 编辑器。
- 移动端优先的 H5 应用，≥768px 有桌面端适配（内容列 768px 居中 + 卡片双列网格）。

## 已知易踩的坑

- **桌面双列网格用 `minmax(0, 1fr)`，不要用 `1fr`**；卡片内 nowrap 文本必须配
  `min-width: 0`。否则 min-content 撑爆列轨 → 横向滚动条。（2026-09-03 已修复）
- 只写 `overflow-y: auto` 的容器，`overflow-x` 会计算成 `auto`，横向也会出滚动条。
- `.app-page-list` 有 `transform`，会成为其内部 `position: fixed` 元素（如
  `.note-list-header`）的 containing block —— 所以顶栏是相对 768px 内容列定位的，
  不是相对视口。改动顶栏/浮层定位时要注意这点。
- 本机沙箱下 `git update-ref` 写 `.git/refs/remotes/**` 会被静默丢弃，push 后
  `origin/main` 可能仍是旧值。直接编辑 `.git/packed-refs` 修正。
- `.app-page-edit` 带 `transform`，会作为内部 `position: fixed` 元素（`.note-edit-page`）的
  containing block。如果给它同时写 `overflow-y: auto`，内部内容撑高后就容易形成
  **外层滚动条嵌套**，滚动外层还会把 fixed 内容一起带上去，露出空白。编辑页只保留
  `.note-edit-content` 一个滚动容器即可，`.app-page-edit` 应 `overflow: hidden`。

## 诊断工具

- 横向溢出/布局问题用无头浏览器实测，技能见
  `~/.workbuddy/skills/browser-overflow-diagnosis/`（playwright-core + 本机 Chrome
  的 `executablePath`，扫 `scrollWidth - clientWidth`）。
