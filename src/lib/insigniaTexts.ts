import { careerKey, type CareerKey } from '../components/CareerEmblem'

// What the insignia of a career says when the person opens it in the passport: what it is to be an engineer of that career, what it is to be an
// engineer in general, and the medal it comes from (the Cruz San Pedro Claver) with its value in the Javeriana community.
export const ENGINEER_TEXT =
  'Hacer ingeniería es usar el conocimiento para resolver problemas reales y mejorar la vida de las personas: primero se entiende a quien se va a servir y después se construye.'

export const CLAVER_TEXT =
  'Esta insignia se inspira en la Cruz San Pedro Claver, la distinción de la Javeriana que honra el servicio a los demás: ocho brazos abiertos, como un sol que se reparte, y una cinta con los colores de la bandera de la Universidad. En la comunidad javeriana, llevarla es recordar que el saber vale por lo que se pone al servicio de otros.'

export const CAREER_TEXT: Record<CareerKey, string> = {
  sistemas: 'Tu ingeniería es la de sistemas: conviertes ideas en software, datos y plataformas que hacen la vida de otros más simple. Detrás de cada línea de código hay una persona a quien servir.',
  tronicas: 'Tu ingeniería es la de las trónicas: unes electrónica, redes y máquinas para que lo físico y lo digital se hablen. Tu circuito no conecta solo componentes, conecta personas.',
  industrial: 'Tu ingeniería es la industrial: logras que las personas, los procesos y los recursos trabajen mejor juntos, con una mano que construye y otra que mide. Mejorar un sistema es cuidar a quienes dependen de él.',
  biomec: 'Tu ingeniería es la de la vida y del movimiento: llevas la técnica hasta el cuerpo, la salud y las máquinas que nos mueven. De una semilla de ciencia nace un cuidado concreto.',
  civil: 'Tu ingeniería es la civil: levantas los puentes, las calles y los edificios que unen lugares y gente. Construyes la base sobre la que otros caminan, estudian y se encuentran.',
  general: 'Tu ingeniería es javeriana: aplicas la ciencia para resolver problemas reales con y para los demás.',
}

export const OTHER_CAREER_TEXT =
  'Tu otra carrera también te hace javeriano: es otro camino para entender el mundo y servirlo. Lo que aprendes en ella no se queda contigo, se pone al servicio de los demás.'

/** The paragraphs of the insignia of a career (by its name). The other career of a double program that is not an engineering has no engineer's paragraph. */
export function insigniaText(career: string, other = false): { career: string; engineer: string | null; claver: string } {
  const key = careerKey(career)
  if (other && key === 'general') return { career: OTHER_CAREER_TEXT, engineer: null, claver: CLAVER_TEXT }
  return { career: CAREER_TEXT[key], engineer: ENGINEER_TEXT, claver: CLAVER_TEXT }
}
