import { generationPicture, sealedGenerationsOf } from '../lib/seals'
import EventSealView from './EventSealView'
import ShapeSeal from './InkSeals'

// The seal of a generation (Peluches, Barbies, Champiñones, Textiles…). The generations are permanent and global: each brings the seal the app
// made for it (a picture turned into ink inside a silhouette of its own) until the coordi edits it (shape, colour, picture). A person who entered
// twice ("Barbies / Minichips") gets a seal for each generation. Returns null when none of them has a seal yet.
export default function GenerationSeals({ generation, size = 104 }: { generation: string | null | undefined; size?: number }) {
  const known = sealedGenerationsOf(generation)
  if (known.length === 0) return null
  return (
    <>
      {known.map((g, i) =>
        g.shape ? (
          <span key={g.key} style={{ display: 'inline-block', transform: `rotate(${i % 2 ? 4 : -3}deg)`, lineHeight: 0 }}>
            <EventSealView shape={g.shape} color={g.color ?? 'currentColor'} imageUrl={generationPicture(g)} initial={g.name} size={size} label={`Sello de la generación ${g.name}`} />
          </span>
        ) : (
          <ShapeSeal
            key={g.key}
            kind={g.kind!}
            ink={g.ink}
            size={size}
            tilt={i % 2 ? 4 : -3}
            label={`Sello de la generación ${g.name}`}
            bottom={g.term ? `${g.name.toUpperCase()} · ${g.term}` : g.name.toUpperCase()}
            source={g.source}
            art={g.key === 'textiles' ? 'spool' : undefined}
          />
        ),
      )}
    </>
  )
}
