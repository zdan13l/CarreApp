import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pictureToInk } from '../lib/customSeals'
import { SHAPES, SHAPE_LABEL, type SealShape } from '../lib/eventSeals'
import { errMsg } from '../pages/admin/AdminContext'
import EventSealView from './EventSealView'

export interface SealDesign {
  shape: SealShape
  color: string
  imagePath: string | null // the picture uploaded for it (null: none)
  imageUrl: string | null
}
export type SealImage = { blob: Blob } | 'keep' | 'remove'

// The editor of ONE seal: shape, colour and a picture (turned into ink), with a preview. It is used by the workshop only (Administración global →
// Sellos): it does not know what the seal is for, the page that opens it saves it. `fallbackImage` is the picture the app brings, kept while none
// is uploaded.
export default function SealEditor({
  name,
  design,
  fallbackImage,
  defaultColor,
  others = [],
  resetLabel,
  onSave,
  onReset,
}: {
  name: string
  design?: SealDesign | null
  fallbackImage?: string | null
  defaultColor: string
  others?: { shape: string; color: string; image_path: string | null }[] // the other seals of the same kind in the same carrera: two cannot look alike
  resetLabel?: string
  onSave: (shape: SealShape, color: string, image: SealImage) => Promise<string | null>
  onReset?: () => Promise<string | null>
}) {
  const [shape, setShape] = useState<SealShape>(design?.shape ?? 'circle')
  const [color, setColor] = useState(design?.color ?? defaultColor)
  const [file, setFile] = useState<File | null>(null)
  const [invert, setInvert] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    if (!file) {
      setPreview(null)
      return
    }
    void pictureToInk(file, invert, 256)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => setPreview(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, invert])

  const shownImage = preview ?? (removeImage ? null : (design?.imageUrl ?? fallbackImage ?? null))
  const keepsImage = !file && !removeImage ? (design?.imagePath ?? null) : null
  const duplicate = others.find((o) => o.shape === shape && o.color.toLowerCase() === color.toLowerCase() && (o.image_path ?? '') === (file ? '\0new' : (keepsImage ?? '')))

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const image: SealImage = file ? { blob: await pictureToInk(file, invert) } : removeImage ? 'remove' : 'keep'
      const err = await onSave(shape, color, image)
      if (err) setMsg(err)
    } catch (e) {
      setMsg(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  async function reset() {
    if (!onReset) return
    setBusy(true)
    setMsg(null)
    const err = await onReset()
    if (err) setMsg(err)
    setBusy(false)
  }

  return (
    <div className="seal-editor">
      <EventSealView shape={shape} color={color} imageUrl={shownImage} initial={name} size={132} label="Previsualización del sello" />
      <div className="seal-fields">
        <label className="inline-field">
          Forma
          <select value={shape} onChange={(e) => setShape(e.target.value as SealShape)}>
            {SHAPES.map((s) => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="btn-like">
          <Upload size={16} aria-hidden="true" /> {file ? file.name : design?.imagePath ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false) }} />
        </label>
        {(file || design?.imagePath) && (
          <>
            <label className="inline-field"><span><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Dibujo claro sobre fondo oscuro (invertir)</span></label>
            <button type="button" className="ghost" onClick={() => { setFile(null); setRemoveImage(true) }}>Quitar imagen</button>
          </>
        )}
        {duplicate && <p className="warn">Otro sello de este tipo en esta carrera ya usa este diseño: cambia la forma, el color o la imagen.</p>}
        {msg && <p className="error">{msg}</p>}
        <div className="row">
          <button disabled={busy || Boolean(duplicate)} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar sello'}</button>
          {onReset && <button type="button" className="ghost danger" disabled={busy} onClick={() => void reset()}>{resetLabel ?? 'Quitar sello'}</button>}
        </div>
      </div>
    </div>
  )
}
