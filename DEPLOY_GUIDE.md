# 角色申请审批系统部署指南

## 一键部署步骤

### 第一步：初始化数据库
在微信开发者工具控制台执行：

```javascript
wx.cloud.callFunction({
  name: 'initDb',
  data: { checkOnly: false }
}).then(res => {
  console.log('初始化结果:', res.result)
})
```

### 第二步：部署云函数

按顺序右键部署以下云函数：

1. `cloudfunctions/user` → 创建并部署：云端安装依赖
2. `cloudfunctions/admin` → 创建并部署：云端安装依赖
3. `cloudfunctions/sms` → 创建并部署：云端安装依赖

### 第三步：验证部署

在控制台执行测试命令：

```javascript
// 1. 测试登录
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'login' }
}).then(res => console.log('登录测试:', res.result))

// 2. 测试获取待审批
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
}).then(res => console.log('待审批:', res.result))
```

---

## 完整测试案例

### 测试案例1：新用户注册手艺人

```javascript
// 1. 获取验证码
wx.cloud.callFunction({
  name: 'sms',
  data: {
    action: 'sendVerifyCode',
    data: { phone: '13800138001', type: 'craftsman' }
  }
})

// 2. 提交注册
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'applyRole',
    data: {
      role: 'craftsman',
      applyData: {
        name: '测试用户',
        phone: '13800138001',
        password: '123456',
        confirmPassword: '123456',
        specialty: '木工',
        experience: '1-3年',
        address: '北京市',
        verifyCode: '收到的验证码'
      }
    }
  }
}).then(res => {
  if (res.result.code === 0) {
    console.log('注册成功:', res.result.message)
    // 期待输出: "申请已提交，请等待管理员审批"
  }
})
```

### 测试案例2：管理员审批

```javascript
// 1. 查看待审批列表
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
}).then(res => {
  console.log('待审批列表:', res.result.data)
  // 记住 applicationId: userId_role
})

// 2. 审批通过
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'reviewRoleApplication',
    data: {
      applicationId: '用户ID_craftsman',
      approved: true
    }
  }
}).then(res => console.log('审批结果:', res.result))
```

### 测试案例3：用户登录

```javascript
// 方式1：微信登录（已注册用户）
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'login' }
}).then(res => console.log('登录结果:', res.result))

// 方式2：手机号密码登录
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'loginByPhone',
    data: {
      phone: '13800138001',
      password: '123456'
    }
  }
}).then(res => console.log('登录结果:', res.result))
```

---

## 常见问题排查

### 1. 提示"该手机号已注册此角色"
**检查**：
```javascript
db.collection('users').where({ phone: '13800138001' }).get()
// 查看 roles 字段是否包含 'craftsman'
```

### 2. 管理员看不到待审批
**检查**：
```javascript
// 检查 adminNotifications 集合
db.collection('adminNotifications').where({ type: 'roleApplication' }).get()

// 检查云函数日志
```

### 3. 审批后无法登录
**检查**：
```javascript
// 1. 检查 users 集合
db.collection('users').where({ phone: '13800138001' }).get()
// 确认：roles 包含角色，roleApplications 状态为 active

// 2. 检查角色详情表
db.collection('craftsmen').where({ phone: '13800138001' }).get()
// 确认：记录存在且 status 为 active
```

### 4. 验证码发送失败
**检查**：
```javascript
// 检查验证码表
db.collection('verifyCodes').where({ phone: '13800138001' }).get()
```

---

## 快速调试技巧

### 清理测试数据
在测试完成后，可以删除测试数据：

```javascript
// 小心执行！仅用于测试环境
const testPhone = '13800138001'

// 1. 查找用户
const user = await db.collection('users').where({ phone: testPhone }).get()
if (user.data.length > 0) {
  const userId = user.data[0]._id
  
  // 2. 删除相关记录
  await db.collection('craftsmen').where({ phone: testPhone }).remove()
  await db.collection('dispatchers').where({ phone: testPhone }).remove()
  await db.collection('users').doc(userId).remove()
  await db.collection('adminNotifications').where({ phone: testPhone }).remove()
  
  console.log('清理完成')
}
```

---

## 文档索引

- [ROLE_APPLICATION_TEST_GUIDE.md](ROLE_APPLICATION_TEST_GUIDE.md) - 详细测试流程
- [DATABASE_COLLECTIONS.md](DATABASE_COLLECTIONS.md) - 数据库集合说明
