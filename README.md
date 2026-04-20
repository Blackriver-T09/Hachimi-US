# 🎵 Hachimi Music Platform

<div align="center">

**A beautiful music streaming platform dedicated to Hachimi culture**

[English](#english) | [中文](#中文)

</div>

---

## 📢 Important Notice / 重要声明

### English

**Non-Commercial & Cultural Purpose Only**

This project is created **solely for the purpose of promoting and spreading Hachimi culture**. 

- ✅ **Non-profit**: This project will **NEVER** generate any revenue or profit
- ✅ **Educational**: For cultural appreciation and educational purposes only
- ✅ **Open Source**: Free and open to the community
- ✅ **No Monetization**: No advertisements, subscriptions, or any form of payment

**Copyright Notice**: All music and content belong to their respective copyright holders. This platform is for cultural sharing and appreciation only. If you are a copyright holder and have concerns, please contact us for immediate removal.

---

### 中文

**非商业用途 & 文化传播声明**

本项目**仅用于传播和推广哈基米文化**。

- ✅ **非营利性**：本项目**永远不会**产生任何收入或利润
- ✅ **教育目的**：仅用于文化欣赏和教育目的
- ✅ **开源项目**：免费且对社区开放
- ✅ **无盈利行为**：无广告、无订阅、无任何形式的付费

**版权声明**：所有音乐和内容的版权归其各自的版权所有者所有。本平台仅用于文化分享和欣赏。如果您是版权持有者并有任何疑虑，请联系我们立即删除相关内容。

---

## ✨ Features / 功能特性

### 🎨 Beautiful UI / 精美界面
- Purple neon theme with glassmorphism effects / 紫色荧光主题 + 毛玻璃效果
- Smooth animations and transitions / 流畅的动画和过渡效果
- Responsive design / 响应式设计

### 🎵 Music Player / 音乐播放器
- Full-featured audio player / 功能完整的音频播放器
- Playlist management / 播放列表管理
- Favorites system / 收藏系统
- Multiple play modes (loop, loop-one, shuffle) / 多种播放模式（循环、单曲循环、随机）

### 📊 Admin Panel / 管理面板
- Video scraping from Bilibili / 从 Bilibili 爬取视频
- Scrape queue management / 爬取队列管理
- Online user statistics / 在线用户统计
- Video management (edit, delete) / 视频管理（编辑、删除）

### 🔍 Search & Browse / 搜索与浏览
- Real-time search / 实时搜索
- Browse all music / 浏览所有音乐
- Favorites view / 收藏夹视图

---

## 🛠️ Tech Stack / 技术栈

### Backend / 后端
- **Python 3.10+**
- **Flask** - Web framework / Web 框架
- **SQLAlchemy** - ORM
- **yt-dlp** - Video downloader / 视频下载器
- **SQLite** - Database / 数据库

### Frontend / 前端
- **React 18** with TypeScript
- **Vite** - Build tool / 构建工具
- **TailwindCSS** - Styling / 样式
- **Lucide React** - Icons / 图标库
- **Axios** - HTTP client / HTTP 客户端

---

## 🚀 Quick Start / 快速开始

### Prerequisites / 前置要求

- Python 3.10 or higher / Python 3.10 或更高版本
- Node.js 18 or higher / Node.js 18 或更高版本
- npm or yarn / npm 或 yarn

### Installation / 安装

#### 1. Clone the repository / 克隆仓库
```bash
git clone <repository-url>
cd Hachimi
```

#### 2. Backend Setup / 后端设置
```bash
# Install Python dependencies / 安装 Python 依赖
pip install -r requirements.txt

# Initialize database / 初始化数据库
python database.py

# Start backend server / 启动后端服务器
python app.py
```

The backend will run on `http://0.0.0.0:5000`

后端将运行在 `http://0.0.0.0:5000`

#### 3. Frontend Setup / 前端设置
```bash
cd frontend

# Install dependencies / 安装依赖
npm install

# Start development server / 启动开发服务器
npm run dev
```

The frontend will run on `http://localhost:5173`

前端将运行在 `http://localhost:5173`

---

## 📖 Usage / 使用说明

### For Users / 用户使用

1. **Browse Music / 浏览音乐**
   - Visit the homepage to see all available music
   - 访问主页查看所有可用音乐

2. **Play Music / 播放音乐**
   - Click on any song to start playing
   - 点击任何歌曲开始播放

3. **Manage Favorites / 管理收藏**
   - Click the heart icon to add to favorites
   - 点击心形图标添加到收藏夹

4. **Create Playlists / 创建播放列表**
   - Add songs to your custom playlist
   - 将歌曲添加到自定义播放列表

### For Admins / 管理员使用

1. **Access Admin Panel / 访问管理面板**
   - Navigate to `/admin`
   - 导航到 `/admin`

2. **Add Music / 添加音乐**
   - Paste a Bilibili video URL
   - 粘贴 Bilibili 视频链接
   - Click "Scrape" to download
   - 点击"Scrape"下载

3. **Manage Videos / 管理视频**
   - Edit video titles
   - 编辑视频标题
   - Delete videos
   - 删除视频

---

## 📁 Project Structure / 项目结构

```
Hachimi/
├── app.py                 # Flask backend / Flask 后端
├── database.py            # Database models / 数据库模型
├── scraper.py             # Video scraper / 视频爬虫
├── scrape_queue.py        # Scrape queue manager / 爬取队列管理
├── config.json            # Configuration / 配置文件
├── requirements.txt       # Python dependencies / Python 依赖
├── db/                    # Database files / 数据库文件
├── music/                 # Downloaded audio / 下载的音频
├── videos/                # Downloaded videos / 下载的视频
├── figures/               # Cover images / 封面图片
└── frontend/              # React frontend / React 前端
    ├── src/
    │   ├── pages/         # Page components / 页面组件
    │   ├── App.tsx        # Main app / 主应用
    │   └── main.tsx       # Entry point / 入口文件
    ├── package.json       # Node dependencies / Node 依赖
    └── vite.config.ts     # Vite config / Vite 配置
```

---

## 🤝 Contributing / 贡献

Contributions are welcome! Please feel free to submit a Pull Request.

欢迎贡献！请随时提交 Pull Request。

---

## 📄 License / 许可证

This project is open source and available for **non-commercial, educational, and cultural purposes only**.

本项目为开源项目，**仅可用于非商业、教育和文化目的**。

---

## 📧 Contact / 联系方式

For copyright concerns or questions, please open an issue.

如有版权问题或疑问，请提交 issue。

---

## ⚠️ Disclaimer / 免责声明

### English

This platform is created for cultural appreciation and educational purposes only. All content is sourced from public platforms and belongs to their respective copyright holders. 

- We do not claim ownership of any content
- We do not profit from this platform in any way
- If you are a copyright holder and wish to have content removed, please contact us immediately

### 中文

本平台仅用于文化欣赏和教育目的。所有内容均来自公共平台，版权归其各自的版权所有者所有。

- 我们不声称拥有任何内容的所有权
- 我们不会以任何方式从本平台获利
- 如果您是版权持有者并希望删除内容，请立即联系我们

---

<div align="center">

**Made with 💜 for Hachimi Culture**

**为哈基米文化而制作 💜**

</div>
