# 🟢 在线用户统计 - 最终版本

## ✅ 正确的实现

现在在线统计以**浏览器实例**为单位，而不是标签页。

---

## 🎯 核心逻辑

### 1个浏览器 = 1个在线用户

- **同一浏览器的所有标签页** → 共享同一个 session ID
- **关闭部分标签页** → 仍然在线（其他标签页还在发送心跳）
- **关闭所有标签页** → 30秒后自动下线（无心跳）

---

## 🔧 技术实现

### Session ID 生成策略

```typescript
const getOrCreateSessionId = () => {
  // 1. 尝试从 localStorage 获取已存在的 session ID
  let sessionId = localStorage.getItem('hachimi_session_id')
  
  if (!sessionId) {
    // 2. 生成浏览器指纹
    const browserFingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}`
    
    // 3. 计算哈希值
    const hash = browserFingerprint.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    // 4. 生成唯一 session ID
    sessionId = `session_${Math.abs(hash)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // 5. 保存到 localStorage（所有标签页共享）
    localStorage.setItem('hachimi_session_id', sessionId)
  }
  
  return sessionId
}
```

### 心跳机制

```typescript
// 每个标签页都发送心跳
const heartbeatInterval = setInterval(sendHeartbeat, 10000)

// 关闭标签页时不发送 offline 信号
return () => {
  clearInterval(heartbeatInterval)
  // 不发送 offline - 让 session 自然超时
}
```

---

## 📊 工作流程

### 场景 1: 打开第一个标签页
```
1. 检查 localStorage → 无 session ID
2. 生成新的 session ID
3. 保存到 localStorage
4. 发送心跳 → 在线 +1
```

### 场景 2: 打开第二个标签页（同一浏览器）
```
1. 检查 localStorage → 找到已存在的 session ID
2. 使用相同的 session ID
3. 发送心跳 → 在线数不变（仍然是 1）
```

### 场景 3: 关闭一个标签页
```
1. 停止发送心跳
2. 其他标签页继续发送心跳
3. 在线数不变（仍然是 1）
```

### 场景 4: 关闭所有标签页
```
1. 所有标签页停止发送心跳
2. 30秒后 session 超时
3. 在线 -1
```

### 场景 5: 打开不同浏览器
```
1. 不同浏览器有不同的 localStorage
2. 生成不同的 session ID
3. 在线 +1（新的用户）
```

---

## 🧪 测试场景

### 测试 1: 同一浏览器多标签页
1. 打开浏览器 A，标签页 1 → 在线 = 1
2. 打开浏览器 A，标签页 2 → 在线 = 1 ✅
3. 打开浏览器 A，标签页 3 → 在线 = 1 ✅
4. 关闭标签页 1 → 在线 = 1 ✅
5. 关闭标签页 2 → 在线 = 1 ✅
6. 关闭标签页 3 → 等待 30 秒 → 在线 = 0 ✅

### 测试 2: 不同浏览器
1. 打开 Chrome → 在线 = 1
2. 打开 Firefox → 在线 = 2 ✅
3. 打开 Safari → 在线 = 3 ✅
4. 关闭 Chrome → 等待 30 秒 → 在线 = 2 ✅

### 测试 3: 隐身模式
1. 打开普通窗口 → 在线 = 1
2. 打开隐身窗口 → 在线 = 2 ✅
   （隐身模式有独立的 localStorage）

---

## 💡 为什么这样设计？

### 问题：之前的实现
- 每个标签页 = 1 个 session
- 关闭一个标签页 → 在线 -1
- **不符合实际**：用户还在其他标签页浏览

### 解决：当前实现
- 1 个浏览器 = 1 个 session
- 所有标签页共享 session ID（通过 localStorage）
- 只要有一个标签页在发送心跳 → 用户在线
- 所有标签页关闭 → 30秒后自动下线

---

## 🔍 技术细节

### localStorage 的作用
- **跨标签页共享数据**
- 同一浏览器的所有标签页可以访问相同的 localStorage
- 隐身模式有独立的 localStorage

### 浏览器指纹
```javascript
const browserFingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}`
```

**包含**：
- User Agent（浏览器类型和版本）
- 屏幕分辨率
- 语言设置

**用途**：
- 增加 session ID 的唯一性
- 同一设备的同一浏览器生成相似的哈希值

### 心跳超时
- **间隔**: 10 秒发送一次心跳
- **超时**: 30 秒无心跳则下线
- **容错**: 允许最多 3 次心跳失败

---

## 📋 对比表

| 场景 | 旧实现 | 新实现 |
|------|--------|--------|
| 打开 3 个标签页 | 在线 +3 | 在线 +1 ✅ |
| 关闭 1 个标签页 | 在线 -1 | 在线不变 ✅ |
| 关闭所有标签页 | 立即 -3 | 30秒后 -1 ✅ |
| 不同浏览器 | 各自计数 | 各自计数 ✅ |
| 隐身模式 | 独立计数 | 独立计数 ✅ |

---

## 🎉 优势

1. **符合直觉**
   - 1 个用户 = 1 个浏览器实例
   - 多个标签页不重复计数

2. **准确统计**
   - 真实反映在线用户数
   - 不会因为多标签页而虚高

3. **自动清理**
   - 用户离开后 30 秒自动下线
   - 无需手动发送 offline 信号

4. **简单可靠**
   - 利用 localStorage 自动共享
   - 减少网络请求

---

## 🛠️ 故障排除

### 在线数还是不准确？

1. **清除 localStorage**
   ```javascript
   localStorage.removeItem('hachimi_session_id')
   ```

2. **检查 Redis**
   ```bash
   redis-cli KEYS "session:*"
   ```

3. **重启服务**
   ```bash
   ./restart.sh
   ```

---

## 📝 总结

**核心原则**：
- ✅ 1 个浏览器 = 1 个在线用户
- ✅ 多个标签页 = 共享 session ID
- ✅ 关闭部分标签页 = 仍然在线
- ✅ 关闭所有标签页 = 30秒后下线

**实现方式**：
- ✅ localStorage 存储 session ID
- ✅ 所有标签页共享同一个 ID
- ✅ 依赖心跳超时机制
- ✅ 不发送 offline 信号

---

**重启服务测试新功能**：
```bash
./restart.sh
```

🟢💚✨
