'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import {
  UploadCloud,
  Cpu,
  Layers,
  Sparkles,
  Play,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface VideoItem {
  id: string;
  title: string;
  status: 'PENDING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  progress: number;
  hlsUrl: string | null;
  createdAt: string;
}

export default function HomePage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      const res = await api.get('/videos');
      setVideos(res.data);
    } catch (err) {
      console.warn('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-16">
      {/* Hero Section */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next.js 16 + NestJS + Go FFmpeg + MinIO S3</span>
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          High Performance LMS Video Pipeline
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
          Direct-to-S3 chunked multipart uploads, asynchronous Go transcode worker with adaptive HLS multi-bitrate ladder (1080p, 720p, 360p), and storyboard scrubbing previews.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:scale-105 active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4" />
            Upload New Video
          </Link>
        </div>
      </div>

      {/* Video Library Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Course Video Library</h2>
            <p className="text-xs text-zinc-400">Click any video to watch with adaptive streaming & hover previews</p>
          </div>
          <Link
            href="/upload"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
          >
            + Upload More
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            Loading courses...
          </div>
        ) : videos.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/40 border border-white/5 rounded-2xl">
            <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-300">No videos uploaded yet</h3>
            <p className="text-xs text-zinc-500 mt-1 mb-4">Upload your first course video to start transcoding</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((vid) => (
              <Link
                key={vid.id}
                href={`/watch/${vid.id}`}
                className="group relative flex flex-col justify-between p-5 bg-zinc-900/70 border border-white/10 rounded-2xl hover:border-blue-500/40 hover:bg-zinc-900 transition-all duration-200 shadow-lg"
              >
                <div className="space-y-3">
                  {/* Card Thumbnail / Preview Placeholder */}
                  <div className="relative w-full aspect-video rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center overflow-hidden group-hover:scale-[1.02] transition-transform">
                    {vid.status === 'READY' ? (
                      <div className="w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 ml-0.5 fill-white" />
                      </div>
                    ) : vid.status === 'FAILED' ? (
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    ) : (
                      <div className="text-center space-y-1">
                        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                        <span className="text-[10px] text-zinc-400">{vid.progress}%</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      {vid.status === 'READY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      )}
                      {vid.status === 'PROCESSING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                          <RefreshCw className="w-3 h-3 animate-spin" /> {vid.progress}%
                        </span>
                      )}
                      {vid.status === 'UPLOADED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                          Queued
                        </span>
                      )}
                      {vid.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-semibold">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors line-clamp-1">
                    {vid.title}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {new Date(vid.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                    Watch →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <UploadCloud className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-white">Direct S3 Multipart</h3>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            10MB chunked browser uploads straight to MinIO S3 with presigned part URLs.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-white">Go FFmpeg Worker</h3>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            Asynchronous multi-bitrate ladder (1080p, 720p, 360p) with live progress tracking.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-semibold text-white">Storyboard Scrubbing</h3>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
            Automated sprite sheet generation and WebVTT cue extraction for timeline hover previews.
          </p>
        </div>
      </div>
    </main>
  );
}
