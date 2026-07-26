import type { ComponentPropsWithoutRef, ReactNode } from "react"

/*
 * Adapted from Magic UI's MIT-licensed Marquee component.
 * Source (reviewed 2026-07-24):
 * https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/marquee.tsx
 * Upstream SHA-256 at review time:
 * 779f360a107409bfa35cda13bcef7d54cd620a15ab4a0ee50412442a4dd6b9c7
 *
 * Changes: plain CSS instead of Tailwind utilities, decorative repetitions hidden
 * from assistive technology, a small repeat cap, and no third-party dependency.
 */

interface MagicMarqueeProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  reverse?: boolean
  pauseOnHover?: boolean
  repeat?: number
}

export function MagicMarquee({
  children,
  className = "",
  reverse = false,
  pauseOnHover = false,
  repeat = 3,
  ...props
}: MagicMarqueeProps) {
  const safeRepeat = Math.min(Math.max(Math.floor(repeat), 2), 5)

  return (
    <div
      {...props}
      className={`magic-marquee ${pauseOnHover ? "magic-marquee--pausable" : ""} ${className}`.trim()}
      data-reverse={reverse ? "true" : "false"}
      aria-hidden="true"
    >
      {Array.from({ length: safeRepeat }, (_, index) => (
        <div className="magic-marquee__track" key={index}>
          {children}
        </div>
      ))}
    </div>
  )
}
