# 测试问题快速修复指南

## 🔴 严重问题

### 1. 订单编码未生成

**现象**：创建订单后数据库中没有 `orderCode` 字段

**检查**：
```javascript
// 在云函数 order/index.js 的 createOrder 中添加日志
console.log('生成订单编码:', orderCode)
console.log('写入数据:', { orderCode, name, ... })
```

**修复**：
```javascript
// 确保 generateOrderCode 在 createOrder 中被调用
const orderCode = await generateOrderCode()
```

### 2. 管理员无法登录控制台

**现象**：使用 13810062394 登录后没有管理员权限

**检查**：
```javascript
// 检查 admin 云函数 checkAdmin
console.log('检查用户:', openid)
console.log('用户数据:', userRes.data)
```

**快速修复**：
```javascript
// 在数据库 users 集合中手动设置
{
  "phone": "13810062394",
  "role": "admin",
  "roles": ["admin"],
  "currentRole": "admin"
}
```

### 3. 审批后用户仍无法使用

**现象**：管理员通过审批，但用户状态仍是 pending

**检查**：
1. 检查 craftsmen/dispatchers 表中的 status 是否变为 active
2. 检查 users 表中的 roles 是否正确更新

**修复**：
```javascript
// 手动更新数据库
db.collection('craftsmen').doc('xxx').update({
  data: { status: 'active' }
})
```

---

## 🟡 中等问题

### 4. 订单状态流转错误

**现象**：上传照片后订单状态变成 completed 而不是 shipped

**原因**：云函数 completeOrder 中错误地修改了 status

**修复**：
```javascript
// cloudfunctions/order/index.js - completeOrder
// 删除或注释掉这行：
// status: 'completed',  ❌ 不要修改状态

// 只更新照片相关字段：
completePhotos: completePhotos || [],
completeDate: completeDate,
```

### 5. 确认收款后订单消失

**现象**：点击确认收款后订单在列表中消失

**原因**：confirmReceipt 中将状态设为 closed 而不是 completed

**修复**：
```javascript
// cloudfunctions/order/index.js - confirmReceipt
// 修改这行：
status: 'completed',  // 原为 'closed'
```

### 6. 列表不显示订单

**现象**：已发货或已完成的订单不在列表中

**检查**：
```javascript
// 检查 myOrders.js 中的筛选条件
console.log('当前筛选状态:', this.data.currentStatus)
console.log('订单实际状态:', item.status)
```

**修复**：
```javascript
// 确保状态匹配
shipped 订单显示在 "已发货" 列表
completed 订单显示在 "已完成" 列表
```

---

## 🟢 轻微问题

### 7. 联系管理员页面空白

**检查**：
1. `app.json` 中是否添加页面
2. 文件路径是否正确

**修复**：
```json
// app.json
{
  "pages": [
    "pages/common/contactAdmin"
  ]
}
```

### 8. 订单编码显示为 undefined

**原因**：旧订单没有 orderCode 字段

**修复**：
```html
<!-- 使用 || 回退到 _id -->
#{{orderInfo.orderCode || orderInfo._id}}
```

### 9. 切换角色按钮不工作

**检查**：
```javascript
// 检查 pages/common/index.js
console.log('可用角色:', availableRoles)
console.log('当前角色:', currentRole)
```

### 10. 确认收款按钮不显示

**检查条件**：
```javascript
// 在 orderDetail.js 中添加调试
console.log('订单状态:', orderInfo.status)  // 应为 'shipped'
console.log('照片数量:', orderInfo.completePhotos?.length)  // 应 > 0
console.log('权限:', canConfirmReceipt)  // 应为 true
```

---

## 🔧 通用 Debug 技巧

### 查看云函数日志
```bash
# 在微信开发者工具中
# 云开发 -> 云函数 -> 日志
```

### 添加前端日志
```javascript
// 在关键位置添加
console.log('=== Debug ===')
console.log('数据:', data)
console.log('状态:', status)
console.log('===========')
```

### 检查数据库数据
```javascript
// 在云开发控制台数据库中检查
// 1. orders 集合 - 检查订单状态和编码
// 2. craftsmen 集合 - 检查手艺人状态
// 3. dispatchers 集合 - 检查派单人状态
// 4. users 集合 - 检查用户角色
```

### 清除缓存
```javascript
// 在微信开发者工具中
// 1. 清除缓存 -> 全部清除
// 2. 重新编译
```

---

## 🚀 快速验证脚本

### 验证订单编码
```javascript
// 在订单详情页控制台执行
console.log('订单编码:', this.data.orderInfo.orderCode)
console.log('格式正确:', /^[A-Z]{2}\d{8}$/.test(this.data.orderInfo.orderCode))
```

### 验证用户角色
```javascript
// 在个人中心控制台执行
console.log('用户角色:', this.data.userInfo.roles)
console.log('是否管理员:', this.data.userInfo.isAdmin)
```

### 验证订单状态
```javascript
// 在订单列表控制台执行
this.data.orderList.forEach(order => {
  console.log(order.orderCode, order.status, order.paymentStatus)
})
```

---

## 📞 紧急联系

如果问题无法解决：
1. 查看云函数详细日志
2. 检查数据库数据完整性
3. 确认所有云函数已部署
4. 尝试重新部署有问题的云函数
