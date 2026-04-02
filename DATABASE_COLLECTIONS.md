# 数据库集合说明

## 核心集合

### 1. users 用户表
存储所有用户基本信息，以手机号为唯一Key

```javascript
{
  _id: '自动生成',
  openid: '微信openid（可变）',
  phone: '13800138001（唯一索引）',
  name: '张三',
  password: 'SHA256加密后的密码',
  roles: ['craftsman', 'dispatcher'],
  currentRole: 'craftsman',
  roleApplications: [
    {
      role: 'craftsman',
      status: 'active', // pending | active | rejected
      applyTime: Date,
      approveTime: Date,
      approveBy: '管理员openid或system',
      rejectReason: '',
      applyData: { 表单数据 }
    }
  ],
  isAdmin: false,
  createTime: Date,
  updateTime: Date
}
```

**索引：**
- phone: 唯一索引
- openid: 普通索引（可变）
- role: 普通索引

---

### 2. craftsmen 手艺人表
存储审批通过的手艺人详细信息

```javascript
{
  _id: '自动生成',
  userId: '对应users._id',
  openid: '微信openid',
  name: '张三',
  phone: '13800138001',
  wechatId: '微信号',
  specialty: '木工',
  experience: '1-3年',
  address: '北京市',
  idCard: '110101xxxxxxxx',
  starLevel: 3,
  performance: '良好',
  totalOrders: 0,
  completedOrders: 0,
  rating: 5.0,
  reliabilityScore: 5.0,
  reliabilityLevel: '优秀',
  status: 'active', // pending | active | rejected
  avatarUrl: '头傡云存储地址',
  createTime: Date,
  updateTime: Date
}
```

**索引：**
- openid: 唯一索引
- phone: 唯一索引
- status: 普通索引

---

### 3. dispatchers 派单人表
存储审批通过的派单人详细信息

```javascript
{
  _id: '自动生成',
  userId: '对应users._id',
  openid: '微信openid',
  name: '李四',
  phone: '13800138002',
  company: '某公司',
  status: 'active',
  avatarUrl: '头傡云存储地址',
  createTime: Date,
  updateTime: Date
}
```

**索引：**
- openid: 唯一索引
- phone: 唯一索引

---

### 4. orders 订单表
存储订单信息

```javascript
{
  _id: '自动生成',
  orderNo: 'DD202403010001',
  title: '订单标题',
  description: '订单描述',
  styleId: '样式ID',
  styleName: '样式名称',
  requirements: '具体要求',
  deadline: Date,
  budget: 1000,
  dispatcherId: '派单人ID',
  craftsmanId: '手艺人ID（接单后填充）',
  status: 'pending', // pending | accepted | making | shipped | completed | cancelled
  completePhotos: ['完成照片URL'],
  deliveryCode: '取货码',
  rated: false,
  ratingScore: 0,
  createTime: Date,
  updateTime: Date
}
```

---

## 辅助集合

### 5. adminNotifications 管理员通知表
存储待审批通知

```javascript
{
  _id: '自动生成',
  type: 'roleApplication',
  userId: '用户ID',
  phone: '13800138001',
  name: '张三',
  role: 'craftsman',
  status: 'pending',
  read: false,
  createTime: Date
}
```

---

### 6. verifyCodes 验证码表
存储短信验证码

```javascript
{
  _id: '自动生成',
  phone: '13800138001',
  code: '123456',
  type: 'craftsman', // craftsman | dispatcher
  used: false,
  createTime: Date,
  expireTime: Date
}
```

---

### 7. smsLogs 短信日志表
记录短信发送日志

```javascript
{
  _id: '自动生成',
  to: '13800138001',
  content: '短信内容',
  type: 'verifyCode', // verifyCode | adminNotify
  status: 'sent',
  createTime: Date
}
```

---

## 数据流转说明

### 新用户注册流程

```
1. 用户提交注册表单
   ↓
2. 创建 users 记录（roles=[role], roleApplications=[{status:'pending'}]
   ↓
3. 创建 adminNotifications 通知
   ↓
4. 管理员审批通过
   ↓
5. 更新 users（roles 添加角色，roleApplications 状态改为 active）
   ↓
6. 创建 craftsmen/dispatchers 记录
   ↓
7. 用户可以正常登录使用
```

### 老用户添加角色流程

```
1. 用户提交新角色申请
   ↓
2. 更新 users（roleApplications 添加新记录，status='pending'）
   ↓
3. 创建 adminNotifications 通知
   ↓
4. 管理员审批通过
   ↓
5. 更新 users（roles 添加新角色，roleApplications 状态改为 active）
   ↓
6. 创建对应角色详情记录
   ↓
7. 用户可以切换角色
```

## 唯一性约束

| 集合 | 字段 | 约束 |
|------|------|------|
| users | phone | 唯一 |
| craftsmen | phone | 唯一 |
| craftsmen | openid | 唯一 |
| dispatchers | phone | 唯一 |
| dispatchers | openid | 唯一 |

**注意：** users.openid 不设唯一约束，支持同一微信号注册多个账号
