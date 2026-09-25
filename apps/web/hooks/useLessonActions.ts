'use client';

import { useRef, useCallback, useEffect } from 'react';
import type Uppy from '@uppy/core';
import type { LessonSlot } from '@/lib/upload-types';
import { cleanTitleFromFilename, createEmptySlot } from '@/lib/upload-types';

type SetSlots = React.Dispatch<React.SetStateAction<LessonSlot[]>>;

/**
 * Manages lesson slot CRUD actions and Uppy file operations.
 *
 * Receives `uppyRef` (not a direct Uppy instance) so that actions always
 * access the current live Uppy instance — even after Strict Mode re-creates it.
 *
 * @param uppyRef - Ref to the live Uppy instance from useUppyEngine
 * @param slots - Current slot state (kept in sync via ref)
 * @param setSlots - State setter from the parent component
 */
export function useLessonActions(
  uppyRef: React.RefObject<Uppy | null>,
  slots: LessonSlot[],
  setSlots: SetSlots
) {
  // Ref to always have fresh slot state without re-creating callbacks
  const slotsRef = useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ──────────────────────────────────────────
  // A. Add a new empty lesson slot card
  // ──────────────────────────────────────────
  const addSlot = useCallback(() => {
    setSlots((prev) => [...prev, createEmptySlot()]);
  }, [setSlots]);

  // ──────────────────────────────────────────
  // B. Remove a lesson slot
  // ──────────────────────────────────────────
  const removeSlot = useCallback(
    (slotId: string) => {
      const slot = slotsRef.current.find((s) => s.id === slotId);
      const uppy = uppyRef.current;

      // Remove from Uppy core if registered
      if (uppy && slot?.uppyFileId) {
        try {
          uppy.removeFile(slot.uppyFileId);
        } catch {
          /* file may have already been removed */
        }
      }

      setSlots((prev) => {
        const remaining = prev.filter((s) => s.id !== slotId);
        // Guarantee at least 1 slot remains
        return remaining.length === 0 ? [createEmptySlot()] : remaining;
      });
    },
    [uppyRef, setSlots]
  );

  // ──────────────────────────────────────────
  // C. Update custom lesson title
  // ──────────────────────────────────────────
  const updateTitle = useCallback(
    (slotId: string, newTitle: string) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, title: newTitle, errorMessage: undefined }
            : s
        )
      );

      // Sync metadata with Uppy core
      const uppy = uppyRef.current;
      const slot = slotsRef.current.find((s) => s.id === slotId);
      if (uppy && slot?.uppyFileId) {
        try {
          uppy.setFileMeta(slot.uppyFileId, { title: newTitle });
        } catch {
          /* file may not exist in Uppy */
        }
      }
    },
    [uppyRef, setSlots]
  );

  // ──────────────────────────────────────────
  // D. Select a single video file for a slot
  // ──────────────────────────────────────────
  const selectFile = useCallback(
    (slotId: string, file: File | null) => {
      const uppy = uppyRef.current;
      if (!file || !uppy) return;

      const currentSlot = slotsRef.current.find((s) => s.id === slotId);

      // Remove previous file from Uppy if one was already attached
      if (currentSlot?.uppyFileId) {
        try {
          uppy.removeFile(currentSlot.uppyFileId);
        } catch {
          /* ignore */
        }
      }

      const suggestedTitle =
        currentSlot?.title?.trim() || cleanTitleFromFilename(file.name);

      // Register file into Uppy core
      let uppyFileId: string | undefined;
      try {
        uppyFileId = uppy.addFile({
          id: `${slotId}/${file.name}`,
          name: file.name,
          type: file.type,
          data: file,
          meta: { title: suggestedTitle, slotId }
        });
      } catch (err) {
        console.warn('[Uppy] Warning adding file:', err);
      }

      // Pure state update — no side effects
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                file,
                uppyFileId,
                title: suggestedTitle,
                status: 'waiting' as const,
                progress: 0,
                errorMessage: undefined
              }
            : s
        )
      );
    },
    [uppyRef, setSlots]
  );

  // ──────────────────────────────────────────
  // E. Trigger the upload queue
  // ──────────────────────────────────────────
  const startQueue = useCallback(async () => {
    const uppy = uppyRef.current;
    if (!uppy) return;

    // Validate that slots with files have non-empty titles
    let hasValidationError = false;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.file && !s.title.trim()) {
          hasValidationError = true;
          return { ...s, errorMessage: 'Lesson title is required' };
        }
        return s;
      })
    );

    if (hasValidationError) return;

    const readySlots = slotsRef.current.filter(
      (s) => (s.status === 'waiting' || s.status === 'error') && s.file !== null
    );
    if (readySlots.length === 0) return;

    try {
      await uppy.upload();
    } catch (err) {
      console.error('[Uppy] Error triggering upload:', err);
    }
  }, [uppyRef, setSlots]);

  // ──────────────────────────────────────────
  // F. Retry a failed upload for a specific slot
  // ──────────────────────────────────────────
  const retrySlot = useCallback(
    async (slotId: string) => {
      const uppy = uppyRef.current;
      if (!uppy) return;

      const slot = slotsRef.current.find((s) => s.id === slotId);
      if (!slot || !slot.file) return;

      let targetUppyId = slot.uppyFileId;

      if (!targetUppyId || !uppy.getFile(targetUppyId)) {
        // Re-register the file if it was removed from Uppy
        try {
          targetUppyId = uppy.addFile({
            id: `${slotId}/${slot.file.name}`,
            name: slot.file.name,
            type: slot.file.type,
            data: slot.file,
            meta: { title: slot.title, slotId }
          });
        } catch {
          /* ignore */
        }
      } else {
        // Retry the existing file
        try {
          uppy.retryUpload(targetUppyId);
        } catch {
          /* ignore */
        }
      }

      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                uppyFileId: targetUppyId,
                status: 'waiting' as const,
                errorMessage: undefined
              }
            : s
        )
      );

      try {
        await uppy.upload();
      } catch {
        /* ignore */
      }
    },
    [uppyRef, setSlots]
  );

  return {
    fileInputRefs,
    addSlot,
    removeSlot,
    updateTitle,
    selectFile,
    startQueue,
    retrySlot
  };
}
