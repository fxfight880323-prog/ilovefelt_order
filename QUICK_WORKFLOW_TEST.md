# 快速业务流程测试

## 一键执行（复制粘贴）

在微信开发者工具控制台依次执行：

### 第1步：加载测试脚本
```javascript
// 复制 test/full-workflow-test.js 的全部内容粘贴到控制台
```

### 第2步：运行完整测试
```javascript
await FullWorkflowTest.run()
```

---

## 分步测试（逐步验证）

### 1. 测试注册
```javascript
await FullWorkflowTest.phase1Register()
```

### 2. 测试审批
```javascript
await FullWorkflowTest.phase2Approve()
```

### 3. 测试创建订单
```javascript
await FullWorkflowTest.phase3CreateOrder()
```

### 4. 测试接单
```javascript
await FullWorkflowTest.phase4AcceptOrder()
```

### 5. 测试取消订单
```javascript
await FullWorkflowTest.phase5CancelOrder()
```

### 6. 测试完成流程
```javascript
await FullWorkflowTest.phase6CompleteFlow()
```

### 7. 测试查询统计
```javascript
await FullWorkflowTest.phase7QueryAndStats()
```

---

## 测试数据

| 角色 | 手机号 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | 13810062394 | 880323 | 审批所有角色 |
| 派单人 | 13800138001 | 123456 | 创建订单 |
| 手艺人 | 13800138002 | 123456 | 接单完成 |

---

## 执行前检查清单

- [ ] 云函数 `api` 已部署
- [ ] 数据库集合已创建 (users, craftsmen, dispatchers, orders)
- [ ] 超级管理员 13810062394/880323 已创建
- [ ] 数据库权限已设置为可读写

---

## 预期结果

✅ 测试通过后会输出：
- 派单人和手艺人注册成功
- 超级管理员审批通过
- 订单创建、接单、取消、完成流程正常
- 快递单号 SF1234567890 已上传
- 派单人和手艺人能正常查询订单
- 统计数据正确

---

## 清理测试数据

测试完成后执行：
```javascript
const db = wx.cloud.database()

// 删除测试订单
db.collection('orders').where({
  name: db.RegExp({ regexp: '测试|正式' })
}).remove()

// 删除测试用户
db.collection('users').where({
  phone: db.command.in(['13800138001', '13800138002'])
}).remove()

console.log('清理完成')
```
