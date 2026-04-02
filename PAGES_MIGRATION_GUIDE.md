# 页面代码迁移指南

## 概述

我已经为你创建了使用新API封装的页面代码。这些新文件与原文件相比更简洁，错误处理更统一。

## 新文件列表

| 原文件 | 新文件 | 说明 |
|--------|--------|------|
| `pages/login/index.js` | `pages/login/index_new.js` | 登录页 |
| `pages/craftsman/orderList.js` | `pages/craftsman/orderList_new.js` | 手艺人订单列表 |
| `pages/dispatcher/myOrders.js` | `pages/dispatcher/myOrders_new.js` | 派单人订单列表 |
| `pages/admin/console.js` | `pages/admin/console_new.js` | 管理员控制台 |
| `pages/auth/craftsmanRegister.js` | `pages/auth/craftsmanRegister_new.js` | 手艺人注册 |

## 迁移步骤

### 步骤1：备份原文件

```bash
# 复制原文件作为备份
copy pages\login\index.js pages\login\index_backup.js
copy pages\craftsman\orderList.js pages\craftsman\orderList_backup.js
copy pages\dispatcher\myOrders.js pages\dispatcher\myOrders_backup.js
copy pages\admin\console.js pages\admin\console_backup.js
copy pages\auth\craftsmanRegister.js pages\auth\craftsmanRegister_backup.js
```

### 步骤2：替换为新文件

```bash
# 用新文件替换原文件
copy pages\login\index_new.js pages\login\index.js
copy pages\craftsman\orderList_new.js pages\craftsman\orderList.js
copy pages\dispatcher\myOrders_new.js pages\dispatcher\myOrders.js
copy pages\admin\console_new.js pages\admin\console.js
copy pages\auth\craftsmanRegister_new.js pages\auth\craftsmanRegister.js
```

### 步骤3：确保API文件存在

确认 `utils/api.js` 已复制到项目中。

### 步骤4：重新编译

在微信开发者工具中点击 "编译" 按钮。

---

## 代码对比

### 登录页对比

#### 原代码（约460行）
```javascript
// 直接调用云函数
const res = await wx.cloud.callFunction({
  name: 'user',
  data: { action: 'getUserInfo' }
})

if (res.result.code === 0) {
  // 处理成功
} else if (res.result.code === -1) {
  // 处理错误
}
```

#### 新代码（约270行）
```javascript
const API = require('../../utils/api.js')

// 使用封装API
const res = await API.auth.checkStatus()
// 自动处理错误，统一返回格式
```

### 订单列表对比

#### 原代码
```javascript
const res = await wx.cloud.callFunction({
  name: 'order',
  data: {
    action: 'getPendingList',
    page: this.data.page,
    pageSize: this.data.pageSize
  }
})

if (res.result.code === 0) {
  const list = res.result.data.list
  // 处理数据
} else {
  util.showToast('获取订单列表失败')
}
```

#### 新代码
```javascript
const API = require('../../utils/api.js')

try {
  const res = await API.order.list()
  const list = res.data
  // 处理数据
} catch (err) {
  util.showToast(err.message || '获取订单列表失败')
}
```

---

## 主要改进

### 1. 代码更简洁
- 减少约40%的代码量
- 去除重复的`wx.cloud.callFunction`调用
- 统一错误处理

### 2. 错误处理统一
```javascript
// 原代码需要多处判断
if (res.result.code === 0) {
  // 成功
} else if (res.result.code === -1001) {
  // 未注册
} else if (res.result.code === -1002) {
  // 审核中
} else {
  // 其他错误
}

// 新代码使用try-catch统一处理
try {
  const res = await API.xxx.xxx()
  // 处理成功
} catch (err) {
  // 统一处理错误
  wx.showToast({ title: err.message, icon: 'none' })
}
```

### 3. 类型提示（如果使用TypeScript）
```typescript
// 有明确的返回类型
const res: ApiResponse<Order[]> = await API.order.list()
```

### 4. 易于维护
- 修改API调用只需修改一处
- 统一的日志记录
- 统一的错误提示

---

## 可能需要手动调整的地方

### 1. 管理员编辑功能
新代码中管理员编辑功能暂时保留了原有的云函数调用，因为需要先在`api`云函数中添加对应接口。

### 2. 短信验证码
短信验证码发送保留了原有的`sms`云函数调用，这部分不需要修改。

### 3. 特殊接口
如果页面使用了新API中未包含的接口，需要：
1. 先在`cloudfunctions/api/index.js`中添加对应接口
2. 在`utils/api.js`中添加封装方法
3. 然后在页面中使用

---

## 测试检查清单

- [ ] 登录页能正常检查状态并跳转
- [ ] 手机号登录成功
- [ ] 注册页面能提交申请
- [ ] 手艺人能看到待接单列表
- [ ] 手艺人能成功接单
- [ ] 派单人能创建订单
- [ ] 派单人能看到自己的订单
- [ ] 管理员能看到待审批列表
- [ ] 管理员能审批通过/拒绝
- [ ] 错误提示正常显示

---

## 回滚方案

如果新代码有问题，可以快速回滚：

```bash
# 恢复备份文件
copy pages\login\index_backup.js pages\login\index.js
copy pages\craftsman\orderList_backup.js pages\craftsman\orderList.js
# ... 其他文件
```

---

## 下一步建议

1. 先在一两个页面测试新代码
2. 确认无误后再替换所有页面
3. 逐步将其他页面也迁移到新API
4. 后续开发统一使用新API封装
