import type { TabType } from '../../types';
import './TabBar.css';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const ImpromptuIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2zm4 8h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

const StudyIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
  </svg>
);

const TodoIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);

const TagIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
  </svg>
);

const TAB_ICONS: Record<TabType, React.FC> = {
  impromptu: ImpromptuIcon,
  study: StudyIcon,
  todo: TodoIcon,
  tags: TagIcon,
};

const TAB_LABELS: Record<TabType, string> = {
  impromptu: '随想',
  study: '学习',
  todo: '待办',
  tags: '标签',
};

const ALL_TABS: TabType[] = ['impromptu', 'study', 'todo', 'tags'];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {ALL_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const isActive = activeTab === tab;
        return (
          <div
            key={tab}
            className={`tab-item ${isActive ? 'tab-active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            <div className="tab-icon">
              <Icon />
            </div>
            <span className="tab-label">{TAB_LABELS[tab]}</span>
          </div>
        );
      })}
    </nav>
  );
}
