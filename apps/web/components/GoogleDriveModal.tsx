'use client';

import React, { useEffect, useRef } from 'react';
import type Uppy from '@uppy/core';
import { X, Cloud } from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string | null;
  slotTitle: string;
  uppyRef: React.RefObject<Uppy | null>;
  onSelectDriveFile: (slotId: string, uppyFile: unknown) => void;
}

export default function GoogleDriveModal({
  isOpen,
  onClose,
  slotId,
  slotTitle,
  uppyRef,
  onSelectDriveFile,
}: GoogleDriveModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !slotId) return;

    const uppy = uppyRef.current;
    if (!uppy || !mountRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = uppy.getPlugin('GoogleDrive') as any;
    if (!plugin) {
      console.warn('[GoogleDriveModal] GoogleDrive plugin not found on Uppy instance');
      return;
    }

    // Mount Google Drive view into our styled container
    try {
      plugin.mount(mountRef.current, plugin);
      // Dispatch resize to trigger VirtualList height recalculation
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    } catch (err) {
      console.error('[GoogleDriveModal] Mount error:', err);
    }

    // Capture file selection from Google Drive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleFileAdded = (file: any) => {
      // Only process if it is a remote file from Google Drive
      if (file?.isRemote) {
        onSelectDriveFile(slotId, file);
        onClose();
      }
    };

    uppy.on('file-added', handleFileAdded);

    return () => {
      uppy.off('file-added', handleFileAdded);
      try {
        plugin.unmount();
      } catch {
        /* ignore */
      }
    };
  }, [isOpen, slotId, uppyRef, onSelectDriveFile, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Google Drive Import
              </h3>
              <p className="text-xs text-zinc-400">
                {slotTitle ? `Target: ${slotTitle}` : 'Select a video to assign to this lesson'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Mount Container */}
        <div
          data-uppy-theme="dark"
          className="uppy-drive-container flex-1 p-4 bg-zinc-950/40 min-h-[460px] h-[460px] flex flex-col overflow-hidden"
        >
          <div
            ref={mountRef}
            className="w-full h-full flex flex-col flex-1 min-h-[420px]"
          />
        </div>

        {/* Modal Footer Tip */}
        <div className="px-6 py-3 border-t border-white/5 bg-zinc-950/40 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Server-to-server streaming directly to MinIO (Zero local bandwidth used).</span>
          <span className="font-mono text-zinc-600">Companion v7</span>
        </div>
      </div>
    </div>
  );
}
