# CloudBase MySQL 同步完整指南

## 概述

此方案将小程序的云开发数据库（NoSQL）实时同步到 CloudBase MySQL（SQL），实现数据的双向备份和更复杂的查询能力。

## 架构设计

```
小程序
  ↓
云函数 (user/order/sms)
  ├─→ 云开发数据库 (NoSQL) - 主存储
  └─→ mysql_proxy 云函数
        ↓
      CloudBase MySQL (SQL) - 备份/分析
```

## 文件说明

### 1. 数据库设计
- `cloudfunctions/mysql_sync/init_mysql.sql` - MySQL 表结构初始化脚本
- `cloudfunctions/mysql_sync/SQL_SCHEMA.md` - 表结构设计文档

### 2. MySQL 连接工具
- `cloudfunctions/mysql_sync/db.js` - MySQL 连接和操作工具

### 3. MySQL 代理云函数
- `cloudfunctions/mysql_proxy/index.js` - 提供 MySQL 操作的 HTTP 接口
- `cloudfunctions/mysql_proxy/package.json`
- `cloudfunctions/mysql_proxy/CONFIG.md` - 配置说明

### 4. 数据迁移工具
- `cloudfunctions/migrate_data/index.js` - 历史数据迁移
- `cloudfunctions/migrate_data/package.json`

### 5. 示例代码
- `cloudfunctions/user_mysql_example.js` - 展示如何修改现有云函数

## 部署步骤

### 第一步：创建 CloudBase MySQL 数据库

1. 登录腾讯云控制台
2. 进入 CloudBase → 数据库 → MySQL
3. 创建 MySQL 实例（如果还没有）
4. 记录连接信息：
   - 内网地址
   - 端口号（默认 3306）
   - 用户名（默认 root）
   - 密码

### 第二步：初始化 MySQL 表结构

#### 方法一：使用 SQL 文件

1. 进入 CloudBase MySQL 控制台
2. 找到"数据库管理" → "SQL 窗口"
3. 打开 `cloudfunctions/mysql_sync/init_mysql.sql`
4. 复制全部内容到 SQL 窗口执行

#### 方法二：使用命令行

```bash
mysql -h <your-mysql-host> -P 3306 -u root -p < cloudfunctions/mysql_sync/init_mysql.sql
```

### 第三步：部署 mysql_proxy 云函数

1. 在微信开发者工具中
2. 右键 `cloudfunctions/mysql_proxy` 文件夹
3. 选择"创建并部署：云端安装依赖"
4. 等待部署完成

### 第四步：配置环境变量

1. 打开云开发控制台
2. 进入"云函数" → 找到 `mysql_proxy`
3. 点击"配置"
4. 添加以下环境变量：

```
MYSQL_HOST=your-mysql-host.mysql.gz.cdb.myqcloud.com
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=cloudbase-9gg5wxnh64aaabbc
```

5. 保存并重新部署

### 第五步：测试 MySQL 连接

在云开发控制台 → 云函数 → mysql_proxy → 测试：

```json
{
  "action": "query",
  "sql": "SELECT 1 as test"
}
```

预期返回：
```json
{
  "code": 0,
  "data": [{ "test": 1 }]
}
```

### 第六步：数据迁移（如有历史数据）

1. 部署 migrate_data 云函数
2. 在云函数控制台测试：

```json
// 检查数据量
{
  "action": "checkStatus"
}

// 迁移所有表
{
  "action": "migrateAll",
  "batchSize": 100
}

// 或迁移单个表
{
  "action": "migrateUsers",
  "batchSize": 100
}
```

### 第七步：修改现有云函数

参考 `cloudfunctions/user_mysql_example.js`，修改以下云函数：

#### 修改 user 云函数

在每个数据库操作后添加 MySQL 同步调用：

```javascript
// 原有代码：写入云数据库
await db.collection('users').add({ data: userData })

// 新增：同步到 MySQL
await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'insertUser',
    data: userData
  }
})
```

#### 修改 order 云函数

```javascript
// 原有代码
await db.collection('orders').add({ data: orderData })

// 新增
await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'insertOrder',
    data: orderData
  }
})
```

#### 修改 sms 云函数

```javascript
// 原有代码
await db.collection('verifyCodes').add({ data: codeData })

// 新增
await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'insertVerifyCode',
    data: codeData
  }
})
```

## 使用方式

### 1. 实时同步（推荐）

每次写入云数据库时，同时调用 mysql_proxy 写入 MySQL。

优点：
- 数据实时一致
- 不遗漏任何操作

缺点：
- 增加响应时间（约 50-100ms）
- 增加云函数调用次数

### 2. 定时同步

使用定时触发器，定期批量同步数据。

优点：
- 不增加实时响应时间
- 减少调用次数

缺点：
- 数据有延迟
- 需要处理冲突

### 3. 按需同步

只在需要复杂查询时，将数据同步到 MySQL。

## 常见问题

### Q1: 同步失败怎么办？

同步失败不会影响主业务流程。可以在 mysql_proxy 中添加日志，定期检查和修复不一致的数据。

### Q2: 云数据库和 MySQL 数据不一致？

可以定期运行 migrate_data 云函数进行全量同步，修复不一致的数据。

### Q3: MySQL 连接超时？

检查：
1. 安全组是否放行 3306 端口
2. 使用的是内网地址还是外网地址
3. 用户名密码是否正确

### Q4: 字符集问题？

确保：
1. MySQL 数据库使用 utf8mb4
2. 连接配置中设置 charset: 'utf8mb4'
3. 云数据库中的特殊字符正确处理

## 费用说明

使用 MySQL 同步会产生以下费用：

1. **CloudBase MySQL**: 按实例规格和使用时长计费
2. **云函数调用**: 每次同步都会调用 mysql_proxy
3. **网络流量**: 云函数访问 MySQL 的内网流量通常免费

建议：
- 开发测试环境使用小规格实例
- 生产环境根据实际数据量选择规格
- 定期检查并优化同步频率

## 安全建议

1. **使用内网访问**：云函数和 MySQL 在同一地域时使用内网地址
2. **限制 IP 访问**：在 MySQL 安全组中只允许云函数 IP 段访问
3. **定期备份**：开启 MySQL 自动备份功能
4. **敏感信息**：使用环境变量存储密码，不要硬编码
5. **权限最小化**：为应用程序创建专用 MySQL 用户，只授予必要权限

## 后续优化

1. **批量写入**：将多条记录合并为一次 MySQL 写入
2. **异步同步**：使用消息队列实现异步同步
3. **冲突解决**：设计冲突检测和解决机制
4. **数据校验**：定期校验两个数据库的数据一致性
