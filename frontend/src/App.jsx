import { Routes, Route, Navigate } from 'react-router-dom'
import WeaponDetection from './pages/WeaponDetection.jsx'
import FightDetection from './pages/FightDetection.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/weapon-detection" replace />} />
      <Route path="/weapon-detection" element={<WeaponDetection />} />
      <Route path="/fight-detection" element={<FightDetection />} />
    </Routes>
  )
}