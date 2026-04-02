# 角色隔离功能测试方案

## 测试环境准备

### 1. 清理测试账号
在数据库中删除或重置以下测试账号：
- 测试手机号A: `13800000001` (用于工匠测试)
- 测试手机号B: `13800000002` (用于派单人测试)
- 测试手机号C: `13800000003` (用于多角色测试)

### 2. 确保云函数已部署
部署 `user` 和 `admin` 云函数

---

## 测试场景 1: 纯新用户注册流程

### 步骤 1.1: 新用户注册工匠
**操作**: 使用手机号 `13800000001` 注册工匠

**预期结果**: 
- 注册成功
- 显示"申请已提交，请等待管理员审批"
- 数据库状态:
  ```javascript
  {
    phone: '13800000001',
    roles: [], // 空数组！
    roleApplications: [{
      role: 'craftsman',
      status: 'pending'
    }]
  }
  ```

### 步骤 1.2: 待审批状态登录
**操作**: 使用 `13800000001` 登录

**预期结果**:
- 显示"等待审批"页面
- **不能进入工匠首页**
- 返回数据: `roles: []` (空数组)

### 步骤 1.3: 管理员审批通过
**操作**: 在管理后台审批通过该工匠申请

**预期结果**:
- 审批成功
- 数据库状态:
  ```javascript
  {
    roles: ['craftsman'], // 现在有了！
    roleApplications: [{
      role: 'craftsman',
      status: 'active' // 变成 active
    }]
  }
  ```

### 步骤 1.4: 审批通过后登录
**操作**: 再次使用 `13800000001` 登录

**预期结果**:
- **直接进入工匠首页**
- 返回数据: `roles: ['craftsman']`

---

## 测试场景 2: 角色隔离 - 已通过工匠 + 待审批派单人

### 步骤 2.1: 已通过的工匠申请派单人
**前提**: 用户已有已通过工匠角色

**操作**: 使用同一账号申请派单人

**预期结果**:
- 申请提交成功
- 数据库状态:
  ```javascript
  {
    roles: ['craftsman'], // 只有工匠，没有派单人！
    roleApplications: [
      { role: 'craftsman', status: 'active' },
      { role: 'dispatcher', status: 'pending' } // 待审批
    ]
  }
  ```

### 步骤 2.2: 登录测试
**操作**: 登录账号

**预期结果**:
- **直接进入工匠首页** (不显示等待审批页面)
- 返回数据:
  ```javascript
  {
    roles: ['craftsman'], // 只有已通过的
    pendingRoles: [{ role: 'dispatcher', status: 'pending' }] // 待审批的单独列出
  }
  ```

### 步骤 2.3: 尝试切换角色
**操作**: 在设置中尝试切换到派单人

**预期结果**:
- 派单人显示"审核中"状态
- **不能切换到派单人**
- 只能切换到工匠

---

## 测试场景 3: 多角色通过，自由切换

### 步骤 3.1: 审批通过派单人
**操作**: 管理员审批通过派单人申请

**预期结果**:
- 数据库状态:
  ```javascript
  {
    roles: ['craftsman', 'dispatcher'], // 两个都有了！
    roleApplications: [
      { role: 'craftsman', status: 'active' },
      { role: 'dispatcher', status: 'active' }
    ]
  }
  ```

### 步骤 3.2: 登录选择角色
**操作**: 重新登录

**预期结果**:
- 显示角色选择器: "手艺人" / "派单人"
- 可以选择任一角色进入

### 步骤 3.3: 角色切换
**操作**: 在设置中切换角色

**预期结果**:
- 可以从工匠切换到派单人
- 可以从派单人切换到工匠
- 切换后跳转到对应首页

---

## 测试场景 4: 管理员手机号不再自动特权

### 步骤 4.1: 使用管理员手机号注册
**操作**: 使用 `13810062394` (管理员手机号) 注册新账号

**预期结果**:
- 显示"申请已提交，请等待管理员审批"
- **不会自动通过！**
- 数据库状态:
  ```javascript
  {
    phone: '13810062394',
    roles: [], // 空数组，不会自动有 admin
    isAdmin: false,
    roleApplications: [{
      role: 'craftsman', // 或 dispatcher
      status: 'pending'  // pending，不是 active
    }]
  }
  ```

### 步骤 4.2: 登录测试
**操作**: 使用 `13810062394` 登录

**预期结果**:
- 显示"等待审批"页面
- **不能自动登录**
- **不会成为管理员**

---

## 测试场景 5: 显式授予管理员权限

### 步骤 5.1: 手动设置管理员
**操作**: 在数据库中为用户添加 admin 角色

```javascript
db.collection('users').doc('用户ID').update({
  data: {
    roles: ['craftsman', 'admin'],
    isAdmin: true,
    roleApplications: [
      { role: 'craftsman', status: 'active' },
      { role: 'admin', status: 'active' }
    ]
  }
})
```

### 步骤 5.2: 登录验证
**操作**: 该用户登录

**预期结果**:
- 角色列表包含 `admin`
- 可以进入管理后台
- `isAdmin: true`

---

## 测试检查清单

| 测试项 | 预期结果 | 实际结果 | 通过 |
|--------|----------|----------|------|
| 新用户注册 | roles为空，status=pending | | |
| 待审批登录 | 显示等待审批页面 | | |
| 审批通过后 | roles包含角色，能登录 | | |
| 已通过+待审批 | 能登录已通过角色 | | |
| 不能切换待审批角色 | 切换被拒绝 | | |
| 多角色通过 | 显示选择器，能切换 | | |
| 管理员手机号注册 | 需要审批，不自动通过 | | |
| 管理员手机号登录 | 不自动成为管理员 | | |
| 显式授予admin | 能成为管理员 | | |

---

## 数据库查询命令

### 查看用户角色状态
```javascript
// 在小程序控制台或云函数中查询
const user = await db.collection('users').where({ phone: '13800000001' }).get()
console.log('用户角色:', user.data[0].roles)
console.log('申请记录:', user.data[0].roleApplications)
```

### 手动批准角色
```javascript
// 批准工匠申请
await db.collection('users').doc('用户ID').update({
  data: {
    roles: ['craftsman'],
    'roleApplications.0.status': 'active',
    'roleApplications.0.approveTime': db.serverDate()
  }
})
```

---

## 调试日志

在登录时查看云函数日志：
```
[login] 用户登录: { phone: '13800000001', roleApps: [...] }
[login] 已通过的角色: ['craftsman']
[login] 登录成功: { phone: '13800000001', validRoles: ['craftsman'], pendingCount: 1 }
```
