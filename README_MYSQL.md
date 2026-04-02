# CloudBase MySQL 集成方案

## 📖 说明

此方案将小程序的云开发数据库（NoSQL）与 CloudBase MySQL（SQL）同步，实现：
- 数据实时备份
- 支持复杂 SQL 查询
- 便于数据分析和导出
- 支持 BI 工具连接

## 📁 文件结构

```
cloudfunctions/
├── mysql_proxy/              # MySQL 代理云函数
│   ├── index.js             # 主函数 - 提供 MySQL 操作接口
│   ├── package.json         # 依赖配置
│   └── CONFIG.md            # 配置说明
│
├── migrate_data/             # 数据迁移云函数
│   ├── index.js             # 主函数 - 历史数据迁移
│   └── package.json
│
├── mysql_sync/               # 同步工具
│   ├── init_mysql.sql       # MySQL 表结构初始化脚本
│   ├── SQL_SCHEMA.md        # 数据库设计文档
│   └── db.js                # MySQL 连接工具
│
└── user_mysql_example.js     # 修改示例 - 展示如何集成

文档/
├── MYSQL_SYNC_GUIDE.md       # 完整部署指南
├── MYSQL_INTEGRATION_SUMMARY.md  # 完成总结
├── DEPLOY_MYSQL.bat          # Windows 部署辅助脚本
└── README_MYSQL.md           # 本文件
```

## 🚀 快速开始

### 1. 准备工作

- 确保有 CloudBase MySQL 实例
- 记录 MySQL 连接信息（地址、端口、用户名、密码）

### 2. 初始化 MySQL 数据库

**方法一：SQL 窗口执行**
1. 登录腾讯云 CloudBase 控制台
2. 进入数据库 → MySQL → SQL 窗口
3. 打开 `cloudfunctions/mysql_sync/init_mysql.sql`
4. 执行全部 SQL

**方法二：命令行执行**
```bash
mysql -h your-host -P 3306 -u root -p < cloudfunctions/mysql_sync/init_mysql.sql
```

### 3. 部署 mysql_proxy 云函数

在微信开发者工具中：
1. 右键 `cloudfunctions/mysql_proxy`
2. 选择 "创建并部署：云端安装依赖"
3. 等待部署完成

### 4. 配置环境变量

1. 打开云开发控制台 → 云函数 → mysql_proxy → 配置
2. 添加环境变量：
   ```
   MYSQL_HOST=your-host.mysql.gz.cdb.myqcloud.com
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your-password
   MYSQL_DATABASE=cloudbase-9gg5wxnh64aaabbc
   ```
3. 保存并重新部署

### 5. 测试连接

在云函数控制台测试 `mysql_proxy`：

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

### 6. 修改现有云函数

参考 `cloudfunctions/user_mysql_example.js`，在以下云函数中添加 MySQL 同步：

- `user` 云函数 - 用户注册/登录
- `order` 云函数 - 订单操作
- `sms` 云函数 - 验证码发送

### 7. 数据迁移（可选）

如果需要迁移历史数据：
1. 部署 `migrate_data` 云函数
2. 在云函数控制台测试：
   ```json
   {
     "action": "migrateAll",
     "batchSize": 100
   }
   ```

## 📊 数据库表结构

| 表名 | 说明 | 主要字段 |
|-----|------|---------|
| users | 用户表 | openid, role, phone, status |
| craftsmen | 手艺人表 | openid, name, phone, specialty, status |
| dispatchers | 派单人表 | openid, name, phone, company |
| orders | 订单表 | name, status, craftsman_id, dispatcher_id |
| styles | 样式表 | name, description, status |
| verify_codes | 验证码表 | phone, code, type, used |
| sms_logs | 短信日志表 | phone_to, content, type |
| notices | 公告表 | title, content, status |
| ratings | 评分表 | order_id, craftsman_id, score |
| admin_requests | 审核表 | openid, type, status |

## 💻 在代码中使用

### 插入数据
```javascript
// 写入云数据库
await db.collection('users').add({ data: userData })

// 同步到 MySQL
await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
  action: 'insertUser',
    data: userData
  }
})
```

### 查询数据
```javascript
const { result } = await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'query',
    sql: 'SELECT * FROM orders WHERE status = ?',
    params: ['pending']
  }
})
console.log(result.data) // MySQL 查询结果
```

### 复杂查询示例
```javascript
// 统计每个手艺人的订单数
const { result } = await cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'query',
    sql: `
      SELECT 
        c.name,
        COUNT(o.id) as order_count,
        SUM(o.total_price) as total_amount
      FROM craftsmen c
      LEFT JOIN orders o ON c.id = o.craftsman_id
      WHERE o.status = 'completed'
      GROUP BY c.id
      ORDER BY total_amount DESC
    `
  }
})
```

## ⚙️ 配置选项

### 同步模式

**模式 1：实时同步（推荐）**
- 每次数据变更同时写入 MySQL
- 数据实时一致
- 适合数据安全性要求高的场景

**模式 2：异步同步**
- 批量写入 MySQL
- 减少调用次数
- 数据有短暂延迟

### 环境变量

| 变量名 | 必填 | 说明 |
|-------|------|------|
| MYSQL_HOST | 是 | MySQL 服务器地址 |
| MYSQL_PORT | 否 | 端口，默认 3306 |
| MYSQL_USER | 是 | 用户名 |
| MYSQL_PASSWORD | 是 | 密码 |
| MYSQL_DATABASE | 否 | 数据库名 |

## 🛠️ 故障排查

### MySQL 连接失败
- 检查安全组是否放行 3306 端口
- 确认使用的是内网还是外网地址
- 验证用户名密码是否正确

### 同步失败
- 查看 `mysql_proxy` 云函数日志
- 检查表结构是否一致
- 确认环境变量已正确配置

### 字符集问题
- 确保 MySQL 使用 utf8mb4
- 检查云数据库中的特殊字符

## 📚 相关文档

- [完整部署指南](MYSQL_SYNC_GUIDE.md)
- [配置说明](cloudfunctions/mysql_proxy/CONFIG.md)
- [数据库设计](cloudfunctions/mysql_sync/SQL_SCHEMA.md)
- [完成总结](MYSQL_INTEGRATION_SUMMARY.md)

## 💰 费用说明

使用此方案会产生以下费用：

1. **CloudBase MySQL**: 按实例规格和使用时长计费
2. **云函数调用**: 每次同步都会调用 `mysql_proxy`
3. **网络流量**: 内网流量通常免费

建议：
- 开发测试使用小规格实例
- 生产环境根据实际数据量选择规格

## 🔒 安全建议

1. 使用内网地址访问 MySQL
2. 为应用程序创建专用 MySQL 用户
3. 限制 MySQL 访问 IP
4. 定期备份数据
5. 不要在代码中硬编码密码

## 📞 支持

- CloudBase 文档: https://docs.cloudbase.net/
- 小程序云开发: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/

---

**版本**: v1.0  
**更新日期**: 2026-03-23  
**状态**: ✅ 已完成
