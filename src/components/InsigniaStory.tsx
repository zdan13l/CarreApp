import { insigniaText } from '../lib/insigniaTexts'
import Insignia from './Insignia'

// The insignia of a career opened in the passport: the big medal with its ribbon and what it means (being an engineer of that career, and the
// Cruz San Pedro Claver it comes from).
export default function InsigniaStory({ career, other = false }: { career: string; other?: boolean }) {
  const t = insigniaText(career, other)
  return (
    <>
      <p className="moment-kicker">{other ? 'Tu otra insignia' : 'Tu insignia'}</p>
      <div className="insignia-zoom">
        <Insignia career={career} size={230} other={other} />
      </div>
      <h2>{career || 'Ingeniería'}</h2>
      <div className="insignia-story">
        <p><strong>{t.career}</strong></p>
        {t.engineer && <p>{t.engineer}</p>}
        <p className="claver">{t.claver}</p>
      </div>
    </>
  )
}
