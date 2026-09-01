# 拾记 - 本地笔记 PWA

一款**零联网、零注册、零服务器**的极简本地笔记工具。打开即用，数据完全驻留在用户设备上。

## 功能特性

### 核心功能
- **纯本地存储**：基于 IndexedDB，数据完全保存在设备本地
- **零网络依赖**：无需网络连接，离线可用（PWA + Service Worker 缓存）
- **分类管理**：随想、学习、待办三种分类，另有独立标签页
- **颜色标签**：红、橙、黄、灰四色标签，标签页支持按颜色筛选与"全部"视图
- **批量操作**：点击列表头部按钮进入多选模式，支持全选、批量删除
- **自动保存**：停止输入 3 秒后自动保存；所有返回路径（应用内按钮、侧滑手势、系统/浏览器返回）均先保存再关闭，防止数据丢失
- **Markdown 导出**：一键导出全部笔记为 Markdown 文件，超过 2MB 自动分卷

### 交互设计
- **卡片左滑删除**：左滑露出删除按钮，快速滑动直接触发
- **边缘侧滑返回**：编辑页左缘右滑跟手拖拽返回，与安卓系统返回手势共存
- **下拉回弹**：列表顶部下拉的弹性滚动效果
- **流畅动效**：页面滑入滑出、Toast、弹窗均有自然过渡动画
- **触控优化**：所有可点击元素 ≥ 48×48px，适配 360px ~ 412px 屏幕宽度

## 技术栈

- **框架**：React 19 + TypeScript 5.9
- **构建工具**：Vite 8
- **数据存储**：IndexedDB（idb 库封装）
- **PWA**：vite-plugin-pwa（Service Worker 自动更新）
- **样式**：纯 CSS，无 UI 框架依赖

## 项目结构

```
src/
├── components/          # UI 组件
│   ├── BatchActionBar/  # 批量操作栏
│   ├── EmptyState/      # 空状态组件
│   ├── FAB/             # 浮动操作按钮
│   ├── Modal/           # 弹窗组件
│   ├── NoteCard/        # 笔记卡片（左滑删除、多选）
│   ├── TabBar/          # 底部 Tab 导航
│   ├── TagChipNav/      # 标签页 Chip 导航
│   ├── TagSelector/     # 颜色标签选择器
│   └── Toast/           # Toast 提示
├── db/                  # IndexedDB 数据层（CRUD、软删除、批量操作）
├── hooks/
│   └── useSwipeBack.ts  # 左缘右滑返回手势
├── pages/               # 页面组件
│   ├── NoteListPage/    # 笔记列表页
│   ├── TagsPage/        # 标签页（筛选、导出）
│   └── NoteEditPage/    # 笔记编辑/详情页
├── types/               # TypeScript 类型定义
├── utils/
│   ├── constants.ts     # 常量（颜色、动画时长、长度上限）
│   ├── export.ts        # Markdown 导出与分卷
│   └── time.ts          # 时间格式化
├── App.tsx              # 主应用组件（状态管理、页面切换、返回手势集成）
└── main.tsx             # 入口文件
```

## 架构要点

- **双页架构**：列表页与编辑页常驻 DOM，通过 CSS 过渡控制滑入滑出，保证动画流畅
- **状态管理**：无外部状态库，全部状态集中于 `App.tsx`
- **数据层收敛**：所有 IndexedDB 操作集中在 `src/db/index.ts`，含标题/内容长度校验与自动截断
- **软删除**：笔记使用 `isDeleted` 标记，不做物理删除
- **返回手势集成**：打开编辑页时压入 history 记录，系统返回/浏览器返回/应用内返回统一走 popstate + 滑出动画

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本（tsc + vite build）
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 数据模型

### Note (笔记)
```typescript
{
  id: string;           // 主键，UUID 生成
  title: string;        // 标题，最大 100 字符
  content: string;      // 正文，最大 50,000 字符
  category: 'impromptu' | 'study' | 'todo';        // 分类
  tagColor: 'red' | 'orange' | 'yellow' | 'gray' | null;  // 标签颜色
  createdAt: number;    // 创建时间戳
  updatedAt: number;    // 最后修改时间戳
  isDeleted: boolean;   // 软删除标记
}
```

## 安装为 PWA

1. 在 Chrome/Edge 中打开应用
2. 点击地址栏右侧的「安装」图标
3. 或在菜单中选择「添加到主屏幕」

## 注意事项

- 数据存储在浏览器 IndexedDB 中，清除浏览器数据会导致数据丢失
- 建议定期使用标签页的导出功能备份重要笔记
- 单条笔记内容上限 50,000 字符，标题上限 100 字符，超长自动截断并提示

## 许可证

MIT License
