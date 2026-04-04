# 拾记 - 本地笔记 PWA

一款**零联网、零注册、零服务器**的极简本地笔记工具。打开即用，数据完全驻留在用户设备上。

## 功能特性

### 核心功能
- **纯本地存储**：使用 IndexedDB，数据完全保存在设备本地
- **零网络依赖**：无需网络连接，离线可用
- **分类管理**：支持随想、学习、待办三种分类
- **颜色标签**：红、橙、黄、灰四色标签，便于分类筛选
- **批量操作**：长按进入批量模式，支持多选删除
- **自动保存**：编辑时自动保存，防止数据丢失

### 界面设计
- **极简风格**：纯净、留白充足、无多余装饰
- **触控优化**：所有可点击元素 ≥ 48×48px
- **流畅动效**：页面切换、Toast、弹窗均有流畅动画
- **响应式布局**：适配 360px ~ 412px 屏幕宽度

## 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite 8
- **数据存储**：IndexedDB (idb 库封装)
- **PWA**：vite-plugin-pwa
- **样式**：纯 CSS，无 UI 框架依赖

## 项目结构

```
src/
├── components/          # UI 组件
│   ├── BatchActionBar/  # 批量操作栏
│   ├── EmptyState/      # 空状态组件
│   ├── FAB/             # 浮动操作按钮
│   ├── Modal/           # 弹窗组件
│   ├── NoteCard/        # 笔记卡片
│   ├── TabBar/          # 底部 Tab 导航
│   ├── TagChipNav/      # 标签页 Chip 导航
│   ├── TagSelector/     # 颜色标签选择器
│   └── Toast/           # Toast 提示
├── db/                  # IndexedDB 数据层
├── pages/               # 页面组件
│   ├── NoteListPage/    # 笔记列表页
│   ├── TagsPage/        # 标签页
│   └── NoteEditPage/    # 笔记编辑/详情页
├── types/               # TypeScript 类型定义
├── utils/               # 工具函数
│   ├── constants.ts     # 常量定义
│   └── time.ts          # 时间格式化
├── App.tsx              # 主应用组件
└── main.tsx             # 入口文件
```

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 数据模型

### Note (笔记)
```typescript
{
  id: string;           // 主键，UUID 生成
  title: string;        // 标题，最大 100 字符
  content: string;      // 正文，最大 50,000 字符
  category: 'impromptu' | 'study' | 'todo';  // 分类
  tagColor: 'red' | 'orange' | 'yellow' | 'gray' | null;  // 标签颜色
  createdAt: number;    // 创建时间戳
  updatedAt: number;    // 最后修改时间戳
  isDeleted: boolean;   // 软删除标记
}
```

## 浏览器兼容性

- Chrome 80+
- Edge 80+
- 支持 PWA 的移动端浏览器

## 安装为 PWA

1. 在 Chrome/Edge 中打开应用
2. 点击地址栏右侧的「安装」图标
3. 或在菜单中选择「添加到主屏幕」

## 注意事项

- 数据存储在浏览器 IndexedDB 中，清除浏览器数据会导致数据丢失
- 建议定期导出重要笔记（后续版本将支持导出功能）
- 单条笔记内容上限 50,000 字符，标题上限 100 字符

## 许可证

MIT License
