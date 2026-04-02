# 派单人注册功能指南

## 功能概述

派单人角色可以发布订单、管理订单、管理样式和查看统计数据。注册后数据会保存到数据库，并自动跳转到派单人首页。

## 数据库结构

### 1. dispatchers 集合（派单人表）

```javascript
{
  _id: String,          // 派单人ID
  openid: String,       // 微信openid
  name: String,         // 姓名
  phone: String,        // 手机号
  company: String,      // 公司名称（可选）
  status: String,       // 状态：active/pending
  createTime: Date,     // 创建时间
  updateTime: Date      // 更新时间
}
```

### 2. users 集合（用户表）

```javascript
{
  openid: String,       // 微信openid
  role: String,         // 主角色
  roles: Array,         // 所有角色数组
  currentRole: String,  // 当前角色
  phone: String,        // 手机号
  status: String,       // 状态
  createTime: Date,
  updateTime: Date
}
```

### 3. verifyCodes 集合（验证码表）

```javascript
{
  phone: String,        // 手机号
  code: String,         // 验证码
  type: String,         // 类型：dispatcher/craftsman
  used: Boolean,        // 是否已使用
  createTime: Date,
  expireTime: Date      // 过期时间
}
```

## 注册流程

### 1. 前端流程

```
角色选择页 (roleSelect.js)
    ↓ 选择"派单人"
派单人认证页 (dispatcherAuth.js)
    ↓ 填写信息
发送验证码 (sms/sendVerifyCode)
    ↓ 输入验证码
提交认证 (user/verifyDispatcher)
    ↓ 注册成功
更新全局数据 → 跳转到首页
```

### 2. 后端流程

```
verifyDispatcher 云函数
    ↓
1. 验证表单数据
2. 验证验证码（查 verifyCodes 表）
3. 检查是否已注册
4. 创建 dispatchers 记录
5. 更新 users 表角色信息
6. 标记验证码为已使用
7. 返回注册结果
```

## 关键代码修改

### 1. 注册成功后更新全局数据

**文件**: `pages/auth/dispatcherAuth.js`

```javascript
if (res.result.code === 0) {
  const { isAdmin, roles, status, dispatcherId } = res.result.data
  
  // 更新全局数据
  app.globalData.userRole = isAdmin ? 'admin' : 'dispatcher'
  app.globalData.isAdmin = isAdmin
  app.globalData.isLoggedIn = true
  app.globalData.roleInfo = {
    _id: dispatcherId,
    name: this.data.form.name,
    phone: this.data.form.phone,
    company: this.data.form.company,
    status: status
  }
  
  // 缓存到本地
  wx.setStorageSync('userRole', isAdmin ? 'admin' : 'dispatcher')
  wx.setStorageSync('userInfo', app.globalData.roleInfo)
  wx.setStorageSync('isAdmin', isAdmin)
  
  // 跳转到首页
  wx.switchTab({ url: '/pages/common/index' })
}
```

## 派单人功能入口

### 首页功能 (pages/common/index)

派单人可以看到以下功能入口：

1. **新建订单** - 创建新订单
2. **订单管理** - 查看和管理已发布订单
3. **样式管理** - 管理产品样式
4. **数据统计** - 查看订单统计

### 页面权限

| 页面 | 派单人权限 |
|------|-----------|
| 首页 (common/index) | ✅ 可访问 |
| 创建订单 (admin/orderForm) | ✅ 可访问 |
| 订单管理 (admin/orderManage) | ✅ 可访问 |
| 样式管理 (admin/styleManage) | ✅ 可访问 |
| 统计页面 (admin/stats/index) | ✅ 可访问 |
| 接单大厅 (craftsman/orderList) | ❌ 不可访问 |
| 我的订单 (craftsman/myOrders) | ❌ 不可访问 |

## 测试步骤

### 1. 初始化数据库

部署并运行 `initDb` 云函数：
```javascript
// 确保创建了以下集合：
// - users
// - dispatchers
// - verifyCodes
// - orders
// - styles
```

### 2. 测试注册流程

1. 打开小程序，进入角色选择页
2. 点击"派单人"
3. 填写信息：
   - 手机号：13800138000（测试号）
   - 验证码：从控制台获取
   - 姓名：张三
   - 公司：测试公司（可选）
4. 勾选同意协议
5. 点击"立即认证"
6. 验证是否跳转成功

### 3. 验证数据库记录

注册成功后检查：

**dispatchers 集合**：
```javascript
db.collection('dispatchers').where({ phone: '13800138000' }).get()
```

**users 集合**：
```javascript
db.collection('users').where({ openid: 'xxx' }).get()
// 应包含：role: 'dispatcher', roles: ['dispatcher']
```

### 4. 验证功能权限

1. 首页应显示"派单中心"功能卡片
2. 点击"新建订单"应能正常打开
3. 点击"接单大厅"应提示"仅限手艺人"

## 常见问题

### Q1: 验证码收不到？

**解决**: 检查 sms 云函数，测试环境会在返回值中返回验证码：
```javascript
return {
  code: 0,
  data: { code: "123456" }  // 在控制台查看
}
```

### Q2: 注册后跳转到首页但没有派单人功能？

**解决**: 检查 `currentRole` 是否正确设置为 'dispatcher'，首页根据 `currentRole` 显示对应功能。

### Q3: 如何切换到手艺人角色？

**解决**: 
1. 在首页点击"账号设置"
2. 点击"切换角色"
3. 选择"注册为手艺人"或切换到已有角色

## 管理员手机号

默认管理员手机号：`13810062394`

使用此手机号注册会自动获得 admin 角色。

## 云函数列表

| 云函数 | 功能 |
|-------|------|
| user/login | 用户登录 |
| user/verifyDispatcher | 派单人注册 |
| user/getUserRoles | 获取用户角色 |
| user/switchRole | 切换角色 |
| sms/sendVerifyCode | 发送验证码 |
| order/create | 创建订单 |
| order/getOrderStats | 获取订单统计 |
| initDb | 初始化数据库 |

## 安全验证

1. **前端验证**: 表单必填项、手机号格式、验证码格式
2. **后端验证**: 
   - 验证码正确性和时效性
   - 手机号是否已注册
   - openid 是否已注册
3. **权限验证**: 各页面根据角色控制访问权限
