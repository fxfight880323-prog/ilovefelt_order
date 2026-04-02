# MySQL Proxy 云函数配置说明

## 环境变量配置

在部署此云函数之前，需要在云函数控制台配置以下环境变量：

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|-------|------|------|
| MYSQL_HOST | MySQL 服务器地址 | 10.0.0.1 或 mysql-xxxx.gz.cdb.myqcloud.com |
| MYSQL_PORT | MySQL 端口 | 3306 |
| MYSQL_USER | 用户名 | root |
| MYSQL_PASSWORD | 密码 | your_password |
| MYSQL_DATABASE | 数据库名 | cloudbase-9gg5wxnh64aaabbc |

### 配置步骤

1. 登录微信开发者工具
2. 点击"云开发"按钮
3. 进入"云函数"管理页面
4. 找到 `mysql_proxy` 云函数
5. 点击"配置"
6. 在"环境变量"中添加以上变量
7. 保存并重新部署云函数

## 获取 CloudBase MySQL 连接信息

1. 登录腾讯云控制台
2. 进入 CloudBase 控制台
3. 找到你的环境 `cloudbase-9gg5wxnh64aaabbc`
4. 点击"数据库" → "MySQL"
5. 在"数据库管理"页面可以查看：
   - 内网地址（推荐，延迟更低）
   - 外网地址
   - 端口号
   - 用户名

## 安全建议

1. **使用内网地址**：如果云函数和 MySQL 在同一地域，使用内网地址可以降低成本并提高性能
2. **设置强密码**：为 MySQL 数据库设置复杂的密码
3. **限制 IP 访问**：在 MySQL 安全组中只允许云函数访问
4. **定期备份**：开启自动备份功能

## 测试连接

部署后可以通过以下方式测试连接：

```javascript
wx.cloud.callFunction({
  name: 'mysql_proxy',
  data: {
    action: 'query',
    sql: 'SELECT 1 as test'
  }
}).then(res => {
  console.log(res)
  // { code: 0, data: [{ test: 1 }] }
})
```

## 故障排查

### 连接超时
- 检查安全组是否放行 3306 端口
- 检查 MySQL 是否允许远程连接
- 确认使用的是正确的内网/外网地址

### 认证失败
- 检查用户名和密码是否正确
- 确认用户有对应数据库的权限

### 字符集问题
- 确保 MySQL 数据库使用 utf8mb4 字符集
- 已在代码中设置 charset: 'utf8mb4'
