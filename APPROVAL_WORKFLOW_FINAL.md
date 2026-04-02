# 审批流程测试指南（最终版）

## 核心逻辑说明

### 注册流程
1. 新用户填写表单提交
2. 创建 users 记录：
   - `roles: []` （空数组，未审批不给角色）
   - `roleApplications: [{role, status: 'pending'}]`
3. 返回状态 `pending`，显示"等待审批"

### 登录流程
1. 用户尝试登录
2. 检查 `roleApplications` 中是否有 `pending` 状态
3. 如果有 `pending`，拦截登录，返回错误码 `-1002`
4. 如果没有 `active` 状态的角色，拦截登录，返回错误码 `-1003`
5. 只有有 `active` 状态的角色才能登录

### 审批流程
1. 管理员调用 `reviewRoleApplication`
2. 如果通过：
   - 更新 `roleApplications[角色].status = 'active'`
   - 添加角色到 `roles` 数组
   - 创建 `craftsmen` 或 `dispatchers` 记录
3. 用户可以正常登录

---

## 部署前准备

### 1. 必须部署的云函数
```
cloudfunctions/user
cloudfunctions/admin
cloudfunctions/sms
```

### 2. 清理测试数据（如果之前有测试过）
在云开发控制台数据库执行：
```javascript
// 删除测试用户
const testPhone = '13800138001'
const user = await db.collection('users').where({ phone: testPhone }).get()
if (user.data.length > 0) {
  await db.collection('users').doc(user.data[0]._id).remove()
}
await db.collection('craftsmen').where({ phone: testPhone }).remove()
await db.collection('dispatchers').where({ phone: testPhone }).remove()
await db.collection('adminNotifications').where({ phone: testPhone }).remove()
```

---

## 步步验证测试

### 步骤1：新用户注册

#### 操作
1. 打开小程序进入登录页
2. 点击"注册新账号" → "注册为手艺人"
3. 填写：
   - 姓名：测试用户
   - 手机号：13800138001（确保未注册过）
   - 验证码：获取并填写
   - 密码：123456
   - 确认密码：123456
   - 擅长工艺：木工
   - 从业经验：1-3年
   - 地区：北京市
4. 点击提交

#### 预期结果
显示弹窗：
```
标题：申请已提交
内容：您的手艺人注册申请已提交，需要管理员审批后才能登录使用。

请耐心等待审批结果。
按钮：知道了
```
点击后跳转到审核中页面。

#### 数据库验证
在云开发控制台检查：
```javascript
const user = await db.collection('users').where({ phone: '13800138001' }).get()
console.log(user.data[0])
```

**必须验证的点：**
- `roles` 字段应该是 `[]` 战空数组
- `roleApplications[0].status` 应该是 `'pending'`
- `roleApplications[0].role` 应该是 `'craftsman'`
- `currentRole` 应该是空字符串 `''`

---

### 步骤2：审批前尝试登录（应被阻止）

#### 操作
1. 退出当前账号（如果有）
2. 在登录页选择"使用手机号密码登录"
3. 输入：
   - 手机号：13800138001
   - 密码：123456
4. 点击"登录"

#### 预期结果
显示弹窗：
```
标题：等待审批
内容：您的手艺人申请正在审核中，请等待管理员审批后再登录
按钮：查看状态 / 知道了
```

点击"查看状态"应跳转到审核中页面。

#### 检查云函数日志
在微信开发者工具云函数日志中查找：
```
[login] 用户登录: { phone: '13800138001', roles: [], roleApps: [...] }
[login] 拦截：有审核中的申请 { role: 'craftsman', status: 'pending' }
```

---

### 步骤3：管理员审批通过

#### 操作
使用管理员账号登录后调用：

1. 获取待审批列表：
```javascript
const res = await wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
})
console.log(res.result.data)
// 找到 phone 为 '13800138001' 的记录，记住 applicationId
```

2. 审批通过：
```javascript
await wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'reviewRoleApplication',
    data: {
      applicationId: '用户ID_craftsman', // 上一步获取的ID
      approved: true
    }
  }
})
```

#### 数据库验证
```javascript
const user = await db.collection('users').where({ phone: '13800138001' }).get()
console.log(user.data[0])

// 必须验证：
// - roleApplications[0].status 为 'active'
// - roles 数组包含 'craftsman'

const craftsman = await db.collection('craftsmen').where({ phone: '13800138001' }).get()
console.log(craftsman.data[0])
// 必须有记录，status 为 'active'
```

---

### 步骤4：审批通过后登录

#### 操作
1. 退出当前账号
2. 使用手机号13800138001和密码123456登录

#### 预期结果
- 登录成功
- 跳转到手艺人首页

#### 检查云函数日志
```
[loginByPhone] 登录成功: { phone: '13800138001', validRoles: ['craftsman'] }
```

---

## 问题排查清单

### 如果注册后直接能登录
检查点：
1. `users` 集合中该用户的 `roles` 字段是否为空数组 `[]`
2. `roleApplications[0].status` 是否为 `'pending'`
3. 云函数日志中是否有 `[login] 拦截：有审核中的申请`

### 如果审批后仍旧不能登录
检查点：
1. `users` 集合中该用户的 `roles` 字段是否包含 `'craftsman'`
2. `roleApplications[0].status` 是否变为 `'active'`
3. 云函数日志中是否有 `[loginByPhone] 登录成功`

### 如果提示"该手机号已注册此角色"
说明该手机号已有此角色，请换一个未注册的手机号测试。

---

## 快速调试命令

### 查看用户当前状态
```javascript
const phone = '13800138001'
const user = await db.collection('users').where({ phone }).get()
if (user.data.length > 0) {
  const u = user.data[0]
  console.log('手机号:', u.phone)
  console.log('roles:', u.roles)
  console.log('currentRole:', u.currentRole)
  console.log('roleApplications:', u.roleApplications)
}
```

### 模拟登录（在控制台）
```javascript
const phone = '13800138001'
const password = '123456'

const res = await wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'loginByPhone',
    data: { phone, password }
  }
})
console.log('登录结果:', res.result)
```
