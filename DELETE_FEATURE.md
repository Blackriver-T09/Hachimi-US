# 🗑️ 删除功能说明

## ✅ 已实现

在 Admin 页面的 Music Library 中，每一行后面添加了删除按钮。

### 功能特性

1. **完整删除**
   - 数据库记录
   - 音频文件 (`music/{id}.mp3`)
   - 封面图片 (`figures/{id}.jpg`)
   - 视频文件 (`videos/{id}.mp4`)
   - 弹幕文件 (`bullet/{id}.xml`)

2. **安全确认**
   - 点击删除按钮会弹出确认对话框
   - 显示歌曲标题和警告信息
   - 明确提示"此操作不可恢复"

3. **权限保护**
   - 需要管理员 token
   - 使用 `@token_required` 装饰器

---

## 📋 使用方法

### 1. 访问 Admin 页面
```
http://localhost:5173/admin
```

### 2. 找到要删除的歌曲
在 Music Library 表格中找到对应行

### 3. 点击删除按钮
每一行最后有一个红色的垃圾桶图标按钮

### 4. 确认删除
弹出对话框会显示：
```
确定要删除《歌曲标题》吗？

这将删除所有相关文件（音频、视频、封面、弹幕）和数据库记录，此操作不可恢复！
```

点击"确定"执行删除，点击"取消"放弃操作

### 5. 查看结果
- 成功：显示绿色提示 "✓ 已删除《歌曲标题》及其所有文件"
- 失败：显示红色错误提示

---

## 🔧 技术实现

### 后端 API

**端点**: `DELETE /api/videos/<video_id>`

**权限**: 需要 Bearer Token

**响应**:
```json
{
  "success": true,
  "message": "Video 18 deleted",
  "deleted_files": ["18.mp3", "18.jpg", "18.mp4", "18.xml"]
}
```

### 前端实现

**位置**: `frontend/src/pages/Admin.tsx`

**函数**: `handleDelete(id: number, title: string)`

**UI**: 
- 红色边框按钮
- Trash2 图标
- Hover 效果：背景变为深红色

---

## 🎨 UI 设计

- **按钮颜色**: 红色 (`text-red-400`)
- **边框**: 半透明红色 (`border-red-900/50`)
- **Hover 效果**: 深红背景 (`hover:bg-red-950`)
- **图标**: Lucide React 的 `Trash2`

---

## ⚠️ 注意事项

1. **不可恢复**: 删除操作会永久删除所有文件和数据
2. **权限检查**: 确保已登录且有有效 token
3. **文件同步**: 删除后前端列表会自动更新
4. **错误处理**: 如果文件不存在，会记录警告但不会中断删除

---

## 🚀 测试步骤

1. 重启后端
```bash
pkill -f "python3 app.py"
python3 app.py
```

2. 访问 Admin 页面
```
http://localhost:5173/admin
```

3. 尝试删除一首歌曲
4. 检查文件是否被删除
```bash
ls music/ figures/ videos/ bullet/
```

5. 刷新页面，确认歌曲已从列表中移除

---

## ✅ 完成

删除功能已完全实现并集成到 Admin 页面！
