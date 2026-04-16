# 自动播放功能文档

## 🎯 功能概述

页面加载时自动播放指定 ID 的歌曲，同时保持在浏览视图（不进入单曲播放页面），底部显示迷你播放器。

---

## ⚙️ 配置方法

### 在 `config.py` 中设置

```python
# config.py
API_KEY = "your-api-key"
USERNAME = "ADMIN"
PASSWORD = "12345"
START_INDEX = 7  # 自动播放 ID 为 7 的歌曲
```

### 配置说明

- **`START_INDEX`**: 要自动播放的歌曲 ID（不是数组索引）
- **设置为 `None`**: 禁用自动播放
- **设置为具体数字**: 自动播放该 ID 的歌曲

---

## 🎨 用户体验

### 未配置自动播放（或 START_INDEX = None）
```
页面加载
    ↓
显示歌曲列表
    ↓
底部无播放器
    ↓
用户手动点击歌曲开始播放
```

### 配置了自动播放（如 START_INDEX = 7）
```
页面加载
    ↓
显示歌曲列表
    ↓
自动加载并播放 ID=7 的歌曲
    ↓
底部显示迷你播放器
    ↓
保持在浏览视图（不跳转到播放页面）
```

---

## 🔧 技术实现

### 后端 API

#### 配置端点
```python
@app.route('/api/config', methods=['GET'])
def get_config():
    """Get public configuration"""
    return jsonify({
        'success': True,
        'start_index': START_INDEX
    })
```

#### 响应示例
```json
{
  "success": true,
  "start_index": 7
}
```

### 前端逻辑

#### 加载流程
```typescript
// 1. 获取视频列表
const response = await axios.get("/api/videos")
const videoList = response.data.data
setVideos(videoList)

// 2. 获取配置
const configResponse = await axios.get("/api/config")
if (configResponse.data.start_index !== null) {
  const startIndex = configResponse.data.start_index
  
  // 3. 查找对应 ID 的视频
  const initialVideo = videoList.find(v => v.id === startIndex)
  
  // 4. 自动播放（不切换视图）
  if (initialVideo) {
    setCurrentVideo(initialVideo)
    setIsPlaying(true)
    // viewMode 保持为 'browse'
  }
}
```

---

## 📊 行为对比

### 场景 1: 无自动播放
| 时间点 | 视图 | 播放器状态 | 说明 |
|--------|------|-----------|------|
| 页面加载 | Browse | 隐藏 | 底部无播放器 |
| 点击歌曲 | Playing | 显示 | 进入播放页面 |

### 场景 2: 有自动播放（START_INDEX = 7）
| 时间点 | 视图 | 播放器状态 | 说明 |
|--------|------|-----------|------|
| 页面加载 | Browse | 显示 | 底部显示迷你播放器 |
| 自动播放 | Browse | 播放中 | ID=7 的歌曲开始播放 |
| 点击歌曲 | Playing | 显示 | 可切换到其他歌曲 |

---

## 🎵 迷你播放器

### 显示条件
- 有歌曲正在播放（`currentVideo !== null`）
- 无论在哪个视图都会显示

### 显示内容
```
┌────────────────────────────────────────────────┐
│ [封面] ⚡米基玄师 - LOSER⚡  ⏮ ⏸ ⏭  [进度条]  │
└────────────────────────────────────────────────┘
```

### 功能
- 显示当前播放歌曲的封面和标题
- 播放/暂停按钮
- 上一曲/下一曲按钮
- 进度条显示
- 点击可跳转到播放页面

---

## 🔍 查找歌曲 ID

### 方法 1: Admin 页面查看
1. 访问 Admin 页面
2. 查看 Music Library 表格
3. 第一列 `#` 就是歌曲 ID

### 方法 2: API 查询
```bash
curl http://127.0.0.1:5000/api/videos | jq '.data[] | {id, title}'
```

输出示例：
```json
{
  "id": 7,
  "title": "基静岭： promise (reprise)"
}
{
  "id": 6,
  "title": "\"王从天降，愤怒狰狞\""
}
```

---

## 🧪 测试

### 测试步骤

1. **设置配置**
```python
# config.py
START_INDEX = 7
```

2. **重启后端**
```bash
pkill -f "python app.py"
python app.py
```

3. **刷新前端**
- 打开 http://localhost:5173
- 按 Ctrl + Shift + R 强制刷新

4. **验证结果**
- ✓ 页面加载后自动开始播放
- ✓ 底部显示迷你播放器
- ✓ 保持在浏览视图
- ✓ 播放的是 ID=7 的歌曲

---

## ⚠️ 注意事项

### 1. ID 不存在
如果配置的 ID 在数据库中不存在：
- 不会播放任何歌曲
- 不会显示错误
- 用户可以手动选择歌曲

### 2. 配置更新
修改 `config.py` 后需要：
1. 重启后端服务
2. 刷新浏览器页面

### 3. 浏览器自动播放策略
某些浏览器可能阻止自动播放：
- Chrome: 需要用户交互后才能自动播放
- Firefox: 默认允许自动播放
- Safari: 可能需要用户授权

如果遇到自动播放被阻止：
- 点击页面任意位置
- 或手动点击播放按钮

---

## 🎯 使用场景

### 场景 1: 欢迎音乐
```python
START_INDEX = 1  # 播放第一首歌作为欢迎音乐
```

### 场景 2: 推荐歌曲
```python
START_INDEX = 7  # 播放精选推荐歌曲
```

### 场景 3: 最新歌曲
```python
# 动态获取最新歌曲 ID
# 需要手动更新配置
START_INDEX = 10
```

### 场景 4: 禁用自动播放
```python
START_INDEX = None  # 或删除这一行
```

---

## 🚀 未来增强

### 短期
- ✅ 基础自动播放功能
- 🔜 支持随机播放模式
- 🔜 记住用户上次播放的歌曲

### 长期
- 🔜 支持播放列表自动播放
- 🔜 根据时间段自动选择歌曲
- 🔜 基于用户喜好的智能推荐
- 🔜 支持多个候选歌曲（如果第一个不可用）

---

## ✅ 总结

### 已实现功能
- ✅ 配置化的自动播放
- ✅ 基于歌曲 ID 的精确匹配
- ✅ 保持在浏览视图
- ✅ 显示迷你播放器
- ✅ 优雅的降级处理

### 配置示例
```python
# config.py
START_INDEX = 7  # 自动播放 ID=7 的歌曲
```

### API 端点
```
GET /api/config
返回: {"success": true, "start_index": 7}
```

### 用户体验
- 🎵 页面加载即有音乐
- 🎨 底部迷你播放器
- 🔄 可随时切换歌曲
- 📱 响应式设计

---

**功能已完整实现并测试通过！** 🎉
