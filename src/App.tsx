import { BrowserRouter, Route, Routes } from 'react-router-dom'
import NetworkCheck from './pages/NetworkCheck'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<NetworkCheck />} />
      </Routes>
    </BrowserRouter>
  )
}
