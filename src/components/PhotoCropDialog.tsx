import { Check, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clampView, cropRect, MAX_ZOOM, type CropView } from '../lib/image'

// The usual profile-photo step: after choosing a picture the person drags it, zooms it (slider, wheel or pinch) and centres the face in a
// square, with a circle showing what the avatar will display. What is inside the square is saved; the rest is thrown away, so a huge
// photo with a tiny person in a corner becomes a good portrait. The result goes to the same upload as any photo.
const OUTPUT_SIDE = 1000 // the same long side the photos are saved with (src/lib/image.ts)

export default function PhotoCropDialog({ file, title = 'Acomoda la foto', onCancel, onConfirm }: { file: File; title?: string; onCancel: () => void; onConfirm: (cropped: File) => void }) {
  const frame = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [square, setSquare] = useState(300)
  const [view, setView] = useState<CropView>({ zoom: 1, x: 0, y: 0 })
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // the picture, shown through an object URL (the browser turns it the right way up) and measured once it loads
  useEffect(() => {
    if (!file.type.startsWith('image/')) {
      setFailed('El archivo debe ser una imagen.')
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  useLayoutEffect(() => {
    const measure = () => frame.current && setSquare(frame.current.clientWidth)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (size) setView((v) => clampView(size, square, v)) // the square changed (rotating the phone): keep the picture covering it
  }, [size, square])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onCancel])

  const change = useCallback((next: (v: CropView) => CropView) => {
    setView((v) => (size ? clampView(size, square, next(v)) : v))
  }, [size, square])

  // zoom keeps the point under the centre where it is
  const zoomTo = useCallback((zoom: number) => change((v) => ({ zoom, x: (v.x / v.zoom) * zoom, y: (v.y / v.zoom) * zoom })), [change])

  // the wheel zooms; it needs a listener that is allowed to stop the page from scrolling
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      change((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)))
        return { zoom, x: (v.x / v.zoom) * zoom, y: (v.y / v.zoom) * zoom }
      })
    }
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [change])

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }
  function move(e: React.PointerEvent) {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / (pinch.current.distance || 1)
      const start = pinch.current.zoom
      change((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, start * ratio))
        return { zoom, x: (v.x / v.zoom) * zoom, y: (v.y / v.zoom) * zoom }
      })
    } else {
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      change((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 30 : 10
    const move: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    const d = move[e.key]
    if (d) {
      e.preventDefault()
      change((v) => ({ ...v, x: v.x + d[0], y: v.y + d[1] }))
    } else if (e.key === '+' || e.key === '=') zoomTo(view.zoom * 1.1)
    else if (e.key === '-') zoomTo(view.zoom / 1.1)
  }

  async function confirm() {
    if (!size) return
    setWorking(true)
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const { sx, sy, side } = cropRect({ width: bitmap.width, height: bitmap.height }, square, view)
      const out = Math.max(200, Math.min(OUTPUT_SIDE, Math.round(side)))
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo procesar la imagen.')
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
      bitmap.close()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('No se pudo procesar la imagen.')
      onConfirm(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'No se pudo procesar la imagen.')
      setWorking(false)
    }
  }

  const scale = size ? (square / Math.min(size.width, size.height)) * view.zoom : 1
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog crop-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div
          ref={frame}
          className="crop-frame"
          tabIndex={0}
          role="img"
          aria-label="Foto: arrastra con el dedo o las flechas para moverla"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        >
          {url && (
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              style={size ? { width: size.width * scale, height: size.height * scale, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` } : { visibility: 'hidden' }}
            />
          )}
        </div>
        <div className="crop-zoom">
          <button type="button" className="ghost icon-only" aria-label="Alejar" disabled={!size || view.zoom <= 1} onClick={() => zoomTo(view.zoom / 1.2)}><Minus size={18} aria-hidden="true" /></button>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} disabled={!size} aria-label="Zoom" onChange={(e) => zoomTo(Number(e.target.value))} />
          <button type="button" className="ghost icon-only" aria-label="Acercar" disabled={!size || view.zoom >= MAX_ZOOM} onClick={() => zoomTo(view.zoom * 1.2)}><Plus size={18} aria-hidden="true" /></button>
        </div>
        {failed && <p className="error" role="alert">{failed}</p>}
        <div className="dialog-actions">
          <button type="button" disabled={!size || working} onClick={() => void confirm()}><Check size={18} aria-hidden="true" /> {working ? 'Procesando…' : 'Usar esta foto'}</button>
          <button type="button" className="btn-danger" disabled={working} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
