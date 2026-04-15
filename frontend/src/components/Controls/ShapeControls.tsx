import { useEffect, useState } from 'react'
import type {
  CircleParams,
  DrawMode,
  RectParams,
  SampleShape,
  ShapeType,
} from '../../types/scan'
import {
  type DisplayUnit,
  DISPLAY_UNIT_OPTIONS,
  displayToUm,
  mmToUm,
  umToDisplay,
} from '../../utils/units'
import Tooltip from '../UI/Tooltip'

interface Props {
  shape: SampleShape | null
  drawMode: DrawMode
  displayUnit: DisplayUnit
  onDrawModeChange: (mode: DrawMode) => void
  onShapeChange: (shape: SampleShape) => void
  onClear: () => void
}

const shapeTypes: { label: string; value: ShapeType }[] = [
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Circle', value: 'circle' },
  { label: 'Freeform', value: 'freeform' },
]

const drawModes: { label: string; value: DrawMode; icon: string | null; hint: string }[] = [
  { label: 'Select', value: 'select', icon: null, hint: 'Select & move shapes' },
  { label: 'Rect', value: 'rectangle', icon: '▭', hint: 'Draw a rectangle by dragging' },
  { label: 'Circle', value: 'circle', icon: '○', hint: 'Draw a circle by dragging' },
  { label: 'Freeform', value: 'freeform', icon: '✏', hint: 'Click to add vertices; double-click or click near start to close' },
]

const INPUT_CLS =
  'w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 font-mono ' +
  'focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-colors ' +
  'dark:bg-[#2c2c2c] dark:border-[#3a3a3a] dark:text-[#d4d4d4] dark:focus:border-[#4a9eff] dark:focus:ring-[#4a9eff]/30'

const LABEL_CLS =
  'text-[10px] font-medium uppercase tracking-wide select-none cursor-default ' +
  'text-gray-500 dark:text-[#888]'

/** Buffered input — lets user type "-10", "1.", etc. without field resetting */
function NumericInput({
  value,
  onChange,
  step = 0.1,
  className = '',
}: {
  value: number
  onChange: (n: number) => void
  step?: number
  className?: string
}) {
  const [raw, setRaw] = useState(String(value))
  useEffect(() => { setRaw(String(value)) }, [value])

  return (
    <input
      type="number"
      step={step}
      value={raw}
      className={className}
      onChange={(e) => {
        const str = e.target.value
        setRaw(str)
        const n = parseFloat(str)
        if (!isNaN(n) && isFinite(n)) onChange(n)
      }}
      onBlur={() => {
        const n = parseFloat(raw)
        if (isNaN(n) || !isFinite(n)) setRaw(String(value))
        else { setRaw(String(n)); onChange(n) }
      }}
    />
  )
}

/** Single labelled field (full-width row) */
function NumInput({
  label,
  hint,
  valueUm,
  onChangeUm,
  displayUnit,
}: {
  label: string
  hint: string
  valueUm: number
  onChangeUm: (um: number) => void
  displayUnit: DisplayUnit
}) {
  const opts = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)!
  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip text={hint} side="right">
        <span className={LABEL_CLS + ' border-b border-dashed border-gray-200 dark:border-[#444]'}>{label}</span>
      </Tooltip>
      <div className="flex items-center gap-1">
        <NumericInput
          value={umToDisplay(valueUm, displayUnit)}
          onChange={(v) => onChangeUm(displayToUm(v, displayUnit))}
          step={opts.step}
          className={INPUT_CLS}
        />
        <span className="text-[10px] shrink-0 w-7 text-right text-gray-400 dark:text-[#555]">{displayUnit}</span>
      </div>
    </div>
  )
}

/** Paired X / Y row (no individual labels overhead, just inline X / Y prefix) */
function PairedNumInput({
  groupLabel,
  groupHint,
  xUm, yUm,
  onChangeX, onChangeY,
  displayUnit,
}: {
  groupLabel: string
  groupHint: string
  xUm: number
  yUm: number
  onChangeX: (um: number) => void
  onChangeY: (um: number) => void
  displayUnit: DisplayUnit
}) {
  const opts = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)!
  const axisLabel = 'text-[10px] text-gray-400 dark:text-[#555] shrink-0'
  const input = INPUT_CLS + ' text-[11px]'

  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip text={groupHint} side="right">
        <span className={LABEL_CLS + ' border-b border-dashed border-gray-200 dark:border-[#444]'}>{groupLabel}</span>
      </Tooltip>
      <div className="flex items-center gap-1">
        <span className={axisLabel}>X</span>
        <NumericInput value={umToDisplay(xUm, displayUnit)} onChange={(v) => onChangeX(displayToUm(v, displayUnit))} step={opts.step} className={input} />
        <span className={axisLabel}>Y</span>
        <NumericInput value={umToDisplay(yUm, displayUnit)} onChange={(v) => onChangeY(displayToUm(v, displayUnit))} step={opts.step} className={input} />
        <span className="text-[10px] shrink-0 text-gray-400 dark:text-[#555]">{displayUnit}</span>
      </div>
    </div>
  )
}

