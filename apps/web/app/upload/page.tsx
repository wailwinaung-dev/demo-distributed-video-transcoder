'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw
} from 'lucide-react';
import { uploadVideoInChunks, UploadProgress } from '@/lib/uploader';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    console.log('Selected file:', selectedFile);
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setUploadedVideoId(null);
    setProgress(null);
    if (!title.trim()) {
      // Auto-populate title with filename (without extension)
      const cleanName = selectedFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!file || !title.trim() || isUploading) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadedVideoId(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await uploadVideoInChunks(
        file,
        title,
        (p) => setProgress(p),
        controller.signal
      );

      setUploadedVideoId(result.videoId);
    } catch (err: any) {
      if (
        err.name === 'CanceledError' ||
        err.message === 'Upload aborted by user'
      ) {
        setErrorMessage('Upload was cancelled.');
      } else {
        setErrorMessage(
          err.response?.data?.message ||
            err.message ||
            'Failed to upload video. Please try again.'
        );
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setProgress(null);
    setUploadedVideoId(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Upload Video
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Upload your video in 10MB chunks directly to local S3 storage for HLS
          transcoding.
        </p>
      </div>

      {uploadedVideoId ? (
        /* Success State */
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Upload Complete!
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your video has been assembled in S3 and pushed to the transcoding
            queue.
          </p>
          <div className="mt-3 inline-block rounded-md bg-zinc-100 px-3 py-1 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Video ID: {uploadedVideoId}
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-4 w-4" />
              Upload Another
            </button>
            <Link
              href={`/watch/${uploadedVideoId}`}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-500"
            >
              <Play className="h-4 w-4" />
              Watch Video
            </Link>
          </div>
        </div>
      ) : (
        /* Upload Form */
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-8">
          {errorMessage && (
            <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Video Title */}
          <div>
            <label
              htmlFor="video-title"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-200"
            >
              Video Title
            </label>
            <input
              id="video-title"
              type="text"
              placeholder="e.g. Introduction to System Architecture"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-800/50"
            />
          </div>

          {/* Drag & Drop File Zone */}
          <div>
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200">
              Video File
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-indigo-600 bg-indigo-500/5'
                  : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
              } ${isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />

              {file ? (
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                    <FileVideo className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatBytes(file.size)} • {file.type || 'video'}
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = '';
                      }}
                      className="ml-4 rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Click to upload or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    MP4, MOV, MKV, or WebM (Uploaded in 10MB chunk parts)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && progress && (
            <div className="space-y-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <span className="capitalize">
                  {progress.stage === 'initiating' &&
                    'Initiating S3 Multipart Upload...'}
                  {progress.stage === 'uploading' &&
                    `Uploading Part ${progress.currentPart} of ${progress.totalParts}...`}
                  {progress.stage === 'completing' &&
                    'Stitching chunks in S3...'}
                </span>
                <span>{progress.percent}%</span>
              </div>

              {/* Bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out dark:bg-indigo-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>
                  {formatBytes(progress.uploadedBytes)} of{' '}
                  {formatBytes(progress.totalBytes)}
                </span>
                <span>Direct to S3 (MinIO)</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {isUploading ? (
              <button
                type="button"
                onClick={handleCancelUpload}
                className="rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                Cancel Upload
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={!file || !title.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                Start Upload
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
