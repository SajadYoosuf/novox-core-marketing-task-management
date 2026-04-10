import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { Client } from '@/types/db'
import {
  FileImage,
  FileText,
  UploadCloud,
  Plus,
  Cloud,
  TrendingUp,
  Users,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'

const BLOG_CATEGORIES: Record<string, string[]> = {
  'novox edtech': [
    'All',
    'Digital Marketing',
    'Web Development',
    'App Development',
    'Artificial Intelligence',
    'Generative AI',
    'AI Tools',
    'Programming Language',
    'Design',
    'Career',
  ],
}

const GALLERY_CATEGORIES: Record<string, string[]> = {
  'novox edtech': ['All', 'Campus', 'Events', 'Ceremony'],
}

export function ContentManagement() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [activeTab, setActiveTab] = useState<'blog' | 'gallery'>('blog')
  const [blogs] = useState([
    {
      id: 1,
      title: 'The Future of AI in SaaS Marketing',
      status: 'Draft',
      statusColor: 'text-amber-500',
      category: 'Strategy',
      author: 'Alex Rivera',
      date: 'Oct 24, 2023',
      views: '1,240',
      avatar: 'https://i.pravatar.cc/150?u=1'
    },
    {
      id: 2,
      title: 'Mastering Social Proof in 2024',
      status: 'Published',
      statusColor: 'text-emerald-500',
      category: 'Growth',
      author: 'Sarah Chen',
      date: 'Oct 21, 2023',
      views: '8,902',
      avatar: 'https://i.pravatar.cc/150?u=2'
    },
    {
      id: 3,
      title: '10 Content Pillars for Small Teams',
      status: 'Scheduled',
      statusColor: 'text-blue-500',
      category: 'Content',
      author: 'Jordan Smythe',
      date: 'Oct 19, 2023',
      views: '456',
      avatar: 'https://i.pravatar.cc/150?u=3'
    }
  ])

  useEffect(() => {
    if (!supabaseConfigured) return
    void supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setClients(data)
          if (data.length > 0) setSelectedClientId(data[0].id)
        }
      })
  }, [])

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const clientNameLower = selectedClient?.name?.toLowerCase() || ''

  const currentCategories =
    activeTab === 'blog'
      ? BLOG_CATEGORIES[clientNameLower] || []
      : GALLERY_CATEGORIES[clientNameLower] || []

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto w-full p-4 sm:p-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Content Management</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text-muted)]">
            Manage blogs, media, and client website configurations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[200px]">
            <Select
              options={clients.map((c) => ({ id: c.id, name: c.name }))}
              value={selectedClientId}
              onChange={setSelectedClientId}
              icon={<Users className="w-4 h-4" />}
            />
          </div>
          <Button className="bg-[var(--color-surface-2)] text-white hover:bg-[var(--color-surface-3)] font-bold text-xs px-5 border border-white/5">
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload Media
          </Button>
          <Button className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white font-bold text-xs shadow-lg shadow-[var(--color-accent)]/20 px-5">
            <Plus className="w-4 h-4 mr-2" />
            Create New {activeTab === 'blog' ? 'Blog' : 'Gallery Folder'}
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab('blog')}
          className={`pb-4 text-sm font-black tracking-wide transition-all ${
            activeTab === 'blog'
              ? 'text-white border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          Blog Management
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`pb-4 text-sm font-black tracking-wide transition-all ${
            activeTab === 'gallery'
              ? 'text-white border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          Gallery Management
        </button>
      </div>

      {/* Dynamic Categories Specific to Client */}
      {currentCategories.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap animate-in slide-in-from-bottom-2">
          {currentCategories.map((cat, i) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                i === 0
                  ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs font-bold text-[var(--color-text-muted)] px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-white/5 border-dashed max-w-md">
          {selectedClient?.name} does not have specific {activeTab === 'blog' ? 'Blog' : 'Gallery'} categorizations configured.
        </div>
      )}

      {/* Table Interface */}
      <div className="rounded-[1.5rem] bg-[var(--color-surface)] border border-white/5 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                <th className="px-6 py-5 pl-8">{activeTab === 'blog' ? 'Blog Title' : 'Media Name'}</th>
                <th className="px-6 py-5">Author</th>
                <th className="px-6 py-5">Category</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Date</th>
                <th className="px-6 py-5 text-right pr-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {blogs.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 pl-8 max-w-[280px]">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-[var(--color-text-muted)] group-hover:bg-[var(--color-accent)]/10 group-hover:text-[var(--color-accent)] transition-colors">
                        {activeTab === 'blog' ? <FileText className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                      </div>
                      <div className="truncate text-sm font-bold text-white">{item.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img src={item.avatar} alt={item.author} className="w-6 h-6 rounded-full border border-white/10" />
                      <span className="text-sm font-bold text-white/80">{item.author}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-md bg-[var(--color-surface-2)] border border-white/5 text-[10px] uppercase font-black tracking-widest text-[var(--color-text-muted)]">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.statusColor.replace('text-', 'bg-')}`}></div>
                      <span className={`text-xs font-bold ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text-muted)]">
                    {item.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right pr-8">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-rose-500/10 text-[var(--color-text-muted)] hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-white/5 bg-[var(--color-surface-2)] flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-muted)] pl-4">Showing 1-3 of 24 items</span>
          <div className="flex gap-2">
             <button className="px-3 py-1.5 rounded-lg border border-white/5 bg-[var(--color-surface)] text-xs text-[var(--color-text-muted)] hover:text-white">Previous</button>
             <button className="px-3 py-1.5 rounded-lg border border-white/5 bg-[var(--color-surface)] text-xs text-[var(--color-text-muted)] hover:text-white">Next</button>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-[1.5rem] bg-[var(--color-surface)] border border-white/5 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Storage Used</span>
            <Cloud className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-3xl font-black text-white">12.4 GB</div>
            <div className="w-full h-1.5 bg-[var(--color-surface-2)] rounded-full mt-4 overflow-hidden">
               <div className="bg-gradient-to-r from-blue-500 to-indigo-500 w-[62%] h-full rounded-full"></div>
            </div>
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-wide">62% of 20GB Plan</div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-[var(--color-surface)] border border-white/5 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Top Category</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">Digital Marketing</div>
            <div className="text-xs font-bold text-emerald-500 mt-2">+14% engagement vs last month</div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-[var(--color-surface)] border border-white/5 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Active Authors</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center -space-x-3">
              <img src="https://i.pravatar.cc/150?u=1" className="w-10 h-10 rounded-full border-2 border-[var(--color-surface)]" alt="Author" />
              <img src="https://i.pravatar.cc/150?u=2" className="w-10 h-10 rounded-full border-2 border-[var(--color-surface)]" alt="Author" />
              <img src="https://i.pravatar.cc/150?u=3" className="w-10 h-10 rounded-full border-2 border-[var(--color-surface)]" alt="Author" />
              <div className="w-10 h-10 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-2)] flex items-center justify-center text-[10px] font-bold text-white">+5</div>
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] mt-4">Manage permissions in Settings</div>
          </div>
        </div>
      </div>
    </div>
  )
}
