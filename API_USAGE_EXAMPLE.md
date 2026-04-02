# API调用示例

## 引入API模块

```javascript
const API = require('../../utils/api.js')
```

---

## 一、认证模块

### 1. 检查登录状态（页面加载时调用）

```javascript
Page({
  async onLoad() {
    try {
      const res = await API.auth.checkStatus()
      
      if (!res.data.registered) {
        // 未注册，跳转到注册页
        wx.redirectTo({ url: '/pages/register/index' })
        return
      }
      
      if (!res.data.approved) {
        // 已注册但未审批
        if (res.data.pendingRoles.length > 0) {
          // 有正在审核的角色
          wx.redirectTo({ 
            url: '/pages/common/pendingApproval?role=' + res.data.pendingRoles[0] 
          })
        } else {
          wx.showModal({
            title: '账号未通过',
            content: '您的申请未通过审批，请联系管理员',
            showCancel: false
          })
        }
        return
      }
      
      // 已审批，保存用户信息
      this.setData({
        userInfo: res.data,
        isLoggedIn: true
      })
      
    } catch (err) {
      console.error('检查状态失败:', err)
    }
  }
})
```

### 2. 用户注册

```javascript
// pages/register/register.js
Page({
  data: {
    form: {
      name: '',
      phone: '',
      requestRole: 'craftsman',  // 或 'dispatcher'
      password: '',
      specialty: '',
      experience: ''
    }
  },

  async submitRegister() {
    const { form } = this.data
    
    // 表单验证
    if (!form.name || !form.phone) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '提交中...' })
    
    try {
      const res = await API.auth.register(form)
      
      wx.hideLoading()
      wx.showModal({
        title: '注册成功',
        content: res.msg,
        showCancel: false,
        success: () => {
          // 返回登录页
          wx.navigateBack()
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

### 3. 手机号登录

```javascript
// pages/login/login.js
Page({
  data: {
    phone: '',
    password: ''
  },

  async login() {
    const { phone, password } = this.data
    
    if (!phone || !password) {
      wx.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '登录中...' })
    
    try {
      const res = await API.auth.loginByPhone(phone, password)
      
      wx.hideLoading()
      
      // 保存登录状态
      wx.setStorageSync('userRole', res.data.currentRole)
      wx.setStorageSync('userInfo', res.data)
      
      wx.showToast({ title: '登录成功', icon: 'success' })
      
      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/common/index' })
      }, 1500)
      
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

---

## 二、订单模块

### 1. 派单人创建订单

```javascript
// pages/dispatcher/createOrder.js
Page({
  data: {
    form: {
      name: '',
      styleName: '',
      quantity: 1,
      price: 0,
      receiveDate: '',
      remark: ''
    }
  },

  async createOrder() {
    const { form } = this.data
    
    wx.showLoading({ title: '创建中...' })
    
    try {
      const res = await API.order.create(form)
      
      wx.hideLoading()
      wx.showToast({ title: '创建成功', icon: 'success' })
      
      // 返回订单列表
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

### 2. 获取订单列表

```javascript
// pages/craftsman/orderList.js
Page({
  data: {
    orders: [],
    loading: false
  },

  async onLoad() {
    this.loadOrders()
  },

  async loadOrders() {
    this.setData({ loading: true })
    
    try {
      const res = await API.order.list()
      
      this.setData({
        orders: res.data,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadOrders()
    wx.stopPullDownRefresh()
  }
})
```

### 3. 手艺人接单

```javascript
// 在订单详情页
Page({
  data: {
    orderId: '',
    orderInfo: null
  },

  async onLoad(options) {
    this.setData({ orderId: options.id })
    this.loadOrderDetail()
  },

  async loadOrderDetail() {
    try {
      const res = await API.order.getDetail(this.data.orderId)
      this.setData({ orderInfo: res.data })
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  async acceptOrder() {
    try {
      await wx.showModal({
        title: '确认接单',
        content: '确定要接这个订单吗？',
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '处理中...' })
            
            await API.order.accept(this.data.orderId)
            
            wx.hideLoading()
            wx.showToast({ title: '接单成功', icon: 'success' })
            
            // 刷新订单详情
            this.loadOrderDetail()
          }
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

### 4. 取消订单

```javascript
async cancelOrder() {
  try {
    const { confirm } = await wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？'
    })
    
    if (!confirm) return
    
    wx.showLoading({ title: '取消中...' })
    
    await API.order.cancel(this.data.orderId, '用户主动取消')
    
    wx.hideLoading()
    wx.showToast({ title: '已取消', icon: 'success' })
    
    // 刷新页面
    this.loadOrderDetail()
    
  } catch (err) {
    wx.hideLoading()
    wx.showToast({ title: err.message, icon: 'none' })
  }
}
```

### 5. 完成订单（上传照片）

```javascript
async completeOrder() {
  try {
    // 先上传照片到云存储
    const photos = await this.uploadPhotos()
    
    wx.showLoading({ title: '提交中...' })
    
    await API.order.complete(this.data.orderId, photos)
    
    wx.hideLoading()
    wx.showToast({ title: '订单已完成', icon: 'success' })
    
  } catch (err) {
    wx.hideLoading()
    wx.showToast({ title: err.message, icon: 'none' })
  }
},

async uploadPhotos() {
  const { tempFilePaths } = await wx.chooseImage({ count: 3 })
  
  const uploadTasks = tempFilePaths.map(filePath => {
    return wx.cloud.uploadFile({
      cloudPath: `orders/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.jpg`,
      filePath
    })
  })
  
  const results = await Promise.all(uploadTasks)
  return results.map(r => r.fileID)
}
```

---

## 三、管理员模块

### 1. 审批列表页面

```javascript
// pages/admin/approvalList.js
Page({
  data: {
    applications: [],
    loading: false
  },

  async onLoad() {
    this.loadApplications()
  },

  async onShow() {
    this.loadApplications()
  },

  async loadApplications() {
    this.setData({ loading: true })
    
    try {
      const res = await API.admin.getPendingRequests()
      
      this.setData({
        applications: res.data,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  async approve(e) {
    const { id } = e.currentTarget.dataset
    
    try {
      await wx.showModal({
        title: '确认通过',
        content: '确定要通过这个申请吗？',
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '处理中...' })
            
            await API.admin.approve(id, true)
            
            wx.hideLoading()
            wx.showToast({ title: '审批通过', icon: 'success' })
            
            // 刷新列表
            this.loadApplications()
          }
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  async reject(e) {
    const { id } = e.currentTarget.dataset
    
    try {
      const { confirm, content } = await wx.showModal({
        title: '确认拒绝',
        content: '请输入拒绝原因（可选）',
        editable: true
      })
      
      if (!confirm) return
      
      wx.showLoading({ title: '处理中...' })
      
      await API.admin.approve(id, false, content)
      
      wx.hideLoading()
      wx.showToast({ title: '已拒绝', icon: 'success' })
      
      this.loadApplications()
      
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

---

## 四、用户模块

### 1. 切换角色（双角色用户）

```javascript
// 在个人中心页面
Page({
  data: {
    userInfo: null,
    roles: []
  },

  async onLoad() {
    this.loadUserInfo()
  },

  async loadUserInfo() {
    try {
      const res = await API.user.getInfo()
      this.setData({
        userInfo: res.data,
        roles: res.data.roles
      })
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  async switchRole(e) {
    const { role } = e.currentTarget.dataset
    
    try {
      wx.showLoading({ title: '切换中...' })
      
      await API.user.switchRole(role)
      
      wx.hideLoading()
      wx.showToast({ title: '切换成功', icon: 'success' })
      
      // 根据角色跳转
      if (role === 'craftsman') {
        wx.switchTab({ url: '/pages/craftsman/orderList' })
      } else if (role === 'dispatcher') {
        wx.switchTab({ url: '/pages/dispatcher/myOrders' })
      }
      
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    }
  }
})
```

---

## 五、全局错误处理

在 `app.js` 中添加全局错误处理：

```javascript
App({
  onError(err) {
    console.error('全局错误:', err)
  },

  // 全局API错误处理
  handleApiError(err) {
    if (err.message.includes('未审批')) {
      wx.redirectTo({ url: '/pages/common/pendingApproval' })
    } else if (err.message.includes('无权限')) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限执行此操作',
        showCancel: false
      })
    } else {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }
})
```

---

## 六、页面调用对比

### 旧方式（直接调用云函数）

```javascript
// 代码冗余，每次都要写完整的callFunction
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'order',
    action: 'list',
    data: {}
  }
}).then(res => {
  if (res.result.success) {
    this.setData({ orders: res.result.data })
  } else {
    wx.showToast({ title: res.result.msg, icon: 'none' })
  }
}).catch(err => {
  wx.showToast({ title: '网络错误', icon: 'none' })
})
```

### 新方式（使用API封装）

```javascript
// 简洁清晰，错误自动处理
const res = await API.order.list()
this.setData({ orders: res.data })
```

---

## 七、TypeScript支持（可选）

如果使用TypeScript，可以添加类型定义：

```typescript
// utils/api.d.ts
interface ApiResponse<T = any> {
  success: boolean
  code: number
  data: T
  msg: string
}

declare const API: {
  auth: {
    checkStatus(): Promise<ApiResponse<{ registered: boolean; approved: boolean; roles: string[] }>>
    register(data: any): Promise<ApiResponse>
    loginByPhone(phone: string, password: string): Promise<ApiResponse>
  }
  order: {
    create(data: any): Promise<ApiResponse<{ orderId: string; orderCode: string }>>
    list(): Promise<ApiResponse<any[]>>
    // ...
  }
  // ...
}
```
