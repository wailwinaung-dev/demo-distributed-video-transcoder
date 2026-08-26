export interface StoryboardCue {
  start: number;
  end: number;
  spriteUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseVTT(vttText: string, baseUrl: string): StoryboardCue[] {
  const cues: StoryboardCue[] = [];
  const lines = vttText.split(/\r?\n/);

  let currentStart = 0;
  let currentEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for timestamp lines like: 00:00:00.000 --> 00:00:05.000
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim());
      currentStart = parseTime(startStr);
      currentEnd = parseTime(endStr);
      continue;
    }

    // Look for sprite coordinate lines like: sprite.jpg#xywh=0,0,160,90
    if (line.includes('#xywh=')) {
      const [imgPath, coords] = line.split('#xywh=');
      const [x, y, w, h] = coords.split(',').map(Number);

      // Resolve relative sprite image path against the VTT base URL
      const fullSpriteUrl = imgPath.startsWith('http')
        ? imgPath
        : `${baseUrl.substring(0, baseUrl.lastIndexOf('/'))}/${imgPath}`;

      cues.push({
        start: currentStart,
        end: currentEnd,
        spriteUrl: fullSpriteUrl,
        x: x || 0,
        y: y || 0,
        w: w || 160,
        h: h || 90,
      });
    }
  }

  return cues;
}

export function findCue(cues: StoryboardCue[], time: number): StoryboardCue | null {
  if (!cues || cues.length === 0) return null;

  // Binary search for efficiency
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];

    if (time >= cue.start && time < cue.end) {
      return cue;
    } else if (time < cue.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return cues[Math.min(Math.max(0, low), cues.length - 1)] || null;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS.mmm
    seconds += parseFloat(parts[0]) * 3600;
    seconds += parseFloat(parts[1]) * 60;
    seconds += parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.mmm
    seconds += parseFloat(parts[0]) * 60;
    seconds += parseFloat(parts[1]);
  }

  return seconds;
}
