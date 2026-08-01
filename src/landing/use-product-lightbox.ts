import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const CLICK_ZOOM = 2

type Point = { x: number; y: number }
type Offset = { x: number; y: number }

interface LightboxOptions {
  imageKey: string
  previousImage: () => void
  nextImage: () => void
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function clampOffset(offset: Offset, zoom: number): Offset {
  if (zoom <= MIN_ZOOM || typeof window === "undefined") return { x: 0, y: 0 }
  const maxX = ((zoom - 1) * window.innerWidth) / 2
  const maxY = ((zoom - 1) * window.innerHeight) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

export function useProductLightbox({
  imageKey,
  previousImage,
  nextImage,
}: LightboxOptions) {
  const [isOpen, setOpen] = useState(false)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const previousImageRef = useRef(previousImage)
  const nextImageRef = useRef(nextImage)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef({
    startDistance: 0,
    startZoom: MIN_ZOOM,
    startCenter: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
    moved: false,
    usedPinch: false,
  })
  const lastTouchTapRef = useRef(0)
  const lastPointerTypeRef = useRef("")

  previousImageRef.current = previousImage
  nextImageRef.current = nextImage

  const resetTransform = () => {
    setZoom(MIN_ZOOM)
    setOffset({ x: 0, y: 0 })
  }

  const open = (trigger: HTMLElement | null) => {
    returnFocusRef.current = trigger
    resetTransform()
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    resetTransform()
    queueMicrotask(() => returnFocusRef.current?.focus())
  }

  const updateZoom = (nextZoom: number) => {
    const clampedZoom = clampZoom(nextZoom)
    setZoom(clampedZoom)
    setOffset((current) => clampOffset(current, clampedZoom))
  }

  const zoomIn = () => updateZoom(zoom + 0.25)
  const zoomOut = () => updateZoom(zoom - 0.25)
  const toggleZoom = () => {
    if (zoom > MIN_ZOOM) resetTransform()
    else updateZoom(CLICK_ZOOM)
  }

  const showPreviousImage = () => {
    resetTransform()
    previousImageRef.current()
  }

  const showNextImage = () => {
    resetTransform()
    nextImageRef.current()
  }

  useEffect(() => {
    resetTransform()
  }, [imageKey])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    queueMicrotask(() => closeButtonRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        showPreviousImage()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        showNextImage()
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        setZoom((value) => clampZoom(value + 0.25))
      } else if (event.key === "-") {
        event.preventDefault()
        setZoom((value) => clampZoom(value - 0.25))
      } else if (event.key === "0") {
        event.preventDefault()
        resetTransform()
      } else if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown, true)
      pointersRef.current.clear()
    }
  }, [isOpen])

  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const first = points[0]
    if (!first) return
    gestureRef.current = {
      startDistance: points[1] ? distance(first, points[1]) : 0,
      startZoom: zoom,
      startCenter: points[1] ? midpoint(first, points[1]) : first,
      startOffset: offset,
      startPoint: first,
      moved: false,
      usedPinch: points.length > 1,
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    lastPointerTypeRef.current = event.pointerType
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is an enhancement; native pointer tracking still works without it.
    }
    beginGesture()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointersRef.current.values()]
    const gesture = gestureRef.current
    const first = points[0]
    if (!first) return

    if (points.length >= 2 && gesture.startDistance > 0) {
      const second = points[1]
      if (!second) return
      const nextZoom = clampZoom(
        gesture.startZoom * (distance(first, second) / gesture.startDistance),
      )
      const center = midpoint(first, second)
      gesture.moved = true
      gesture.usedPinch = true
      setZoom(nextZoom)
      setOffset(
        clampOffset(
          {
            x: gesture.startOffset.x + center.x - gesture.startCenter.x,
            y: gesture.startOffset.y + center.y - gesture.startCenter.y,
          },
          nextZoom,
        ),
      )
      return
    }

    const deltaX = first.x - gesture.startPoint.x
    const deltaY = first.y - gesture.startPoint.y
    if (Math.hypot(deltaX, deltaY) > 6) gesture.moved = true
    if (zoom > MIN_ZOOM) {
      setOffset(
        clampOffset(
          { x: gesture.startOffset.x + deltaX, y: gesture.startOffset.y + deltaY },
          zoom,
        ),
      )
    }
  }

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    const isTouchTap =
      event.pointerType === "touch" && !gesture.moved && !gesture.usedPinch
    pointersRef.current.delete(event.pointerId)

    if (isTouchTap) {
      const now = Date.now()
      if (now - lastTouchTapRef.current < 320) {
        toggleZoom()
        lastTouchTapRef.current = 0
      } else {
        lastTouchTapRef.current = now
      }
    }

    if (pointersRef.current.size > 0) beginGesture()
  }

  const onImageClick = () => {
    if (lastPointerTypeRef.current !== "touch" && !gestureRef.current.moved) toggleZoom()
  }

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    updateZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25))
  }

  return {
    isOpen,
    zoom,
    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
    dialogRef,
    closeButtonRef,
    open,
    close,
    zoomIn,
    zoomOut,
    showPreviousImage,
    showNextImage,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onImageClick,
    onWheel,
  }
}
