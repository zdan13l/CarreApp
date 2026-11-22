import type { TutorialStep } from '../components/Tutorial'

// The guided tours shown while the Carrera is Habilitada. Only bases and runners have one.

export const baseTutorial = (): TutorialStep[] => [
  { tab: 'ronda', target: '.base-ticket', title: 'Tu ventanilla', body: 'Aquí está tu base y cuántos grupos ya sellaste. Todo lo que haces en la Carrera pasa en la pestaña Ronda.' },
  {
    tab: 'ronda',
    target: '.walking',
    title: '1. Los grupos vienen en camino',
    body: 'Verás a los dos grupos del cruce, de qué base vienen y un reloj con el tiempo que les queda para llegar. Si tardan, apura a uno o a los dos con «Apurar»: puede que uno ya haya llegado y no tenga que recibir el aviso.',
  },
  { tab: 'ronda', title: '2. Confirma la llegada', body: 'Cuando los dos grupos estén en tu base, toca «Ya llegaron ambos grupos». Sin esa confirmación no se puede calificar.' },
  { tab: 'ronda', title: '3. Califica las tres etapas', body: 'Se califica primero el minijuego, luego la pregunta y por último la barra. Eliges el ganador de cada una y envías: vale un punto cada una y solo el coordinador puede corregirlas.' },
  { tab: 'ronda', title: '4. Déjalos ir', body: 'Al calificar las tres etapas solo queda un botón: «Ya los dejé ir». Se activa cuando el coordinador avisa que todas las bases terminaron. Al confirmarlo llegan los siguientes grupos, con su reloj.' },
  { tab: 'resultados', target: '.bottom-nav', title: 'Resultados', body: 'Aquí ves a todos los grupos con su foto y nombre, y el historial de lo que calificaste. Los puntos de los demás grupos no se muestran.' },
  { tab: 'base', target: '.bottom-nav', title: 'Mi base', body: 'Tu guía: la información que debes dar, las preguntas con su respuesta, la foto de tu lugar y su ubicación en el mapa, que puedes cambiar si la base se mueve.' },
  { tab: 'ronda', target: '.account-btn', title: 'Tu cuenta', body: 'Aquí activas el sonido y las notificaciones para recibir los avisos del coordinador, cambias entre modo claro y oscuro y cierras sesión.' },
]

export const runnerTutorial = (isTracker: boolean): TutorialStep[] => [
  { tab: 'ronda', target: '.status-ticket', title: 'Tu grupo', body: 'Este es tu grupo y los puntos que lleva. Nadie ve quién va ganando hasta que el coordinador lo anuncie.' },
  { tab: 'ronda', title: 'Tu siguiente base', body: 'En Visado ves a qué base debes ir, contra qué grupo juegas y las tres etapas que se califican. Si llevas mucho tiempo caminando, la app te avisa con sonido: apúrate o avísale a la base si ya llegaste.' },
  { tab: 'ruta', target: '.bottom-nav', title: 'Tu pasaporte', body: 'Cada vez que una base califica las tres etapas, tu pasaporte recibe el sello de esa base. Toca un sello para ver cómo les fue.' },
  { tab: 'top', target: '.bottom-nav', title: 'Top', body: 'Aquí ves tus puntos y todos los grupos por nombre, sin puestos ni puntos de los demás.' },
  ...(isTracker
    ? [{ tab: 'ubicacion', target: '.bottom-nav', title: 'Ubicación', body: 'Eres el corredor designado: tu teléfono comparte la ubicación del grupo para que el coordinador lo vea en el mapa. Déjala abierta durante la Carrera.' } satisfies TutorialStep]
    : []),
  { tab: 'ronda', target: '.account-btn', title: 'Tu cuenta', body: 'Aquí activas el sonido y las notificaciones para no perderte ningún aviso, cambias entre modo claro y oscuro y cierras sesión.' },
]
