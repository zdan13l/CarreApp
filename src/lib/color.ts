// A colour from hue / saturation / lightness as the #rrggbb an <input type=color> needs.
export function hslToHex(h: number, sat: number, light: number): string {
  const a = (sat * Math.min(light, 100 - light)) / 10000
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (light / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
