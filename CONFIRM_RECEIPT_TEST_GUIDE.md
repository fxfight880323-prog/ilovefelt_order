# 确认收款功能完整测试指南

## 功能概述

确认收款是订单流程的最后一步，只有手艺人确认收到款项后，订单才会正式结束。

## 订单状态流转流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   pending   │ --> │  accepted   │ --> │   shipped   │ --> │  completed  │ --> │   closed    │
│   (待接单)   │     │   (进行中)   │     │   (已发货)   │     │   (已完成)   │     │   (已结束)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            paymentStatus:
                                                            - unpaid (未付款)
                                                            - pending_receipt (待收款)
                                                            - paid (已收款)
```

## 完整操作流程

### 第一步：手艺人接单
- **操作页面**: 手艺人端 → 接单大厅
- **操作**: 点击"立即接单"
- **状态变化**: `pending` → `accepted`
- **前置条件**: 手艺人已注册并通过审核

### 第二步：填写运单号（关键！必须完成）
- **操作页面**: 手艺人端 → 我的订单 → 订单详情
- **操作**: 点击"填写运单" → 选择物流公司 → 输入运单号 → 提交
- **状态变化**: `accepted` → `shipped`
- **关键限制**: ⚠️ **必须先填写运单号，否则无法进行后续操作**

### 第三步：上传完成照片
- **操作页面**: 手艺人端 → 我的订单 → 订单详情
- **操作**: 点击"完成订单" → 上传成品照片（至少1张）→ 提交
- **状态变化**: `shipped` → `completed`
- **云函数校验**: 
  ```javascript
  // 必须先填写运单号（订单状态为 shipped）才能上传完成照片
  if (order.data.status !== 'shipped') {
    return { code: -1, message: '请先填写运单号并发货后再完成订单' }
  }
  ```

### 第四步：派单人确认付款
- **操作页面**: 派单人端 → 订单管理 → 订单详情
- **操作**: 点击"确认付款"
- **状态变化**: `paymentStatus: unpaid` → `pending_receipt`
- **前提**: 订单状态为 `completed`

### 第五步：手艺人确认收款 ⭐
- **操作页面**: 手艺人端 → 我的订单 或 订单详情
- **操作**: 点击"确认收款"按钮
- **状态变化**: 
  - `paymentStatus: pending_receipt` → `paid`
  - `status: completed` → `closed`
- **云函数校验**:
  ```javascript
  // 检查订单状态
  if (order.data.status !== 'completed') {
    return { code: -1, message: '订单未完成，无法确认收款' }
  }
  // 检查是否已确认付款
  if (order.data.paymentStatus !== 'pending_receipt') {
    return { code: -1, message: '订单尚未确认付款，无法确认收款' }
  }
  // 检查权限（必须是接单人）
  if (order.data.craftsmanId !== craftsmanRes.data[0]._id) {
    return { code: -1, message: '无权确认收款' }
  }
  ```

## 前端界面展示

### 我的订单列表
```html
<!-- 确认收款按钮 -->
<view class="btn btn-success btn-sm" 
      bindtap="confirmReceipt" 
      data-id="{{item._id}}" 
      wx:if="{{item.status === 'completed' && item.paymentStatus === 'pending_receipt'}}"
      style="background: #52c41a; color: white;">
  确认收款
</view>
```

### 订单详情页面
```html
<!-- 手艺人：确认收款 -->
<block wx:if="{{canConfirmReceipt && orderInfo.paymentStatus === 'pending_receipt'}}">
  <view class="btn btn-primary btn-full" bindtap="confirmReceipt">确认收款</view>
  <view style="margin-top: 16rpx; padding: 20rpx; background: var(--surface-container); border-radius: 12rpx;">
    <view style="font-size: 24rpx; color: var(--on-surface-variant);">确认收款后，订单将正式结束</view>
  </view>
</block>
```

## 测试用例

### 测试用例 1: 正常流程
| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 手艺人接单 | 订单状态变为 `accepted` |
| 2 | 填写运单号 | 订单状态变为 `shipped` |
| 3 | 上传完成照片 | 订单状态变为 `completed` |
| 4 | 派单人确认付款 | `paymentStatus` 变为 `pending_receipt` |
| 5 | 手艺人点击"确认收款" | 提示成功，订单状态变为 `closed`，`paymentStatus` 变为 `paid` |

### 测试用例 2: 不填运单号直接完成订单
| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 手艺人接单 | 订单状态变为 `accepted` |
| 2 | 尝试直接上传完成照片 | ❌ 失败，提示"请先填写运单号并发货后再完成订单" |

### 测试用例 3: 未确认付款时尝试收款
| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1-3 | 完成到 `completed` 状态 | - |
| 4 | 手艺人尝试点击"确认收款" | ❌ 按钮不显示或点击后提示"订单尚未确认付款，无法确认收款" |

### 测试用例 4: 非接单人尝试确认收款
| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1-4 | 完成到 `pending_receipt` 状态 | - |
| 5 | 其他手艺人尝试确认收款 | ❌ 云函数返回"无权确认收款" |

## 部署步骤

### 1. 部署云函数
```bash
# 部署 order 云函数（包含 confirmReceipt 和 completeOrder 修复）
cd cloudfunctions/order
wxcloud deploy --env <your-env-id>
```

### 2. 验证数据库
确保 `orders` 集合有以下字段：
- `status`: string (pending/accepted/shipped/completed/closed)
- `paymentStatus`: string (unpaid/pending_receipt/paid)
- `trackingNumber`: string (运单号)
- `craftsmanId`: string (接单人ID)

### 3. 前端测试
1. 打开微信开发者工具
2. 清除缓存（确保获取最新云函数）
3. 按测试用例逐步验证

## 关键代码位置

| 功能 | 文件路径 |
|------|----------|
| 确认收款云函数 | `cloudfunctions/order/index.js` - `confirmReceipt()` |
| 完成订单云函数 | `cloudfunctions/order/index.js` - `completeOrder()` |
| 填写运单云函数 | `cloudfunctions/order/index.js` - `addTrackingNumber()` |
| 确认收款前端 | `pages/craftsman/myOrders.js` - `confirmReceipt()` |
| 确认收款UI | `pages/craftsman/myOrders.wxml` / `orderDetail.wxml` |

## 常见问题

### Q1: 为什么确认收款按钮不显示？
A: 检查以下条件：
1. 订单状态是否为 `completed`
2. `paymentStatus` 是否为 `pending_receipt`
3. 当前用户是否为接单人

### Q2: 手艺人确认收款后有什么变化？
A: 
1. 订单状态变为 `closed`
2. `paymentStatus` 变为 `paid`
3. 记录 `receiptConfirmedAt` 时间
4. 更新手艺人总收入和已收款订单数
5. 发送通知给派单人

### Q3: 如果不填运单号能完成订单吗？
A: ❌ 不能。云函数已添加校验，必须先填写运单号（订单状态为 `shipped`）才能上传完成照片。
