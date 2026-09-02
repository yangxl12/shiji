import { useState } from 'react';
import type { AIModelConfig } from '../../types';
import {
  getAIModels,
  saveAIModel,
  deleteAIModel,
  getActiveAIModelId,
  setActiveAIModel,
} from '../../ai/config';
import { testAIConnection } from '../../ai/client';
import { Modal } from '../Modal/Modal';
import './AISettings.css';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

/** 表单状态：id 为 null 表示新增 */
interface ModelFormState {
  id: string | null;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const EMPTY_FORM: ModelFormState = { id: null, name: '', baseUrl: '', apiKey: '', model: '' };

/** 表单测试连接使用的临时 id（与列表行测试互斥） */
const DRAFT_TEST_ID = '__draft__';

function generateModelId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function AISettings({ isOpen, onClose, onToast }: AISettingsProps) {
  // 初始值取自已保存配置；面板常驻（关闭仅隐藏），列表数据每次打开时刷新
  const [models, setModels] = useState<AIModelConfig[]>(() => getAIModels());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveAIModelId());
  const [form, setForm] = useState<ModelFormState | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIModelConfig | null>(null);

  if (!isOpen) return null;

  const refresh = () => {
    setModels(getAIModels());
    setActiveId(getActiveAIModelId());
  };

  const handleSelect = (model: AIModelConfig) => {
    if (activeId === model.id) return;
    setActiveAIModel(model.id);
    refresh();
    onToast(`已切换为 ${model.name}`);
  };

  const handleStartEdit = (model: AIModelConfig) => {
    setTestingId(null);
    setForm({ id: model.id, name: model.name, baseUrl: model.baseUrl, apiKey: model.apiKey, model: model.model });
  };

  const canSaveForm =
    form !== null &&
    form.name.trim().length > 0 &&
    form.baseUrl.trim().length > 0 &&
    form.apiKey.trim().length > 0 &&
    form.model.trim().length > 0;

  const handleSaveForm = () => {
    if (!form || !canSaveForm) return;
    saveAIModel({
      id: form.id ?? generateModelId(),
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
    });
    setForm(null);
    refresh();
    onToast(form.id ? '模型已更新' : '模型已添加');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteAIModel(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    onToast('模型已删除');
  };

  const runTest = async (model: AIModelConfig) => {
    if (testingId) return;
    setTestingId(model.id);
    try {
      await testAIConnection(model);
      onToast(`${model.name} 连接成功`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : '连接失败');
    } finally {
      setTestingId(null);
    }
  };

  const runTestForm = async () => {
    if (!form || !canSaveForm) return;
    await runTest({
      id: DRAFT_TEST_ID,
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
    });
  };

  return (
    <div className="sync-overlay" onClick={onClose}>
      <div className="sync-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sync-sheet-grabber" aria-hidden="true" />
        <div className="sync-sheet-header">
          <h3 className="sync-sheet-title">AI 模型设置</h3>
          <button className="sync-close-btn" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {form === null ? (
          <>
            <div className="sync-status">
              {models.length === 0
                ? '尚未配置模型，添加一个支持 OpenAI 协议的服务即可使用 AI 优化'
                : `已配置 ${models.length} 个模型，点击可切换当前使用的模型`}
            </div>

            <div className="ai-model-list">
              {models.map((m) => (
                <div
                  key={m.id}
                  className={`ai-model-item${activeId === m.id ? ' is-active' : ''}`}
                  onClick={() => handleSelect(m)}
                >
                  <div className="ai-model-item-head">
                    <span className="ai-model-radio" aria-hidden="true" />
                    <span className="ai-model-name">{m.name}</span>
                    {activeId === m.id && <span className="ai-model-active-tag">使用中</span>}
                  </div>
                  <div className="ai-model-meta">{m.model} · {m.baseUrl}</div>
                  <div className="ai-model-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="ai-mini-btn"
                      disabled={testingId !== null}
                      onClick={() => void runTest(m)}
                    >
                      {testingId === m.id ? '测试中…' : '测试'}
                    </button>
                    <button className="ai-mini-btn" disabled={testingId !== null} onClick={() => handleStartEdit(m)}>
                      编辑
                    </button>
                    <button
                      className="ai-mini-btn ai-mini-btn-danger"
                      disabled={testingId !== null}
                      onClick={() => setDeleteTarget(m)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="sync-btn sync-btn-primary" onClick={() => setForm({ ...EMPTY_FORM })}>
              添加模型
            </button>

            <details className="sync-help">
              <summary>常见服务商示例与说明</summary>
              <div className="sync-help-body">
                <p>DeepSeek：API 地址 <strong>https://api.deepseek.com/v1</strong>，模型 <strong>deepseek-chat</strong></p>
                <p>智谱 GLM：API 地址 <strong>https://open.bigmodel.cn/api/paas/v4</strong>，模型如 <strong>glm-4-flash</strong></p>
                <p>OpenAI：API 地址 <strong>https://api.openai.com/v1</strong>，模型如 <strong>gpt-4o-mini</strong></p>
                <p>说明：配置仅保存在本设备浏览器中，不上传云端；AI 优化仅覆盖笔记正文，可通过撤销恢复。</p>
              </div>
            </details>
          </>
        ) : (
          <>
            <div className="sync-field">
              <label className="sync-field-label" htmlFor="ai-name">名称</label>
              <input
                id="ai-name"
                className="sync-input"
                type="text"
                value={form.name}
                placeholder="如 DeepSeek"
                autoComplete="off"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="sync-field">
              <label className="sync-field-label" htmlFor="ai-base-url">API 地址（Base URL）</label>
              <input
                id="ai-base-url"
                className="sync-input"
                type="text"
                value={form.baseUrl}
                placeholder="https://api.deepseek.com/v1"
                autoComplete="off"
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>

            <div className="sync-field">
              <label className="sync-field-label" htmlFor="ai-key">API Key</label>
              <input
                id="ai-key"
                className="sync-input"
                type="password"
                value={form.apiKey}
                placeholder="sk- 开头的密钥"
                autoComplete="off"
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </div>

            <div className="sync-field">
              <label className="sync-field-label" htmlFor="ai-model">模型 ID</label>
              <input
                id="ai-model"
                className="sync-input"
                type="text"
                value={form.model}
                placeholder="如 deepseek-chat"
                autoComplete="off"
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>

            <button
              className="sync-btn sync-btn-primary"
              disabled={!canSaveForm || testingId !== null}
              onClick={handleSaveForm}
            >
              保存
            </button>

            <div className="sync-action-row">
              <button
                className="sync-btn sync-btn-secondary"
                disabled={!canSaveForm || testingId !== null}
                onClick={() => void runTestForm()}
              >
                {testingId === DRAFT_TEST_ID ? '测试中…' : '测试连接'}
              </button>
              <button className="sync-btn sync-btn-text-danger" disabled={testingId !== null} onClick={() => setForm(null)}>
                取消
              </button>
            </div>
          </>
        )}

        <Modal
          isOpen={deleteTarget !== null}
          title={`删除「${deleteTarget?.name ?? ''}」配置？`}
          content="删除后需重新填写 API Key"
          cancelText="取消"
          confirmText="删除"
          isDanger={true}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </div>
  );
}
