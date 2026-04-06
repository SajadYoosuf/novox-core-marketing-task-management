import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  const [search, setSearch] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  return (
    <div className="flex h-svh max-h-svh overflow-hidden bg-[var(--color-surface)]">
      <Sidebar 
        isOpen={showMobileSidebar} 
        onClose={() => setShowMobileSidebar(false)} 
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar 
          search={search} 
          onSearchChange={setSearch} 
          onMenuClick={() => setShowMobileSidebar(true)}
        />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 pb-10 sm:p-6">
          <Outlet context={{ search }} />
        </main>
      </div>
      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}
    </div>
  )
}
