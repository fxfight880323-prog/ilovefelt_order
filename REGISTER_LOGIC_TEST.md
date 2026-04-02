# 注册逻辑测试验证

## 已更新的逻辑

### 1. 已审批用户重新注册
**场景：** 已审批通过的用户再次点击注册
**结果：** 提示 "已审批通过，可直接登录"

### 2. 被拒绝用户重新申请
**场景：** 被拒绝的用户再次提交申请
**结果：** 将状态从 rejected 改为 pending，重新提交申请

### 3. 审核中用户注册
**场景：** 正在审核中的用户再次点击注册
**结果：** 返回错误码 -1002，提示 "您的申请正在审核中"

### 4. 全新用户注册
**场景：** 从未注册过的用户
**结果：** 创建新记录，状态为 pending

---

## 快速验证步骤

### 步骤1：重新部署云函数
```bash
# 在微信开发者工具中
右键 cloudfunctions/api → "创建并部署：云端安装依赖"
```

### 步骤2：测试全新用户注册
```javascript
// 在控制台运行
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '测试用户' + Date.now(),
      phone: '13800' + String(Math.random()).slice(2, 7),
      requestRole: 'craftsman',
      password: '123456',
      specialty: '木工'
    }
  }
}).then(res => console.log('注册结果:', res.result))
```

**预期：** 
```json
{
  "success": true,
  "code": 0,
  "data": null,
  "msg": "注册成功，等待管理员审批"
}
```

### 步骤3：测试重复注册（审核中）
使用同一手机号再次注册：
```javascript
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '测试用户',
      phone: '上一步的手机号',
      requestRole: 'craftsman'
    }
  }
}).then(res => console.log('重复注册结果:', res.result))
```

**预期：**
```json
{
  "success": false,
  "code": -1002,
  "msg": "您的申请正在审核中，请耐心等待"
}
```

### 步骤4：管理员审批（通过）
```javascript
// 获取待审批列表
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'admin', action: 'getPendingRequests' }
}).then(res => {
  const appId = res.result.data[0].id
  // 审批通过
  return wx.cloud.callFunction({
    name: 'api',
    data: {
      module: 'admin',
      action: 'approve',
      data: { applicationId: appId, approved: true }
    }
  })
}).then(res => console.log('审批结果:', res.result))
```

### 步骤5：测试已审批用户再次注册
使用已审批通过的手机号再次注册：
```javascript
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '测试用户',
      phone: '已审批的手机号',
      requestRole: 'craftsman'
    }
  }
}).then(res => console.log('结果:', res.result))
```

**预期：**
```json
{
  "success": true,
  "code": 0,
  "data": {
    "registered": true,
    "approved": true,
    "roles": ["craftsman"]
  },
  "msg": "已审批通过，可直接登录"
}
```

### 步骤6：测试拒绝后重新申请
1. 注册一个新用户
2. 管理员拒绝审批
3. 该用户再次提交申请

**预期：** 重新提交成功，状态变为 pending

---

## 数据库状态验证

### 全新用户注册后
```javascript
db.collection('users').where({ phone: 'xxx' }).get()
```
**应有：**
- `roles: []`
- `roleApplications[0].status: 'pending'`

### 审批通过后
**应有：**
- `roles: ['craftsman']`
- `roleApplications[0].status: 'active'`

### 审批拒绝后
**应有：**
- `roleApplications[0].status: 'rejected'`
- `roleApplications[0].rejectReason: '...'`

### 拒绝后重新申请
**应有：**
- `roleApplications[0].status: 'pending'`
- `roleApplications[0].rejectReason: ''`

---

## 常见问题

### Q1: 注册提示 "该手机号已注册此角色"
**原因：** 手机号已被其他用户使用
**解决：** 使用不同的手机号，或检查是否是换设备登录

### Q2: 被拒绝后无法重新申请
**检查：** 
1. 云函数是否已重新部署
2. 数据库中该用户的roleApplications状态是否为 'rejected'

### Q3: 审批通过后登录仍提示未审批
**检查：**
1. users表中roles数组是否包含对应角色
2. roleApplications中对应角色的status是否为 'active'

---

## 小程序端测试

### 注册流程测试
1. 打开小程序 → 登录页
2. 点击 "注册新账号" → "注册为手艺人"
3. 填写信息，提交
4. **预期：** 提示 "注册成功，等待管理员审批"

### 重复注册测试
1. 不退出，再次点击注册
2. 填写同一手机号
3. **预期：** 提示 "您的申请正在审核中"

### 审批后重新注册测试
1. 管理员审批通过
2. 用户再次点击注册
3. **预期：** 提示 "已审批通过，可直接登录"

### 登录测试
1. 使用注册的手机号登录
2. **预期：** 登录成功，进入首页
