# 用户角色数据库设计

## 核心表结构

### 1. users 表（用户主表）

```javascript
{
  _id: "xxx",
  openid: "xxx",                    // 微信openid
  phone: "13800138000",             // 手机号（唯一）
  name: "张三",                     // 姓名
  avatarUrl: "",                    // 头像
  
  // 角色管理（核心字段）
  roles: ["guest"],                 // 已获批的角色列表
  currentRole: "guest",             // 当前角色
  
  // 角色审批状态
  roleApplications: [               // 角色申请记录
    {
      role: "craftsman",            // 申请角色
      status: "pending",            // pending/active/rejected
      applyTime: Date,
      approveTime: Date,
      approveBy: "adminId",
      rejectReason: ""
    }
  ],
  
  // 管理员标识
  isAdmin: false,
  
  // 时间戳
  createTime: Date,
  updateTime: Date
}
```

### 2. roleApplications 表（角色申请表）- 可选，用于详细记录

```javascript
{
  _id: "xxx",
  userId: "xxx",                    // 用户ID
  openid: "xxx",
  phone: "13800138000",
  name: "张三",
  
  role: "craftsman",                // 申请角色
  status: "pending",                // pending/active/rejected
  
  // 申请信息
  applyData: {
    specialty: "编织",              // 手艺人特有
    experience: "5年",
    company: "",                    // 派单人特有
    ...
  },
  
  // 审批信息
  approveBy: "adminId",
  approveTime: Date,
  rejectReason: "",
  
  applyTime: Date,
  updateTime: Date
}
```

### 3. craftsmen 表（手艺人详情表）

```javascript
{
  _id: "xxx",
  userId: "xxx",                    // 关联users表
  openid: "xxx",
  
  // 基本信息（从users表同步）
  name: "张三",
  phone: "13800138000",
  
  // 手艺人特有信息
  specialty: "编织",
  experience: "5年",
  starLevel: 5,
  
  // 统计
  totalOrders: 0,
  completedOrders: 0,
  
  createTime: Date,
  updateTime: Date
}
```

### 4. dispatchers 表（派单人详情表）

```javascript
{
  _id: "xxx",
  userId: "xxx",                    // 关联users表
  openid: "xxx",
  
  name: "张三",
  phone: "13800138000",
  
  // 派单人特有信息
  company: "XX工作室",
  
  // 统计
  totalOrders: 0,
  
  createTime: Date,
  updateTime: Date
}
```

## 流程设计

### 1. 用户注册/申请角色流程

```
用户申请角色（如手艺人）
    ↓
检查 users.roleApplications
    ↓
已有pending申请？
    → 是：提示"申请正在审核中"
    → 否：创建申请记录
    ↓
写入 roleApplications 表（status: pending）
更新 users.roleApplications
    ↓
提示"申请已提交，等待管理员审批"
```

### 2. 管理员审批流程

```
管理员查看待审批列表
    ↓
点击通过/拒绝
    ↓
更新 roleApplications 状态
    ↓
如通过：
  - 将角色加入 users.roles
  - 创建 craftsmen/dispatchers 记录
    ↓
用户可切换角色
```

### 3. 用户切换角色流程

```
用户点击切换角色
    ↓
检查 users.roles 是否包含目标角色
    ↓
包含？
    → 是：直接切换
    → 否：检查 roleApplications
        ↓
        有pending申请？
            → 是：提示"申请正在审核中"
            → 否：引导申请角色
```

## API设计

### 用户相关

```javascript
// 申请角色
applyRole({ role, applyData })

// 切换角色
switchRole({ role })

// 获取用户角色信息
getUserRoleInfo()

// 检查是否有角色权限
checkRolePermission({ role })
```

### 管理员相关

```javascript
// 获取待审批列表
getPendingApplications()

// 审批角色申请
reviewApplication({ applicationId, approved, reason })

// 获取所有角色申请记录
getApplicationHistory({ userId })
```

## 状态流转

```
                    ┌─────────────┐
                    │   未申请    │
                    └──────┬──────┘
                           │ 申请角色
                           ▼
                    ┌─────────────┐
     被拒绝 ←──────│   pending   │──────→ 通过审批
     (可重新申请)   │  (审核中)   │        (获得角色)
                    └──────┬──────┘
                           │ 拒绝
                           ▼
                    ┌─────────────┐
                    │  rejected   │
                    │  (被拒绝)   │
                    └─────────────┘
```

## 前端页面状态

### 1. 角色选择页面

```
┌─────────────────────────┐
│       选择角色          │
├─────────────────────────┤
│                         │
│  👑 管理员              │
│     [已获批]            │
│                         │
│  👨‍🎨 手艺人            │
│     [审核中...]         │
│                         │
│  📋 派单人              │
│     [点击申请]          │
│                         │
└─────────────────────────┘
```

### 2. 等待审批页面

```
┌─────────────────────────┐
│                         │
│      ⏳ 审核中          │
│                         │
│   您的手艺人申请        │
│   正在审核中...         │
│                         │
│   请耐心等待            │
│   管理员将在1-2个       │
│   工作日内完成审核      │
│                         │
│   [联系管理员]          │
│                         │
└─────────────────────────┘
```

### 3. 被拒绝页面

```
┌─────────────────────────┐
│                         │
│      ❌ 申请被拒绝      │
│                         │
│   原因：信息不完整      │
│                         │
│   [重新申请]            │
│   [联系管理员]          │
│                         │
└─────────────────────────┘
```
