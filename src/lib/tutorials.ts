import type { TutorialStep } from '../components/Tutorial'

// The guided tours shown while the Carrera is Habilitada. Only bases and runners have one. A step with a `target` lights that element up; a
// step without one is shown centred (there is nothing on the screen to point at).

// the same four steps for both: the account sheet (notifications, sound, light/dark)
const accountSteps = (who: 'base' | 'runner'): TutorialStep[] => [
  { tab: 'ronda', target: '.account-btn', title: 'Tu cuenta', body: 'Toca tu foto para abrir tu cuenta. Ahí están los ajustes de abajo y «Cerrar sesión».' },
  { title: 'Activa las notificaciones', body: `En tu cuenta toca «Activar notificaciones» para recibir los avisos con el teléfono bloqueado. En iPhone instala la app en la pantalla de inicio.` },
  { title: 'Alertas con sonido', body: who === 'base' ? 'Toca «Activar sonido de alertas»: así te suena el teléfono cuando el coordinador te avisa algo.' : 'Toca «Activar sonido de alertas»: así te suena el teléfono si llevas mucho tiempo caminando o el coordinador te avisa.' },
  { title: 'Modo claro u oscuro', body: 'En tu cuenta puedes cambiar entre modo claro y modo oscuro cuando quieras.' },
]

export const baseTutorial = (): TutorialStep[] => [
  { tab: 'ronda', target: '.base-ticket', title: 'Tu ventanilla', body: 'Aquí está tu base y cuántos grupos ya sellaste.' },
  { tab: 'ronda', target: '.walking', title: '1. Grupos en camino', body: 'Cada grupo con su reloj y la base de donde viene. Apura a uno o a los dos con «Apurar».' },
  { tab: 'ronda', target: '.match > button.btn-block', title: '2. Confirma la llegada', body: 'Cuando estén los dos grupos, toca «Ya llegaron ambos grupos». Sin eso no se puede calificar.' },
  { tab: 'ronda', title: '3. Califica las etapas', body: 'Minijuego, pregunta y barra, en ese orden. Eliges al ganador de cada una: vale 1 punto y solo el coordinador corrige.' },
  { tab: 'ronda', title: '4. Déjalos ir', body: 'Al final queda solo «Ya los dejé ir». Se activa cuando el coordinador avisa la rotación; luego llegan los siguientes grupos.' },
  { tab: 'resultados', target: '.bottom-nav', title: 'Resultados', body: 'Los equipos de la Carrera y lo que calificaste en cada cruce.' },
  { tab: 'base', target: '.bottom-nav', title: 'Mi base', body: 'Tu guía con las preguntas y respuestas, y la foto y ubicación de tu base.' },
  ...accountSteps('base'),
]

export const runnerTutorial = (isTracker: boolean): TutorialStep[] => [
  { tab: 'ronda', target: '.status-ticket', title: 'Tu grupo', body: 'Tu grupo y los puntos que lleva. Nadie ve quién va ganando hasta que el coordinador lo anuncie.' },
  { tab: 'ronda', title: 'Tu siguiente base', body: 'En Visado ves a qué base ir y contra quién juegas. Si caminas mucho, la app te avisa: apúrate o dile a la base si ya llegaste.' },
  { tab: 'ruta', target: '.bottom-nav', title: 'Tu pasaporte', body: 'Cada vez que una base califica tus tres etapas recibes su sello.' },
  { tab: 'top', target: '.bottom-nav', title: 'Top', body: 'Tus puntos y los demás grupos por nombre, sin puestos.' },
  ...(isTracker
    ? [{ tab: 'ubicacion', target: '.bottom-nav', title: 'Ubicación', body: 'Eres el corredor designado: tu teléfono comparte la ubicación del grupo. Déjala abierta.' } satisfies TutorialStep]
    : []),
  ...accountSteps('runner'),
]
