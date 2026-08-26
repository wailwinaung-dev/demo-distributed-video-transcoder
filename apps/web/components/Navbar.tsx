import Link from 'next/link';
import { Video, UploadCloud, Film } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
            <Film className="h-5 w-5" />
          </div>
          <span>LMS Video Platform</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Video className="h-4 w-4" />
            Videos
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Video
          </Link>
        </nav>
      </div>
    </header>
  );
}
