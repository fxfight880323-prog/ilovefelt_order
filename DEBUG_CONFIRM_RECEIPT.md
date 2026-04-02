# 确认收款按钮不显示 - 完整 Debug 指南

## 🔍 问题现象
手艺人进入已完成的订单详情页，但没有看到"确认收款"按钮。

## ✅ 按钮显示条件（必须同时满足）

### 1. 订单状态检查
```javascript
order.status === 'completed'  // 订单状态必须是"已完成"
order.paymentStatus === 'pending_receipt'  // 付款状态必须是"待收款"
```

### 2. 权限检查
```javascript
canConfirmReceipt === true  // 必须是接单人
```

## 🔧 Debug 步骤

### 步骤 1: 检查数据库中的订单状态

打开微信开发者工具 → 云开发 → 数据库 → `orders` 集合 → 找到对应的订单，检查以下字段：

```json
{
  "status": "completed",        // 必须是 "completed"
  "paymentStatus": "pending_receipt",  // 必须是 "pending_receipt"
  "craftsmanId": "xxx",         // 记录这个ID
  "craftsmanName": "手艺人姓名"
}
```

**如果 status 不是 `completed`：**
- 需要手艺人先上传完成照片

**如果 paymentStatus 不是 `pending_receipt`：**
- 如果是 `unpaid`：需要派单人先点击"确认付款"
- 如果是 `paid`：订单已结束，无需确认收款

---

### 步骤 2: 检查控制台日志

打开微信开发者工具控制台，查看以下日志输出：

#### 日志 1: 权限检查
```javascript
权限检查: {
  craftsmanInfo: "xxx",        // 当前登录手艺人的ID
  orderCraftsmanId: "xxx",     // 订单记录的接单人ID
  orderStatus: "completed"
}
```

**对比：** `craftsmanInfo` 必须等于 `orderCraftsmanId`

#### 日志 2: 确认收款权限检查
```javascript
确认收款权限检查: {
  orderStatus: "completed",
  paymentStatus: "pending_receipt",
  craftsmanInfoId: "xxx",           // 当前用户ID
  orderCraftsmanId: "xxx",          // 订单接单人ID
  isMatch: true                     // 必须是 true
}
```

**关键点：**
- `orderStatus` 必须是 `"completed"`
- `paymentStatus` 必须是 `"pending_receipt"`
- `isMatch` 必须是 `true`

#### 日志 3: 权限判断结果
```javascript
权限判断结果: {
  canConfirmPayment: false,
  canConfirmReceipt: true,          // 必须是 true
  orderStatus: "completed",
  paymentStatus: "pending_receipt",
  craftsmanInfo: { id: "xxx", name: "xxx" }
}
```

---

### 步骤 3: 常见问题和解决方案

#### ❌ 问题 1: `paymentStatus` 为 `undefined` 或 `"unpaid"`

**现象：**
```javascript
paymentStatus: undefined  // 或 "unpaid"
```

**原因：**
- 旧订单没有 `paymentStatus` 字段（默认为 `undefined`，被视为未付款）
- 派单人尚未确认付款

**解决：**
1. 如果是旧订单，需要派单人点击"确认付款"按钮
2. 如果是新订单，按照正常流程：派单人确认付款 → 手艺人确认收款

---

#### ❌ 问题 2: `craftsmanInfo` 为 `null`

**现象：**
```javascript
craftsmanInfo: null
craftsmanInfoId: null
```

**原因：**
手艺人信息未正确加载

**解决：**
检查 `loadCraftsmanInfo` 函数的调用和返回结果：

1. 确保 `onLoad` 中正确调用了 `loadCraftsmanInfo()`
2. 检查云函数 `craftsman.checkUserRole` 是否返回正确结果
3. 在控制台搜索 `"获取手艺人信息失败"` 查看错误信息

---

#### ❌ 问题 3: `isMatch` 为 `false`（ID 不匹配）

**现象：**
```javascript
craftsmanInfoId: "abc123"
orderCraftsmanId: "xyz789"
isMatch: false
```

