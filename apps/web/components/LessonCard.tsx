'use client';

import React from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileVideo,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import type { LessonSlot } from '@/lib/upload-types';
import { formatBytes } from '@/lib/upload-types';

interface LessonCardProps {
  slot: LessonSlot;
  index: number;
  isUploadingQueue: boolean;
  onRemove: (slotId: string) => void;
  onUpdateTitle: (slotId: string, title: string) => void;
  onSelectFile: (slotId: string, file: File | null) => void;
  onRetry: (slotId: string) => void;
  setFileInputRef: (el: HTMLInputElement | null) => void;
  onClickFileInput: () => void;
}

export default function LessonCard({
  slot,
  index,
  isUploadingQueue,
  onRemove,
  onUpdateTitle,
  onSelectFile,
  onRetry,
  setFileInputRef,
  onClickFileInput,
}: LessonCardProps) {
  const isUploading = slot.status === 'uploading';
  const isCompleted = slot.status === 'completed';
  const isWaiting = slot.status === 'waiting';
  const isError = slot.status === 'error';
  const isEmpty = slot.status === 'empty';

  return (
    <div
      className={`p-6 rounded-2xl border transition-all ${
        isUploading
          ? 'bg-zinc-900/90 border-indigo-500/40 shadow-xl shadow-indigo-500/5 ring-1 ring-indigo-500/20'
          : isCompleted
          ? 'bg-zinc-900/40 border-emerald-500/20'
          : 'bg-zinc-900/50 border-white/5 hover:border-white/10'
      }`}
    >
      {/* Card Header: Lesson # & Status Badges */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold font-mono">
            #{index + 1}
          </span>
          <span className="text-sm font-semibold text-white">
            Lesson {index + 1}
          </span>

          {/* Status Badges */}
          {isEmpty && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              Empty Slot
            </span>
          )}
          {isWaiting && (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Waiting in Queue ⏳
            </span>
          )}
          {isUploading && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              Uploading {slot.progress}%
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Transcoding Enqueued
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3 h-3" /> Failed
            </span>
          )}
        </div>

        {/* Delete Slot Button (Allowed when not uploading) */}
        {!isUploading && !isUploadingQueue && (
          <button
            type="button"
            onClick={() => onRemove(slot.id)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Remove lesson slot"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Card Inputs: Title + Single Video File Picker */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* 1. Title Input */}
        <div className="md:col-span-7 space-y-1.5">
          <label className="block text-xs font-medium text-zinc-400">
            Lesson Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={slot.title}
            onChange={(e) => onUpdateTitle(slot.id, e.target.value)}
            disabled={isUploading || isCompleted}
            placeholder="e.g. 01 - Introduction to Course"
            className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
          />
        </div>

        {/* 2. File Picker (Strictly Single Video File) */}
        <div className="md:col-span-5 space-y-1.5">
          <label className="block text-xs font-medium text-zinc-400">
            Video File <span className="text-rose-400">*</span>
          </label>

          {/* Hidden single file input */}
          <input
            ref={setFileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            disabled={isUploading || isCompleted}
            onChange={(e) => {
              const selected = e.target.files?.[0] || null;
              onSelectFile(slot.id, selected);
              e.target.value = ''; // Reset so same file can be re-selected
            }}
          />

          {slot.file ? (
            /* Attached Single File Card */
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <FileVideo className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    {slot.file.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {formatBytes(slot.file.size)}
                  </p>
                </div>
              </div>

              {!isUploading && !isCompleted && !isUploadingQueue && (
                <button
                  type="button"
                  onClick={onClickFileInput}
                  className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-white/5 transition"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            /* Empty File Picker Button */
            <button
              type="button"
              disabled={isUploadingQueue}
              onClick={onClickFileInput}
              className="w-full h-[46px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 hover:bg-zinc-950/60 hover:border-indigo-500 text-xs text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition group"
            >
              <UploadCloud className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transition" />
              <span>Select Video File</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (Visible while uploading or completed) */}
      {(isUploading || isCompleted) && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-2">
              {isUploading && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
              {slot.stage === 'initiating' && 'Initializing S3 Multipart...'}
              {slot.stage === 'uploading' &&
                `Streaming 10MB chunk ${slot.currentPart || 1} of ${slot.totalParts || 1} directly to MinIO...`}
              {slot.stage === 'completing' && 'Stitching chunks & enqueuing to Redis...'}
              {slot.stage === 'done' && 'Upload completed! Processing in Go Transcoder...'}
            </span>
            <span className="font-semibold text-white">{slot.progress}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${slot.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>
              {formatBytes(slot.uploadedBytes || 0)} / {formatBytes(slot.file?.size || 0)}
            </span>
            <span>Direct S3 Upload (10MB Chunks)</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && slot.errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{slot.errorMessage}</span>
        </div>
      )}

      {/* Card Footer: Retry Button or Watch Stream Link */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <div>
          {isError && !isUploadingQueue && (
            <button
              type="button"
              onClick={() => onRetry(slot.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry Upload
            </button>
          )}
        </div>

        {isCompleted && slot.videoId && (
          <Link
            href={`/watch/${slot.videoId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-400 transition"
          >
            Watch HLS Stream <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
