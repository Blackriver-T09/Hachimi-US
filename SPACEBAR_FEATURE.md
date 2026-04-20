# ⌨️ 空格键暂停/继续功能

## ✅ 已实现

为播放器添加了**空格键**快捷键，可以快速暂停/继续播放音乐。

---

## 🎯 功能说明

### 使用方法
1. **播放音乐时**，按下**空格键** → 暂停播放
2. **暂停状态时**，按下**空格键** → 继续播放

### 适用场景
- ✅ **浏览视图**（Browse）
- ✅ **收藏视图**（Favorites）
- ✅ **播放列表视图**（Playlists）
- ✅ **全屏播放器**（Now Playing）

---

## 🔧 技术实现

### 代码位置
**文件**: `frontend/src/pages/Player.tsx`  
**行数**: 241-264

### 实现逻辑

```tsx
// Spacebar keyboard event for play/pause
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Only handle spacebar when not typing in an input field
    if (e.code === 'Space' && 
        e.target instanceof HTMLElement && 
        e.target.tagName !== 'INPUT' && 
        e.target.tagName !== 'TEXTAREA') {
      e.preventDefault() // Prevent page scroll
      
      if (currentVideo && audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause()
          setIsPlaying(false)
        } else {
          audioRef.current.play().catch(err => {
            console.error('Playback failed:', err)
          })
          setIsPlaying(true)
        }
      }
    }
  }

  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [currentVideo, isPlaying])
```

---

## 💡 关键特性

### 1. 智能检测
- ✅ **排除输入框** - 在搜索框输入时不会触发
- ✅ **排除文本域** - 在任何文本输入区域都不会触发
- ✅ **防止滚动** - 使用 `e.preventDefault()` 阻止空格键默认的页面滚动

### 2. 状态同步
- ✅ **依赖追踪** - 监听 `currentVideo` 和 `isPlaying` 状态
- ✅ **自动清理** - 组件卸载时自动移除事件监听器

### 3. 错误处理
- ✅ **播放失败捕获** - 使用 `.catch()` 捕获自动播放错误
- ✅ **控制台日志** - 播放失败时输出错误信息

---

## 🧪 测试方法

### 1. 基本测试
1. 打开应用 → http://localhost:5173
2. 选择任意歌曲播放
3. 按下**空格键** → 应该暂停
4. 再按**空格键** → 应该继续播放

### 2. 输入框测试
1. 点击搜索框
2. 按下**空格键** → 应该输入空格，**不**暂停音乐
3. 点击搜索框外的区域
4. 按下**空格键** → 应该暂停音乐

### 3. 不同视图测试
- **Browse 视图** → 空格键有效
- **Favorites 视图** → 空格键有效
- **Playlists 视图** → 空格键有效
- **Now Playing 视图** → 空格键有效

---

## 🎹 快捷键列表

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| **空格** | 暂停/继续 | 切换播放状态 |
| ← | 上一曲 | 点击按钮 |
| → | 下一曲 | 点击按钮 |

---

## 📋 注意事项

### ✅ 会触发
- 在主页面任意位置按空格键
- 在播放器界面按空格键
- 在歌曲列表区域按空格键

### ❌ 不会触发
- 在搜索框输入时
- 在任何文本输入框中
- 没有选择歌曲时（currentVideo 为 null）

---

## 🔍 故障排除

### 空格键不起作用？

1. **检查是否有歌曲在播放**
   - 必须先选择一首歌曲

2. **检查是否在输入框中**
   - 点击输入框外的区域

3. **检查浏览器控制台**
   - 打开 F12 查看是否有错误

4. **刷新页面**
   - 按 Ctrl+Shift+R 强制刷新

---

## 🎉 完成！

空格键暂停/继续功能已成功添加！

**使用方法**：
1. 播放任意歌曲
2. 按**空格键**暂停
3. 再按**空格键**继续

简单、快捷、高效！⌨️🎵💜
