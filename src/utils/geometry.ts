import type { Point, SampleShape, Viewport } from '../types/scan'

// ── Viewport transforms ────────────────────────────────────────────────────────

/** Convert micron coordinate to canvas pixel. */
export function umToPixel(um: number, viewportOrigin: number, scale: number): number {
  return (um - viewportOrigin) * scale
}

/** Convert canvas pixel to micron coordinate. */
export function pixelToUm(px: number, viewportOrigin: number, scale: number): number {
  return px / scale + viewportOrigin
}

/** Convert a canvas pointer position {x, y} in pixels to microns. */
export function pointerToUm(
  pointerX: number,
  pointerY: number,
  vp: Viewport,
): Point {
  return {
    x: pixelToUm(pointerX, vp.left, vp.scale),
    y: pixelToUm(pointerY, vp.top, vp.scale),
  }
}

/**
 * Zoom the viewport around a point (umX, umY), by a scale factor.
 * Keeps the micron coordinate under the cursor at the same pixel position.
 */
export function zoomViewport(
  vp: Viewport,
  cursorUmX: number,
  cursorUmY: number,
  factor: number,
): Viewport {
  const newScale = vp.scale * factor
  return {
    scale: newScale,
    left: cursorUmX - (cursorUmX - vp.left) * (vp.scale / newScale),
    top: cursorUmY - (cursorUmY - vp.top) * (vp.scale / newScale),
  }
}

/**
 * Build a viewport that fits the given bounding box in the canvas with padding.
 */
export function fitViewport(
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
  canvasW: number,
  canvasH: number,
  padding = 0.12,
): Viewport {
  const bw = xMax - xMin || 100
  const bh = yMax - yMin || 100
  const scaleX = canvasW / (bw * (1 + padding * 2))
  const scaleY = canvasH / (bh * (1 + padding * 2))
  const scale = Math.min(scaleX, scaleY)
  const centerUmX = (xMin + xMax) / 2
  const centerUmY = (yMin + yMax) / 2
  return {
    scale,
    left: centerUmX - canvasW / 2 / scale,
    top: centerUmY - canvasH / 2 / scale,
  }
}

// ── Shape bounding boxes ───────────────────────────────────────────────────────

export function shapeBoundingBox(
  shape: SampleShape,
): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
  if (shape.type === 'rectangle' && shape.rect) {
    const r = shape.rect
    return { xMin: r.x, yMin: r.y, xMax: r.x + r.width, yMax: r.y + r.height }
  }
  if (shape.type === 'circle' && shape.circle) {
    const c = shape.circle
    return {
      xMin: c.cx - c.radius,
      yMin: c.cy - c.radius,
      xMax: c.cx + c.radius,
      yMax: c.cy + c.radius,
    }
  }
  if (shape.type === 'freeform' && shape.freeform) {
    const pts = shape.freeform.points
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    return {
      xMin: Math.min(...xs),
      yMin: Math.min(...ys),
      xMax: Math.max(...xs),
      yMax: Math.max(...ys),
    }
  }
  return null
}

// ── Point-in-polygon (client-side, for hover checks) ──────────────────────────

export function pointInPolygon(x: number, y: number, pts: Point[]): boolean {
  let inside = false
  const n = pts.length
  let j = n - 1
  for (let i = 0; i < n; i++) {
    const xi = pts[i].x, yi = pts[i].y
    const xj = pts[j].x, yj = pts[j].y
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
    j = i
  }
  return inside
}

// ── Distance helpers ───────────────────────────────────────────────────────────

export function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
