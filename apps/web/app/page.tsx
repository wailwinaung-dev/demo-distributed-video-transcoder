import Link from 'next/link';
import { UploadCloud, Cpu, Layers, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      {/* Hero Section */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next.js 16 + NestJS + Go FFmpeg + MinIO S3</span>
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          High Performance Video Transcoding Pipeline
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Direct-to-S3 chunked multipart uploads, asynchronous Go transcode worker with adaptive HLS multi-bitrate ladder (1080p, 720p, 360p), and storyboard scrubbing previews.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <UploadCloud className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-100">Direct S3 Multipart</h3>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            10MB chunked browser uploads straight to MinIO S3 without server buffering.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-100">Go FFmpeg Worker</h3>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            High performance transcoding generating 360p, 720p, 1080p HLS playlists.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-zinc-900 dark:text-zinc-100">Storyboard Previews</h3>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Automated sprite generation and WebVTT cue extraction for timeline hover previews.
          </p>
        </div>
      </div>
    </main>
  );
}
