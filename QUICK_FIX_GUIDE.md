# 常见问题快速修复

## 当前问题汇总

### 问题1: adminNotifications 集合不存在
**错误信息：** `collection.add:fail -502005 database collection not exists`

**解决方案：**
1. 在云开发控制台手动创建集合
2. 或者运行修复脚本自动创建

### 问题2: 注册提示"正在审核中"
**原因：** 之前测试留下的数据，或者注册逻辑判断问题

**解决方案：**
1. 清理旧数据
2. 重新部署云函数

### 问题3: 管理员权限判断失败
**原因：** 管理员账号未正确创建

**解决方案：**
运行修复脚本创建管理员

---

## 快速修复步骤

### 第一步：在云开发控制台创建集合（2分钟）

1. 打开微信开发者工具
2. 点击 "云开发" 按钮
3. 进入 "数据库"
4. 点击 "添加集合"
5. 依次创建以下集合：
   - `users`
   - `craftsmen`
   - `dispatchers`
   - `orders`
   - `adminNotifications`

### 第二步：设置数据库权限（1分钟）

对每个集合：
1. 点击集合名称
2. 点击 "权限设置"
3. 选择 "所有用户可读可写"
4. 点击 "确定"

### 第三步：运行修复脚本（1分钟）

在微信开发者工具控制台：

```javascript
// 复制 test/fix-database.js 内容到控制台
// 然后运行：
await DBFix.fixAll()
```

**预期输出：**
```
========== 开始修复数据库 ==========

--- 检查集合 ---
✅ users 集合存在
✅ craftsmen 集合存在
✅ dispatchers 集合存在
✅ orders 集合存在
✅ adminNotifications 集合存在

--- 检查管理员账号 ---
✅ 管理员账号正常

--- 当前数据概览 ---
users: 1 条记录
craftsmen: 0 条记录
dispatchers: 0 条记录
orders: 0 条记录

用户列表:
  - 系统管理员 (13810062394): roles=[admin], pending=0

✅ 数据库修复完成
```

### 第四步：重新部署云函数（1分钟）

1. 右键 `cloudfunctions/api`
2. 选择 "创建并部署：云端安装依赖"
3. 等待部署完成

### 第五步：清理测试数据并重新初始化

```javascript
// 清理旧数据
await DBFix.cleanTestData()

// 重新初始化测试数据
await TestDataInit.init()
```

### 第六步：运行自动化测试

```javascript
await SYSTEM_TEST.runAll()
```

---

## 如果还有问题

### 问题：注册仍提示"正在审核中"

**检查方法：**
```javascript
// 查看该手机号的用户数据
wx.cloud.database().collection('users')
  .where({ phone: '13800138001' })
  .get()
  .then(res => console.log(res.data))
```

**手动清理：**
```javascript
// 删除特定手机号的用户
const phone = '13800138001'
wx.cloud.database().collection('users')
  .where({ phone })
  .get()
  .then(res => {
    res.data.forEach(u => {
      wx.cloud.database().collection('users').doc(u._id).remove()
    })
  })
```

### 问题：云函数部署失败

**解决：**
1. 检查 `cloudfunctions/api/package.json` 是否存在
2. 检查内容是否正确
3. 尝试删除 `cloudfunctions/api/node_modules` 后重新部署

### 问题：登录提示无权限

**解决：**
```javascript
// 手动创建管理员
wx.cloud.database().collection('users').add({
  data: {
    openid: 'admin_' + Date.now(),
    phone: '13810062394',
    name: '系统管理员',
    roles: ['admin'],
    currentRole: 'admin',
    createTime: new Date()
  }
})
```

---

## 验证修复成功

运行以下命令验证：

```javascript
// 1. 检查数据库
await DBFix.listCollections()

// 2. 检查注册
const res = await wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '测试用户',
      phone: '13800999999',
      requestRole: 'craftsman',
      password: '123456',
      specialty: '木工'
    }
  }
})
console.log('注册结果:', res.result)

// 3. 检查登录
const loginRes = await wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'loginByPhone',
    data: {
      phone: '13810062394',
      password: '123456'
    }
  }
})
console.log('登录结果:', loginRes.result)
```

---

## 联系支持

如果以上步骤都无法解决问题：
1. 截图错误信息
2. 提供控制台输出
3. 说明已尝试的步骤
