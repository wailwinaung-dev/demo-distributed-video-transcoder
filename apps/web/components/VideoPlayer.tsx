'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  RotateCcw,
  RotateCw,
  Check,
} from 'lucide-react';
import { parseVTT, findCue, StoryboardCue } from '../lib/vtt-parser';

interface VideoPlayerProps {
  src: string;
  vttSrc?: string | null;
  title?: string;
  watermarkText?: string;
}

interface QualityLevel {
  id: number;
  height: number;
  bitrate: number;
  name: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  vttSrc,
  title,
  watermarkText = 'student@lms-demo.com | ID: #84920',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Floating Watermark Position State
  const [watermarkPos, setWatermarkPos] = useState({ top: 15, left: 15 });

  // Periodically shift watermark to deter screen recording crops
  useEffect(() => {
    const interval = setInterval(() => {
      const randomTop = Math.floor(Math.random() * 70) + 10; // 10% to 80%
      const randomLeft = Math.floor(Math.random() * 60) + 10; // 10% to 70%
      setWatermarkPos({ top: randomTop, left: randomLeft });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Quality & Settings
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'quality' | 'speed'>('main');

  // Storyboard Scrubbing State
  const [cues, setCues] = useState<StoryboardCue[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [activeCue, setActiveCue] = useState<StoryboardCue | null>(null);

  // Hide controls timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showSettings]);

  // Load Storyboard VTT
  useEffect(() => {
    if (!vttSrc) return;

    fetch(vttSrc)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load VTT');
        return res.text();
      })
      .then((text) => {
        const parsed = parseVTT(text, vttSrc);
        setCues(parsed);
      })
      .catch((err) => {
        console.warn('Could not load storyboard VTT:', err);
      });
  }, [vttSrc]);

  // Initialize HLS.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const parsedLevels: QualityLevel[] = data.levels.map((lvl, index) => ({
          id: index,
          height: lvl.height,
          bitrate: lvl.bitrate,
          name: `${lvl.height}p`,
        }));
        setLevels(parsedLevels);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS for Safari
      video.src = src;
    }
  }, [src]);

  // Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
            setBuffered((video.buffered.end(i) / video.duration) * 100);
            break;
          }
        }
      }
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  // Controls Handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    video.muted = val === 0;
    setIsMuted(val === 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
  };

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;

    setHoverPosition(pos * 100);
    setHoverTime(time);

    if (cues.length > 0) {
      const cue = findCue(cues, time);
      setActiveCue(cue);
    }
  };

  const handleMouseLeaveProgress = () => {
    setHoverTime(null);
    setActiveCue(null);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleQualityChange = (levelId: number) => {
    if (!hlsRef.current) return;
    if (levelId === -1) {
      hlsRef.current.currentLevel = -1; // Auto
      setCurrentLevel(-1);
    } else {
      hlsRef.current.currentLevel = levelId;
      setCurrentLevel(levelId);
    }
    setShowSettings(false);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSettings(false);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          skipTime(-5);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          skipTime(5);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group select-none flex items-center justify-center font-sans"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Floating Dynamic Anti-Piracy Student Watermark */}
      {watermarkText && isPlaying && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-1000 ease-in-out opacity-25 hover:opacity-10 text-white font-mono text-[11px] md:text-xs px-2.5 py-1 rounded bg-black/40 border border-white/10 backdrop-blur-[1px] tracking-wider select-none"
          style={{
            top: `${watermarkPos.top}%`,
            left: `${watermarkPos.left}%`,
          }}
        >
          {watermarkText}
        </div>
      )}

      {/* Floating Center Play Button (When Paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute z-10 w-20 h-20 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg hover:scale-110 hover:bg-blue-500 transition-all duration-200"
        >
          <Play className="w-10 h-10 ml-1 fill-white" />
        </button>
      )}

      {/* Top Title Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <h1 className="text-white text-lg md:text-xl font-bold tracking-tight drop-shadow-md">
          {title || 'Video Player'}
        </h1>
      </div>

      {/* Bottom Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Seekbar & Storyboard Preview Container */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          onMouseMove={handleMouseMoveProgress}
          onMouseLeave={handleMouseLeaveProgress}
          className="relative w-full h-3 group/bar flex items-center cursor-pointer mb-3"
        >
          {/* Background Bar */}
          <div className="w-full h-1.5 group-hover/bar:h-2.5 bg-white/20 rounded-full overflow-hidden transition-all relative">
            {/* Buffer Progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full transition-all duration-150"
              style={{ width: `${buffered}%` }}
            />
            {/* Played Progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md scale-0 group-hover/bar:scale-100 transition-transform pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 8px)` }}
          />

          {/* Storyboard Hover Thumbnail Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-6 -translate-x-1/2 pointer-events-none flex flex-col items-center z-30 transition-transform duration-75"
              style={{ left: `${hoverPosition}%` }}
            >
              {/* Thumbnail Image Crop from Sprite */}
              {activeCue ? (
                <div
                  className="w-[160px] h-[90px] rounded-lg border-2 border-white/80 shadow-2xl overflow-hidden bg-black mb-1.5"
                  style={{
                    backgroundImage: `url(${activeCue.spriteUrl})`,
                    backgroundPosition: `-${activeCue.x}px -${activeCue.y}px`,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              ) : (
                <div className="w-[160px] h-[90px] rounded-lg border-2 border-white/80 shadow-2xl bg-zinc-900 flex items-center justify-center text-xs text-zinc-400 mb-1.5">
                  Preview
                </div>
              )}
              {/* Hover Timestamp */}
              <span className="px-2.5 py-1 text-xs font-semibold bg-black/90 text-white rounded-md shadow border border-white/10">
                {formatSeconds(hoverTime)}
              </span>
            </div>
          )}
        </div>

        {/* Buttons and Settings Row */}
        <div className="flex items-center justify-between text-white text-sm">
          {/* Left Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/15 rounded-lg transition"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => skipTime(-10)}
              className="p-2 hover:bg-white/15 rounded-lg transition text-white/80 hover:text-white"
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-2 hover:bg-white/15 rounded-lg transition text-white/80 hover:text-white"
              title="Forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume ml-1">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/15 rounded-lg transition"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-blue-500 h-1.5 bg-white/30 rounded-lg cursor-pointer appearance-none"
              />
            </div>

            {/* Time Display */}
            <span className="text-xs text-white/80 font-mono ml-2">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 relative">
            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setActiveTab('main');
                }}
                className={`p-2 hover:bg-white/15 rounded-lg transition ${
                  showSettings ? 'bg-white/20 text-blue-400' : ''
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Menu Modal */}
              {showSettings && (
                <div className="absolute right-0 bottom-12 w-56 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-2 z-50 text-sm text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
                  {activeTab === 'main' && (
                    <div className="space-y-1">
                      <button
                        onClick={() => setActiveTab('quality')}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition text-left"
                      >
                        <span>Quality</span>
                        <span className="text-xs text-blue-400 font-medium">
                          {currentLevel === -1
                            ? 'Auto'
                            : levels.find((l) => l.id === currentLevel)?.name || 'Auto'}
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveTab('speed')}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition text-left"
                      >
                        <span>Speed</span>
                        <span className="text-xs text-blue-400 font-medium">
                          {playbackRate === 1 ? 'Normal' : `${playbackRate}x`}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Quality Sub-menu */}
                  {activeTab === 'quality' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10 mb-1 text-xs text-zinc-400 font-semibold">
                        <button
                          onClick={() => setActiveTab('main')}
                          className="hover:text-white"
                        >
                          ← Back
                        </button>
                        <span>Quality</span>
                      </div>
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 rounded-lg transition text-left text-xs"
                      >
                        <span>Auto</span>
                        {currentLevel === -1 && <Check className="w-4 h-4 text-blue-400" />}
                      </button>
                      {levels.map((lvl) => (
                        <button
                          key={lvl.id}
                          onClick={() => handleQualityChange(lvl.id)}
                          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 rounded-lg transition text-left text-xs"
                        >
                          <span>{lvl.name}</span>
                          {currentLevel === lvl.id && <Check className="w-4 h-4 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Speed Sub-menu */}
                  {activeTab === 'speed' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10 mb-1 text-xs text-zinc-400 font-semibold">
                        <button
                          onClick={() => setActiveTab('main')}
                          className="hover:text-white"
                        >
                          ← Back
                        </button>
                        <span>Playback Speed</span>
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => handleSpeedChange(spd)}
                          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 rounded-lg transition text-left text-xs"
                        >
                          <span>{spd === 1 ? 'Normal (1x)' : `${spd}x`}</span>
                          {playbackRate === spd && <Check className="w-4 h-4 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/15 rounded-lg transition"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
