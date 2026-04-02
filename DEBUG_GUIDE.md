# 注册与跳转问题排查指南

## 快速诊断

### 1. 检查控制台输出

在注册过程中，查看开发者工具控制台是否有以下输出：

```
[注册成功] 返回数据: {...}
[全局数据] userRole: craftsman/dispatcher
[缓存成功] userRole 已缓存
```

### 2. 检查数据库

在云开发控制台 → 数据库中查看：

**users 集合：**
```javascript
{
  openid: "xxx",
  role: "craftsman",  // 或 dispatcher
  roles: ["craftsman"],
  currentRole: "craftsman",
  status: "active"
}
```

**craftsmen/dispatchers 集合：**
```javascript
{
  openid: "xxx",
  name: "测试姓名",
  phone: "13800138001",
  status: "active"  // 或 pending
}
```

## 常见问题解决

### 问题 1：注册后仍显示游客

**现象**：注册成功后跳转，但页面显示"游客"

**排查步骤**：

1. **检查全局数据是否设置**
   ```javascript
   // 在 app.js 的 onLaunch 中添加调试
   console.log('当前全局数据:', this.globalData)
   ```

2. **检查缓存是否写入**
   ```javascript
   // 在控制台执行
   wx.getStorageSync('userRole')
   wx.getStorageSync('userInfo')
   ```

3. **检查首页数据加载**
   ```javascript
   // 在 pages/common/index.js 的 onLoad 中添加
   console.log('首页加载，当前角色:', this.data.currentRole)
   ```

**解决方案**：
- 确保注册页面设置了 `app.globalData.roleInfo`
- 确保注册页面调用了 `wx.setStorageSync`

---

### 问题 2：跳转后白屏或报错

**现象**：注册成功后跳转，页面空白或报错

**排查步骤**：

1. **检查页面路径**
   ```javascript
   // 确认路径在 app.json 的 pages 中
   "pages": [
     "pages/craftsman/orderList",  // 手艺人首页
     "pages/common/index"          // 派单人首页
   ]
   ```

2. **检查 tabBar 配置**
   ```javascript
   // 如果是 tabBar 页面，必须使用 switchTab
   wx.switchTab({ url: '/pages/craftsman/orderList' })
   
   // 普通页面使用 navigateTo
   wx.navigateTo({ url: '/pages/admin/orderForm' })
   ```

3. **检查页面生命周期**
   ```javascript
   // 在目标页面的 onLoad 中添加调试
   onLoad() {
     console.log('页面加载')
     this.checkUserRole()
   }
   ```

**解决方案**：
- tabBar 页面使用 `wx.switchTab`
- 非 tabBar 页面使用 `wx.navigateTo` 或 `wx.reLaunch`

---

### 问题 3：验证码发送失败

**现象**：点击获取验证码无反应或报错

**排查步骤**：

1. **检查 sms 云函数**
   ```javascript
   // 在云开发控制台 → 云函数 → 日志中查看
   // 是否有 sendVerifyCode 调用记录
   ```

2. **检查验证码表**
   ```javascript
   // 在云开发控制台 → 数据库 → verifyCodes
   // 查看是否有新记录生成
   ```

3. **检查控制台输出**
   ```
   [发送验证码] 手机号: 13800138001
   [发送成功] 验证码: 123456
   ```

**解决方案**：
- 确保 sms 云函数已部署
- 确保 verifyCodes 集合已创建
- 测试环境验证码会打印在控制台

---

### 问题 4：数据库写入失败

**现象**：注册提示成功，但数据库无记录

**排查步骤**：

1. **检查云函数日志**
   ```javascript
   // 在云开发控制台 → 云函数 → user → 日志
   // 查看 registerCraftsman 或 verifyDispatcher 的执行日志
   ```

2. **检查数据库权限**
   ```javascript
   // 确保数据库权限设置为"所有用户可读，仅创建者可写"
   // 或"所有用户可读可写"（开发环境）
   ```

3. **检查集合是否存在**
   ```javascript
   // 运行 initDb 云函数初始化数据库
   ```

**解决方案**：
- 重新运行 initDb 初始化数据库
- 检查云函数执行日志中的错误信息

---

## 调试代码

### 在页面中添加调试按钮

```javascript
// 在任意页面的 js 文件中添加
Page({
  // ...
  
  // 调试：检查全局数据
  checkGlobalData() {
    const app = getApp()
    console.log('=== 全局数据 ===')
    console.log('userRole:', app.globalData.userRole)
    console.log('isAdmin:', app.globalData.isAdmin)
    console.log('isLoggedIn:', app.globalData.isLoggedIn)
    console.log('roleInfo:', app.globalData.roleInfo)
    
    console.log('=== 本地缓存 ===')
    console.log('userRole:', wx.getStorageSync('userRole'))
    console.log('userInfo:', wx.getStorageSync('userInfo'))
    console.log('isAdmin:', wx.getStorageSync('isAdmin'))
    
    wx.showModal({
      title: '调试信息',
      content: `角色: ${app.globalData.userRole}\n登录: ${app.globalData.isLoggedIn}`,
      showCancel: false
    })
  }
})
```

```html
<!-- 在 wxml 中添加 -->
<button bindtap="checkGlobalData">检查全局数据</button>
```

### 在云函数中添加调试日志

```javascript
// 在 user 云函数的 registerCraftsman 中添加
console.log('=== 注册手艺人 ===')
console.log('openid:', openid)
console.log('form data:', data)
console.log('创建记录结果:', craftsmanRes)
console.log('更新用户结果:', updateRes)
```

---

## 修复检查清单

### 手艺人注册修复确认

- [ ] `app.globalData.userRole` 设置为 'craftsman'
- [ ] `app.globalData.isAdmin` 设置为 false
- [ ] `app.globalData.isLoggedIn` 设置为 true
- [ ] `app.globalData.roleInfo` 设置为包含手艺人信息的对象
- [ ] `app.globalData.craftsmanInfo` 设置为 roleInfo
- [ ] `wx.setStorageSync('userRole', 'craftsman')`
- [ ] `wx.setStorageSync('userInfo', roleInfo)`
- [ ] 跳转使用 `wx.switchTab({ url: '/pages/craftsman/orderList' })`

### 派单人注册修复确认

- [ ] `app.globalData.userRole` 设置为 'dispatcher'
- [ ] `app.globalData.isAdmin` 设置为 false
- [ ] `app.globalData.isLoggedIn` 设置为 true
- [ ] `app.globalData.roleInfo` 设置为包含派单人信息的对象
- [ ] `wx.setStorageSync('userRole', 'dispatcher')`
- [ ] `wx.setStorageSync('userInfo', roleInfo)`
- [ ] 跳转使用 `wx.switchTab({ url: '/pages/common/index' })`

---

## 联系支持

如果以上方法都无法解决问题：

1. 查看完整日志（开发者工具 → 控制台 → 全部）
2. 检查云函数日志（云开发控制台 → 云函数 → 日志）
3. 检查数据库记录（云开发控制台 → 数据库）
4. 提供完整的错误信息和截图
