import CommitteeSeal from './CommitteeSeal'
import EventSealView from './EventSealView'
import { CultureSeal } from './Seals'
import Stamp from './Stamp'
import { imageUrl, type EventSeal } from '../lib/eventSeals'
import type { SealElement } from '../lib/sealElements'

// The seal of an element of a carrera as it is shown in the panel: the one made for this carrera in the workshop, or, while none was made, the
// seal the app has always had (subtheme, committee and base) or the first letter (theme).
export default function ElementSeal({ element, seal, size = 64 }: { element: SealElement; seal?: EventSeal; size?: number }) {
  const e = element
  if (seal || e.kind === 'theme' || e.kind === 'coordinator') {
    return <EventSealView shape={seal?.shape ?? 'circle'} color={seal?.color ?? 'currentColor'} imageUrl={imageUrl(seal?.image_path ?? null)} initial={e.name} gold={e.kind === 'coordinator'} size={size} label={`Sello de ${e.name}`} />
  }
  if (e.kind === 'subtheme' && e.theme) return <CultureSeal culture={e.ref} theme={e.theme} top={e.name.toUpperCase()} bottom="DE SIEMPRE" size={size} tilt={0} />
  if (e.kind === 'committee') return <CommitteeSeal committee={e.ref} size={size} />
  return <Stamp seed={e.ref} name={e.name} round={0} state="stamped" size={size} straight />
}

/** One line under the name: what the seal is. */
export function sealNote(element: SealElement, seal?: EventSeal): string {
  if (element.kind === 'coordinator') return 'Dorado: se pone solo al elegir al coordi'
  if (seal) return `sello propio de esta carrera · ${seal.color}`
  return element.kind === 'subtheme' || element.kind === 'committee' || element.kind === 'base' ? 'sello de siempre (todavía no se ha creado uno para esta carrera)' : 'sin sello todavía'
}
