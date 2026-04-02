# 统一API云函数使用指南

## 概述

`cloudfunctions/api/index.js` 是一个统一的云函数入口，使用 `module` 和 `action` 来路由请求。

## 部署步骤

### 1. 部署云函数

在微信开发者工具中：
1. 右键 `cloudfunctions/api` → "创建并部署：云端安装依赖"
2. 等待部署完成

### 2. 小程序端调用示例

```javascript
// 封装API调用
const api = {
  async call(module, action, data = {}) {
    const res = await wx.cloud.callFunction({
      name: 'api',
      data: { module, action, data }
    })
    return res.result
  }
}

// 使用示例
async function register() {
  const result = await api.call('auth', 'register', {
    name: '张三',
    phone: '13800138001',
    requestRole: 'craftsman',
    password: '123456',
    specialty: '木工',
    experience: '3-5年'
  })
  
  if (result.success) {
    console.log('注册成功:', result.msg)
  } else {
    console.error('注册失败:', result.msg)
  }
}
```

## API接口文档

### 模块：auth（认证模块）

#### 1. 检查用户状态
```javascript
api.call('auth', 'checkStatus')
// 返回：
{
  success: true,
  data: {
    registered: true/false,
    approved: true/false,
    roles: ['craftsman'],
    pendingRoles: [],
    currentRole: 'craftsman',
    phone: '13800138001'
  }
}
```

#### 2. 用户注册
```javascript
api.call('auth', 'register', {
  name: '用户名',
  phone: '手机号',
  requestRole: 'craftsman',  // 或 'dispatcher'
  password: '密码',  // 可选
  specialty: '擅长工艺',  // 手艺人
  experience: '从业经验',  // 手艺人
  company: '公司名称'  // 派单人
})
```

#### 3. 手机号登录
```javascript
api.call('auth', 'loginByPhone', {
  phone: '13800138001',
  password: '123456'
})
```

---

### 模块：admin（管理员模块）

**需要管理员权限**

#### 1. 获取待审批列表
```javascript
api.call('admin', 'getPendingRequests')
// 返回：
{
  success: true,
  data: [
    {
      id: 'userId_role',
      userId: 'xxx',
      phone: '13800138001',
      name: '张三',
      role: 'craftsman',
      applyData: {...},
      applyTime: Date
    }
  ]
}
```

#### 2. 审批通过/拒绝
```javascript
api.call('admin', 'approve', {
  applicationId: 'userId_craftsman',
  approved: true,  // true通过，false拒绝
  reason: '拒绝原因'  // 拒绝时填写
})
```

#### 3. 获取统计数据
```javascript
api.call('admin', 'getStats')
// 返回：
{
  success: true,
  data: {
    userCount: 100,
    craftsmanCount: 50,
    dispatcherCount: 30,
    orderCount: 200
  }
}
```

---

### 模块：order（订单模块）

#### 1. 创建订单（派单人/管理员）
```javascript
api.call('order', 'create', {
  name: '订单名称',
  styleId: '样式ID',
  styleName: '样式名称',
  quantity: 10,
  price: 50,
  receiveDate: '2026-04-15',
  remark: '备注信息'
})
// 返回：{ orderId: 'xxx', orderCode: 'AB24031578' }
```

#### 2. 获取订单列表
```javascript
api.call('order', 'list')
// 根据角色返回不同数据：
// - 手艺人：待接单 + 自己的订单
// - 派单人：自己创建的订单
// - 管理员：所有订单
```

#### 3. 获取订单详情
```javascript
api.call('order', 'getDetail', {
  orderId: '订单ID'
})
```

#### 4. 接单（手艺人）
```javascript
api.call('order', 'accept', {
  orderId: '订单ID'
})
```

#### 5. 取消订单
```javascript
api.call('order', 'cancel', {
  orderId: '订单ID',
  reason: '取消原因'
})
```

#### 6. 完成订单（手艺人）
```javascript
api.call('order', 'complete', {
  orderId: '订单ID',
  photos: ['cloud://xxx.jpg']  // 完成照片fileID数组
})
```

#### 7. 获取手艺人列表（用于派单）
```javascript
api.call('order', 'getCraftsmen')
```

---

### 模块：user（用户模块）

#### 1. 获取用户信息
```javascript
api.call('user', 'getInfo')
// 返回：
{
  openid: 'xxx',
  phone: '13800138001',
  name: '张三',
  roles: ['craftsman'],
  currentRole: 'craftsman',
  rolesInfo: {
    craftsman: {...}
  }
}
```

#### 2. 切换角色
```javascript
api.call('user', 'switchRole', {
  role: 'dispatcher'
})
```

## 完整示例：注册到接单的流程

```javascript
// 1. 注册为手艺人
const registerRes = await api.call('auth', 'register', {
  name: '张三',
  phone: '13800138001',
  requestRole: 'craftsman',
  password: '123456',
  specialty: '木工',
  experience: '3-5年'
})

// 2. 管理员审批通过（在管理后台操作）
// api.call('admin', 'approve', { applicationId: 'xxx', approved: true })

// 3. 登录
const loginRes = await api.call('auth', 'loginByPhone', {
  phone: '13800138001',
  password: '123456'
})

// 4. 获取用户信息
const userRes = await api.call('user', 'getInfo')

// 5. 查看订单列表
const orderList = await api.call('order', 'list')

// 6. 接单
await api.call('order', 'accept', { orderId: 'xxx' })

// 7. 完成订单
await api.call('order', 'complete', {
  orderId: 'xxx',
  photos: ['cloud://xxx.jpg']
})
```

## 错误处理

```javascript
async function safeApiCall(module, action, data) {
  try {
    const res = await api.call(module, action, data)
    
    if (!res.success) {
      // 业务错误
      wx.showToast({ title: res.msg, icon: 'none' })
      return null
    }
    
    return res.data
  } catch (err) {
    // 网络或服务器错误
    console.error('API调用失败:', err)
    wx.showToast({ title: '网络错误', icon: 'none' })
    return null
  }
}
```

## 优势

1. **统一入口**：一个云函数处理所有请求
2. **权限集中**：在入口处统一检查权限
3. **代码简洁**：避免创建多个云函数
4. **易于维护**：所有API在一个文件中
5. **类型安全**：统一的返回格式

## 注意事项

1. 云函数有超时限制（默认3秒，最长20秒）
2. 云函数有内存限制（默认256MB）
3. 复杂查询建议分页处理
4. 文件上传仍需要使用 `wx.cloud.uploadFile`