**原因：**
当前登录的手艺人不是该订单的接单人

**解决：**
1. 确认当前登录的微信账号是接单的那个手艺人
2. 检查数据库中订单的 `craftsmanId` 是否正确
3. 检查手艺人集合中的 `_id` 是否与订单记录一致

---

#### ❌ 问题 4: 订单状态为 `shipped` 而不是 `completed`

**现象：**
```javascript
orderStatus: "shipped"
```

**原因：**
手艺人只填写了运单号，还没有上传完成照片

**解决：**
1. 手艺人进入订单详情
2. 点击"完成订单"按钮
3. 上传成品照片
4. 点击"提交完成"
5. 状态变为 `completed` 后才能确认收款

---

### 步骤 4: 验证订单状态流转

正确的流转顺序：

```
pending (待接单)
  ↓ 手艺人点击"立即接单"
accepted (进行中)
  ↓ 手艺人点击"填写运单"并提交
shipped (已发货)
  ↓ 手艺人点击"完成订单"并上传照片
completed (已完成) + paymentStatus: "unpaid"
  ↓ 派单人点击"确认付款"
completed (已完成) + paymentStatus: "pending_receipt"
  ↓ 手艺人点击"确认收款"  ← 【你现在应该在这里】
closed (已结束) + paymentStatus: "paid"
```

**你必须到达这个状态才能看到按钮：**
- `status`: `"completed"`
- `paymentStatus`: `"pending_receipt"`

---

### 步骤 5: 手动修复测试

如果你确定数据正确但按钮仍然不显示，可以尝试手动修复：

#### 方法 1: 强制更新订单状态（仅用于测试）

在云开发控制台 → 数据库 → `orders` 集合 → 找到订单 → 编辑：

```json
{
  "status": "completed",
  "paymentStatus": "pending_receipt"
}
```

然后重新进入订单详情页查看按钮是否显示。

#### 方法 2: 添加临时调试按钮

在 `orderDetail.wxml` 中，付款状态卡片后面添加临时调试信息：

```xml
<!-- 临时调试信息 -->
<view style="padding: 20rpx; background: #ffeb3b; margin: 20rpx;">
  <text>调试信息：\n</text>
  <text>status: {{orderInfo.status}}\n</text>
  <text>paymentStatus: {{orderInfo.paymentStatus}}\n</text>
  <text>canConfirmReceipt: {{canConfirmReceipt}}</text>
</view>
```

这样可以直观看到当前的状态值。

---

## 🧪 完整的测试流程验证

按照以下步骤创建一个新订单并验证整个流程：

### 准备
1. 账号 A：派单人/管理员
2. 账号 B：手艺人（已通过审核）

### 测试步骤

| # | 操作者 | 操作 | 检查数据库字段 |
|---|-------|------|--------------|
| 1 | A | 创建订单 | `status`: `"pending"` |
| 2 | B | 接单 | `status`: `"accepted"`, `craftsmanId`: B的ID |
| 3 | B | 填写运单号 | `status`: `"shipped"`, `trackingNumber`: 有值 |
| 4 | B | 上传完成照片 | `status`: `"completed"`, `paymentStatus`: `"unpaid"` 或 `undefined` |
| 5 | A | 确认付款 | `paymentStatus`: `"pending_receipt"` |
| 6 | B | 查看订单 | **此时应该看到"确认收款"按钮** |
| 7 | B | 点击确认收款 | `status`: `"closed"`, `paymentStatus`: `"paid"` |

如果在第 6 步看不到按钮，立即查看控制台日志，对照上面的 Debug 步骤排查。

---

## 📞 仍有问题？

如果以上步骤都无法解决问题，请提供以下信息：

1. **数据库截图**：订单的完整字段（特别是 `status`, `paymentStatus`, `craftsmanId`）
2. **控制台日志**：完整的权限检查日志输出
3. **当前登录用户**：手艺人的 `_id` 和 `openid`
4. **页面路径**：从哪个页面进入的订单详情（我的订单列表？直接扫码？）

有了这些信息可以快速定位问题根源。
