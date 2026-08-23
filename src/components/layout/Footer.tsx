import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-neutral-800/80 bg-neutral-950/80 py-6 mt-12 text-neutral-400 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-neutral-400">
          <span>© {new Date().getFullYear()} Sweeper.lol</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>Built by</span>
          <a
            href="https://x.com/n_y_1411"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-200 hover:text-amber-400 font-bold transition-colors underline underline-offset-4 decoration-neutral-700 hover:decoration-amber-400"
          >
            @n_y_1411
          </a>
        </div>
      </div>
    </footer>
  );
};
