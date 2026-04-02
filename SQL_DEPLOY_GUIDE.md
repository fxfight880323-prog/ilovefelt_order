# CloudBase SQL 数据库部署指南

## 概述
直接使用你的 CloudBase SQL 数据库 (`cloudbase-9gg5wxnh64aaabbc`) 运行小程序。

## 快速开始（3步）

### 第 1 步：初始化数据库表（5分钟）

在 CloudBase 控制台的 SQL 窗口执行以下 SQL：

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS `cloudbase-9gg5wxnh64aaabbc` 
DEFAULT CHARACTER SET utf8mb4;

USE `cloudbase-9gg5wxnh64aaabbc`;

-- 1. 用户表
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'guest',
    roles JSON,
    current_role VARCHAR(20) DEFAULT 'guest',
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    name VARCHAR(50),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 手艺人表
CREATE TABLE craftsmen (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    wechat_id VARCHAR(50),
    specialty VARCHAR(100),
    experience VARCHAR(50),
    address VARCHAR(200),
    star_level TINYINT DEFAULT 3,
    performance VARCHAR(10) DEFAULT '中',
    total_orders INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 5.0,
    status VARCHAR(20) DEFAULT 'pending',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 派单人表
CREATE TABLE dispatchers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    company VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. 订单表
CREATE TABLE orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    style_id INT,
    style_name VARCHAR(100),
    quantity INT DEFAULT 1,
    price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    receive_date DATE,
    dispatch_date DATE,
    remark TEXT,
    image_url VARCHAR(500),
    dispatcher_id INT,
    dispatcher_name VARCHAR(50),
    craftsman_id INT,
    craftsman_name VARCHAR(50),
    craftsman_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    tracking_number VARCHAR(100),
    tracking_company VARCHAR(50),
    ship_date TIMESTAMP NULL,
    complete_photos JSON,
    complete_date TIMESTAMP NULL,
    rating TINYINT,
    rating_comment TEXT,
    accept_date TIMESTAMP NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. 验证码表
CREATE TABLE verify_codes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL,
    used TINYINT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expire_time TIMESTAMP NULL,
    used_time TIMESTAMP NULL
);

-- 6. 短信日志表
CREATE TABLE sms_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    phone_to VARCHAR(20),
    content TEXT,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO users (openid, role, roles, current_role, phone, status, name) VALUES
('test_openid_1', 'admin', '["admin"]', 'admin', '13810062394', 'active', '管理员');
```

### 第 2 步：配置环境变量（5分钟）

1. 打开云开发控制台
2. 进入「云函数」→「配置」
3. 添加以下环境变量：

```
DB_HOST=your-mysql-host.mysql.gz.cdb.myqcloud.com
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
```

> 获取方式：CloudBase 控制台 → 数据库 → MySQL → 查看连接信息

### 第 3 步：部署云函数（10分钟）

#### 1. 部署 db 工具模块
```bash
# 在微信开发者工具中
# 右键 cloudfunctions/db 文件夹
# 选择 "创建并部署：云端安装依赖"
```

#### 2. 部署 user_sql 云函数
```bash
# 右键 cloudfunctions/user_sql 文件夹
# 选择 "创建并部署：云端安装依赖"
```

#### 3. （可选）继续部署 order_sql, sms_sql

#### 4. 测试连接
在云函数控制台测试 user_sql：
```json
{
  "action": "login"
}
```

预期返回用户登录信息。

## 切换现有代码到 SQL 版本

### 修改调用方式

**原来（云数据库）**：
```javascript
// 调用云函数
const res = await wx.cloud.callFunction({
  name: 'user',  // 原来的云函数
  data: { action: 'login' }
})
```

**现在（SQL 数据库）**：
```javascript
// 调用云函数
const res = await wx.cloud.callFunction({
  name: 'user_sql',  // 新的 SQL 版本
  data: { action: 'login' }
})
```

### 或者替换原有云函数

如果你想直接用 SQL 替换原有的云函数：

1. 备份原有的 `user` 云函数
2. 将 `user_sql` 的内容复制到 `user` 文件夹
3. 重新部署

## 在代码中使用 SQL

### 查询示例
```javascript
const { query } = require('./db')

// 执行任意 SQL
const users = await query('SELECT * FROM users WHERE role = ?', ['craftsman'])
```

### 使用封装的方法
```javascript
const { UserDB, OrderDB } = require('./db')

// 获取用户
const user = await UserDB.getByOpenid(openid)

// 创建订单
const orderId = await OrderDB.create({
  name: '测试订单',
  price: 100,
  status: 'pending'
})

// 获取订单列表
const orders = await OrderDB.getList({ status: 'pending', limit: 10 })
```

## 数据迁移（从云数据库到 SQL）

如果你有现有数据需要迁移：

```javascript
// 在云函数控制台执行
const cloud = require('wx-server-sdk')
const { UserDB, CraftsmanDB } = require('./db')

// 读取云数据库
const { data } = await db.collection('users').get()

// 写入 SQL
for (const doc of data) {
  await UserDB.create(doc)
}
```

## 故障排查

### 1. 连接失败
- 检查环境变量是否正确设置
- 确认 MySQL 安全组是否放行 3306 端口
- 验证用户名密码

### 2. 表不存在
- 确认已执行 SQL 初始化脚本
- 检查数据库名是否正确

### 3. 字符集问题
- 确保所有表使用 utf8mb4
- 连接配置中设置 charset: 'utf8mb4'

## API 列表

### UserDB
- `getByOpenid(openid)` - 根据 openid 获取用户
- `create(data)` - 创建用户
- `update(openid, data)` - 更新用户

### CraftsmanDB
- `getByOpenid(openid)` - 根据 openid 获取手艺人
- `getByPhone(phone)` - 根据手机号获取
- `create(data)` - 创建手艺人
- `update(openid, data)` - 更新手艺人
- `getAll(status)` - 获取所有手艺人

### DispatcherDB
- `getByOpenid(openid)` - 根据 openid 获取派单人
- `getByPhone(phone)` - 根据手机号获取
- `create(data)` - 创建派单人
- `update(openid, data)` - 更新派单人

### OrderDB
- `getById(id)` - 根据 ID 获取订单
- `create(data)` - 创建订单
- `update(id, data)` - 更新订单
- `getList(where)` - 获取订单列表

### VerifyCodeDB
- `create(data)` - 创建验证码
- `verify(phone, code, type)` - 验证验证码
- `markUsed(id)` - 标记已使用

### 原始 SQL 操作
- `query(sql, params)` - 执行查询
- `insert(sql, params)` - 执行插入，返回 ID
- `update(sql, params)` - 执行更新，返回影响行数

## 完成！

现在你的小程序直接使用 CloudBase SQL 数据库运行。

如有问题请查看：
- 云函数日志
- MySQL 控制台
- 环境变量配置
