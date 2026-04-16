# 点赞功能文档

## 🎯 功能概述

为每首歌添加点赞功能，用户可以点击小心心给歌曲点赞或取消点赞，点赞数会实时更新并保存到数据库。

---

## ✨ 功能特性

### 1. **数据库支持**
- ✅ 添加 `likes` 字段到 `videos` 表
- ✅ 默认值为 0
- ✅ 支持增加和减少（最小值 0）

### 2. **后端 API**
- ✅ `POST /api/videos/<id>/like` - 点赞（+1）
- ✅ `POST /api/videos/<id>/unlike` - 取消点赞（-1）
- ✅ 返回更新后的点赞数

### 3. **前端 UI**
- ✅ 替换 "Bilibili" 文字为两个图标按钮
- ✅ 加入歌单按钮（ListPlus 图标）
- ✅ 点赞按钮（Heart 图标）+ 点赞数显示
- ✅ 点赞状态本地存储（localStorage）
- ✅ 已点赞显示红色填充心形

### 4. **用户体验**
- ✅ 点击心形即可点赞/取消
- ✅ 实时更新点赞数
- ✅ 半透明图标，hover 时高亮
- ✅ 已点赞的歌曲显示红色心形

---

## 🗄️ 数据库变更

### 新增字段
```sql
ALTER TABLE videos ADD COLUMN likes INTEGER DEFAULT 0 NOT NULL;
```

### Video 表结构
```sql
CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_at DATETIME,
    likes INTEGER DEFAULT 0 NOT NULL
);
```

---

## 🔧 后端 API

### 1. GET /api/videos
返回视频列表，包含 likes 字段

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "歌曲标题",
      "source_url": "https://...",
      "created_at": "2026-04-16T...",
      "duration": 180,
      "likes": 42
    }
  ]
}
```

### 2. POST /api/videos/<id>/like
给视频点赞（likes + 1）

**响应示例：**
```json
{
  "success": true,
  "likes": 43
}
```

### 3. POST /api/videos/<id>/unlike
取消点赞（likes - 1，最小 0）

**响应示例：**
```json
{
  "success": true,
  "likes": 42
}
```

---

## 🎨 前端实现

### Video 接口
```typescript
interface Video {
  id: number
  title: string
  source_url: string
  created_at: string
  likes: number  // 新增
}
```

### 点赞状态管理
```typescript
// 使用 localStorage 存储用户点赞的歌曲 ID
const [likedVideos, setLikedVideos] = useState<Set<number>>(() => {
  const saved = localStorage.getItem('likedVideos')
  return saved ? new Set(JSON.parse(saved)) : new Set()
})
```

### 点赞处理函数
```typescript
const handleLike = async (videoId: number, e: React.MouseEvent) => {
  e.stopPropagation() // 防止触发卡片点击
  
  const isLiked = likedVideos.has(videoId)
  const endpoint = isLiked ? 'unlike' : 'like'
  
  // 调用 API
  const response = await axios.post(`/api/videos/${videoId}/${endpoint}`)
  
  // 更新本地状态
  const newLiked = new Set(likedVideos)
  isLiked ? newLiked.delete(videoId) : newLiked.add(videoId)
  setLikedVideos(newLiked)
  localStorage.setItem('likedVideos', JSON.stringify(Array.from(newLiked)))
  
  // 更新视频列表中的 likes 数
  setVideos(videos.map(v => 
    v.id === videoId ? { ...v, likes: response.data.likes } : v
  ))
}
```

---

## 🎨 UI 设计

### 歌曲卡片底部

**之前：**
```
┌────────────────────────┐
│  [封面图]              │
│  歌曲标题              │
│  Bilibili      00:00   │
└────────────────────────┘
```

**现在：**
```
┌────────────────────────┐
│  [封面图]              │
│  歌曲标题              │
│  [+] [♥ 42]    00:00   │
└────────────────────────┘
```

### 图标按钮
```tsx
<div className="flex items-center gap-2">
  {/* 加入歌单按钮 */}
  <button className="p-1.5 rounded-full hover:bg-white/10 opacity-60 hover:opacity-100">
    <ListPlus size={16} />
  </button>
  
  {/* 点赞按钮 */}
  <button className={`p-1.5 rounded-full hover:bg-white/10 flex items-center gap-1 ${
    likedVideos.has(video.id) ? 'text-red-400' : 'opacity-60 hover:opacity-100'
  }`}>
    <Heart size={16} fill={likedVideos.has(video.id) ? 'currentColor' : 'none'} />
    <span className="text-xs">{video.likes}</span>
  </button>
