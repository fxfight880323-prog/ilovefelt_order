# 完整业务流程测试指南

## 测试范围

本测试覆盖以下完整业务流程：

- ✅ 派单员注册、审批、登录
- ✅ 手艺人注册、审批、登录
- ✅ 派单员创建订单
- ✅ 手艺人接单、填写运单号、上传完成照片
- ✅ 手艺人确认收款
- ✅ 派单员给手艺人打分
- ✅ 评分算法（时间分 + 评分 = 履约分）
- ✅ 管理员统计查看
- ✅ 管理员管理人员列表
- ✅ 订单跟踪
- ✅ 数据隔离验证

---

## 评分算法说明

### 履约分计算公式
```
履约分 = 时间分 × 50% + 派单评分 × 50%
```

### 时间分计算（基于是否在约定时间内寄出）
| 情况 | 得分 |
|------|------|
| 提前或准时寄出 | 5.0 |
| 延迟1天内 | 4.5 |
| 延迟2天内 | 4.0 |
| 延迟3天内 | 3.5 |
| 延迟5天内 | 3.0 |
| 延迟7天内 | 2.5 |
| 延迟10天内 | 2.0 |
| 延迟15天内 | 1.5 |
| 延迟超过15天 | 1.0 |

### 履约等级
| 分数范围 | 等级 | 颜色 |
|---------|------|------|
| 4.0 - 6.0 | 优秀 | 绿色 #52c41a |
| 2.0 - 4.0 | 中等 | 黄色 #faad14 |
| 0.4 - 2.0 | 警告 | 橙色 #fa8c16 |
| 0 - 0.4 | 危险 | 红色 #f5222d |

---

## 使用方法

### 方式一：自动测试（推荐）

在微信开发者工具控制台输入：

```javascript
require('./test/test-full-workflow.js')
```

### 方式二：逐步测试

如果自动测试失败，可以按照以下步骤手动测试：

#### 步骤1: 初始化管理员
```javascript
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'initAdmin',
    data: { phone: '13810062394', password: '880323' }
  }
}).then(res => console.log('管理员初始化:', res.result));
```

#### 步骤2-3: 注册并审批派单员和手艺人
```javascript
// 注册派单员
const dispatcherPhone = '139' + Date.now().toString().slice(-8);
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'applyRole',
    data: {
      role: 'dispatcher',
      applyData: { phone: dispatcherPhone, name: '测试派单员', password: '123456', company: '测试公司' }
    }
  }
}).then(res => {
  console.log('注册结果:', res.result);
  wx.setStorageSync('dispatcherPhone', dispatcherPhone);
});

// 管理员审批...
// 手艺人注册和审批同理
```

#### 步骤4: 创建订单
```javascript
wx.cloud.callFunction({
  name: 'order',
  data: {
    action: 'create',
    data: {
      name: '测试订单',
      styleId: 'test_style',
      styleName: '测试样式',
      quantity: 10,
      price: 100,
      receiveDate: '2026-04-15'
    }
  }
}).then(res => {
  console.log('创建结果:', res.result);
  wx.setStorageSync('orderId', res.result.data?._id);
});
```

#### 步骤5-8: 订单流转
```javascript
const orderId = wx.getStorageSync('orderId');

// 接单
wx.cloud.callFunction({
  name: 'order',
  data: { action: 'accept', data: { orderId } }
});

// 填写运单号
wx.cloud.callFunction({
  name: 'order',
  data: {
    action: 'addTracking',
    data: { orderId, trackingNumber: 'SF123456', trackingCompany: '顺丰' }
  }
});

// 上传完成照片
wx.cloud.callFunction({
  name: 'order',
  data: {
    action: 'complete',
    data: { orderId, completePhotos: ['url1', 'url2'] }
  }
});

// 确认收款
wx.cloud.callFunction({
  name: 'order',
  data: { action: 'confirmReceipt', data: { orderId } }
});
```

#### 步骤9: 派单员打分
```javascript
wx.cloud.callFunction({
  name: 'order',
  data: {
    action: 'rateCraftsman',
    data: { orderId, craftsmanId, score: 5, comment: '非常满意' }
  }
}).then(res => {
  console.log('打分结果:', res.result.data);
  // 应该显示综合履约分、时间分、评分
});
```

---

## 预期结果

测试通过后应该看到：

```
✅ 派单员创建订单: 创建成功
✅ 手艺人接单: 接单成功
✅ 手艺人填写运单号: 运单号提交成功
✅ 手艺人上传完成照片: 照片上传成功
✅ 确认收款: 收款确认成功
✅ 派单员打分: 评价成功
✅ 综合履约分: 5.0 (示例)
```

---

## 常见问题

### Q: 订单创建失败
- 检查是否已登录为派单员
- 检查必填字段是否完整

### Q: 接单失败
- 检查是否已登录为手艺人
- 检查订单状态是否为 pending

### Q: 评分失败
- 只有已完成的订单可以评分
- 只有派单员和管理员可以评分

---

## 数据清理

测试完成后，可以在云开发控制台删除测试数据：
- users 表：删除测试手机号的记录
- craftsmen 表：删除测试手艺人
- dispatchers 表：删除测试派单员
- orders 表：删除测试订单
- ratings 表：删除测试评分