export default function ShapeControls({
  shape,
  drawMode,
  displayUnit,
  onDrawModeChange,
  onShapeChange,
  onClear,
}: Props) {
  const activeShapeType = shape?.type ?? null
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const setShapeType = (type: ShapeType) => {
    if (type === 'rectangle') {
      onShapeChange({ type, rect: shape?.rect ?? { x: 0, y: 0, width: mmToUm(10), height: mmToUm(5) } })
    } else if (type === 'circle') {
      onShapeChange({ type, circle: shape?.circle ?? { cx: 0, cy: 0, radius: mmToUm(5) } })
    } else {
      onShapeChange({
        type: 'freeform',
        freeform: shape?.freeform ?? {
          points: [{ x: 0, y: 0 }, { x: mmToUm(10), y: 0 }, { x: mmToUm(5), y: mmToUm(10) }],
        },
      })
    }
    onDrawModeChange('select')
  }

  const updateRect = (patch: Partial<RectParams>) => {
    if (!shape) return
    onShapeChange({ ...shape, type: 'rectangle', rect: { ...(shape.rect ?? { x: 0, y: 0, width: 0, height: 0 }), ...patch } })
  }

  const updateCircle = (patch: Partial<CircleParams>) => {
    if (!shape) return
    onShapeChange({ ...shape, type: 'circle', circle: { ...(shape.circle ?? { cx: 0, cy: 0, radius: 0 }), ...patch } })
  }

  const activeBtn = 'border-blue-400 bg-blue-50 text-blue-600 dark:border-[#4a9eff] dark:bg-[#1a3a5c] dark:text-[#4a9eff]'
  const idleBtn = 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-[#3a3a3a] dark:bg-[#2c2c2c] dark:text-[#888] dark:hover:bg-[#333] dark:hover:text-[#bbb]'

  return (
    <section className="space-y-4">

      {/* Draw tools */}
      <div>
        <p className={LABEL_CLS + ' mb-2'}>Draw Tool</p>
        <div className="grid grid-cols-4 gap-1">
          {drawModes.map((m) => (
            <Tooltip key={m.value} text={m.hint} side="top">
              <button
                onClick={() => onDrawModeChange(m.value)}
                className={`w-full flex flex-col items-center justify-center py-2 rounded border text-xs transition-colors ${drawMode === m.value ? activeBtn : idleBtn}`}
              >
                {m.icon === null ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 20" fill="currentColor">
                    <path d="M1 1 L1 14 L4.5 10.5 L7.5 18 L9.5 17 L6.5 9.5 L12 9.5 Z" />
                  </svg>
                ) : (
                  <span className="text-sm leading-none">{m.icon}</span>
                )}
                <span className="mt-0.5 text-[10px]">{m.label}</span>
              </button>
            </Tooltip>
          ))}
        </div>
        {drawMode === 'freeform' && (
          <p className="mt-1.5 text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1.5 leading-relaxed dark:text-[#4a9eff] dark:bg-[#1a3a5c]/40 dark:border-[#4a9eff]/20">
            Click to add vertices. Double-click or click near the first point to close.
          </p>
        )}
      </div>

      {/* Shape type */}
      <div>
        <p className={LABEL_CLS + ' mb-2'}>Sample Shape</p>
        <div className="grid grid-cols-3 gap-1">
          {shapeTypes.map((s) => (
            <button
              key={s.value}
              onClick={() => setShapeType(s.value)}
              className={`py-1.5 rounded border text-xs transition-colors ${shape && activeShapeType === s.value ? activeBtn : idleBtn}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rectangle dimensions */}
      {shape?.type === 'rectangle' && shape.rect && (
        <div className="space-y-2">
          <p className={LABEL_CLS}>Dimensions</p>
          <PairedNumInput
            groupLabel="Origin"
            groupHint="Top-left corner coordinates of the rectangle"
            xUm={shape.rect.x} yUm={shape.rect.y}
            onChangeX={(v) => updateRect({ x: v })}
            onChangeY={(v) => updateRect({ y: v })}
            displayUnit={displayUnit}
          />
          <PairedNumInput
            groupLabel="Size"
            groupHint="Width (X) and height (Y) of the rectangle"
            xUm={shape.rect.width} yUm={shape.rect.height}
            onChangeX={(v) => updateRect({ width: Math.max(0.001, v) })}
            onChangeY={(v) => updateRect({ height: Math.max(0.001, v) })}
            displayUnit={displayUnit}
          />
        </div>
      )}

      {/* Circle dimensions */}
      {shape?.type === 'circle' && shape.circle && (
        <div className="space-y-2">
          <p className={LABEL_CLS}>Dimensions</p>
          <PairedNumInput
            groupLabel="Center"
            groupHint="Center point of the circle"
            xUm={shape.circle.cx} yUm={shape.circle.cy}
            onChangeX={(v) => updateCircle({ cx: v })}
            onChangeY={(v) => updateCircle({ cy: v })}
            displayUnit={displayUnit}
          />
          <NumInput
            label="Radius"
            hint="Radius of the circle"
            valueUm={shape.circle.radius}
            onChangeUm={(v) => updateCircle({ radius: Math.max(0.001, v) })}
            displayUnit={displayUnit}
          />
        </div>
      )}

      {/* Freeform points */}
      {shape?.type === 'freeform' && shape.freeform && (
        <div className="space-y-1.5">
          <p className={LABEL_CLS}>Polygon Points</p>

          <div className="space-y-0.5">
            {shape.freeform.points.map((p, i) => {
              const pts = shape.freeform!.points
              const isOver = dragOverIndex === i && dragIndex !== i

              const updatePoint = (axis: 'x' | 'y', um: number) => {
                const updated = pts.map((pt, j) => j === i ? { ...pt, [axis]: um } : pt)
                onShapeChange({ ...shape, freeform: { points: updated } })
              }

              const removePoint = () => {
                if (pts.length <= 3) return
                onShapeChange({ ...shape, freeform: { points: pts.filter((_, j) => j !== i) } })
              }

              const rowBase = 'flex items-center gap-1 rounded px-1 py-0.5 transition-colors border'
              const rowCls = isOver
                ? rowBase + ' bg-blue-50 border-blue-300 dark:bg-[#1a3a5c] dark:border-[#4a9eff]/50'
                : dragIndex === i
                ? rowBase + ' opacity-40 border-dashed border-gray-300 dark:border-[#555]'
                : rowBase + ' border-transparent hover:bg-gray-50 dark:hover:bg-[#252525]'

              const ptInput =
                'w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-800 ' +
                'focus:outline-none focus:border-blue-400 transition-colors ' +
                'dark:bg-[#2c2c2c] dark:border-[#3a3a3a] dark:text-[#d4d4d4] dark:focus:border-[#4a9eff]'

              return (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i) }}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === i) return
                    const reordered = [...pts]
                    const [moved] = reordered.splice(dragIndex, 1)
                    reordered.splice(i, 0, moved)
                    onShapeChange({ ...shape, freeform: { points: reordered } })
                    setDragIndex(null); setDragOverIndex(null)
                  }}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                  className={rowCls}
                >
                  <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none shrink-0 text-sm leading-none hover:text-gray-500 dark:text-[#444] dark:hover:text-[#888]" title="Drag to reorder">⠿</span>
                  <span className="text-[10px] font-mono font-semibold text-blue-500 w-6 shrink-0 dark:text-[#4a9eff]">P{i + 1}</span>
                  <div className="flex items-center gap-0.5 flex-1">
                    <span className="text-[10px] text-gray-400 dark:text-[#555]">X</span>
                    <NumericInput value={umToDisplay(p.x, displayUnit)} onChange={(v) => updatePoint('x', displayToUm(v, displayUnit))} step={DISPLAY_UNIT_OPTIONS.find(o => o.value === displayUnit)!.step} className={ptInput} />
                  </div>
                  <div className="flex items-center gap-0.5 flex-1">
                    <span className="text-[10px] text-gray-400 dark:text-[#555]">Y</span>
                    <NumericInput value={umToDisplay(p.y, displayUnit)} onChange={(v) => updatePoint('y', displayToUm(v, displayUnit))} step={DISPLAY_UNIT_OPTIONS.find(o => o.value === displayUnit)!.step} className={ptInput} />
                  </div>
                  <button onClick={removePoint} disabled={pts.length <= 3} title="Remove point" className="text-gray-300 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed text-sm leading-none shrink-0 transition-colors dark:text-[#444]">×</button>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              const pts = shape.freeform!.points
              const last = pts[pts.length - 1]
              onShapeChange({ ...shape, freeform: { points: [...pts, { x: last.x + displayToUm(1, displayUnit), y: last.y }] } })
            }}
            className="w-full py-1 rounded border border-dashed text-[10px] transition-colors border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:border-[#3a3a3a] dark:text-[#666] dark:hover:border-[#4a9eff] dark:hover:text-[#4a9eff]"
          >
            + Add Point
          </button>
        </div>
      )}

      {shape && (
        <button
          onClick={onClear}
          className="w-full py-1.5 rounded border text-xs transition-colors border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400/80 dark:hover:bg-red-900/20 dark:hover:border-red-700"
        >
          Clear Shape
        </button>
      )}
    </section>
  )
}
