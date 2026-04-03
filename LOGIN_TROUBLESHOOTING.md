# 登录问题排查指南

## 问题描述
测试账号 `13800138001/123456` 或 `13800138002/123456` 无法手动登录。

## 常见原因

### 1. 账号未注册 ❌
账号可能还没有创建。

### 2. 密码不匹配 ❌
密码可能存储为MD5格式，而你输入的是明文。

### 3. 账号未审批 ❌
账号已注册但角色申请状态为 `pending`，需要审批后才能登录。

### 4. 无角色分配 ❌
账号的 `roles` 数组为空或 `currentRole` 未设置。

---

## 快速诊断

在微信开发者工具控制台运行：

```javascript
// 加载诊断工具
const { showAccountDetails } = require('./test/quick-fix.js')

// 查看账号详情
await showAccountDetails()
```

预期输出：
```
============================================================
🔍 账号详情
============================================================

📱 13800138001:
  用户名: 测试派单人A
  密码: 123456
  角色: ["dispatcher"]
  当前角色: dispatcher
  OpenID: 无
  角色申请:
    - dispatcher: active
  ✅ 正常

📱 13800138002:
  用户名: 测试手艺人B
  密码: 123456
  角色: ["craftsman"]
  当前角色: craftsman
  ✅ 正常
```

---

## 快速修复

在微信开发者工具控制台运行：

```javascript
// 加载修复工具
const { quickFixTestAccounts } = require('./test/quick-fix.js')

// 一键修复所有测试账号
await quickFixTestAccounts()
```

这个脚本会：
1. ✅ 创建/更新用户记录
2. ✅ 设置密码为 `123456`（明文，登录时同时支持明文和MD5）
3. ✅ 设置角色为 `active` 状态
4. ✅ 创建/更新角色集合记录（dispatchers/craftsmen）

---

## 手动修复方法

### 步骤1: 检查数据库

打开「云开发」→「数据库」→「users」集合，检查：

```javascript
// 查询测试账号
db.collection('users').where({
  phone: '13800138001'
}).get()
```

检查字段：
- `password`: 应该是 `123456` 或 MD5值
- `roles`: 应该包含 `["dispatcher"]`
- `currentRole`: 应该是 `"dispatcher"`
- `roleApplications`: 应该有 `status: "active"`

### 步骤2: 修复密码

如果密码不正确，更新为明文：

```javascript
db.collection('users').doc('用户ID').update({
  data: {
    password: '123456',
    updateTime: new Date()
  }
})
```

### 步骤3: 修复角色状态

如果角色未审批：

```javascript
db.collection('users').doc('用户ID').update({
  data: {
    roles: ['dispatcher'],
    currentRole: 'dispatcher',
    'roleApplications.0.status': 'active',
    updateTime: new Date()
  }
})
```

### 步骤4: 检查角色集合

检查 `dispatchers` 或 `craftsmen` 集合：

```javascript
db.collection('dispatchers').where({
  phone: '13800138001'
}).get()
```

如果不存在，创建记录：

```javascript
db.collection('dispatchers').add({
  data: {
    phone: '13800138001',
    name: '测试派单人A',
    status: 'active',
    createTime: new Date(),
    updateTime: new Date()
  }
})
```

---

## 验证登录

修复后，在登录页面输入：

| 账号 | 手机号 | 密码 |
|------|--------|------|
| 派单人 | 13800138001 | 123456 |
| 手艺人 | 13800138002 | 123456 |

如果仍有问题，请检查控制台日志，查看具体错误信息。

---

## 云函数日志

如果登录失败，查看云函数日志：

1. 打开「云开发」→「云函数」
2. 找到 `api` 函数
3. 点击「日志」
4. 查找最近的 `loginByPhone` 调用

常见错误码：
- `-1001`: 缺少手机号或密码
- `-1003`: 账号不存在或密码错误
- `-1004`: 账号未审批

---

## 一键测试

运行完整测试自动修复并验证：

```javascript
const test = require('./test/test-dispatcher-craftsman.js')
await TestDispatcherCraftsman.run()
```

这个测试会自动：
1. 注册账号（如果不存在）
2. 审批账号
3. 测试登录
4. 测试完整业务流程
