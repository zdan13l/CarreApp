// Suggested passwords that are fun to read and easy to type: two random silly words with leet-speak, like
// "D3lF1nZ4p4t0" or "C4p1b4r4Pij4m4". Only letters and digits (no accents or symbols, so any phone keyboard types them).
// The point is that people remember them and smile; the strength comes from the random choice of words, digits and capitals.
const ANIMALS = [
  'delfin', 'capibara', 'pinguino', 'llama', 'koala', 'mapache', 'ornitorrinco', 'ajolote', 'cocodrilo', 'camaleon', 'hipopotamo', 'pulpo', 'tucan',
  'armadillo', 'cangrejo', 'gallina', 'mariposa', 'tortuga', 'jirafa', 'elefante', 'pantera', 'zorro', 'bufalo', 'cucaracha', 'colibri', 'ballena',
  'foca', 'lechuza', 'erizo', 'hormiga', 'oso', 'burro', 'cabra', 'rana', 'sapo', 'pato', 'loro', 'conejo', 'canguro', 'gorila', 'mono', 'pelicano',
  'cobra', 'iguana', 'murcielago', 'abeja', 'avestruz', 'chinche', 'lagartija', 'tiburon',
]
const THINGS = [
  'zapato', 'calcetin', 'pijama', 'paraguas', 'chancleta', 'bufanda', 'escoba', 'trompo', 'cohete', 'burbuja', 'sombrero', 'cuchara', 'tenedor',
  'arepa', 'empanada', 'bunuelo', 'aguacate', 'chontaduro', 'papaya', 'tamal', 'ajiaco', 'salpicon', 'sancocho', 'panela', 'mazorca', 'cebolla',
  'tomate', 'banano', 'guayaba', 'mango', 'lulo', 'pizza', 'taco', 'helado', 'galleta', 'mochila', 'bicicleta', 'patineta', 'guitarra', 'tambor',
  'balon', 'cometa', 'nube', 'volcan', 'cactus', 'girasol', 'piedra', 'espejo', 'reloj', 'linterna', 'martillo', 'bocadillo', 'cafetera', 'sofa',
]

const LEET: Record<string, string> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' }

function pick<T>(list: T[]): T {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return list[n % list.length]
}
function chance(p: number): boolean {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return n / 0xffffffff < p
}

// "delfin" -> "D3lF1n": capital first letter, some inner capitals and leet-speak on vowels.
function silly(word: string): string {
  return [...word]
    .map((ch, i) => {
      const swapped = LEET[ch] && chance(0.55) ? LEET[ch] : ch
      if (i === 0) return swapped.toUpperCase()
      return chance(0.22) ? swapped.toUpperCase() : swapped
    })
    .join('')
}

export function generatePassword(minLength = 8): string {
  for (;;) {
    const password = silly(pick(ANIMALS)) + silly(pick(THINGS))
    // at least one digit and one capital besides the first letter, and the length asked for
    if (password.length >= minLength && /\d/.test(password) && /[A-Z]/.test(password.slice(1))) return password
  }
}
