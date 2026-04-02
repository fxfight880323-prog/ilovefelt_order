# 手工艺人派单接单小程序

一个基于微信小程序云开发的手工艺人派单接单系统，支持超级管理员审批、派单人发布订单、手艺人接单功能。

## 功能特性

### 超级管理员端
- 🔐 **账号密码登录**: 手机号 13810062394 / 密码 880323
- ✅ **角色审批**: 审批手艺人和派单人的注册申请
- 📊 **数据统计**: 查看用户统计、订单统计、待审批数量
- 📋 **用户管理**: 查看所有注册用户和角色状态

### 派单人端
- 📝 **发布订单**: 创建派单订单，设置样式、数量、价格、交期
- 📦 **订单管理**: 查看自己发布的订单状态
- 👥 **手艺人管理**: 查看手艺人信息和接单情况

### 手艺人端
- 🏪 **接单大厅**: 浏览可接订单，抢单接单
- 📦 **我的订单**: 查看已接订单，完成订单
- 👤 **个人中心**: 查看个人信息和接单统计

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     超级管理员                               │
│              13810062394 / 880323                           │
│                      │                                      │
│           ┌─────────┴─────────┐                             │
│           ▼                   ▼                             │
│      ┌─────────┐        ┌─────────┐                         │
│      │ 手艺人  │        │ 派单人  │                         │
│      └─────────┘        └─────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

- 微信小程序原生开发
- 微信云开发（云数据库 + 云函数）
- 统一API云函数架构

## 项目结构

```
├── app.js / app.json / app.wxss    # 小程序入口
├── pages/
│   ├── login/                      # 登录页（支持超级管理员登录）
│   ├── admin/
│   │   └── console.js              # 超级管理员后台
│   ├── auth/
│   │   ├── craftsmanRegister       # 手艺人注册
│   │   └── dispatcherAuth          # 派单人注册
│   ├── craftsman/                  # 手艺人页面
│   └── dispatcher/                 # 派单人页面
├── cloudfunctions/
│   └── api/index.js                # 统一API云函数（全部接口）
├── utils/api.js                    # API封装
└── test/                           # 测试脚本
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/fxfight880323-prog/ilovefelt_order.git
cd ilovefelt_order
```

### 2. 导入项目

1. 打开微信开发者工具
2. 选择 "导入项目"
3. 选择项目目录，填写自己的 AppID
4. 点击 "确定"

### 3. 初始化数据库

在微信开发者工具控制台执行：

```javascript
const db = wx.cloud.database()
const collections = ['users', 'craftsmen', 'dispatchers', 'orders']

// 创建集合
collections.forEach(async name => {
  try {
    await db.collection(name).add({ data: { _init: true, t: new Date() } })
    const d = await db.collection(name).where({ _init: true }).get()
    d.data.forEach(async i => await db.collection(name).doc(i._id).remove())
    console.log('✅', name)
  } catch (e) {
    console.log('ℹ️', name, '已存在')
  }
})
```

### 4. 创建超级管理员

在控制台执行：

```javascript
const db = wx.cloud.database()

db.collection('users').add({
  data: {
    phone: '13810062394',
    password: '880323',
    name: '超级管理员',
    roles: ['admin'],
    currentRole: 'admin',
    isSuperAdmin: true,
    roleApplications: [{ role: 'admin', status: 'active' }],
    createTime: new Date()
  }
}).then(() => console.log('✅ 超级管理员创建成功'))
```

### 5. 部署云函数

1. 右键 `cloudfunctions/api` → "创建并部署：云端安装依赖"
2. 等待部署完成

### 6. 设置数据库权限

云开发 → 数据库 → 每个集合 → 数据权限 → "所有用户可读可写"（开发环境）

## 使用说明

### 超级管理员登录

1. 打开小程序登录页
2. 点击 "账号密码登录"
3. 输入手机号：`13810062394`
4. 输入密码：`880323`
5. 点击 "登录"
6. 自动跳转到管理后台

### 审批流程

1. **手艺人/派单人注册** → 填写信息提交申请
2. **超级管理员审批** → 在"待审批"列表查看申请
3. **点击通过/拒绝** → 完成审批
4. **用户登录** → 审批通过后可正常使用

### 派单流程

1. **派单人** → 发布订单
2. **手艺人** → 接单大厅抢单
3. **手艺人** → 完成订单制作
4. **派单人** → 确认订单完成

## 测试账号

| 角色 | 手机号 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | 13810062394 | 880323 | 无需审批，直接登录 |
| 手艺人 | 自行注册 | - | 需审批 |
| 派单人 | 自行注册 | - | 需审批 |

## API 接口

### 认证模块
- `auth.checkStatus` - 检查登录状态
- `auth.register` - 注册（手艺人/派单人）
- `auth.loginByPhone` - 手机号登录（支持超级管理员）

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

## 测试脚本

```javascript
// 测试超级管理员登录
await testAdminLogin()

// 测试审批功能
await testAdminPermission()
```

## 注意事项

1. 超级管理员账号 13810062394 / 880323 是唯一的
2. 所有手艺人和派单人都需要超级管理员审批
3. 云函数部署后可能需要等待1-2分钟生效
4. 生产环境建议修改数据库权限为"仅创建者可读写"

## 后续优化方向

- [ ] 订单图片上传功能
- [ ] 订单评价功能
- [ ] 收入结算统计
- [ ] 消息通知功能
- [ ] 数据导出功能

## License

MIT
