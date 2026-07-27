import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePhoneLayout, usePrefersReducedMotion } from '../../lib/motion';

type DetailSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Must match the originating tile so the surface morphs rather than appears. */
  layoutId: string;
  accent?: string;
  children: ReactNode;
};

/**
 * The expanded view of a bento tile.
 *
 * The surface shares a `layoutId` with the tile that opened it, so Framer
 * interpolates the card's position and size into the sheet's - the panel
 * appears to grow out of the thing you tapped rather than materialising over
 * it. That continuity is the whole point: it keeps you oriented, so the
 * detail reads as "more about this tile" instead of "a new screen".
 */
export function DetailSheet({ open, onClose, title, layoutId, accent, children }: DetailSheetProps) {
  const reduced = usePrefersReducedMotion();
  const phone = usePhoneLayout();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Remember what had focus so it can be handed back on close, and move focus
  // into the sheet so keyboard and screen-reader users are not left behind on
  // the page underneath.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));

    return () => {
      cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Escape closes; Tab is kept inside the sheet.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="detail-overlay fixed inset-0 z-50 grid place-items-center p-3 sm:p-6"
          onWheel={(event) => {
            if (!panelRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            layoutId={reduced || phone ? undefined : layoutId}
            initial={
              reduced
                ? { opacity: 0, scale: 0.98 }
                : phone
                  ? { opacity: 0, y: 36, scale: 0.985 }
                  : undefined
            }
            animate={reduced || phone ? { opacity: 1, y: 0, scale: 1 } : undefined}
            exit={
              reduced
                ? { opacity: 0, scale: 0.98 }
                : phone
                  ? { opacity: 0, y: 28, scale: 0.99 }
                  : undefined
            }
            transition={{ type: 'spring', stiffness: phone ? 440 : 460, damping: phone ? 38 : 40, mass: 0.7 }}
            className="sheet relative flex max-h-[88svh] w-full max-w-2xl flex-col focus:outline-none"
            style={accent ? ({ '--tile-glow': accent } as React.CSSProperties) : undefined}
          >
            <header className="detail-sheet-header flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <h2 id={titleId} className="text-lg font-black tracking-[-0.01em] text-white">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="focus-ring grid size-9 shrink-0 place-items-center rounded-full border border-white/16 bg-white/10 text-white/70 transition hover:bg-white/18 hover:text-white"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>

            {/* Content fades in slightly behind the morph so the surface lands
                first and the text does not appear to stretch with it. */}
            <motion.div
              className="detail-sheet-body min-h-0 flex-1 overflow-y-auto px-5 py-5"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: reduced ? 0 : 0.06 }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
