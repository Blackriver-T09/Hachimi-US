# 🚀 Hachimi Service Management

## 📦 服务说明

Hachimi 服务同时管理前端和后端：
- **后端**: Flask 服务器 (端口 5000)
- **前端**: Vite 开发服务器 (端口 5173)

---

## 🔧 安装服务

### 1. 安装为系统服务（推荐）

```bash
# 运行安装脚本
chmod +x install-service.sh
./install-service.sh
```

这将：
- ✅ 使所有脚本可执行
- ✅ 创建日志目录
- ✅ 安装 systemd 服务
- ✅ 设置开机自启动

### 2. 使用 systemd 管理

```bash
# 启动服务
sudo systemctl start hachimi

# 停止服务
sudo systemctl stop hachimi

# 重启服务
sudo systemctl restart hachimi

# 查看服务状态
sudo systemctl status hachimi

# 查看日志
sudo journalctl -u hachimi -f

# 禁用开机自启
sudo systemctl disable hachimi

# 启用开机自启
sudo systemctl enable hachimi
```

---

## 🛠️ 手动管理（不使用 systemd）

如果不想安装为系统服务，可以直接使用脚本：

### 启动服务
```bash
./start.sh
```

### 停止服务
```bash
./stop.sh
```

### 重启服务
```bash
./restart.sh
```

### 查看状态
```bash
./status.sh
```

---

## 📊 服务状态检查

### 使用状态脚本
```bash
./status.sh
```

输出示例：
```
Hachimi Service Status
======================

✓ Backend:  RUNNING (PID: 12345)
  URL:      http://0.0.0.0:5000
  Log:      /home/heihe/Hachimi/logs/backend.log

✓ Frontend: RUNNING (PID: 12346)
  URL:      http://localhost:5173
  Log:      /home/heihe/Hachimi/logs/frontend.log
```

### 使用 systemd
```bash
sudo systemctl status hachimi
```

---

## 📝 日志管理

### 日志位置
- **后端日志**: `logs/backend.log`
- **前端日志**: `logs/frontend.log`

### 查看日志
```bash
# 查看后端日志
tail -f logs/backend.log

# 查看前端日志
tail -f logs/frontend.log

# 查看最后 50 行
tail -n 50 logs/backend.log

# 使用 systemd 查看日志
sudo journalctl -u hachimi -f
```

### 清理日志
```bash
# 清空日志文件
> logs/backend.log
> logs/frontend.log

# 或删除日志目录
rm -rf logs
mkdir logs
```

---

## 🔄 服务重启场景

### 代码更新后重启
```bash
# 拉取最新代码
git pull

# 重启服务
sudo systemctl restart hachimi
# 或
./restart.sh
```

### 配置更改后重启
```bash
# 修改 config.py 后
sudo systemctl restart hachimi
# 或
./restart.sh
```

### 依赖更新后重启
```bash
# 更新 Python 依赖
pip install -r requirements.txt

# 更新前端依赖
cd frontend
npm install
cd ..

# 重启服务
sudo systemctl restart hachimi
```

---

## ❌ 卸载服务

```bash
# 运行卸载脚本
chmod +x uninstall-service.sh
./uninstall-service.sh
```

这将：
- ✅ 停止服务
- ✅ 禁用开机自启
- ✅ 删除 systemd 服务文件

注意：项目文件和日志不会被删除。

---

## 🐛 故障排除

### 服务无法启动

1. **检查端口占用**
   ```bash
   # 检查 5000 端口
   lsof -i :5000
   
   # 检查 5173 端口
   lsof -i :5173
   ```

2. **检查日志**
   ```bash
   tail -n 100 logs/backend.log
   tail -n 100 logs/frontend.log
   ```

3. **手动启动测试**
   ```bash
   # 测试后端
   python3 app.py
   
   # 测试前端
   cd frontend
   npm run dev
   ```

### 服务自动停止

1. **检查系统日志**
   ```bash
   sudo journalctl -u hachimi -n 100
   ```

2. **检查进程**
   ```bash
   ps aux | grep "python3 app.py"
   ps aux | grep "vite"
   ```

3. **检查资源使用**
   ```bash
   top
   df -h
   ```

### PID 文件过期

如果看到 "stale PID file" 错误：
```bash
# 清理 PID 文件
rm -f backend.pid frontend.pid

# 重新启动
./start.sh
```

---

## 📋 文件说明

| 文件 | 说明 |
|------|------|
| `start.sh` | 启动服务脚本 |
| `stop.sh` | 停止服务脚本 |
| `restart.sh` | 重启服务脚本 |
| `status.sh` | 状态检查脚本 |
| `install-service.sh` | 安装 systemd 服务 |
| `uninstall-service.sh` | 卸载 systemd 服务 |
| `hachimi.service` | systemd 服务配置文件 |
| `backend.pid` | 后端进程 ID（自动生成） |
| `frontend.pid` | 前端进程 ID（自动生成） |
| `logs/` | 日志目录 |

---

## 🎯 快速参考

```bash
# 安装服务
./install-service.sh

# 启动
sudo systemctl start hachimi

# 停止
sudo systemctl stop hachimi

# 重启
sudo systemctl restart hachimi

# 状态
sudo systemctl status hachimi

# 查看日志
sudo journalctl -u hachimi -f

# 卸载
./uninstall-service.sh
```

---

## 💡 提示

- 服务默认设置为开机自启动
- 日志会自动轮转（如果配置了 logrotate）
- 服务失败会自动重启（最多尝试 10 秒后）
- 可以同时使用 systemd 和手动脚本管理

---

**服务管理文档完成！** 🎉
