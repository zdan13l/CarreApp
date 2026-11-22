import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { sealForSeed } from '../lib/seals'
import { useScrollLock } from '../lib/scrollLock'
import Stamp from './Stamp'

const CULTURE: Record<string, string> = { egipcia: 'egipcia', nordica: 'nórdica', griega: 'griega', mexicana: 'mexicana', china: 'china' }

// "Mi base": the seal of this base in a box of its own. Tap it to see it big, with what it is: which mythology it belongs to and what it refers to.
export default function BaseSealCard({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const seal = sealForSeed(id)
  const culture = CULTURE[seal.culture] ?? seal.culture
  return (
    <section className="top-others" aria-label="El sello de mi base">
      <div className="card base-seal-card">
        <button type="button" className="seal-btn" aria-haspopup="dialog" aria-label={`Ver el sello de ${name} en grande`} onClick={() => setOpen(true)}>
          <Stamp seed={id} name={name} round={0} state="stamped" size={118} straight />
        </button>
        <div>
          <p className="alias-label mono">Mi sello</p>
          <p className="alias-name">{seal.name}</p>
        </div>
      </div>
      {open && <SealDialog id={id} name={name} culture={culture} onClose={() => setOpen(false)} />}
    </section>
  )
}

function SealDialog({ id, name, culture, onClose }: { id: string; name: string; culture: string; onClose: () => void }) {
  const seal = sealForSeed(id)
  useScrollLock()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="sheet-backdrop centered" role="presentation" onClick={onClose}>
      <section className="account-sheet team-sheet seal-sheet" role="dialog" aria-modal="true" aria-label={`Sello de ${name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost icon-btn sheet-x" onClick={onClose} aria-label="Cerrar" title="Cerrar">
          <X size={18} />
        </button>
        <Stamp seed={id} name={name} round={0} state="stamped" size={250} straight />
        <h2>{seal.name}</h2>
        <p className="account-role">Mitología {culture}</p>
        <p className="seal-story">{seal.story}</p>
      </section>
    </div>,
    document.body,
  )
}
