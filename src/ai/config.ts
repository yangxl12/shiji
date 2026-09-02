import type { AIModelConfig } from '../types';

/**
 * AI 模型配置存取（localStorage，仅存于本机浏览器，不参与云端同步）。
 */

const MODELS_STORAGE_KEY = 'shiJi-ai-models';
const ACTIVE_STORAGE_KEY = 'shiJi-ai-active';

function readModels(): AIModelConfig[] {
  try {
    const raw = localStorage.getItem(MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeModels(models: AIModelConfig[]): void {
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
}

export function getAIModels(): AIModelConfig[] {
  return readModels();
}

export function getActiveAIModelId(): string | null {
  return localStorage.getItem(ACTIVE_STORAGE_KEY);
}

/** 当前选中的模型；未选择或已失效时返回 null */
export function getActiveAIModel(): AIModelConfig | null {
  const id = getActiveAIModelId();
  if (!id) return null;
  return readModels().find((m) => m.id === id) ?? null;
}

export function setActiveAIModel(id: string): void {
  localStorage.setItem(ACTIVE_STORAGE_KEY, id);
}

/** 新增或更新模型；保存首个模型时自动选为当前使用 */
export function saveAIModel(model: AIModelConfig): void {
  const models = readModels();
  const index = models.findIndex((m) => m.id === model.id);
  if (index >= 0) {
    models[index] = model;
  } else {
    models.push(model);
  }
  writeModels(models);
  if (!getActiveAIModelId() && models.length > 0) {
    setActiveAIModel(models[0].id);
  }
}

/** 删除模型；删除的是当前使用模型时自动改选剩余首个 */
export function deleteAIModel(id: string): void {
  const models = readModels().filter((m) => m.id !== id);
  writeModels(models);
  if (getActiveAIModelId() === id) {
    if (models.length > 0) {
      setActiveAIModel(models[0].id);
    } else {
      localStorage.removeItem(ACTIVE_STORAGE_KEY);
    }
  }
}
