import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LogOut, Loader2, CheckCircle2, XCircle, ExternalLink, Edit2, Check, X, Users, Trash2 } from "lucide-react"
import axios from "axios"

interface Video {
  id: number
  title: string
  source_url: string
  created_at: string
  duration?: number
  likes: number
}

interface ScrapeTask {
  id: number
  url: string
  status: string
  retry_count: number
  max_retries: number
  error_message: string | null
  created_at: string
  updated_at: string
  video_id: number | null
}

const Admin = () => {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{success: boolean, msg: string, data?: any} | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [scrapeTasks, setScrapeTasks] = useState<ScrapeTask[]>([])
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [peakToday, setPeakToday] = useState(0)
  const [statsHistory, setStatsHistory] = useState<{timestamp: string, online_count: number}[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const navigate = useNavigate()
  
  // Session ID for online tracking - shared across all tabs
  const getOrCreateSessionId = () => {
    let sessionId = localStorage.getItem('hachimi_session_id')
    if (!sessionId) {
      const browserFingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}`
      const hash = browserFingerprint.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)
      sessionId = `session_${Math.abs(hash)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem('hachimi_session_id', sessionId)
    }
    return sessionId
  }
  const sessionId = getOrCreateSessionId()

  const handleLogout = () => {
    localStorage.removeItem("token")
    navigate("/login")
  }

  useEffect(() => {
    fetchVideos()
    fetchScrapeTasks()
    fetchOnlineUsers()
    fetchStatsHistory()
    
    // Send heartbeat to track online users
    const sendHeartbeat = async () => {
      try {
        await axios.post('/api/heartbeat', {
          session_id: sessionId
        })
      } catch (err) {
        // Silently fail
      }
    }
    
    sendHeartbeat()
    
    // Poll online users every 10 seconds and send heartbeat
    const interval = setInterval(() => {
      fetchOnlineUsers()
      sendHeartbeat()
      fetchScrapeTasks() // Also refresh scrape tasks
    }, 10000)
    
    // Refresh history every 5 minutes
    const historyInterval = setInterval(fetchStatsHistory, 300000)
    
    return () => {
      clearInterval(interval)
      clearInterval(historyInterval)
      // Don't send offline signal - let session timeout naturally
    }
  }, [])

  const fetchVideos = async () => {
    try {
      const response = await axios.get("/api/videos")
      if (response.data.success) {
        setVideos(response.data.data)
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err)
    }
  }

  const fetchScrapeTasks = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await axios.get("/api/scrape/queue/tasks?limit=10", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setScrapeTasks(response.data.tasks)
      }
    } catch (err) {
      console.error("Failed to fetch scrape tasks:", err)
    }
  }

  const fetchOnlineUsers = async () => {
    try {
      const response = await axios.get("/api/stats/online")
      if (response.data.success) {
        setOnlineUsers(response.data.count)
        setPeakToday(response.data.peak_today || 0)
      }
    } catch (err) {
      console.error("Failed to fetch online users:", err)
    }
  }

  const fetchStatsHistory = async () => {
    try {
      const response = await axios.get("/api/stats/history?hours=24")
      if (response.data.success) {
        setStatsHistory(response.data.data)
      }
    } catch (err) {
      console.error("Failed to fetch stats history:", err)
    }
  }

  const extractUrl = (text: string): string => {
    // Extract URL starting with https:// or http://
    const match = text.match(/(https?:\/\/[^\s]+)/)
    return match ? match[1] : text
  }

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setResult(null)
    
    try {
      const token = localStorage.getItem("token")
      const extractedUrl = extractUrl(url.trim())
      const response = await axios.post(
        "/api/scrape", 
        { url: extractedUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (response.data.success) {
        setResult({
          success: true,
          msg: "Task added to queue successfully!",
          data: { id: response.data.task_id, title: "Processing..." }
        })
        setUrl("")
        fetchScrapeTasks() // Refresh scrape queue
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      
      // Handle duplicate URL (409 Conflict)
      if (err.response?.status === 409 && err.response?.data?.existing) {
        const existing = err.response.data.existing
        setResult({
          success: false,
          msg: `⚠️ Video already exists in library!`,
          data: {
            id: existing.id,
            title: existing.title,
            note: `Added on ${new Date(existing.created_at).toLocaleString()}`
          }
        })
      } else {
        setResult({
          success: false,
          msg: err.response?.data?.error || "Failed to scrape video"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTitle = async (id: number, newTitle: string) => {
    try {
      const token = localStorage.getItem("token")
      await axios.put(
        `/api/videos/${id}`,
        { title: newTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setVideos(videos.map(v => v.id === id ? {...v, title: newTitle} : v))
      setEditingId(null)
    } catch (err) {
      console.error("Failed to update title:", err)
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要删除《${title}》吗？\n\n这将删除所有相关文件（音频、视频、封面、弹幕）和数据库记录，此操作不可恢复！`)) {
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await axios.delete(
        `/api/videos/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (response.data.success) {
        setVideos(videos.filter(v => v.id !== id))
        setResult({
          success: true,
          msg: `✓ 已删除《${title}》及其所有文件`
        })
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      setResult({
        success: false,
        msg: err.response?.data?.error || "删除失败"
      })
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <img 
              src="/logo.png" 
              alt="Hachimi Music" 
              className="w-12 h-12 rounded-full object-cover shadow-lg shadow-purple-500/20"
            />
            <h1 className="text-3xl font-bold text-purple-400">Hachimi Music Admin</h1>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/")} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              View Player
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-sm text-zinc-400">Online Now</p>
                  <p className="text-2xl font-bold text-purple-400">{onlineUsers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center text-purple-400 text-2xl">📈</div>
                <div>
                  <p className="text-sm text-zinc-400">Peak Today</p>
                  <p className="text-2xl font-bold text-purple-400">{peakToday}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center text-purple-400 text-2xl">🎵</div>
                <div>
                  <p className="text-sm text-zinc-400">Total Songs</p>
                  <p className="text-2xl font-bold text-purple-400">{videos.length}</p>
                </div>
              </div>
            </div>
            
            {/* Simple stats history visualization */}
            {statsHistory.length > 0 && (
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <p className="text-sm text-zinc-400 mb-3">Last 24 Hours Activity</p>
                <div className="flex items-end gap-1 h-16">
                  {statsHistory.slice(-48).map((stat, i) => {
                    const maxCount = Math.max(...statsHistory.map(s => s.online_count), 1)
                    const height = (stat.online_count / maxCount) * 100
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-purple-500/30 rounded-t hover:bg-purple-500/50 transition"
                        style={{ height: `${height}%`, minHeight: '2px' }}
                        title={`${new Date(stat.timestamp).toLocaleTimeString()}: ${stat.online_count} users`}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle>Add New Music</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrape} className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Paste Bilibili URL or share text here..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-purple-500 flex-1"
                  disabled={loading}
                />
                <Button 
                  type="submit" 
                  disabled={loading || !url.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Scrape"}
                </Button>
              </div>
            </form>

            {result && (
              <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-500/10 border border-green-500/30' : result.msg.includes('already exists') ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                ) : result.msg.includes('already exists') ? (
                  <XCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${result.success ? 'text-green-400' : result.msg.includes('already exists') ? 'text-yellow-400' : 'text-red-400'}`}>
                    {result.msg}
                  </p>
                  {result.data && (
                    <div className="mt-2 text-sm text-zinc-400 space-y-1">
                      <p>Title: <span className="text-zinc-300">{result.data.title}</span></p>
                      <p>ID: <span className="text-zinc-300">{result.data.id}</span></p>
                      {result.data.note && (
                        <p className="text-zinc-500 italic">{result.data.note}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scrape Queue */}
        {scrapeTasks.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle>Scrape Queue (Recent 10 tasks)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scrapeTasks.map((task) => {
                  const statusColors = {
                    'in_queue': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                    'scraping': 'bg-purple-500/10 border-purple-500/30 text-purple-400',
                    'waiting': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                    'finished': 'bg-green-500/10 border-green-500/30 text-green-400',
                    'failed': 'bg-red-500/10 border-red-500/30 text-red-400'
                  }
                  
                  const statusIcons = {
                    'in_queue': '⏳',
                    'scraping': '🔄',
                    'waiting': '⏸️',
                    'finished': '✅',
                    'failed': '❌'
                  }
                  
                  return (
                    <div key={task.id} className={`p-4 rounded-lg border ${statusColors[task.status as keyof typeof statusColors] || 'bg-zinc-800 border-zinc-700'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{statusIcons[task.status as keyof typeof statusIcons] || '📝'}</span>
                            <span className="font-medium capitalize">{task.status.replace('_', ' ')}</span>
                            <span className="text-xs text-zinc-500">#{task.id}</span>
                          </div>
                          <p className="text-sm text-zinc-400 truncate mb-1">{task.url}</p>
                          {task.error_message && (
                            <p className="text-xs text-red-400 mt-1">Error: {task.error_message}</p>
                          )}
                          {task.video_id && (
                            <p className="text-xs text-green-400 mt-1">✓ Created video ID: {task.video_id}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-zinc-500 flex-shrink-0">
                          <div>Retry: {task.retry_count}/{task.max_retries}</div>
                          <div className="mt-1">{new Date(task.updated_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Music Library Table */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle>Music Library ({videos.length} songs)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-16">#</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-24">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-20">Likes</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-32">Source</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => (
                    <tr key={video.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4 text-zinc-400">{video.id}</td>
                      <td className="py-3 px-4">
                        {editingId === video.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTitle(video.id, editTitle)}
                              className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setEditingId(null)}
                              className="h-8 w-8 p-0 bg-zinc-700 hover:bg-zinc-600"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="text-zinc-100">{video.title}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(video.id)
                                setEditTitle(video.title)
                              }}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 font-mono text-sm">
                        {formatDuration(video.duration)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <span className="text-red-400">♥</span>
                          <span className="font-medium">{video.likes}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(video.source_url, '_blank')}
                          className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-purple-400 flex items-center gap-2"
                        >
                          <ExternalLink className="w-3 h-3" /> Bilibili
                        </Button>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(video.id, video.title)}
                          className="h-8 border-red-900/50 text-red-400 hover:bg-red-950 hover:border-red-800 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {videos.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  No music in library yet. Add some above!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Admin
