import { useEffect, useRef, type RefObject } from "react"

interface UseModalDialogOptions {
  dialogRef: RefObject<HTMLElement | null>
  initialFocusRef: RefObject<HTMLElement | null>
  isOpen: boolean
  onClose: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

let activeModalCount = 0
let originalBodyOverflow = ""

export function acquireModalPageLock() {
  if (activeModalCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.body.classList.add("is-locked")
  }
  activeModalCount += 1
}

export function releaseModalPageLock() {
  activeModalCount = Math.max(0, activeModalCount - 1)
  if (activeModalCount > 0) return
  document.body.style.overflow = originalBodyOverflow
  document.body.classList.remove("is-locked")
}

export function useModalDialog({
  dialogRef,
  initialFocusRef,
  isOpen,
  onClose,
  returnFocusRef,
}: UseModalDialogOptions) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    acquireModalPageLock()
    initialFocusRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true")
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      releaseModalPageLock()
      if (activeModalCount > 0) return
      const returnTarget = returnFocusRef?.current ?? previousFocus
      if (returnTarget?.isConnected) returnTarget.focus()
    }
  }, [dialogRef, initialFocusRef, isOpen, returnFocusRef])
}
