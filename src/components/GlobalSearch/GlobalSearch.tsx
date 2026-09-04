import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Note } from '../../types';
import { CATEGORIES, TAG_COLORS } from '../../utils/constants';
import { markdownToPlainText } from '../../utils/markdown';
import { formatRelativeTime } from '../../utils/time';
import './GlobalSearch.css';

interface GlobalSearchProps {
  /** 全部笔记（含各分类与标签页），作为搜索范围 */
  notes: Note[];
  /** 软键盘遮挡高度（px）：弹层据此收缩，输入区与结果不被键盘压住 */
  keyboardInset: number;
  onViewNote: (note: Note) => void;
}

interface SearchResult {
  note: Note;
  /** 卡片展示标题（无标题时取正文前 20 字，与 NoteCard 一致） */
  title: string;
  /** 命中片段：正文命中处前后上下文；仅标题命中时为正文开头 */
  snippet: string;
}

/** 命中片段：命中词前 / 后保留的字符数 */
const SNIPPET_BEFORE = 16;
const SNIPPET_AFTER = 44;
/** 仅标题命中时的兜底片段长度 */
const SNIPPET_FALLBACK = 60;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 按关键词切分文本，命中部分标记 hit（大小写不敏感） */
function splitByKeyword(text: string, keyword: string): { text: string; hit: boolean }[] {
  if (!keyword) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  const re = new RegExp(escapeRegExp(keyword), 'gi');
  let last = 0;
  let match = re.exec(text);
  while (match !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), hit: false });
    }
    parts.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
    // 零宽匹配兜底，避免死循环
    if (match[0].length === 0) re.lastIndex += 1;
    match = re.exec(text);
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/** 正文 → 单行片段：命中处居中截断，命中词不在正文内时退回开头 */
function buildSnippet(plainText: string, keyword: string): string {
  const oneLine = plainText.replace(/\s+/g, ' ').trim();
  if (!oneLine) return '';
  const hitIndex = oneLine.toLowerCase().indexOf(keyword.toLowerCase());
  if (hitIndex < 0) {
    return oneLine.length > SNIPPET_FALLBACK
      ? `${oneLine.slice(0, SNIPPET_FALLBACK)}…`
      : oneLine;
  }
  const start = Math.max(0, hitIndex - SNIPPET_BEFORE);
  const end = Math.min(oneLine.length, hitIndex + keyword.length + SNIPPET_AFTER);
  return `${start > 0 ? '…' : ''}${oneLine.slice(start, end)}${end < oneLine.length ? '…' : ''}`;
}

/** 文本 + 关键词 → 命中高亮片段 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  return (
    <>
      {splitByKeyword(text, keyword).map((part, i) =>
        part.hit ? (
          <mark key={i} className="global-search-hit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

export function GlobalSearch({ notes, keyboardInset, onViewNote }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 正文纯文本化较重，且只随笔记变化；与关键词解耦，避免每次输入重算
  const indexed = useMemo(
    () =>
      notes.map((note) => {
        const plain = markdownToPlainText(note.content);
        return { note, title: note.title || plain.slice(0, 20), plain };
      }),
    [notes]
  );

  const trimmed = keyword.trim();

  const results = useMemo<SearchResult[]>(() => {
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();
    const out: SearchResult[] = [];
    for (const item of indexed) {
      if (
        item.title.toLowerCase().includes(lower) ||
        item.plain.toLowerCase().includes(lower)
      ) {
        out.push({ note: item.note, title: item.title, snippet: buildSnippet(item.plain, trimmed) });
      }
    }
    return out;
  }, [indexed, trimmed]);

  const close = useCallback(() => {
    setIsOpen(false);
    setKeyword('');
  }, []);

  // Esc 关闭（桌面端）
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // 打开后聚焦输入框（点击属于用户手势，移动端可唤起软键盘）
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // 换关键词后结果集整体变化，回到顶部（否则停留在上一段结果的滚动位置）
  useEffect(() => {
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  }, [trimmed]);

  const handlePick = useCallback(
    (note: Note) => {
      close();
      onViewNote(note);
    },
    [close, onViewNote]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 回车直达第一条结果
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handlePick(results[0].note);
      }
    },
    [results, handlePick]
  );

  const clearKeyword = useCallback(() => {
    setKeyword('');
    inputRef.current?.focus();
  }, []);

  return (
    <>
      <button
        type="button"
        className="global-search-btn"
        onClick={() => setIsOpen(true)}
        aria-label="搜索笔记"
        title="搜索笔记"
      >
        <SearchIcon />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="global-search-overlay"
            style={{ bottom: keyboardInset }}
            onClick={close}
          >
            <div
              className="global-search-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="搜索笔记"
            >
              <div className="global-search-field">
                <span className="global-search-field-icon">
                  <SearchIcon />
                </span>
                <input
                  ref={inputRef}
                  className="global-search-input"
                  type="search"
                  value={keyword}
                  placeholder="搜索标题与正文"
                  autoComplete="off"
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                />
                {keyword && (
                  <button
                    type="button"
                    className="global-search-clear"
                    onClick={clearKeyword}
                    aria-label="清空关键词"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="global-search-results" ref={resultsRef}>
                {!trimmed ? (
                  <p className="global-search-hint">输入关键词，搜索全部笔记的标题与正文</p>
                ) : results.length === 0 ? (
                  <p className="global-search-hint">没有匹配的笔记</p>
                ) : (
                  <>
                    <div className="global-search-count">找到 {results.length} 条</div>
                    <ul className="global-search-list">
                      {results.map(({ note, title, snippet }) => {
                        const category = CATEGORIES.find((c) => c.key === note.category);
                        const tagColor = note.tagColor
                          ? TAG_COLORS.find((c) => c.key === note.tagColor)?.value
                          : null;
                        return (
                          <li key={note.id}>
                            <button
                              type="button"
                              className="global-search-item"
                              onClick={() => handlePick(note)}
                            >
                              <div className="global-search-item-title">
                                <Highlight text={title} keyword={trimmed} />
                              </div>
                              {snippet && (
                                <div className="global-search-item-snippet">
                                  <Highlight text={snippet} keyword={trimmed} />
                                </div>
                              )}
                              <div className="global-search-item-meta">
                                {tagColor && (
                                  <span
                                    className="global-search-item-dot"
                                    style={{ background: tagColor }}
                                  />
                                )}
                                {category?.label}
                                {' · '}
                                {formatRelativeTime(note.updatedAt)}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
