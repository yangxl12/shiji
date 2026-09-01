import { useState } from 'react';
import {
  getSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  getLastSyncTime,
} from '../../sync/gist';
import './SyncSettings.css';

export type SyncStatus = 'unconfigured' | 'idle' | 'syncing' | 'ok' | 'error';

interface SyncSettingsProps {
  isOpen: boolean;
  syncStatus: SyncStatus;
  onClose: () => void;
  /** 手动触发一次完整同步（拉取 + 合并 + 推送） */
  onManualSync: () => void;
  /** 保存配置后触发（App 执行首次同步） */
  onConfigSaved: () => void;
  /** 清除配置后触发 */
  onConfigCleared: () => void;
}

function formatSyncTime(ts: number | null): string {
  if (ts === null) return '从未同步';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SyncSettings({
  isOpen,
  syncStatus,
  onClose,
  onManualSync,
  onConfigSaved,
  onConfigCleared,
}: SyncSettingsProps) {
  // 初始值取自已保存配置；面板常驻（关闭仅隐藏），输入内容在开关间保留
  const [token, setToken] = useState(() => getSyncConfig()?.token ?? '');
  const [gistId, setGistId] = useState(() => getSyncConfig()?.gistId ?? '');

  if (!isOpen) return null;

  // 渲染时直接读取，syncStatus 变化触发重渲染即可刷新时间
  const lastSync = getLastSyncTime();

  const isConfigured = syncStatus !== 'unconfigured';
  const canSave = token.trim().length > 0 && gistId.trim().length > 0;
  const isSyncing = syncStatus === 'syncing';

  const statusText = (() => {
    if (!isConfigured) return '未配置';
    if (isSyncing) return '同步中…';
    if (syncStatus === 'error') return '同步失败，可点击"立即同步"重试';
    return `上次同步：${formatSyncTime(lastSync)}`;
  })();

  const handleSave = () => {
    saveSyncConfig({ token: token.trim(), gistId: gistId.trim() });
    onConfigSaved();
  };

  const handleClear = () => {
    clearSyncConfig();
    setToken('');
    setGistId('');
    onConfigCleared();
  };

  return (
    <div className="sync-overlay" onClick={onClose}>
      <div className="sync-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sync-sheet-grabber" aria-hidden="true" />
        <div className="sync-sheet-header">
          <h3 className="sync-sheet-title">多端同步</h3>
          <button className="sync-close-btn" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className={`sync-status ${syncStatus === 'error' ? 'sync-status-error' : ''}`}>
          {statusText}
        </div>

        <div className="sync-field">
          <label className="sync-field-label" htmlFor="sync-token">Personal Access Token</label>
          <input
            id="sync-token"
            className="sync-input"
            type="password"
            value={token}
            placeholder="ghp_ 开头的 Token（只需 gist 权限）"
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <div className="sync-field">
          <label className="sync-field-label" htmlFor="sync-gist-id">Gist ID</label>
          <input
            id="sync-gist-id"
            className="sync-input"
            type="text"
            value={gistId}
            placeholder="Gist 网址最后一段字符"
            autoComplete="off"
            onChange={(e) => setGistId(e.target.value)}
          />
        </div>

        <button
          className="sync-btn sync-btn-primary"
          disabled={!canSave || isSyncing}
          onClick={handleSave}
        >
          保存并同步
        </button>

        {isConfigured && (
          <div className="sync-action-row">
            <button
              className="sync-btn sync-btn-secondary"
              disabled={isSyncing}
              onClick={onManualSync}
            >
              {isSyncing ? '同步中…' : '立即同步'}
            </button>
            <button className="sync-btn sync-btn-text-danger" disabled={isSyncing} onClick={handleClear}>
              清除配置
            </button>
          </div>
        )}

        <details className="sync-help">
          <summary>如何获取 Token 和 Gist ID？</summary>
          <div className="sync-help-body">
            <p>1. 打开 gist.github.com，输入任意文件名和内容，点 Create <strong>secret</strong> gist，网址最后一段就是 Gist ID。</p>
            <p>2. 打开 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)，只勾选 <strong>gist</strong> 权限，生成后复制 Token。</p>
            <p>3. 将两者填入上方保存即可。数据以 JSON 形式存放在你自己的 Secret Gist 中，仅在你配置过的设备间同步。</p>
            <p>说明：笔记变更后会自动推送（有几秒延迟）；每次打开应用会自动拉取云端最新数据；多端同时编辑同一条笔记时，保留最后修改的版本。</p>
          </div>
        </details>
      </div>
    </div>
  );
}
