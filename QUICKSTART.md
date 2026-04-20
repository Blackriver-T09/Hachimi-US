# ⚡ Hachimi 快速启动指南

## 🚀 一键启动

### 方法 1: 使用系统服务（推荐）

```bash
# 首次使用：安装服务
./install-service.sh

# 启动
sudo systemctl start hachimi

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:5000
```

### 方法 2: 使用脚本

```bash
# 启动
./start.sh

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:5000
```

---

## 📋 常用命令

### 系统服务方式

```bash
sudo systemctl start hachimi      # 启动
sudo systemctl stop hachimi       # 停止
sudo systemctl restart hachimi    # 重启
sudo systemctl status hachimi     # 状态
```

### 脚本方式

```bash
./start.sh      # 启动
./stop.sh       # 停止
./restart.sh    # 重启
./status.sh     # 状态
```

---

## 📊 检查状态

```bash
# 详细状态
./status.sh

# 查看日志
tail -f logs/backend.log
tail -f logs/frontend.log
```

---

## 🔧 首次安装

```bash
# 1. 安装依赖
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 2. 初始化数据库
python3 database.py

# 3. 配置文件（可选）
cp config.example.py config.py
# 编辑 config.py

# 4. 安装服务
./install-service.sh

# 5. 启动
sudo systemctl start hachimi
```

---

## 🎯 访问地址

- **前端**: http://localhost:5173
- **后端**: http://localhost:5000
- **管理**: http://localhost:5173/admin

---

**就这么简单！** 🎉
