import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import WorkflowPage from './pages/WorkflowPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
