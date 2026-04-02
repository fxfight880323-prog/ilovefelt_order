# 云函数部署和数据清理指南

## 问题原因

1. **云函数没有重新部署** - 修改后的代码没有上传到云端
2. **测试数据残留** - 之前测试留下的 pending 状态数据

## 解决方案

### 第一步：手动清理测试数据（1分钟）

在微信开发者工具控制台运行：

```javascript
// 清理所有测试用户数据
const db = wx.cloud.database()
const testPhones = ['13800138001', '13800138002', '13800138003']

for (const phone of testPhones) {
  // 清理 users
  db.collection('users').where({ phone }).get().then(res => {
    res.data.forEach(u => {
      db.collection('users').doc(u._id).remove()
      console.log('删除 user:', u._id)
    })
  })
  
  // 清理 craftsmen
  db.collection('craftsmen').where({ phone }).get().then(res => {
    res.data.forEach(c => {
      db.collection('craftsmen').doc(c._id).remove()
      console.log('删除 craftsman:', c._id)
    })
  })
  
  // 清理 dispatchers
  db.collection('dispatchers').where({ phone }).get().then(res => {
    res.data.forEach(d => {
      db.collection('dispatchers').doc(d._id).remove()
      console.log('删除 dispatcher:', d._id)
    })
  })
  
  // 清理 adminNotifications
  db.collection('adminNotifications').where({ phone }).get().then(res => {
    res.data.forEach(n => {
      db.collection('adminNotifications').doc(n._id).remove()
      console.log('删除 notification:', n._id)
    })
  })
}

console.log('清理命令已发送')
```

### 第二步：重新部署云函数（关键步骤）

**方法1：右键部署（推荐）**
1. 在微信开发者工具左侧文件树中找到 `cloudfunctions/api`
2. **右键** `cloudfunctions/api`
3. 选择 **"创建并部署：云端安装依赖"**
4. 等待部署完成（约30秒）
5. 查看控制台输出，确保没有错误

**方法2：命令行部署（备用）**
```bash
# 在项目目录下运行
npx cloudbase functions:deploy api --env 你的环境ID
```

**验证部署成功：**
```javascript
// 测试云函数是否更新
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('云函数返回:', res.result)
  // 应该返回 { success: true/false, ... }
})
```

### 第三步：初始化测试数据

数据清理完成后，运行：

```javascript
await TestDataInit.init()
```

### 第四步：测试验证

```javascript
await SYSTEM_TEST.runAll()
```

---

## 常见问题诊断

### Q1: 如何确认云函数已更新？

**检查方法：**
```javascript
// 查看云函数代码版本
wx.cloud.callFunction({
  name: 'api',
  data: { 
    module: 'auth', 
    action: 'register',
    data: { name: '测试', phone: '13800000001', requestRole: 'craftsman' }
  }
}).then(res => {
  // 如果返回 "注册成功" 而不是报错，说明代码已更新
  console.log(res.result)
})
```

### Q2: 部署后还是有错误？

**可能原因：**
1. 部署失败（查看控制台红色错误信息）
2. 缓存问题（重启微信开发者工具）
3. 数据库权限问题（检查集合权限）

**解决步骤：**
1. 关闭微信开发者工具
2. 重新打开项目
3. 再次部署云函数
4. 清除缓存：工具栏 → 详情 → 本地设置 → 清除缓存

### Q3: "正在审核中" 错误一直出现？

**原因：** 之前测试的数据残留

**解决：**
```javascript
// 强制清理所有测试数据
const db = wx.cloud.database()

// 清理所有非管理员用户
db.collection('users').get().then(res => {
  res.data.forEach(u => {
    if (!u.roles || !u.roles.includes('admin')) {
      db.collection('users').doc(u._id).remove()
    }
  })
})

// 清理所有 craftsmen
db.collection('craftsmen').get().then(res => {
  res.data.forEach(c => db.collection('craftsmen').doc(c._id).remove())
})

// 清理所有 dispatchers
db.collection('dispatchers').get().then(res => {
  res.data.forEach(d => db.collection('dispatchers').doc(d._id).remove())
})

// 清理所有 adminNotifications
db.collection('adminNotifications').get().then(res => {
  res.data.forEach(n => db.collection('adminNotifications').doc(n._id).remove())
})
```

---

## 正确的部署状态检查

### 检查1：云函数状态
在微信开发者工具：
1. 点击 "云开发" → "云函数"
2. 查看 `api` 函数的状态
3. 确认状态为 "正常"

### 检查2：数据库权限
1. 点击 "云开发" → "数据库"
2. 检查每个集合的权限
3. 确保为 "所有用户可读可写"

### 检查3：测试运行
```javascript
// 完整的测试流程
console.log('=== 开始测试 ===')

// 1. 清理数据
await DBFix.cleanTestData()

// 2. 初始化数据
await TestDataInit.init()

// 3. 运行测试
await SYSTEM_TEST.runAll()

console.log('=== 测试完成 ===')
```

---

## 最简验证流程

如果上述步骤太复杂，可以直接测试核心功能：

```javascript
// 第1步：确认管理员存在
db.collection('users').where({ phone: '13810062394' }).get()

// 第2步：注册新用户（使用新手机号）
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '新手艺人',
      phone: '13800999999',  // 新手机号
      requestRole: 'craftsman',
      password: '123456',
      specialty: '木工'
    }
  }
}).then(res => console.log('注册:', res.result))

// 第3步：管理员审批（手动在控制台操作）

// 第4步：登录测试
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'loginByPhone',
    data: { phone: '13800999999', password: '123456' }
  }
}).then(res => console.log('登录:', res.result))
```

---

## 关键检查点

- [ ] 云函数 `api` 已重新部署
- [ ] 数据库集合权限为 "所有用户可读可写"
- [ ] 旧的测试数据已清理
- [ ] 测试数据已初始化
- [ ] 自动化测试通过

**如果还有问题，请截图以下信息：**
1. 云函数部署后的控制台输出
2. 数据库 `users` 集合的内容
3. 测试运行的完整错误信息
