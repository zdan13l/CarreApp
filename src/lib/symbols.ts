// The personal symbol of an inductor (the white cat of one, the owl of another): everybody picks one from this list and may give it a
// name ("Gato blanco"). They are icons, not emojis. `key` is what the database stores (passports.symbol).
import {
  Anchor, Bird, Bone, Bug, Cat, Cherry, Coffee, Compass, Cookie, Crown, Dog, Fish, Feather, Flame, Gamepad2, Gem, Ghost, Heart, Leaf, Moon,
  Mountain, Music, Origami, PawPrint, Pizza, Rabbit, Rat, Rocket, Skull, Smile, Snail, Sprout, Squirrel, Star, Sun, TreePine, Turtle,
  Umbrella, Waves, Zap, type LucideIcon,
} from 'lucide-react'

export interface Symbol {
  key: string
  name: string
  Icon: LucideIcon
}

export const SYMBOLS: Symbol[] = [
  { key: 'cat', name: 'Gato', Icon: Cat },
  { key: 'dog', name: 'Perro', Icon: Dog },
  { key: 'bird', name: 'Pájaro', Icon: Bird },
  { key: 'fish', name: 'Pez', Icon: Fish },
  { key: 'rabbit', name: 'Conejo', Icon: Rabbit },
  { key: 'squirrel', name: 'Ardilla', Icon: Squirrel },
  { key: 'turtle', name: 'Tortuga', Icon: Turtle },
  { key: 'snail', name: 'Caracol', Icon: Snail },
  { key: 'rat', name: 'Rata', Icon: Rat },
  { key: 'bug', name: 'Bicho', Icon: Bug },
  { key: 'origami', name: 'Origami', Icon: Origami },
  { key: 'paw-print', name: 'Huella', Icon: PawPrint },
  { key: 'bone', name: 'Hueso', Icon: Bone },
  { key: 'feather', name: 'Pluma', Icon: Feather },
  { key: 'flame', name: 'Llama', Icon: Flame },
  { key: 'zap', name: 'Rayo', Icon: Zap },
  { key: 'ghost', name: 'Fantasma', Icon: Ghost },
  { key: 'skull', name: 'Calavera', Icon: Skull },
  { key: 'crown', name: 'Corona', Icon: Crown },
  { key: 'gem', name: 'Gema', Icon: Gem },
  { key: 'rocket', name: 'Cohete', Icon: Rocket },
  { key: 'moon', name: 'Luna', Icon: Moon },
  { key: 'sun', name: 'Sol', Icon: Sun },
  { key: 'star', name: 'Estrella', Icon: Star },
  { key: 'heart', name: 'Corazón', Icon: Heart },
  { key: 'anchor', name: 'Ancla', Icon: Anchor },
  { key: 'compass', name: 'Brújula', Icon: Compass },
  { key: 'mountain', name: 'Montaña', Icon: Mountain },
  { key: 'waves', name: 'Olas', Icon: Waves },
  { key: 'leaf', name: 'Hoja', Icon: Leaf },
  { key: 'sprout', name: 'Brote', Icon: Sprout },
  { key: 'tree-pine', name: 'Pino', Icon: TreePine },
  { key: 'music', name: 'Música', Icon: Music },
  { key: 'coffee', name: 'Café', Icon: Coffee },
  { key: 'pizza', name: 'Pizza', Icon: Pizza },
  { key: 'cherry', name: 'Cereza', Icon: Cherry },
  { key: 'cookie', name: 'Galleta', Icon: Cookie },
  { key: 'gamepad-2', name: 'Control', Icon: Gamepad2 },
  { key: 'umbrella', name: 'Paraguas', Icon: Umbrella },
  { key: 'smile', name: 'Sonrisa', Icon: Smile },
]

export const symbolOf = (key: string | null | undefined): Symbol | null => SYMBOLS.find((s) => s.key === key) ?? null
