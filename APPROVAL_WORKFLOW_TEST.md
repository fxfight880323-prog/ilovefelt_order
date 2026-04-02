# 审批流程测试指南

## 测试前准备

### 1. 部署云函数
必须部署以下云函数：
- `cloudfunctions/user`
- `cloudfunctions/admin`
- `cloudfunctions/sms`

### 2. 清理测试数据（如果需要）
```javascript
// 在云开发控制台执行
const testPhone = '13800138001'
const user = await db.collection('users').where({ phone: testPhone }).get()
if (user.data.length > 0) {
  await db.collection('users').doc(user.data[0]._id).remove()
  await db.collection('craftsmen').where({ phone: testPhone }).remove()
  await db.collection('adminNotifications').where({ phone: testPhone }).remove()
}
```

---

## 测试场景1：新用户注册

### 步骤1：提交注册
1. 进入小程序登录页
2. 点击"注册新账号" → "注册为手艺人"
3. 填写表单：
   - 姓名：测试用户
   - 手机号：13800138001（未注册过的）
   - 验证码：获取并填写
   - 密码：123456
   - 确认密码：123456
   - 擅长工艺：木工
   - 从业经验：1-3年
   - 所在地区：北京市
4. 点击"提交注册"

### 预期结果
- 显示弹窗："申请已提交"
- 内容："您的手艺人注册申请已提交，需要管理员审批后才能登录使用。请耐心等待审批结果。"
- 点击"知道了"后跳转到审核中页面

### 数据库验证
```javascript
// 查询 users 集合
const user = await db.collection('users').where({ phone: '13800138001' }).get()

// 应该包含：
{
  phone: '13800138001',
  name: '测试用户',
  password: 'SHA256加密后的密码',
  roles: ['craftsman'],
  roleApplications: [{
    role: 'craftsman',
    status: 'pending',  // 关键：状态为 pending
    applyTime: Date,
    applyData: { ... }
  }]
}
```

---

## 测试场景2：审批前尝试登录（应该被阻止）

### 步骤1：尝试登录
1. 退出当前账号（如果有）
2. 在登录页选择"使用手机号密码登录"
3. 输入：
   - 手机号：13800138001
   - 密码：123456
4. 点击"登录"

### 预期结果
- 显示弹窗："等待审批"
- 内容："您的手艺人申请正在审核中，请等待管理员审批后再登录"
- 可选择："查看状态" 或 "知道了"
- 点击"查看状态"跳转到 pendingApproval 页面

---

## 测试场景3：管理员审批

### 步骤1：管理员查看待审列表
使用管理员账号登录后调用：
```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
}).then(res => console.log(res.result.data))
```

### 步骤2：审批通过
```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'reviewRoleApplication',
    data: {
      applicationId: '用户ID_craftsman',
      approved: true
    }
  }
})
```

### 数据库验证
```javascript
// 验证 users 集合
const user = await db.collection('users').where({ phone: '13800138001' }).get()
// roleApplications[0].status 应该为 'active'

// 验证 craftsmen 集合
const craftsman = await db.collection('craftsmen').where({ phone: '13800138001' }).get()
// 应该有记录且 status 为 'active'
```

---

## 测试场景4：审批通过后登录

### 步骤1：使用手机号密码登录
1. 输入手机号：13800138001
2. 输入密码：123456
3. 点击登录

### 预期结果
- 登录成功
- 跳转到手艺人首页

---

## 测试场景5：同一手机号重复注册（应该被阻止）

### 步骤1：尝试重复注册
1. 使用已注册的手机号13800138001
2. 再次进入注册页面
3. 填写表单并提交

### 预期结果
- 显示错误提示："该手机号已注册此角色，请直接登录"

---

## 常见问题

### Q1: 注册后直接进入了首页，没有等待审批
**A**: 检查云函数返回的状态是否为 'pending'，不是 'active'

### Q2: 登录时没有检查审批状态
**A**: 确保登录云函数返回错误码 -1002 或 -1003

### Q3: 审批后仍然无法登录
**A**: 检查 users 集合中 roleApplications 的状态是否已更新为 'active'

---

## 调试命令

### 查看用户状态
```javascript
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'getRoleApplicationStatus',
    data: { role: 'craftsman' }
  }
}).then(res => console.log(res.result))
```

### 模拟登录
```javascript
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'login' }
}).then(res => console.log(res.result))
```
