# 角色申请审批流程测试指南

## 一、测试前准备

### 1. 初始化数据库
在微信开发者工具中执行：
```javascript
// 在控制台运行
wx.cloud.callFunction({
  name: 'initDb',
  data: { checkOnly: false }
})
```

### 2. 部署云函数
右键以下云函数，选择"创建并部署：云端安装依赖"：
- `cloudfunctions/user`
- `cloudfunctions/admin`
- `cloudfunctions/sms`
- `cloudfunctions/initDb`

## 二、完整测试流程

### 测试场景1：新用户注册手艺人

#### 步骤1：进入注册页面
1. 打开小程序，进入登录页
2. 点击"注册新账号" → 选择"注册为手艺人"
3. 填写表单：
   - 姓名：张三
   - 手机号：13800138001（未注册过的号码）
   - 验证码：获取并填写
   - 密码：123456
   - 确认密码：123456
   - 擅长工艺：木工
   - 从业经验：1-3年
   - 所在地区：北京市

#### 步骤2：提交申请
1. 点击"提交注册"
2. 预期结果：显示"申请已提交，请等待管理员审批"
3. 页面跳转到审核中页面 (`pendingApproval`)

#### 步骤3：检查数据库
在云开发控制台检查：
```javascript
// users 集合应该有新记录
db.collection('users').where({ phone: '13800138001' }).get()

// 结果示例：
{
  phone: '13800138001',
  name: '张三',
  password: 'SHA256加密后的密码',
  roles: ['craftsman'],
  currentRole: 'craftsman',
  roleApplications: [{
    role: 'craftsman',
    status: 'pending',
    applyTime: Date,
    applyData: { 表单数据 
  }]
}

// adminNotifications 集合应该有通知
db.collection('adminNotifications').where({ type: 'roleApplication' }).get()
```

---

### 测试场景2：管理员审批手艺人

#### 步骤1：管理员进入后台
1. 使用管理员账号登录（手机号：13810062394）
2. 进入"管理员控制台"

#### 步骤2：查看待审批列表
1. 调用云函数：
```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
})
```

2. 验证返回数据包含：
   - 申请人姓名：张三
   - 手机号：13800138001
   - 角色：craftsman
   - 状态：pending

#### 步骤3：审批通过
```javascript
// 审批通过
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

#### 步骤4：验证审批结果
1. 检查 users 集合：
```javascript
db.collection('users').where({ phone: '13800138001' }).get()
// 验证：roles 包含 'craftsman'
// 验证：roleApplications[0].status 为 'active'
```

2. 检查 craftsmen 集合：
```javascript
db.collection('craftsmen').where({ phone: '13800138001' }).get()
// 应该有新记录，status 为 'active'
```

---

### 测试场景3：同一微信号注册两个账号

#### 步骤1：第一个账号注册
- 手机号：13800138001
- 角色：手艺人
- 等待审批通过

#### 步骤2：第二个账号注册
1. 不退出当前微信
2. 直接进入注册页面
3. 填写新手机号：13800138002
4. 选择角色：派单人
5. 提交注册

#### 步骤3：验证结果
```javascript
// 应该有两个用户记录
db.collection('users').where({ openid: '当前微信openid' }).get()
// 结果应该有两条记录，phone 分别为 13800138001 和 13800138002
```

---

### 测试场景4：老用户添加新角色

#### 步骤1：已有手艺人角色
- 用户A已注册为手艺人
- 手机号：13800138001

#### 步骤2：申请派单人角色
1. 登录后进入角色选择页
2. 选择"注册为派单人"
3. 填写派单人表单（使用同一手机号）
4. 提交

#### 步骤3：验证
```javascript
db.collection('users').where({ phone: '13800138001' }).get()
// 验证：
// - roles 包含 ['craftsman', 'dispatcher']
// - roleApplications 有两条记录
```

---

## 三、常见问题排查

### 问题1：提示"该手机号已注册此角色"
**原因**：该手机号已有此角色
**解决**：使用手机号密码登录

### 问题2：提示"您的申请正在审核中"
**原因**：已提交过申请但未审批
**解决**：等待管理员审批或联系管理员

### 问题3：管理员看不到待审批
**检查**：
1. 确保云函数已部署
2. 检查 adminNotifications 集合是否有数据
3. 检查云函数日志

### 问题4：审批通过后无法登录
**检查**：
1. 检查 users 集合中 roles 字段是否更新
2. 检查 craftsmen/dispatchers 集合是否有记录
3. 检查 roleApplications 状态是否为 'active'

---

## 四、测试检查清单

### 云函数部署状态
- [ ] user 云函数已部署
- [ ] admin 云函数已部署
- [ ] sms 云函数已部署

### 数据库集合检查
- [ ] users 集合存在
- [ ] craftsmen 集合存在
- [ ] dispatchers 集合存在
- [ ] adminNotifications 集合存在
- [ ] verifyCodes 集合存在

### 索引检查
- [ ] users.phone 唯一索引
- [ ] users.openid 索引

### 流程测试
- [ ] 新用户注册 → 待审批
- [ ] 管理员审批 → 通过
- [ ] 用户登录 → 正常使用
- [ ] 老用户添加角色 → 待审批

---

## 五、快速调试命令

### 查看待审批列表
```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'getRoleApplications',
    data: { status: 'pending' }
  }
}).then(res => console.log(res.result.data))
```

### 审批通过
```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'reviewRoleApplication',
    data: {
      applicationId: '用户ID_角色名',
      approved: true
    }
  }
})
```

### 查看用户记录
```javascript
wx.cloud.callFunction({
  name: 'user',
  data: { action: 'getUserInfo' }
}).then(res => console.log(res.result.data))
```
