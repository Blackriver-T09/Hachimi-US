# 品牌更新文档

## 🎨 更新内容

### 1. **Logo 更新**
- ✅ 使用 `mambo head.png` 作为新 logo
- ✅ 复制到 `frontend/public/logo.png`
- ✅ 圆形显示，带紫色阴影效果

### 2. **标签页更新**
- ✅ 标题：`Hachimi Music`
- ✅ Favicon：使用新 logo
- ✅ 文件：`frontend/index.html`

### 3. **侧边栏更新（Player 页面）**
- ✅ 替换原来的 "H" 圆形图标
- ✅ 使用新 logo 图片
- ✅ 文字：`Hachimi Music`
- ✅ 尺寸：40x40px 圆形

### 4. **Admin 页面更新**
- ✅ 顶部标题：`Hachimi Music Admin`
- ✅ 添加 logo（48x48px）
- ✅ 与标题并排显示

### 5. **Login 页面更新**
- ✅ 顶部居中显示 logo（80x80px）
- ✅ 标题：`Hachimi Music Admin`
- ✅ 卡片式布局

---

## 📁 修改的文件

### 1. `frontend/index.html`
```html
<link rel="icon" type="image/png" href="/logo.png" />
<title>Hachimi Music</title>
```

### 2. `frontend/src/pages/Player.tsx`
```tsx
<img 
  src="/logo.png" 
  alt="Hachimi Music" 
  className="w-10 h-10 rounded-full object-cover shadow-lg shadow-purple-500/20"
/>
Hachimi Music
```

### 3. `frontend/src/pages/Admin.tsx`
```tsx
<div className="flex items-center gap-4">
  <img 
    src="/logo.png" 
    alt="Hachimi Music" 
    className="w-12 h-12 rounded-full object-cover shadow-lg shadow-purple-500/20"
  />
  <h1 className="text-3xl font-bold text-purple-400">Hachimi Music Admin</h1>
</div>
```

### 4. `frontend/src/pages/Login.tsx`
```tsx
<div className="flex justify-center">
  <img 
    src="/logo.png" 
    alt="Hachimi Music" 
    className="w-20 h-20 rounded-full object-cover shadow-lg shadow-purple-500/20"
  />
</div>
<CardTitle className="text-2xl text-center text-purple-400">Hachimi Music Admin</CardTitle>
```

### 5. 新增文件
- `frontend/public/logo.png` - 从 `mambo head.png` 复制

---

## 🎯 视觉效果

### Player 侧边栏
```
┌────────────────────────┐
│  [Logo]  Hachimi Music │  ← 顶部
│                        │
│  🔲 Browse            │
│  ▶  Now Playing       │
│  ☰  Playlists         │
│  ♥  Favorites         │
└────────────────────────┘
```

### Admin 页面
```
┌──────────────────────────────────────┐
│  [Logo]  Hachimi Music Admin  [Logout]│
├──────────────────────────────────────┤
│  统计信息...                          │
└──────────────────────────────────────┘
```

### Login 页面
```
┌──────────────────┐
│                  │
│     [Logo]       │  ← 居中大图标
│                  │
│ Hachimi Music    │
│     Admin        │
│                  │
│  [Username]      │
│  [Password]      │
│  [Login Button]  │
└──────────────────┘
```

### 浏览器标签页
```
[Logo图标] Hachimi Music
```

---

## 🎨 样式细节

### Logo 样式
```css
/* 通用样式 */
.rounded-full          /* 圆形 */
.object-cover          /* 图片填充 */
.shadow-lg             /* 大阴影 */
.shadow-purple-500/20  /* 紫色光晕 */

/* 不同尺寸 */
w-10 h-10  /* 40px - 侧边栏 */
w-12 h-12  /* 48px - Admin 标题 */
w-20 h-20  /* 80px - Login 页面 */
```

### 文字样式
```css
/* 标题 */
text-xl font-bold text-white           /* 侧边栏 */
text-3xl font-bold text-purple-400     /* Admin 页面 */
text-2xl text-center text-purple-400   /* Login 页面 */
```

---

## 🔍 测试清单

### ✅ 已测试项目
- [x] 浏览器标签页显示新 logo
- [x] 标签页标题为 "Hachimi Music"
- [x] Player 侧边栏显示新 logo
- [x] Player 侧边栏文字为 "Hachimi Music"
- [x] Admin 页面标题显示新 logo
- [x] Admin 页面标题为 "Hachimi Music Admin"
- [x] Login 页面显示居中 logo
- [x] Login 页面标题为 "Hachimi Music Admin"

### 测试步骤
1. **刷新浏览器** (Ctrl + Shift + R)
2. **检查标签页**
   - Logo 是否显示
   - 标题是否为 "Hachimi Music"
3. **检查 Player 页面**
   - 侧边栏顶部 logo 是否显示
   - 文字是否为 "Hachimi Music"
4. **检查 Admin 页面**
   - 顶部是否显示 logo
   - 标题是否为 "Hachimi Music Admin"
5. **检查 Login 页面**
   - Logo 是否居中显示
   - 标题是否正确

---

## 📊 文件结构

```
Hachimi/
├── mambo head.png                    # 原始 logo 文件
└── frontend/
    ├── index.html                    # ✏️ 修改：标题和 favicon
    ├── public/
    │   └── logo.png                  # ✨ 新增：复制的 logo
    └── src/
        └── pages/
            ├── Player.tsx            # ✏️ 修改：侧边栏 logo
            ├── Admin.tsx             # ✏️ 修改：顶部 logo
            └── Login.tsx             # ✏️ 修改：居中 logo
```

---

## 🎯 品牌一致性

### 颜色方案
- **主色调**: 紫色 (`purple-400`, `purple-500`)
- **背景色**: 深色 (`zinc-900`, `zinc-950`)
- **文字色**: 白色/浅灰 (`white`, `zinc-100`)

### Logo 使用规范
- **形状**: 圆形
- **阴影**: 紫色光晕
- **尺寸**: 
  - 小：40px（侧边栏）
  - 中：48px（页面标题）
  - 大：80px（登录页面）

### 文字规范
- **应用名**: Hachimi Music
- **管理后台**: Hachimi Music Admin
- **字体**: 系统默认（粗体）

---

## 🚀 部署说明

### 1. 确认文件
```bash
ls -lh frontend/public/logo.png
# 应该显示文件存在
```

### 2. 构建前端
```bash
cd frontend
npm run build
```

### 3. 刷新浏览器
- 按 Ctrl + Shift + R 强制刷新
- 清除缓存

### 4. 验证
- 检查所有页面的 logo 显示
- 检查标签页标题和图标

---

## ✅ 完成状态

- ✅ Logo 文件已复制
- ✅ HTML 标题已更新
- ✅ Favicon 已更新
- ✅ Player 侧边栏已更新
- ✅ Admin 页面已更新
- ✅ Login 页面已更新
- ✅ 前端已构建
- ✅ 样式统一

---

**品牌更新已完成！** 🎉
