import { insigniaText } from '../lib/insigniaTexts'
import Insignia from './Insignia'

// The insignia of a career opened in the passport: the big medal with its ribbon and what it means (being an engineer of that career, and the
// Cruz San Pedro Claver it comes from).
export default function InsigniaStory({ career }: { career: string }) {
  const t = insigniaText(career)
  return (
    <>
      <p className="moment-kicker">Tu insignia</p>
      <div className="insignia-zoom">
        <Insignia career={career} size={230} />
      </div>
      <h2>{career || 'Ingeniería'}</h2>
      <div className="insignia-story">
        <p><strong>{t.career}</strong></p>
        <p>{t.engineer}</p>
        <p className="claver">{t.claver}</p>
      </div>
    </>
  )
}
