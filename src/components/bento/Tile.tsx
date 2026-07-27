import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { bentoItem, usePhoneLayout, usePrefersReducedMotion } from '../../lib/motion';

type TileProps = {
  label: string;
  /** Metric hue, bled in from the corner. */
  glow?: string;
  className?: string;
  children: ReactNode;
  feature?: boolean;
  /** Shared with the detail sheet so the surface morphs between them. */
  layoutId?: string;
  onOpen?: () => void;
  /** Hides the surface while its sheet is open so the morph has one subject. */
  expanded?: boolean;
};

/**
 * The bento unit.
 *
 * Every tile is label + content, nothing else - the chart is the explanation.
 * When a tile has an `onOpen` it becomes a real button, so the whole card is
 * one keyboard-reachable target rather than a div with a click handler.
 */
export function Tile({
  label,
  glow,
  className,
  children,
  feature = false,
  layoutId,
  onOpen,
  expanded = false,
}: TileProps) {
  const reduced = usePrefersReducedMotion();
  const phone = usePhoneLayout();
  const interactive = Boolean(onOpen);

  const body = (
    <>
      <p className="tile-label">{label}</p>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  );

  const classes = `bento ${feature ? 'bento-feature' : ''} ${interactive ? 'bento-interactive' : ''} p-3 sm:p-4 ${className ?? ''}`;
  const style = {
    ...(glow ? { '--tile-glow': glow } : {}),
    // Kept in the layout, but invisible while its sheet owns the surface.
    ...(expanded ? { opacity: 0 } : {}),
  } as React.CSSProperties;

  if (!interactive) {
    return (
      <motion.section variants={bentoItem} className={classes} style={style}>
        {body}
      </motion.section>
    );
  }

  return (
    <motion.button
      type="button"
      variants={bentoItem}
      layoutId={reduced || phone ? undefined : layoutId}
      onClick={onOpen}
      aria-label={`${label} — open details`}
      className={`${classes} focus-ring text-left`}
      style={style}
      whileTap={reduced ? undefined : { scale: 0.985 }}
    >
      {body}
    </motion.button>
  );
}
