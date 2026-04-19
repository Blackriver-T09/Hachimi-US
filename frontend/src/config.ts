// API 配置
export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const API_ENDPOINTS = {
  videos: `${API_BASE_URL}/api/videos`,
  login: `${API_BASE_URL}/api/login`,
  scrape: `${API_BASE_URL}/api/scrape`,
  heartbeat: `${API_BASE_URL}/api/heartbeat`,
  stats: {
    online: `${API_BASE_URL}/api/stats/online`,
    history: `${API_BASE_URL}/api/stats/history`,
  },
  scrapeQueue: {
    stats: `${API_BASE_URL}/api/scrape/queue/stats`,
    tasks: `${API_BASE_URL}/api/scrape/queue/tasks`,
    task: (id: number) => `${API_BASE_URL}/api/scrape/queue/task/${id}`,
  },
  config: `${API_BASE_URL}/api/config`,
  updateVideo: (id: number) => `${API_BASE_URL}/api/videos/${id}`,
}
