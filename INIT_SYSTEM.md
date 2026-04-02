# 系统初始化指南

## 系统架构

- **超级管理员**：13810062394 / 880323（唯一，负责审批所有角色）
- **其他角色**：手艺人(craftsman)、派单人(dispatcher)

## 快速初始化

### 步骤1：创建数据库集合

在微信开发者工具控制台执行：

```javascript
const db = wx.cloud.database()

// 创建所有必要的集合
const collections = ['users', 'craftsmen', 'dispatchers', 'orders']

collections.forEach(async name => {
  try {
    await db.collection(name).add({
      data: { _init: true, createTime: new Date() }
    })
    const { data } = await db.collection(name).where({ _init: true }).get()
    data.forEach(async d => await db.collection(name).doc(d._id).remove())
    console.log(`✅ ${name} 集合已创建`)
  } catch (e) {
    console.log(`ℹ️ ${name} 已存在`)
  }
})
```

### 步骤2：创建超级管理员

```javascript
const db = wx.cloud.database()

async function createSuperAdmin() {
  // 检查是否已存在
  const { data: existing } = await db.collection('users')
    .where({ phone: '13810062394' })
    .get()
  
  if (existing.length > 0) {
    // 更新为超级管理员
    await db.collection('users').doc(existing[0]._id).update({
      data: {
        password: '880323',
        name: '超级管理员',
        roles: ['admin'],
        currentRole: 'admin',
        isSuperAdmin: true,
        'roleApplications.0.status': 'active'
      }
    })
    console.log('✅ 超级管理员密码已更新: 880323')
  } else {
    // 创建超级管理员
    await db.collection('users').add({
      data: {
        phone: '13810062394',
        password: '880323',
        name: '超级管理员',
        roles: ['admin'],
        currentRole: 'admin',
        isSuperAdmin: true,
        roleApplications: [{
          role: 'admin',
          status: 'active',
          applyTime: new Date()
        }],
        createTime: new Date()
      }
    })
    console.log('✅ 超级管理员创建成功')
    console.log('📱 手机号: 13810062394')
    console.log('🔑 密码: 880323')
  }
}

createSuperAdmin()
```

### 步骤3：部署云函数

1. 右键 `cloudfunctions/api` → "创建并部署：云端安装依赖"
2. 等待部署完成

### 步骤4：设置数据库权限

1. 云开发 → 数据库 → 每个集合
2. 数据权限 → "所有用户可读可写"（开发环境）
3. 生产环境建议设置为"仅创建者可读写"

## 使用流程

### 1. 超级管理员登录
- 打开登录页面
- 输入手机号: 13810062394
- 输入密码: 880323
- 自动跳转到管理后台

### 2. 审批角色申请
- 在管理后台查看"待审批"列表
- 可以看到手艺人和派单人的注册申请
- 点击"通过"或"拒绝"

### 3. 普通用户注册
- 手艺人/派单人注册后需要等待审批
- 审批通过后才能登录

## 测试账号

| 角色 | 手机号 | 密码 | 状态 |
|-----|-------|------|------|
| 超级管理员 | 13810062394 | 880323 | 无需审批 |
| 手艺人 | 自行注册 | - | 需审批 |
| 派单人 | 自行注册 | - | 需审批 |

## 目录结构

```
cloudfunctions/
  └── api/                    # 统一API云函数
      ├── index.js            # 主入口
      └── package.json

pages/
  ├── login/                  # 登录页
  ├── admin/
  │   └── console.js          # 超级管理员后台
  ├── auth/
  │   ├── craftsmanRegister   # 手艺人注册
  │   └── dispatcherAuth      # 派单人注册
  ├── craftsman/              # 手艺人页面
  └── dispatcher/             # 派单人页面

utils/
  └── api.js                  # API封装
```

## API 接口

### 认证模块
- `auth.checkStatus` - 检查登录状态
- `auth.register` - 注册（手艺人/派单人）
- `auth.loginByPhone` - 手机号登录

### 管理员模块（需超级管理员权限）
- `admin.getPendingRequests` - 获取待审批列表
- `admin.approve` - 审批通过/拒绝
- `admin.getStats` - 获取统计数据

### 订单模块
- `order.create` - 创建订单（派单人）
- `order.list` - 订单列表
- `order.accept` - 接单（手艺人）
- `order.cancel` - 取消订单
- `order.complete` - 完成订单

## 推送代码

```bash
git add -A
git commit -m "feat: 超级管理员审批系统 - 13810062394/880323"
git push origin master
```
