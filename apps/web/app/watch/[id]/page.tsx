'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { VideoPlayer } from '../../../components/VideoPlayer';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Film,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface VideoData {
  id: string;
  title: string;
  status: 'PENDING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  progress: number;
  hlsUrl: string | null;
  vttUrl: string | null;
  spriteUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const videoId = resolvedParams.id;

  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideo = async () => {
    try {
      const res = await api.get(`/videos/${videoId}`);
      setVideo(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load video details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideo();

    // Auto-poll while video is in PROCESSING or UPLOADED state
    const interval = setInterval(() => {
      if (video?.status === 'PROCESSING' || video?.status === 'UPLOADED' || !video) {
        fetchVideo();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [videoId, video?.status]);

  if (loading && !video) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Loading video player...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-zinc-900 border border-red-500/20 rounded-2xl text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Video Not Found</h2>
        <p className="text-zinc-400 text-sm mb-6">{error || 'Could not locate the requested video.'}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>

      {/* Video Content Area */}
      {video.status === 'READY' && video.hlsUrl ? (
        <div className="space-y-6">
          {/* Custom HLS Video Player */}
          <VideoPlayer
            src={video.hlsUrl}
            vttSrc={video.vttUrl}
            title={video.title}
          />

          {/* Video Metadata Card */}
          <div className="p-6 bg-zinc-900/60 border border-white/5 rounded-2xl backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">{video.title}</h1>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  Uploaded {new Date(video.createdAt).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <Sparkles className="w-3 h-3" /> Ready for Streaming
                </span>
              </div>
            </div>

            {/* Quality & Features Badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 border border-white/5 rounded-xl text-xs text-zinc-300">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Adaptive HLS (1080p, 720p, 360p)</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 border border-white/5 rounded-xl text-xs text-zinc-300">
                <Film className="w-4 h-4 text-purple-400" />
                <span>Storyboard Scrubbing</span>
              </div>
            </div>
          </div>
        </div>
      ) : video.status === 'FAILED' ? (
        <div className="p-8 bg-zinc-900 border border-red-500/30 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Transcoding Failed</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            {video.errorMessage || 'An error occurred while transcoding the video.'}
          </p>
        </div>
      ) : (
        /* Transcoding in Progress Screen */
        <div className="p-10 md:p-14 bg-zinc-900/80 border border-white/10 rounded-2xl text-center space-y-6 shadow-2xl backdrop-blur-md">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
            <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/40 rounded-full flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {video.status === 'UPLOADED' ? 'Queued for Transcoding' : 'Transcoding Video...'}
            </h2>
            <p className="text-zinc-400 text-sm">
              Generating multi-rendition HLS ladder (360p, 720p, 1080p) and storyboard seekbar thumbnails.
            </p>
          </div>

          {/* Live Progress Bar */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-xs font-semibold text-zinc-400">
              <span>{video.status}</span>
              <span className="text-blue-400">{video.progress}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${Math.max(5, video.progress)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500 animate-pulse">
            This page will automatically refresh the instant the video is ready!
          </p>
        </div>
      )}
    </div>
  );
}
