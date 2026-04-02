# ✅ CloudBase SQL 版本已就绪

## 你的 SQL 数据库
- **环境ID**: `cloudbase-9gg5wxnh64aaabbc`
- **数据库**: `cloudbase-9gg5wxnh64aaabbc`
- **类型**: MySQL

## 📂 创建的文件

```
cloudfunctions/
├── db/
│   └── index.js          # SQL 操作工具（核心）
│
└── user_sql/
    ├── index.js          # User 云函数 SQL 版本
    └── package.json

docs/
└── SQL_DEPLOY_GUIDE.md   # 完整部署指南
```

## 🚀 快速部署（3步）

### 1️⃣ 创建数据库表
在 CloudBase 控制台 SQL 窗口执行：
```sql
CREATE DATABASE IF NOT EXISTS `cloudbase-9gg5wxnh64aaabbc` DEFAULT CHARACTER SET utf8mb4;
USE `cloudbase-9gg5wxnh64aaabbc`;

-- 然后创建表（详见 SQL_DEPLOY_GUIDE.md）
```

### 2️⃣ 设置环境变量
在云开发控制台 → 云函数 → 配置：
```
DB_HOST=your-mysql-host.mysql.gz.cdb.myqcloud.com
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
```

### 3️⃣ 部署云函数
- 右键 `cloudfunctions/db` → 创建并部署
- 右键 `cloudfunctions/user_sql` → 创建并部署

## 💻 使用方式

### 在小程序中调用
```javascript
// 原来的调用（云数据库）
wx.cloud.callFunction({ name: 'user', data: {...} })

// 现在的调用（SQL 数据库）
wx.cloud.callFunction({ name: 'user_sql', data: {...} })
```

### 在代码中使用 SQL
```javascript
const { UserDB, OrderDB, query } = require('./db')

// 使用封装方法
const user = await UserDB.getByOpenid(openid)

// 执行任意 SQL
const rows = await query('SELECT * FROM orders WHERE status = ?', ['pending'])
```

## 📊 支持的表

| 表名 | 说明 |
|-----|------|
| users | 用户表 |
| craftsmen | 手艺人表 |
| dispatchers | 派单人表 |
| orders | 订单表 |
| verify_codes | 验证码表 |
| sms_logs | 短信日志表 |

## 📖 详细文档
- `SQL_DEPLOY_GUIDE.md` - 完整部署步骤和 API 文档

## ⚡ 下一步
1. 执行 SQL 创建表
2. 设置环境变量
3. 部署云函数
4. 测试注册/登录功能

---
**状态**: ✅ 已完成，等待部署
