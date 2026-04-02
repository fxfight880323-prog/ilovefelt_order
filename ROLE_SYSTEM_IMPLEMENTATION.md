# 用户角色切换与审批系统 - 实现文档

## 系统概述

新系统实现了统一的用户角色管理，支持多角色申请和审批流程：

1. **统一用户表**：所有用户信息存储在 `users` 表
2. **角色申请机制**：用户申请角色后需要管理员审批
3. **切换角色检查**：切换时检查是否有权限
4. **审批管理面板**：管理员可审批所有角色申请

## 数据库设计

### 1. users 表（用户主表）

```javascript
{
  _id: "xxx",
  openid: "xxx",
  phone: "13800138000",
  name: "张三",
  
  // 角色管理
  roles: ["guest"],                 // 已获批的角色列表
  currentRole: "guest",             // 当前角色
  
  // 角色申请记录
  roleApplications: [
    {
      role: "craftsman",            // 申请角色
      status: "pending",            // pending/active/rejected
      applyTime: Date,
      applyData: { ... },           // 申请时填写的信息
      approveTime: Date,
      approveBy: "adminId",
      rejectReason: ""
    }
  ],
  
  isAdmin: false,
  createTime: Date,
  updateTime: Date
}
```

### 2. roleApplications 表（角色申请表）

```javascript
{
  _id: "xxx",
  userId: "xxx",                    // 关联users表
  openid: "xxx",
  phone: "13800138000",
  name: "张三",
  
  role: "craftsman",                // 申请角色
  status: "pending",                // pending/active/rejected
  
  applyData: {                      // 申请信息
    specialty: "编织",
    experience: "5年",
    ...
  },
  
  approveBy: "adminId",
  approveTime: Date,
  rejectReason: "",
  
  applyTime: Date,
  updateTime: Date
}
```

### 3. craftsmen/dispatchers 表（角色详情表）

审批通过后创建，存储角色的详细信息。

## 流程说明

### 用户申请角色流程

```
用户点击申请角色
    ↓
前端调用 applyRole 接口
    ↓
检查 users.roleApplications
    ↓
已有pending？
    → 是：返回"审核中"
    → 否：创建申请记录
    ↓
写入 roleApplications 集合
更新 users.roleApplications
    ↓
如管理员手机号：直接通过
否则：状态设为 pending
    ↓
提示用户等待审核
跳转到 pendingApproval 页面
```

### 管理员审批流程

```
管理员进入控制台
    ↓
调用 getRoleApplications 接口
    ↓
显示待审核列表
    ↓
点击通过/拒绝
    ↓
调用 reviewRoleApplication 接口
    ↓
更新 roleApplications 状态
更新 users.roleApplications
    ↓
如通过：
  - 添加角色到 users.roles
  - 创建 craftsmen/dispatchers 记录
    ↓
用户可切换角色
```

### 切换角色流程

```
用户点击切换角色
    ↓
调用 switchRole 接口
    ↓
检查 users.roles 是否包含目标角色
    ↓
包含？
    → 是：直接切换，返回成功
    → 否：检查 roleApplications
        ↓
        pending？
            → 是：返回"审核中"
        rejected？
            → 是：返回"被拒绝"
        无记录？
            → 返回"未申请"
```

## 接口列表

### 用户接口（user 云函数）

#### applyRole - 申请角色
```javascript
// 请求
{
  action: 'applyRole',
  data: {
    role: 'craftsman',  // 或 'dispatcher'
    applyData: { ... }  // 申请信息
  }
}

// 响应
{
  code: 0,
  message: '申请已提交',
  data: {
    status: 'pending',  // 或 'active'
    role: 'craftsman'
  }
}
```

#### getRoleApplicationStatus - 获取申请状态
```javascript
// 请求
{
  action: 'getRoleApplicationStatus',
  data: { role: 'craftsman' }
}

// 响应
{
  code: 0,
  data: {
    hasRole: false,
    status: 'pending',  // pending/active/rejected/none
    applyTime: Date,
    rejectReason: ''
  }
}
```

#### checkRoleAccess - 检查角色访问权限
```javascript
// 请求
{
  action: 'checkRoleAccess',
  data: { role: 'craftsman' }
}

// 响应
{
  code: 0,
  data: {
    hasAccess: false,
    status: 'pending',
    message: '您的申请正在审核中'
  }
}
```

