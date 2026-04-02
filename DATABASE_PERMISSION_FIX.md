# 数据库权限配置修复指南

## 问题原因

错误信息 `Cannot read properties of undefined (reading 'role')` 表示权限规则中使用了 `auth.role`，但小程序端直接访问数据库时 `auth` 对象可能为 `null`。

## 解决方案

### 方法1：使用云函数（推荐）

**最佳实践：所有数据库操作都通过云函数进行**

这样可以避免权限问题，因为云函数有管理员权限。你的代码应该这样修改：

```javascript
// ❌ 错误：小程序端直接访问数据库
wx.cloud.database().collection('users').get()

// ✅ 正确：通过云函数访问
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'getUserInfo' }
})
```

### 方法2：修改数据库权限规则

如果必须在小程序端直接访问数据库，需要设置正确的权限规则：

#### 步骤1：打开云开发控制台

1. 打开微信开发者工具
2. 点击 "云开发" 按钮
3. 进入 "数据库"
4. 选择对应集合
5. 点击 "权限设置"

#### 步骤2：设置权限规则

**测试环境（推荐）**

将所有集合设置为 **"所有用户可读可写"**：

```json
{
  "read": true,
  "write": true
}
```

涉及的集合：
- `users`
- `craftsmen`
- `dispatchers`
- `orders`
- `styles`
- `verifyCodes`
- `adminNotifications`

**生产环境（更安全）**

使用自定义安全规则：

```json
{
  "read": "doc.openid == auth.openid || doc._openid == auth.openid",
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```

或使用：

```json
{
  "read": true,
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```

#### 步骤3：避免使用 auth.role

**❌ 错误的权限规则（会导致报错）：**

```json
{
  "read": "auth.role == 'admin'",
  "write": "auth.role == 'admin'"
}
```

**✅ 正确的权限规则：**

```json
{
  "read": true,
  "write": "doc.openid == auth.openid"
}
```

## 完整权限配置

### 各集合推荐权限

#### 1. users 集合

**测试环境：**
```json
{
  "read": true,
  "write": true
}
```

**生产环境：**
```json
{
  "read": "doc.openid == auth.openid || doc._openid == auth.openid",
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```

#### 2. craftsmen 集合

**测试环境：**
```json
{
  "read": true,
  "write": true
}
```

**生产环境：**
```json
{
  "read": true,
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```

#### 3. dispatchers 集合

**测试环境：**
```json
{
  "read": true,
  "write": true
}
```

**生产环境：**
```json
{
  "read": true,
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```

#### 4. orders 集合

**测试环境：**
```json
{
  "read": true,
  "write": true
}
```

**生产环境：**
```json
{
  "read": "doc.openid == auth.openid || doc._openid == auth.openid || doc.dispatcherId == auth.openid || doc.craftsmanId == auth.openid",
  "write": "doc.openid == auth.openid || doc._openid == auth.openid || doc.dispatcherId == auth.openid || doc.craftsmanId == auth.openid"
}
```

## 代码修改建议

### 方案A：统一使用云函数（最安全）

修改所有小程序端直接调用数据库的地方，改为调用云函数：

```javascript
// utils/db.js
const db = wx.cloud.database()

// ❌ 删除这些直接访问
// export const getUser = (id) => db.collection('users').doc(id).get()

// ✅ 改为云函数调用
export const getUser = () => {
  return wx.cloud.callFunction({
    name: 'user',
    data: { action: 'getUserInfo' }
  }).then(res => res.result)
}

export const getOrders = () => {
  return wx.cloud.callFunction({
    name: 'order',
    data: { action: 'getList' }
  }).then(res => res.result)
}
```

### 方案B：检查并修改现有代码

检查以下文件是否有直接数据库访问：

```bash
# 搜索直接数据库访问
grep -r "db.collection" pages/
grep -r "wx.cloud.database" pages/
```

需要修改的典型代码：

```javascript
// pages/craftsman/orderList.js
// ❌ 删除
async getOrderList() {
  const res = await db.collection('orders').where({ status: 'pending' }).get()
}

// ✅ 改为
async getOrderList() {
  const res = await wx.cloud.callFunction({
    name: 'order',
    data: { action: 'getPendingList' }
  })
}
```

## 快速修复步骤

### 步骤1：立即修复权限（1分钟）

在云开发控制台，将所有集合设置为 **"所有用户可读可写"**：

1. 打开云开发控制台
2. 点击 "数据库"
3. 对每个集合：
   - 点击集合名称
   - 点击 "权限设置"
   - 选择 "自定义安全规则"
   - 输入：`{ "read": true, "write": true }`
   - 点击 "确定"

### 步骤2：验证修复

在控制台运行测试：

```javascript
// 测试读取
wx.cloud.database().collection('users').get().then(res => {
  console.log('✅ 读取成功', res.data)
}).catch(err => {
  console.error('❌ 读取失败', err)
})

// 测试写入
wx.cloud.database().collection('users').add({
  data: { test: true, createTime: new Date() }
}).then(res => {
  console.log('✅ 写入成功', res._id)
}).catch(err => {
  console.error('❌ 写入失败', err)
})
```

### 步骤3：优化为云函数调用（推荐）

逐步将小程序端的数据库调用改为云函数调用，提高安全性。

## 常见问题

### Q1: 设置了权限还是报错？

**检查点：**
1. 是否设置了正确的集合？
2. 是否点击了 "确定" 保存？
3. 是否等待了1-2分钟让权限生效？

### Q2: 如何判断是客户端还是云函数访问？

**客户端访问特征：**
- 代码中有 `wx.cloud.database()`
- 代码中有 `db.collection('xxx')`

**云函数访问特征：**
- 代码中有 `wx.cloud.callFunction({ name: 'xxx' })`
- 云函数内部使用 `cloud.database()`

### Q3: 生产环境如何设置更安全？

**建议架构：**
1. 所有敏感操作通过云函数
2. 数据库权限设置为最严格
3. 云函数内部进行权限校验

示例云函数权限校验：

```javascript
// cloudfunctions/order/index.js
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  // 检查用户角色
  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '未登录' }
  }
  
  const user = userRes.data[0]
  const roles = user.roles || []
  
  // 根据角色判断权限
  if (!roles.includes('admin') && !roles.includes('dispatcher')) {
    return { code: -1, message: '无权限' }
  }
  
  // 执行业务逻辑
  // ...
}
```

## 总结

| 方案 | 安全性 | 复杂度 | 适用场景 |
|------|--------|--------|----------|
| 所有用户可读可写 | 低 | 简单 | 测试环境 |
| 仅创建者可读写 | 中 | 中等 | 简单应用 |
| 云函数统一访问 | 高 | 复杂 | 生产环境 |

**推荐：** 测试阶段使用 "所有用户可读可写"，生产阶段使用云函数统一访问。
