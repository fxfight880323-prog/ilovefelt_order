# 初始化管理员集合指南

## 方案1：直接执行云函数（推荐）

### 步骤1：部署云函数

1. 在微信开发者工具中，右键 `cloudfunctions/initAdmin` 文件夹
2. 选择 **"创建并部署：云端安装依赖"**
3. 等待部署完成

### 步骤2：初始化管理员

在控制台执行：

```javascript
wx.cloud.callFunction({
  name: 'initAdmin',
  data: { action: 'init' }
}).then(res => {
  console.log('结果:', res.result)
})
```

**预期输出：**
```
{ success: true, msg: '管理员创建成功' }
```

或者（如果已存在）：
```
{ success: true, msg: '管理员密码已更新为 880323' }
```

### 步骤3：验证登录

```javascript
wx.cloud.callFunction({
  name: 'initAdmin',
  data: { 
    action: 'verify',
    phone: '13810062394',
    password: '880323'
  }
}).then(res => {
  console.log('验证结果:', res.result)
})
```

**预期输出：**
```
{ success: true, msg: '验证成功', data: { phone: '13810062394', name: '超级管理员', roles: ['admin'] } }
```

### 步骤4：查看所有管理员

```javascript
wx.cloud.callFunction({
  name: 'initAdmin',
  data: { action: 'list' }
}).then(res => {
  console.log('管理员列表:', res.result)
})
```

---

## 方案2：直接操作数据库（无需部署）

如果云函数部署有问题，可以直接在控制台执行：

```javascript
const db = wx.cloud.database()

// 创建管理员
async function createAdmin() {
  // 检查是否已存在
  const { data: existing } = await db.collection('adminUsers')
    .where({ phone: '13810062394' })
    .get()
  
  if (existing.length > 0) {
    console.log('管理员已存在，ID:', existing[0]._id)
    return
  }
  
  // 添加管理员
  const result = await db.collection('adminUsers').add({
    data: {
      phone: '13810062394',
      password: '880323',  // 明文存储，生产环境建议加密
      name: '超级管理员',
      roles: ['admin'],
      isSuperAdmin: true,
      status: 'active',
      createTime: new Date(),
      updateTime: new Date()
    }
  })
  
  console.log('管理员创建成功，ID:', result._id)
}

createAdmin()
```

---

## 集合结构

**集合名：** `adminUsers`

**字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| phone | String | 手机号 |
| password | String | 密码（MD5加密） |
| name | String | 姓名 |
| roles | Array | 角色列表，如 ['admin'] |
| isSuperAdmin | Boolean | 是否超级管理员 |
| status | String | 状态：active/disabled |
| createTime | Date | 创建时间 |
| updateTime | Date | 更新时间 |

---

## 登录验证代码示例

```javascript
// 在登录页面使用
async function adminLogin(phone, password) {
  const { result } = await wx.cloud.callFunction({
    name: 'initAdmin',
    data: { 
      action: 'verify',
      phone,
      password
    }
  })
  
  if (result.success) {
    // 保存登录状态
    wx.setStorageSync('adminInfo', result.data)
    wx.showToast({ title: '登录成功' })
    // 跳转到管理后台
    wx.navigateTo({ url: '/pages/admin/console' })
  } else {
    wx.showToast({ title: result.msg, icon: 'none' })
  }
}
```

---

## 注意事项

1. **生产环境** 建议对密码进行加密存储
2. **权限设置** 确保 `adminUsers` 集合的权限为 "仅管理员可写"
3. **安全性** 超级管理员权限需谨慎分配
