import type { ReactNode } from 'react'

interface Props {
  text: string
  children: ReactNode
  side?: 'top' | 'right'
}

/**
 * Lightweight CSS-only tooltip that appears on hover.
 * Wrap any element you want to give a hint to.
 *
 * Usage:
 *   <Tooltip text="Step size in X direction">
 *     <label>ΔX</label>
 *   </Tooltip>
 */
export default function Tooltip({ text, children, side = 'top' }: Props) {
  const positionClasses =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'left-full top-1/2 -translate-y-1/2 ml-2'

  const arrowClasses =
    side === 'top'
      ? 'top-full left-1/2 -translate-x-1/2 border-t-[#111827]'
      : 'right-full top-1/2 -translate-y-1/2 border-r-[#111827]'

  return (
    <span className="relative group/tip inline-flex items-center">
      {children}
      <span
        className={`pointer-events-none absolute ${positionClasses}
          px-2 py-1 rounded bg-[#111827] text-[#e5e7eb] text-[10px] leading-snug
          whitespace-nowrap max-w-[200px] text-center
          opacity-0 group-hover/tip:opacity-100
          transition-opacity duration-150 z-[200] shadow-xl`}
      >
        {text}
        <span
          className={`absolute ${arrowClasses}
            border-[4px] border-transparent`}
        />
      </span>
    </span>
  )
}
