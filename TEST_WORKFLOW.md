# 角色审批流程测试指南

## 测试准备

1. 打开微信开发者工具
2. 确保云开发环境已启动
3. 打开调试器控制台

---

## 步骤 1: 初始化管理员

在控制台输入：

```javascript
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'initAdmin',
    data: { phone: '13810062394', password: '880323' }
  }
}).then(res => {
  console.log('初始化结果:', res.result);
});
```

预期结果：`code: 0`

---

## 步骤 2: 注册新用户（手艺人）

在控制台输入：

```javascript
const testPhone = '138' + Date.now().toString().slice(-8);
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'applyRole',
    data: {
      role: 'craftsman',
      applyData: {
        phone: testPhone,
        name: '测试用户',
        password: '123456',
        specialty: '针淫'
      }
    }
  }
}).then(res => {
  console.log('注册结果:', res.result);
  console.log('测试手机号:', testPhone);
  wx.setStorageSync('testPhone', testPhone);
});
```

预期结果：`code: 0`, `status: 'pending'`

---

## 步骤 3: 验证登录被拦截

在控制台输入：

```javascript
const testPhone = wx.getStorageSync('testPhone');
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'loginByPhone',
    data: { phone: testPhone, password: '123456' }
  }
}).then(res => {
  console.log('登录结果:', res.result);
  // 应该返回错误码 -1002 或 -1003
});
```

预期结果：`code: -1002` 或 `-1003` (登录被拦截)

---

## 步骤 4: 管理员登录

在控制台输入：

```javascript
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'loginByPhone',
    data: { phone: '13810062394', password: '880323' }
  }
}).then(res => {
  console.log('管理员登录:', res.result);
  console.log('是否管理员:', res.result.data?.isAdmin);
});
```

预期结果：`code: 0`, `isAdmin: true`

---

## 步骤 5: 查看待审批列表

在控制台输入：

```javascript
wx.cloud.callFunction({
  name: 'admin',
  data: { 
    action: 'getRoleApplications', 
    data: { status: 'pending' } 
  }
}).then(res => {
  console.log('待审批列表:', res.result);
  const list = res.result.data?.list || [];
  if (list.length > 0) {
    wx.setStorageSync('testAppId', list[0].applicationId);
    console.log('应用ID:', list[0].applicationId);
  }
});
```

预期结果：列表中包含刚刚注册的用户

---

## 步骤 6: 执行审批

在控制台输入：

```javascript
const appId = wx.getStorageSync('testAppId');
wx.cloud.callFunction({
  name: 'admin',
  data: {
    action: 'reviewRoleApplication',
    data: {
      applicationId: appId,
      approved: true
    }
  }
}).then(res => {
  console.log('审批结果:', res.result);
});
```

预期结果：`code: 0`

---

## 步骤 7: 验证审批后可以登录

在控制台输入：

```javascript
const testPhone = wx.getStorageSync('testPhone');
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'loginByPhone',
    data: { phone: testPhone, password: '123456' }
  }
}).then(res => {
  console.log('登录结果:', res.result);
  console.log('角色:', res.result.data?.roles);
});
```

预期结果：`code: 0`, `roles: ['craftsman']`, `openid: 'xxx'`

> 注意：云函数登录不返回token，使用openid作为身份凭证

---

## 通过标准

如果以上所有步骤都通过，说明角色审批流程正常工作！

---

## 常见问题

### Q: 测试数据怎么清理？

在云开发控制台数据库中删除 `users` 集合中的测试记录，或者每次测试都使用不同的手机号。

### Q: 审批失败怎么办？

检查 `applicationId` 格式是否正确（格式: `userId_role`）。

### Q: 登录错误怎么办？

检查手机号和密码是否正确，确认用户已注册。
