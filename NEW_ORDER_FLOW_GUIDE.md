# 订单流程重构说明

## 新流程概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│   pending   │ --> │  accepted   │ --> │        shipped          │ --> │  completed  │
│   (待接单)   │     │   (进行中)   │     │        (已发货)          │     │   (已完成)   │
└─────────────┘     └─────────────┘     └─────────────────────────┘     └─────────────┘
                                                 │                              │
                                                 │  上传照片 + 确认收款            │
                                                 ▼                              ▼
                                          已发货列表                      已完成列表
                                          (待收款/已收款)                 (已收款)
```

## 状态说明

| 状态 | 名称 | 说明 |
|------|------|------|
| `pending` | 待接单 | 等待手艺人接单 |
| `accepted` | 进行中 | 手艺人已接单，可填写运单 |
| `shipped` | 已发货 | 已填写运单，可上传照片和确认收款 |
| `completed` | 已完成 | 已确认收款，订单完成 |
| `closed` | 已撤回 | 订单被撤回（原"已结束"改名） |

## 流程详细步骤

### 1. 手艺人接单
- **操作**: 点击"立即接单"
- **状态变化**: `pending` → `accepted`
- **列表位置**: 进行中

### 2. 填写运单号
- **操作**: 点击"填写运单" → 选择物流公司 → 输入运单号 → 提交
- **状态变化**: `accepted` → `shipped`
- **列表位置**: 已发货

### 3. 完成订单（上传照片）
- **操作**: 点击"完成订单" → 上传货品照片 → 提交
- **状态保持**: `shipped`（已发货）
- **变化**: 添加 `completePhotos` 字段
- **列表位置**: 已发货（显示"待收款"标签）

### 4. 确认收款
- **操作**: 点击"确认收款"
- **状态变化**: `shipped` → `completed`
- **列表位置**: 已完成

## 前端界面变化

### 筛选选项
```
全部 | 进行中 | 已发货 | 已完成 | 已撤回
```

### 已发货列表
- 显示 `shipped` 状态的订单
- 未上传照片：显示"完成订单"按钮
- 已上传照片：显示"确认收款"按钮
- 标签显示："待收款"（橙色）

### 已完成列表
- 显示 `completed` 状态的订单
- 标签显示："已收款"（绿色）

### 已撤回列表（原"已结束"）
- 显示 `closed` 状态的订单
- 标签显示："已撤回"（红色）

## 云函数修改

### 1. completeOrder（完成订单）
```javascript
// 修改前：上传照片后状态变为 completed
status: 'completed'

// 修改后：上传照片后保持 shipped 状态
// 状态保持 shipped，只添加 completePhotos 字段
```

### 2. confirmReceipt（确认收款）
```javascript
// 修改前：检查 completed 状态，完成后变为 closed
if (order.status !== 'completed') return error
status: 'closed'

// 修改后：检查 shipped 状态，完成后变为 completed
if (order.status !== 'shipped') return error
status: 'completed'
```

## 数据库字段

### 订单状态字段
```javascript
{
  status: 'shipped',           // 订单状态
  paymentStatus: 'unpaid',     // 新流程中可忽略，或用做标记
  completePhotos: [...],       // 完成照片数组
  trackingNumber: 'xxx',       // 运单号
  trackingCompany: '顺丰'      // 物流公司
}
```

## 权限检查更新

### 确认收款权限
```javascript
// 修改前：只有 completed 状态可以确认收款
if (order.status !== 'completed') return false

// 修改后：只有 shipped 状态可以确认收款
if (order.status !== 'shipped') return false
```

## 测试清单

- [ ] 手艺人可以正常接单（pending → accepted）
- [ ] 手艺人可以填写运单号（accepted → shipped）
- [ ] 已发货列表显示 shipped 状态的订单
- [ ] 手艺人可以在 shipped 状态上传照片
- [ ] 上传照片后状态保持 shipped
- [ ] 已上传照片的订单显示"确认收款"按钮
- [ ] 点击"确认收款"后状态变为 completed
- [ ] 已完成的订单进入"已完成"列表
- [ ] 已撤回列表显示正常（原"已结束"改名）

## 部署步骤

1. **部署云函数**
   ```bash
   cd cloudfunctions/order
   wxcloud deploy --env <your-env-id>
   ```

2. **测试新流程**
   - 创建测试订单
   - 按新流程逐步验证
   - 检查各状态列表显示

3. **上线前检查**
   - 关闭调试模式（`showDebugInfo: false`）
   - 检查所有状态显示正确
   - 确认按钮逻辑无误
