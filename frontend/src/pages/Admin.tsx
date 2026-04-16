import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LogOut, Loader2, CheckCircle2, XCircle } from "lucide-react"
import axios from "axios"

const Admin = () => {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{success: boolean, msg: string, data?: any} | null>(null)
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem("token")
    navigate("/login")
  }

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setResult(null)
    
    try {
      const token = localStorage.getItem("token")
      const response = await axios.post(
        "http://127.0.0.1:5000/api/scrape", 
        { url: url.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (response.data.success) {
        setResult({
          success: true,
          msg: "Video scraped successfully!",
          data: response.data.data
        })
        setUrl("")
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout()
        return
      }
      setResult({
        success: false,
        msg: err.response?.data?.error || "Failed to scrape video"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
          <h1 className="text-3xl font-bold text-purple-400">Admin Dashboard</h1>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/")} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              View Player
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle>Add New Music</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScrape} className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Paste Bilibili URL here..."
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
              <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.msg}
                  </p>
                  {result.success && result.data && (
                    <div className="mt-2 text-sm text-zinc-400">
                      <p>Title: <span className="text-zinc-300">{result.data.title}</span></p>
                      <p>ID: <span className="text-zinc-300">{result.data.id}</span></p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Admin
