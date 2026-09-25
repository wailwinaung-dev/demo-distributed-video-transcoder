'use client';

import React, { useState } from 'react';
import { Plus, Layers, Play, Loader2 } from 'lucide-react';
import type { LessonSlot } from '@/lib/upload-types';
import { useUppyEngine } from '@/hooks/useUppyEngine';
import { useLessonActions } from '@/hooks/useLessonActions';
import LessonCard from './LessonCard';

// ==========================================
// COMPONENT
// ==========================================

const INITIAL_SLOT: LessonSlot = {
  id: 'slot-1',
  title: '',
  file: null,
  status: 'empty',
  progress: 0
};

export const QueueVideoUploader: React.FC = () => {
  // State is lifted to the component — hooks consume via setSlots
  const [slots, setSlots] = useState<LessonSlot[]>([INITIAL_SLOT]);

  // Uppy engine: creates instance inside effect, exposes via ref
  const { uppyRef, isUploading } = useUppyEngine(setSlots);

  // Lesson slot actions: CRUD + Uppy file operations (uses uppyRef.current)
  const {
    fileInputRefs,
    addSlot,
    removeSlot,
    updateTitle,
    selectFile,
    startQueue,
    retrySlot
  } = useLessonActions(uppyRef, slots, setSlots);

  // ==========================================
  // METRICS & COMPUTED STATS
  // ==========================================
  const totalSlots = slots.length;
  const waitingCount = slots.filter(
    (s) => s.status === 'waiting' && s.file !== null
  ).length;
  const uploadingCount = slots.filter((s) => s.status === 'uploading').length;
  const completedCount = slots.filter((s) => s.status === 'completed').length;
  const errorCount = slots.filter((s) => s.status === 'error').length;

  return (
    <div className="w-full space-y-6 font-sans">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">
              Course Lesson Builder &amp; Upload Queue
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {totalSlots} lesson slot{totalSlots > 1 ? 's' : ''} •{' '}
            {completedCount} completed, {waitingCount + uploadingCount} in queue
            • Sequential queue (1 by 1)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Fixed Concurrency: Sequential
          </span>
        </div>
      </div>

      {/* 2. Lesson Cards */}
      <div className="space-y-4">
        {slots.map((slot, index) => (
          <LessonCard
            key={slot.id}
            slot={slot}
            index={index}
            isUploadingQueue={isUploading}
            onRemove={removeSlot}
            onUpdateTitle={updateTitle}
            onSelectFile={selectFile}
            onRetry={retrySlot}
            setFileInputRef={(el) => {
              if (el) fileInputRefs.current.set(slot.id, el);
              else fileInputRefs.current.delete(slot.id);
            }}
            onClickFileInput={() => fileInputRefs.current.get(slot.id)?.click()}
          />
        ))}
      </div>

      {/* 3. Bottom Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-white/5 backdrop-blur-md">
        <button
          type="button"
          disabled={isUploading}
          onClick={addSlot}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Add Another Lesson
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={startQueue}
            disabled={(waitingCount === 0 && errorCount === 0) || isUploading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-sm font-medium shadow-lg shadow-indigo-600/20 transition"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processing Queue (1 by 1)...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>
                  {waitingCount > 0
                    ? `Start Upload Queue (${waitingCount} Lesson${waitingCount > 1 ? 's' : ''})`
                    : completedCount > 0 && completedCount === totalSlots
                      ? 'All Lessons Uploaded'
                      : 'Add Lessons to Start'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
