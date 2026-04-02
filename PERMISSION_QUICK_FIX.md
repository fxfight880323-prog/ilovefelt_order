# 数据库权限问题快速修复指南

## 问题说明

错误 `Cannot read properties of undefined (reading 'role')` 表示数据库权限规则配置不正确。

## 已完成的代码修复

我已经修复了以下问题：

### 1. 修复了 `pages/craftsman/orderDetail.js`
- 原来测试代码直接访问数据库：`db.collection('orders').doc().update()`
- 现在改为调用云函数，避免权限问题

### 2. 更新了 `cloudfunctions/order/index.js`
- 添加了 `testConfirmPayment` 和 `testConfirmReceipt` 测试接口

## 快速解决方案（2分钟）

### 方案A：修改数据库权限（推荐测试环境使用）

1. **打开云开发控制台**
   - 在微信开发者工具中点击 "云开发" 按钮
   - 进入 "数据库"

2. **设置权限规则**
   
   对每个集合（users、craftsmen、dispatchers、orders），执行：
   - 点击集合名称
   - 点击 "权限设置"
   - 选择 "自定义安全规则"
   - 粘贴以下规则：

```json
{
  "read": true,
  "write": true
}
```

3. **点击 "确定" 保存**

4. **等待1-2分钟**让权限生效

### 方案B：重新部署云函数

1. 在微信开发者工具中：
   - 右键 `cloudfunctions/order` → "创建并部署：云端安装依赖"

2. 等待部署完成

## 验证修复

在开发者工具控制台运行：

```javascript
// 测试读取
wx.cloud.database().collection('users').get()
  .then(res => console.log('✅ 读取成功', res.data.length, '条记录'))
  .catch(err => console.error('❌ 读取失败', err))

// 测试云函数调用
wx.cloud.callFunction({ name: 'order', data: { action: 'getPendingList' }})
  .then(res => console.log('✅ 云函数调用成功', res.result))
  .catch(err => console.error('❌ 云函数调用失败', err))
```

## 权限规则说明

### 测试环境（宽松）
```json
{
  "read": true,
  "write": true
}
```
- 所有用户可读可写
- 适合开发和测试

### 生产环境（严格）
```json
{
  "read": "doc.openid == auth.openid || doc._openid == auth.openid",
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```
- 只允许创建者读写自己的数据
- 更安全，适合生产环境

### 混合模式（推荐）
```json
{
  "read": true,
  "write": "doc.openid == auth.openid || doc._openid == auth.openid"
}
```
- 所有人可读
- 只有创建者可写
- 适合大多数场景

## 各集合权限设置建议

| 集合 | 测试环境 | 生产环境 |
|------|----------|----------|
| users | 全部可读写 | 仅自己可读写 |
| craftsmen | 全部可读写 | 全部可读，仅管理员可写 |
| dispatchers | 全部可读写 | 全部可读，仅管理员可写 |
| orders | 全部可读写 | 全部可读，相关角色可写 |
| styles | 全部可读写 | 全部可读，仅管理员可写 |

## 常见问题

### Q1: 修改权限后还是报错？
- 检查是否保存成功
- 等待1-2分钟让权限生效
- 清除开发者工具缓存
- 重新编译项目

### Q2: 如何查看当前权限设置？
- 在云开发控制台 → 数据库 → 选择集合 → 权限设置

### Q3: 安全性考虑
- 测试阶段使用宽松权限
- 上线前改为严格权限
- 敏感操作通过云函数进行

## 下一步

1. 设置数据库权限
2. 重新部署 order 云函数
3. 重新编译小程序
4. 运行测试验证

如果还有问题，请告诉我具体的错误信息。
