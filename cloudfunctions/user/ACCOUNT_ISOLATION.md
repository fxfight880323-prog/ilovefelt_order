# 账号完全隔离设计

## 隔离原则

1. **手机号是唯一标识** - 每个账号由手机号唯一确定
2. **数据查询必须带身份验证** - 所有查询必须通过openid或phone确认身份
3. **不同账号数据完全隔离** - 不可能访问其他账号的数据

## 数据库设计

### users 集合
```javascript
{
  _id: '自动生成',
  openid: 'wx_xxx',           // 微信openid（登录凭证）
  phone: '13800138000',       // 手机号（唯一标识）
  roles: ['craftsman'],       // 角色列表
  roleApplications: [...],    // 角色申请记录
  // 其他字段...
}

// 索引
// - phone: unique
// - openid: unique
```

### craftsmen 集合
```javascript
{
  _id: '自动生成',
  openid: 'wx_xxx',           // 关联用户
  phone: '13800138000',       // 关联手机号（备用）
  name: '张三',
  // 其他字段...
}

// 索引
// - openid: 用于查询
// - phone: 用于备份查询
```

### dispatchers 集合
```javascript
{
  _id: '自动生成',
  openid: 'wx_xxx',           // 关联用户
  phone: '13800138000',       // 关联手机号（备用）
  name: '李四',
  // 其他字段...
}
```

## 云函数安全查询规范

### 正确示例
```javascript
// 获取当前用户openid
const { OPENID } = cloud.getWXContext()

// 只查询当前用户的数据
const userRes = await db.collection('users').where({ openid: OPENID }).get()

// 使用查询到的用户手机号（不传入参数）
const phone = userRes.data[0].phone
const ordersRes = await db.collection('orders').where({ 
  craftsmanPhone: phone  // 使用查询到的phone，不是传入的phone
}).get()
```

### 错误示例
```javascript
// 错误：直接使用传入的phone，可能访问其他账号
const { phone } = event.data  // 危险！
const ordersRes = await db.collection('orders').where({ craftsmanPhone: phone }).get()
```

## 账号隔离验证清单

- [ ] 所有查询都通过openid确认身份
- [ ] 不直接使用传入的phone查询
- [ ] 订单查询通过phone关联，且phone来自查询结果
- [ ] 不同账号的订单完全隔离
- [ ] 不同账号的个人信息完全隔离
