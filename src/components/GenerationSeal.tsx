import { generationsOf } from '../lib/seals'
import ShapeSeal from './InkSeals'

// The seal of a generation (Peluches, Barbies, Champiñones, Textiles…): a picture turned into ink inside a silhouette of its own. A person who
// entered twice ("Barbies / Pendiente") gets a seal for each generation this version knows. Returns null when it knows none.
export default function GenerationSeals({ generation, size = 104 }: { generation: string | null | undefined; size?: number }) {
  const known = generationsOf(generation).filter((g) => g.kind)
  if (known.length === 0) return null
  return (
    <>
      {known.map((g, i) => (
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
      ))}
    </>
  )
}
