import { useEffect, useState } from 'react'

// Tells the user when the phone has no connection: the screen keeps showing the last data it got.
export default function ConnectionBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return <div className="conn-banner" role="status">Sin conexión: lo que ves puede estar desactualizado.</div>
}
