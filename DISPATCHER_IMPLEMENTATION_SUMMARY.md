# 派单人注册功能实现总结

## 修改记录

### 1. 前端修改

#### pages/auth/dispatcherAuth.js
**修改内容**: 完善注册成功后的全局数据更新和缓存

```javascript
// 修改前
if (res.result.code === 0) {
  const { isAdmin } = res.result.data
  app.globalData.userRole = isAdmin ? 'admin' : 'dispatcher'
  wx.switchTab({ url: '/pages/common/index' })
}

// 修改后
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
  
  wx.switchTab({ url: '/pages/common/index' })
}
```

### 2. 后端云函数

#### cloudfunctions/user/index.js - verifyDispatcher
**功能**: 验证派单人身份并创建记录

**主要逻辑**:
1. 验证表单数据（手机号、姓名、验证码）
2. 验证验证码（查 verifyCodes 表，验证时效性）
3. 检查用户是否已注册（查 dispatchers 表）
4. 检查手机号是否被注册
5. 创建 dispatchers 记录
6. 更新 users 表角色信息
7. 标记验证码为已使用

**数据库操作**:
```javascript
// 1. 创建派单人记录
db.collection('dispatchers').add({
  data: {
    openid,
    name,
    phone,
    company,
    status: isAdminPhone ? 'active' : 'pending',
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
})

// 2. 更新用户角色
db.collection('users').where({ openid }).update({
  data: {
    roles: currentRoles,
    role: currentRoles[0],
    currentRole: 'dispatcher',
    status: 'active',
    updateTime: db.serverDate()
  }
})

// 3. 标记验证码已使用
db.collection('verifyCodes').doc(codeId).update({
  data: { used: true, usedTime: db.serverDate() }
})
```

#### cloudfunctions/sms/index.js - sendVerifyCode
**功能**: 发送验证码

**主要逻辑**:
1. 验证手机号格式
2. 检查发送频率（1分钟内只能发一次）
3. 生成6位随机验证码
4. 保存到 verifyCodes 表
5. 记录短信日志
6. 向管理员发送通知

## 数据库集合

### dispatchers（派单人表）
```javascript
{
  _id: String,      // 派单人ID
  openid: String,   // 微信openid
  name: String,     // 姓名
  phone: String,    // 手机号
  company: String,  // 公司名称
  status: String,   // active/pending
  createTime: Date,
  updateTime: Date
}
```

### users（用户表）
```javascript
{
  openid: String,       // 微信openid
  role: String,         // 主角色
  roles: Array,         // 所有角色
  currentRole: String,  // 当前角色
  phone: String,
  status: String,
  createTime: Date,
  updateTime: Date
}
```

### verifyCodes（验证码表）
```javascript
{
  phone: String,    // 手机号
  code: String,     // 验证码
  type: String,     // dispatcher/craftsman
  used: Boolean,    // 是否已使用
  createTime: Date,
  expireTime: Date  // 过期时间（10分钟）
}
```

## 完整注册流程

```
用户操作                          系统处理
─────────────────────────────────────────────────────────
1. 点击"派单人"                   → 跳转到 dispatcherAuth 页

2. 填写手机号                     → 前端验证手机号格式

3. 点击"获取验证码"               → 调用 sms/sendVerifyCode
                                  → 生成验证码并保存到数据库
                                  → 返回验证码（测试环境）

4. 填写验证码、姓名、公司         → 前端表单验证

5. 勾选协议，点击提交             → 调用 user/verifyDispatcher
                                  → 后端验证数据
                                  → 创建 dispatchers 记录
                                  → 更新 users 角色信息
                                  → 标记验证码已使用

6. 显示成功提示                   → 前端更新全局数据
                                  → 缓存到本地存储
                                  → 跳转到首页

7. 进入派单人首页                 → 显示派单人功能入口
                                  → 可以创建订单、管理订单等
```

## 派单人功能权限

| 功能 | 权限 |
|-----|------|
| 新建订单 | ✅ |
| 订单管理 | ✅ |
| 样式管理 | ✅ |
| 数据统计 | ✅ |
| 接单大厅 | ❌（仅限手艺人）|
| 我的订单 | ❌（仅限手艺人）|

## 关键文件清单

### 前端文件
- `pages/auth/roleSelect.js` - 角色选择页
- `pages/auth/dispatcherAuth.js` - 派单人认证页
- `pages/auth/dispatcherAuth.wxml` - 认证页模板
- `pages/common/index.js` - 首页（支持多角色显示）
- `pages/admin/orderForm.js` - 创建订单
- `pages/admin/orderManage.js` - 订单管理
- `pages/admin/styleManage.js` - 样式管理

### 云函数
- `cloudfunctions/user/index.js` - 用户相关接口
  - `verifyDispatcher` - 派单人注册
  - `login` - 用户登录
  - `getUserRoles` - 获取用户角色
  - `switchRole` - 切换角色
- `cloudfunctions/sms/index.js` - 短信相关接口
  - `sendVerifyCode` - 发送验证码
- `cloudfunctions/order/index.js` - 订单相关接口
- `cloudfunctions/initDb/index.js` - 数据库初始化

## 测试验证点

1. **注册流程**
   - 表单验证正确
   - 验证码发送和验证正常
   - 数据库记录正确创建
   - 跳转和全局数据更新正确

2. **功能权限**
   - 派单人能看到正确的功能入口
   - 各功能页面访问权限正确
   - 角色切换功能正常

3. **数据一致性**
   - dispatchers 表记录正确
   - users 表角色信息正确
   - verifyCodes 表状态正确

## 部署步骤

1. 部署云函数
   ```bash
   # 部署 user 云函数
   cd cloudfunctions/user && npm install
   
   # 部署 sms 云函数
   cd cloudfunctions/sms && npm install
   
   # 部署 order 云函数
   cd cloudfunctions/order && npm install
   ```

2. 初始化数据库
   - 运行 initDb 云函数
   - 确保创建了所有必要的集合

3. 配置管理员手机号
   - 修改 `cloudfunctions/user/index.js` 中的 ADMIN_PHONE
   - 修改 `cloudfunctions/sms/index.js` 中的 ADMIN_PHONE

4. 测试注册流程
   - 按照测试检查清单逐项验证

## 注意事项

1. **验证码安全**
   - 测试环境返回验证码方便调试
   - 生产环境应接入真实短信服务

2. **数据验证**
   - 前端和后端都要做验证
   - 防止重复注册

3. **角色权限**
   - 首页根据 currentRole 显示不同功能
   - 各页面要做好权限检查

4. **用户体验**
   - 加载状态要清晰
   - 错误提示要明确
   - 跳转动画要流畅
