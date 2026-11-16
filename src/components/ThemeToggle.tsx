import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

// Switches between dark and light mode. Shows the icon of the mode you would switch TO.
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <button className="ghost icon-btn" onClick={() => setTheme(next)} aria-label={label} title={label}>
      {next === 'light' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