#### switchRole - 切换角色
```javascript
// 请求
{
  action: 'switchRole',
  data: { role: 'craftsman' }
}

// 响应 - 有权限
{
  code: 0,
  message: '切换成功',
  data: { currentRole: 'craftsman', status: 'active' }
}

// 响应 - 无权限
{
  code: -1,
  message: '您的申请正在审核中',
  data: { status: 'pending', role: 'craftsman' }
}
```

### 管理员接口（admin 云函数）

#### getRoleApplications - 获取角色申请列表
```javascript
// 请求
{
  action: 'getRoleApplications',
  data: { status: 'pending', role: '' }
}

// 响应
{
  code: 0,
  data: [ ...applications ]
}
```

#### reviewRoleApplication - 审批角色申请
```javascript
// 请求
{
  action: 'reviewRoleApplication',
  data: {
    applicationId: 'xxx',
    approved: true,  // 或 false
    reason: ''       // 拒绝原因
  }
}

// 响应
{
  code: 0,
  message: '审批通过',
  data: { status: 'active', role: 'craftsman' }
}
```

## 页面说明

### 1. pendingApproval - 等待审批页面

**路径**：`pages/common/pendingApproval`

**功能**：
- 显示申请状态（审核中/已通过/已拒绝）
- 审核中：显示提示，提供联系管理员入口
- 已通过：显示通过信息，可切换角色
- 已拒绝：显示拒绝原因，可重新申请

**参数**：`?role=craftsman`

### 2. roleSelect - 角色选择页面

**修改**：使用新的 checkRoleAccess 接口检查权限

**逻辑**：
- 有权限 → 直接切换角色
- 审核中 → 跳转到 pendingApproval
- 已拒绝 → 提示可重新申请
- 未申请 → 跳转到注册页面

### 3. craftsmanRegister/dispatcherAuth - 注册页面

**修改**：使用 applyRole 接口提交申请

**流程**：
- 填写信息 → 调用 applyRole
- 直接通过（管理员）→ 跳转首页
- 需要审核 → 跳转 pendingApproval

### 4. admin/console - 管理员控制台

**修改**：使用新的角色申请审批接口

**功能**：
- 显示所有待审批申请
- 按角色筛选（全部/手艺人/派单人）
- 通过/拒绝操作
- 自动创建角色详情记录

## 状态流转

```
                    ┌─────────────┐
                    │   未申请    │
                    └──────┬──────┘
                           │ 申请角色
                           ▼
                    ┌─────────────┐
     ┌─────────────│   pending   │──────────┐
     │              │  (审核中)   │          │
     │              └──────┬──────┘          │
     │                     │                 │
     │ 被拒绝              │ 通过            │
     ▼                     ▼                 │
┌─────────┐          ┌──────────┐          │
│rejected │          │  active  │          │
│(可重申)  │          │(获得角色)│◄─────────┘
└────┬────┘          └──────────┘
     │
     │ 重新申请
     └──────────────►┌─────────────┐
                      │   pending   │
                      └─────────────┘
```

## 部署步骤

```bash
# 1. 部署 user 云函数
cd cloudfunctions/user
wxcloud deploy

# 2. 部署 admin 云函数
cd cloudfunctions/admin
wxcloud deploy

# 3. 部署 craftsman 云函数（可选，如需使用旧接口）
cd cloudfunctions/craftsman
wxcloud deploy
```

## 测试用例

### 1. 普通用户申请手艺人
1. 进入角色选择 → 选择手艺人
2. 填写信息 → 提交申请
3. 跳转到 pendingApproval 页面，显示审核中
4. 管理员通过审批
5. 页面刷新，显示已通过，可切换角色

### 2. 普通用户申请派单人
同上流程

### 3. 管理员直接通过
1. 使用 13810062394 注册
2. 申请角色后立即通过
3. 跳转到首页

### 4. 切换角色检查
1. 已有手艺人角色的用户
2. 点击切换派单人角色
3. 提示未申请，引导注册
4. 申请后显示审核中

### 5. 拒绝后重新申请
1. 申请被管理员拒绝
2. pendingApproval 显示拒绝原因
3. 点击重新申请
4. 清除旧记录，允许重新提交

## 注意事项

1. **数据兼容**：旧数据（无 roleApplications）仍可正常使用
2. **唯一性**：一个手机号只能申请一个角色（旧逻辑保留）
3. **管理员特权**：13810062394 自动通过审批
4. **状态同步**：审批后自动同步 users 和 roleApplications 表

## 后续优化

1. **消息通知**：审批结果通过微信消息通知用户
2. **批量审批**：支持批量通过/拒绝申请
3. **申请历史**：查看所有申请记录
4. **角色禁用**：支持禁用已获批的角色
