# 角色上下文隔离完全修复

## 问题描述

之前的问题：切换角色时只更新了 `userRole`，但没有更新 `roleInfo`，导致新角色仍然看到旧角色的数据。

## 修复内容

### 1. 角色切换时完全更新上下文

**修复的文件**:
- `pages/craftsman/profile.js` - `doSwitchRole` 函数
- `pages/auth/roleSelect.js` - 角色选择逻辑
- `pages/login/index.js` - 登录时的角色选择

**修复内容**:
```javascript
// 角色切换成功后，获取新角色的完整信息
const userRes = await wx.cloud.callFunction({
  name: 'user',
  data: { action: 'getUserInfo' }
})

if (userRes.result.code === 0) {
  const { rolesInfo, roles } = userRes.result.data
  const newRoleInfo = rolesInfo ? rolesInfo[role] : null
  
  // 完全更新全局数据 - 角色隔离
  app.globalData.userRole = role
  app.globalData.roleInfo = newRoleInfo
  app.globalData.isAdmin = roles.includes('admin')
  
  // 更新本地缓存
  wx.setStorageSync('userRole', role)
  wx.setStorageSync('userInfo', newRoleInfo || {})
}
```

### 2. 登录时正确设置角色上下文

**修复的场景**:
- 多角色选择时
- 单角色直接登录时
- 手机号登录时

**修复内容**:
```javascript
const { rolesInfo } = res.result.data
const selectedRoleInfo = rolesInfo ? rolesInfo[selectedRole] : null

// 完全更新全局数据 - 角色隔离
app.globalData.userRole = selectedRole
app.globalData.roleInfo = selectedRoleInfo
wx.setStorageSync('userRole', selectedRole)
wx.setStorageSync('userInfo', selectedRoleInfo || {})
```

## 角色隔离的数据结构

### 全局状态 (app.globalData)
```javascript
{
  userRole: 'craftsman',      // 当前活动角色
  roleInfo: {                 // 当前角色的详细信息
    _id: 'xxx',
    name: '张三',
    phone: '13800138000',
    avatarUrl: '...',
    // 角色特定字段...
  },
  isAdmin: false,             // 是否管理员
  isLoggedIn: true            // 是否登录
}
```

### 用户数据库结构
```javascript
{
  openid: 'xxx',
  phone: '13800138000',
  roles: ['craftsman', 'dispatcher'],  // 所有已通过的角色
  currentRole: 'craftsman',             // 当前活动角色
  roleApplications: [
    { role: 'craftsman', status: 'active', ... },
    { role: 'dispatcher', status: 'active', ... }
  ]
}
```

## 角色切换流程

```
1. 用户点击"切换角色"
   ↓
2. 调用云函数 switchRole
   ↓
3. 切换成功后，调用 getUserInfo 获取新角色信息
   ↓
4. 更新 app.globalData.userRole 和 app.globalData.roleInfo
   ↓
5. 更新本地缓存 userRole 和 userInfo
   ↓
6. 跳转到新角色首页
   ↓
7. 新页面加载时使用新的 roleInfo 渲染
```

## 测试验证

### 测试 1: 工匠和派单人角色切换

**步骤**:
1. 用户同时拥有工匠和派单人角色
2. 当前在工匠首页
3. 切换到派单人

**预期结果**:
- [ ] 显示派单人的首页
- [ ] 显示派单人的名称和信息
- [ ] 显示派单人的订单列表
- [ ] 不显示工匠的数据

### 测试 2: 登录时选择不同角色

**步骤**:
1. 用户拥有多个角色
2. 退出登录
3. 重新登录
4. 选择不同的角色

**预期结果**:
- [ ] 登录后显示选择的角色页面
- [ ] 角色信息正确

### 测试 3: 不同角色的数据隔离

**步骤**:
1. 工匠接了订单A
2. 派单人发布了订单B
3. 切换到工匠角色
4. 查看我的订单

**预期结果**:
- [ ] 工匠只看到订单A
- [ ] 不看到订单B
- [ ] 切换到派单人后，看到订单B

## 常见问题

### 问题 1: 切换角色后仍然显示旧角色数据
**原因**: 只更新了 `userRole`，没有更新 `roleInfo`
**解决**: 确保切换时调用 `getUserInfo` 获取新角色的完整信息

### 问题 2: 页面加载时 roleInfo 为空
**原因**: 没有正确设置全局数据
**解决**: 检查登录/切换时是否正确设置了 `app.globalData.roleInfo`

### 问题 3: 重启小程序后角色信息丢失
**原因**: 没有从本地缓存恢复 roleInfo
**解决**: 在 app.js 的 onLaunch 中检查并恢复本地缓存

## 代码检查清单

- [ ] `pages/craftsman/profile.js` 的 `doSwitchRole` 函数
- [ ] `pages/auth/roleSelect.js` 的角色切换逻辑
- [ ] `pages/login/index.js` 的微信登录处理
- [ ] `pages/login/index.js` 的手机号登录处理
- [ ] `app.js` 的 checkLoginStatus 函数
