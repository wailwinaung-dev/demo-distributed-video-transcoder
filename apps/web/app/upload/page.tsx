'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { QueueVideoUploader } from '@/components/QueueVideoUploader';

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Courses
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Upload Course Videos
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Add multiple lesson videos, set individual lesson titles, and upload them sequentially in 10MB chunks directly to S3.
          </p>
        </div>
      </div>

      <QueueVideoUploader />
    </main>
  );
}
