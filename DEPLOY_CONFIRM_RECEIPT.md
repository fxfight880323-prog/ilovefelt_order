# 确认收款功能 - 部署和测试步骤

## 📋 前置检查

确认以下代码已正确更新：

### 1. 云函数 `cloudfunctions/order/index.js`

#### ✅ 完成订单校验（已修复）
```javascript
// 第 687-689 行 - 必须先填写运单号才能完成订单
if (order.data.status !== 'shipped') {
  return { code: -1, message: '请先填写运单号并发货后再完成订单' }
}
```

#### ✅ 确认收款接口（已存在）
```javascript
// 第 870-930 行 - confirmReceipt 函数
case 'confirmReceipt':
  return await confirmReceipt(params, OPENID)
```

### 2. 前端 `pages/craftsman/myOrders.js`

#### ✅ 确认收款函数（已添加）
```javascript
// 确认收款
async confirmReceipt(e) {
  const id = e.currentTarget.dataset.id
  const confirmed = await util.showConfirm('确认收款', '确定已收到款项吗？确认后订单将正式结束。')
  if (!confirmed) return

  util.showLoading('确认中...')
  try {
    const res = await wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'confirmReceipt',
        orderId: id
      }
    })

    util.hideLoading()
    if (res.result.code === 0) {
      util.showToast('确认收款成功', 'success')
      this.refreshList()
    } else {
      util.showToast(res.result.message || '确认收款失败')
    }
  } catch (err) {
    util.hideLoading()
    console.error('确认收款失败:', err)
    util.showToast('确认收款失败')
  }
},
```

### 3. 前端 `pages/craftsman/myOrders.wxml`

#### ✅ 确认收款按钮（已绑定）
```html
<view class="btn btn-success btn-sm" 
      bindtap="confirmReceipt" 
      data-id="{{item._id}}" 
      wx:if="{{item.status === 'completed' && item.paymentStatus === 'pending_receipt'}}"
      style="background: #52c41a; color: white;">
  确认收款
</view>
```

---

## 🚀 部署步骤

### 步骤 1: 部署 order 云函数

在微信开发者工具中：

1. 找到 `cloudfunctions/order` 文件夹
2. 右键点击 → "创建并部署：云端安装依赖"
3. 等待部署完成（约 30-60 秒）

或者使用命令行：
```bash
# 进入项目目录
cd 微信小程序派单

# 部署 order 云函数
wxcloud deploy --env <你的环境ID> --functions order
```

### 步骤 2: 验证部署

打开"云开发" → "云函数" → 确认 `order` 函数更新时间已刷新

---

## 🧪 完整测试流程

### 测试环境准备

1. 准备两个微信账号：
   - **账号 A**: 派单人/管理员
   - **账号 B**: 手艺人（已通过审核）

2. 创建测试订单（用账号 A）

---

### 测试步骤

#### 阶段 1: 手艺人接单

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 1.1 | 进入"接单大厅" | B | 看到测试订单 |
| 1.2 | 点击"立即接单" | B | 提示"接单成功" |
| 1.3 | 查看订单状态 | B | 状态变为"进行中" (`accepted`) |

#### 阶段 2: 尝试跳过运单号直接完成（应该失败）⚠️

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 2.1 | 进入订单详情 | B | - |
| 2.2 | 尝试找到"完成订单"按钮 | B | ❌ 找不到按钮（因为状态是 accepted） |
| 2.3 | 或者尝试直接调用云函数 | B | ❌ 返回错误"请先填写运单号并发货后再完成订单" |

#### 阶段 3: 填写运单号

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 3.1 | 点击"填写运单" | B | 弹出运单输入框 |
| 3.2 | 选择物流公司，输入运单号 | B | - |
| 3.3 | 点击"提交" | B | 提示"运单号提交成功" |
| 3.4 | 查看订单状态 | B | 状态变为"已发货" (`shipped`) |

#### 阶段 4: 上传完成照片

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 4.1 | 点击"完成订单"按钮 | B | 显示照片上传区域 |
| 4.2 | 上传 1-3 张成品照片 | B | 照片显示在页面上 |
| 4.3 | 点击"提交完成" | B | 提示"订单已完成" |
| 4.4 | 查看订单状态 | B | 状态变为"已完成" (`completed`) |

#### 阶段 5: 派单人确认付款

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 5.1 | 进入订单管理 | A | 看到订单状态为"已完成" |
| 5.2 | 进入订单详情 | A | 看到"确认付款"按钮 |
| 5.3 | 点击"确认付款" | A | 提示"付款确认成功" |
| 5.4 | 查看付款状态 | A | 显示"待收款" (`pending_receipt`) |

#### 阶段 6: 手艺人确认收款 ⭐

| # | 操作 | 账号 | 预期结果 |
|---|------|------|----------|
| 6.1 | 进入"我的订单" | B | 订单显示"待收款"状态 |
| 6.2 | **看到"确认收款"按钮** | B | ✅ 按钮显示为绿色 |
| 6.3 | **点击"确认收款"** | B | 弹出确认对话框 |
| 6.4 | **确认收款** | B | 提示"确认收款成功" |
| 6.5 | **查看订单状态** | B | 状态变为"已结束" (`closed`) |
| 6.6 | **查看付款状态** | B | 显示"已收款" (`paid`) |

---

## ✅ 验证清单

部署和测试完成后，请检查以下项目：

### 云函数
- [ ] `cloudfunctions/order/index.js` 已更新
- [ ] 云函数已部署到云端
- [ ] 部署无错误提示

### 前端功能
- [ ] `pages/craftsman/myOrders.js` 有 `confirmReceipt` 函数
- [ ] `pages/craftsman/myOrders.wxml` 按钮绑定 `confirmReceipt`
- [ ] 未填运单号时无法完成订单
- [ ] 已填运单号后可以正常完成订单

### 完整流程
- [ ] 手艺人可以接单
- [ ] 手艺人可以填写运单号
- [ ] 手艺人可以上传完成照片
- [ ] 派单人可以确认付款
- [ ] 手艺人可以看到"确认收款"按钮
- [ ] 手艺人点击后可以成功确认收款
- [ ] 订单状态正确变化为 `closed`
- [ ] 付款状态正确变化为 `paid`

---

## 🔧 故障排查

### 问题 1: "确认收款"按钮不显示
**检查点**:
1. 订单状态是否为 `completed`
2. `paymentStatus` 是否为 `pending_receipt`
3. 当前用户是否是接单人

**调试方法**:
在 `orderDetail.js` 的 `onLoad` 中添加：
```javascript
console.log('订单状态:', this.data.orderInfo.status)
console.log('付款状态:', this.data.orderInfo.paymentStatus)
console.log('手艺人ID:', this.data.craftsmanInfo._id)
console.log('订单手艺人ID:', this.data.orderInfo.craftsmanId)
```

### 问题 2: 点击"确认收款"报错
**可能原因**:
1. 云函数未部署 - 重新部署 `order` 云函数
2. 权限不足 - 检查当前用户是否是接单人
3. 状态不符合 - 检查订单状态是否为 `completed` 且 `paymentStatus` 为 `pending_receipt`

### 问题 3: 可以不填运单号直接完成订单
**解决方案**:
确保云函数 `completeOrder` 中有以下校验：
```javascript
if (order.data.status !== 'shipped') {
  return { code: -1, message: '请先填写运单号并发货后再完成订单' }
}
```
然后重新部署云函数。

---

## 📞 联系支持

如果测试过程中遇到问题，请提供：
1. 当前订单状态（数据库截图）
2. 云函数返回的错误信息
3. 微信开发者工具的控制台日志
