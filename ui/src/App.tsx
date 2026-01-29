import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/components/AuthProvider"
import { Layout } from "@/components/layout/Layout"
import { Dashboard } from "@/pages/Dashboard"
import { Agents } from "@/pages/Agents"
import { AgentDetail } from "@/pages/AgentDetail"
import { Chat } from "@/pages/Chat"
import { Sessions } from "@/pages/Sessions"
import { Settings } from "@/pages/Settings"
import { AuthCallback } from "@/pages/AuthCallback"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:agentId" element={<AgentDetail />} />
            <Route path="chat" element={<Chat />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