</div>
```

### 样式特性
- **未点赞**: 灰色空心心形，60% 不透明度
- **已点赞**: 红色填充心形，100% 不透明度
- **Hover**: 背景变白色半透明，不透明度提升到 100%
- **点赞数**: 紧跟在心形后面，小字体显示

---

## 📊 数据流程

### 点赞流程
```
用户点击心形
    ↓
检查当前状态（likedVideos）
    ↓
调用 API (like/unlike)
    ↓
更新 localStorage
    ↓
更新 React 状态
    ↓
UI 实时更新
```

### 状态同步
```
页面加载
    ↓
从 localStorage 读取 likedVideos
    ↓
从 API 获取视频列表（含 likes 数）
    ↓
渲染 UI（根据 likedVideos 显示状态）
```

---

## 🔍 localStorage 结构

### 存储格式
```javascript
// Key
'likedVideos'

// Value (JSON 数组)
[1, 3, 5, 7]  // 用户点赞的视频 ID 列表
```

### 读取示例
```typescript
const saved = localStorage.getItem('likedVideos')
const likedSet = saved ? new Set(JSON.parse(saved)) : new Set()
// likedSet.has(1) => true
// likedSet.has(2) => false
```

---

## 🎯 用户场景

### 场景 1: 首次点赞
1. 用户看到喜欢的歌曲
2. 点击空心心形
3. 心形变为红色填充
4. 点赞数从 0 变为 1
5. localStorage 记录该歌曲 ID

### 场景 2: 取消点赞
1. 用户点击已点赞的红色心形
2. 心形变回灰色空心
3. 点赞数从 1 变为 0
4. localStorage 移除该歌曲 ID

### 场景 3: 刷新页面
1. 页面重新加载
2. 从 localStorage 读取点赞记录
3. 之前点赞的歌曲仍显示红色心形
4. 点赞数从服务器获取（最新值）

### 场景 4: 新窗口/设备
1. 打开新浏览器窗口
2. localStorage 是独立的
3. 可以再次点赞（允许的）
4. 点赞数会累加

---

## ⚠️ 注意事项

### 1. 无用户系统
- 点赞记录仅存储在本地浏览器
- 不同浏览器/设备可以重复点赞
- 这是**允许的**设计

### 2. 点赞数累加
- 每次点击都会调用 API
- 数据库中的 likes 会真实增加
- 清除浏览器数据后可以再次点赞

### 3. 数据一致性
- 点赞数以服务器为准
- 本地只记录"我点过赞"的状态
- 刷新页面会同步最新点赞数

---

## 🧪 测试

### 测试步骤

1. **刷新页面**
```bash
# 浏览器中按 Ctrl + Shift + R
```

2. **查看歌曲卡片**
- 底部左侧应显示两个图标按钮
- 加入歌单按钮（+）
- 点赞按钮（♥）+ 数字

3. **测试点赞**
- 点击空心心形
- 观察变为红色填充
- 数字增加 1

4. **测试取消点赞**
- 点击红色心形
- 观察变回灰色空心
- 数字减少 1

5. **测试持久化**
- 点赞几首歌
- 刷新页面
- 确认点赞状态保持

6. **测试数据库**
```bash
python -c "
from database import SessionLocal, Video
db = SessionLocal()
videos = db.query(Video).all()
for v in videos:
    print(f'{v.id}: {v.title} - {v.likes} likes')
db.close()
"
```

---

## 🚀 未来增强

### 短期
- ✅ 基础点赞功能
- 🔜 加入歌单功能（ListPlus 按钮）
- 🔜 显示最受欢迎的歌曲（按 likes 排序）

### 长期
- 🔜 用户系统（登录后点赞）
- 🔜 点赞历史记录
- 🔜 点赞排行榜
- 🔜 点赞趋势图表
- 🔜 防止恶意刷赞（IP 限制）

---

## ✅ 总结

### 已实现功能
- ✅ 数据库 likes 字段
- ✅ Like/Unlike API 端点
- ✅ 前端点赞 UI
- ✅ 本地状态持久化
- ✅ 实时更新点赞数
- ✅ 视觉反馈（红色心形）

### 技术栈
- **后端**: Flask + SQLAlchemy
- **前端**: React + TypeScript
- **存储**: SQLite + localStorage
- **图标**: Lucide React

### 用户体验
- 🎯 简单直观的点赞操作
- 💖 红色心形视觉反馈
- 🔄 实时更新无延迟
- 💾 刷新页面状态保持

---

**点赞功能已完整实现并测试通过！** 🎉
