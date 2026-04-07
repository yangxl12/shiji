import type { Note } from '../types';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

interface ExportProgress {
  current: number;
  total: number;
  fileIndex: number;
}

export function generateMarkdownContent(notes: Note[]): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  let content = `# 拾记导出 - ${timestamp}\n\n`;
  content += `> 共导出 ${notes.length} 条笔记\n\n`;
  content += `---\n\n`;
  
  notes.forEach((note, index) => {
    const date = new Date(note.createdAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    content += `## ${index + 1}. ${note.title || '(无标题)'}\n\n`;
    content += `- **分类**: ${getCategoryName(note.category)}\n`;
    content += `- **标签**: ${getTagName(note.tagColor)}\n`;
    content += `- **创建时间**: ${dateStr}\n`;
    content += `- **更新时间**: ${new Date(note.updatedAt).toLocaleString('zh-CN')}\n\n`;
    
    if (note.content) {
      content += `### 内容\n\n${note.content}\n\n`;
    }
    
    content += `---\n\n`;
  });
  
  return content;
}

function getCategoryName(category: string): string {
  const categoryMap: Record<string, string> = {
    random: '随想',
    study: '学习',
    todo: '待办',
  };
  return categoryMap[category] || category;
}

function getTagName(tagColor: string | null): string {
  if (!tagColor) return '无';
  const tagMap: Record<string, string> = {
    red: '红色',
    orange: '橙色',
    yellow: '黄色',
    gray: '灰色',
  };
  return tagMap[tagColor] || tagColor;
}

export function splitNotesIntoChunks(notes: Note[]): Note[][] {
  const chunks: Note[][] = [];
  let currentChunk: Note[] = [];
  let currentSize = 0;
  
  for (const note of notes) {
    const noteContent = generateMarkdownContent([note]);
    const noteSize = new Blob([noteContent]).size;
    
    // If adding this note would exceed the limit, start a new chunk
    if (currentSize + noteSize > MAX_FILE_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [note];
      currentSize = noteSize;
    } else {
      currentChunk.push(note);
      currentSize += noteSize;
    }
  }
  
  // Add the last chunk if it has notes
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportNotes(
  notes: Note[],
  onProgress?: (progress: ExportProgress) => void
): Promise<{ success: boolean; message: string; fileCount: number }> {
  if (notes.length === 0) {
    return { success: false, message: '没有可导出的笔记', fileCount: 0 };
  }
  
  const chunks = splitNotesIntoChunks(notes);
  const timestamp = new Date().toISOString().slice(0, 10);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const content = generateMarkdownContent(chunk);
    const filename = chunks.length === 1 
      ? `拾记导出-${timestamp}.md`
      : `拾记导出-${timestamp}-part${i + 1}.md`;
    
    downloadFile(content, filename);
    
    if (onProgress) {
      onProgress({
        current: chunk.length,
        total: notes.length,
        fileIndex: i + 1,
      });
    }
    
    // Small delay between downloads to prevent browser blocking
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const message = chunks.length === 1 
    ? `成功导出 ${notes.length} 条笔记`
    : `成功导出 ${notes.length} 条笔记，已分割为 ${chunks.length} 个文件`;
  
  return { success: true, message, fileCount: chunks.length };
}
