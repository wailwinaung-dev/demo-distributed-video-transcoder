'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type Uppy from '@uppy/core';
import { createUppy } from '@/lib/uppy';
import { api } from '@/lib/api';
import type { LessonSlot } from '@/lib/upload-types';

type SetSlots = React.Dispatch<React.SetStateAction<LessonSlot[]>>;

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB — must match lib/uppy.ts

/**
 * Manages Uppy instance lifecycle and event listeners.
 *
 * Creates Uppy INSIDE useEffect so Strict Mode's cleanup→re-run cycle
 * properly destroys the old instance and creates a fresh one.
 * Exposes Uppy via `uppyRef` (not a direct value) so actions always
 * access the current live instance.
 *
 * @param setSlots - State setter from the parent component
 * @returns `{ uppyRef, isUploading }` — ref to the live Uppy instance + queue status
 */
export function useUppyEngine(setSlots: SetSlots) {
  const [isUploading, setIsUploading] = useState(false);
  const uppyRef = useRef<Uppy | null>(null);

  // Stable updateSlot — never changes, safe as effect dependency
  const updateSlot = useCallback(
    (slotId: string, update: Record<string, unknown>) => {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, ...update } : s))
      );
    },
    [setSlots]
  );

  useEffect(() => {
    // Create Uppy inside the effect — Strict Mode safe:
    // cleanup destroys it, re-run creates a fresh one
    const uppy = createUppy(updateSlot);
    uppyRef.current = uppy;

    // ── Event Listeners ──

    const onUploadStart = () => {
      setIsUploading(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onUploadProgress = (file: any, progress: any) => {
      const slotId = file?.meta?.slotId as string;
      if (!slotId) return;

      const percent =
        progress.bytesTotal > 0
          ? Math.min(
              99,
              Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
            )
          : 0;

      updateSlot(slotId, {
        status: 'uploading',
        stage: 'uploading',
        progress: percent,
        uploadedBytes: progress.bytesUploaded,
        totalBytes: progress.bytesTotal
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onPartUploaded = (file: any, part: any) => {
      const slotId = file?.meta?.slotId as string;
      if (!slotId) return;

      const totalParts = file.size ? Math.ceil(file.size / CHUNK_SIZE) : 1;

      updateSlot(slotId, {
        currentPart: part.PartNumber,
        totalParts
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onUploadSuccess = async (file: any, response: any) => {
      const slotId = file?.meta?.slotId as string;
      const s3Key = (response?.body?.key || file?.meta?.s3Key) as string;

      if (slotId) updateSlot(slotId, { stage: 'completing' });

      try {
        const res = await api.post('/upload/notify-complete', {
          key: s3Key,
        });

        if (slotId) {
          updateSlot(slotId, {
            status: 'completed',
            progress: 100,
            stage: 'done',
            videoId: res.data.videoId
          });
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (err as Error)?.message ||
          'Failed to notify completion';

        if (slotId) {
          updateSlot(slotId, {
            status: 'error',
            errorMessage
          });
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onUploadError = (file: any, error: any) => {
      const slotId = file?.meta?.slotId as string;
      if (slotId) {
        updateSlot(slotId, {
          status: 'error',
          errorMessage: error?.message || 'Upload failed'
        });
      }
    };

    const onComplete = () => {
      setIsUploading(false);
    };

    uppy.on('upload-start', onUploadStart);
    uppy.on('upload-progress', onUploadProgress);
    uppy.on('s3-multipart:part-uploaded', onPartUploaded);
    uppy.on('upload-success', onUploadSuccess);
    uppy.on('upload-error', onUploadError);
    uppy.on('complete', onComplete);

    return () => {
      uppy.off('upload-start', onUploadStart);
      uppy.off('upload-progress', onUploadProgress);
      uppy.off('s3-multipart:part-uploaded', onPartUploaded);
      uppy.off('upload-success', onUploadSuccess);
      uppy.off('upload-error', onUploadError);
      uppy.off('complete', onComplete);
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [updateSlot]);

  return { uppyRef, isUploading };
}
