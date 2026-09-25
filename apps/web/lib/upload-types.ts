// ==========================================
// Shared Types & Helpers for Upload System
// ==========================================

export interface LessonSlot {
  id: string;
  uppyFileId?: string;
  title: string;
  file: File | null;
  status: 'empty' | 'waiting' | 'uploading' | 'completed' | 'error';
  progress: number;
  stage?: 'initiating' | 'uploading' | 'completing' | 'done';
  currentPart?: number;
  totalParts?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  videoId?: string;
  errorMessage?: string;
}

/** Format bytes into human-readable strings (KB, MB, GB) */
export function formatBytes(bytes: number = 0): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Convert raw filename to clean, suggested lesson title */
export function cleanTitleFromFilename(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '')  // Strip extension (.mp4, .mov, etc.)
    .replace(/[-_]/g, ' ')     // Replace dashes and underscores with spaces
    .trim();
}

/** Create a fresh empty lesson slot */
export function createEmptySlot(): LessonSlot {
  return {
    id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    file: null,
    status: 'empty',
    progress: 0,
  };
}
