# 角色隔离快速测试指南

## 第一步: 部署代码

### 1. 部署 user 云函数
```
微信开发者工具 → 云开发 → 云函数 → user → 右键 → 上传并部署：云端安装依赖
```

### 2. 确认部署成功
查看云函数日志，确保没有报错

---

## 第二步: 清理测试环境

在小程序控制台执行：

```javascript
// 清理测试账号
const phones = ['13800000001', '13800000002', '13800000003']

for (const phone of phones) {
  const userRes = await db.collection('users').where({ phone }).get()
  if (userRes.data.length > 0) {
    const userId = userRes.data[0]._id
    await db.collection('users').doc(userId).remove()
    console.log(`已删除用户: ${phone}`)
  }
  
  const craftsmanRes = await db.collection('craftsmen').where({ phone }).get()
  if (craftsmanRes.data.length > 0) {
    await db.collection('craftsmen').doc(craftsmanRes.data[0]._id).remove()
    console.log(`已删除工匠: ${phone}`)
  }
  
  const dispatcherRes = await db.collection('dispatchers').where({ phone }).get()
  if (dispatcherRes.data.length > 0) {
    await db.collection('dispatchers').doc(dispatcherRes.data[0]._id).remove()
    console.log(`已删除派单人: ${phone}`)
  }
}

console.log('清理完成')
```

---

## 第三步: 执行核心测试

### 测试 1: 基本注册登录流程 (必做)

**Step 1**: 使用 `13800000001` 注册工匠
- 期望: 显示 "请等待审批"
- 验证: 数据库中 roles 为 []

**Step 2**: 尝试登录
- 期望: 被拦截，显示等待审批页面
- 验证: 不能进入工匠首页

**Step 3**: 管理员通过审批
```javascript
// 在控制台找到用户ID，然后：
await db.collection('users').doc('用户ID').update({
  data: {
    roles: ['craftsman'],
    'roleApplications.0.status': 'active',
    'roleApplications.0.approveTime': db.serverDate()
  }
})
```

**Step 4**: 再次登录
- 期望: 直接进入工匠首页

---

### 测试 2: 角色隔离验证 (核心)

**Step 1**: 使用已通过的账号申请派单人
- 不要审批，保持 pending 状态

**Step 2**: 登录
- 期望: **直接进入工匠首页**，不被等待审批页面拦截
- 这是**角色隔离的核心验证**

---

### 测试 3: 管理员手机号测试 (核心)

**Step 1**: 使用 `13810062394` 注册新账号
- 期望: **需要等待审批**，不会自动通过

**Step 2**: 尝试登录
- 期望: 显示等待审批页面，**不是管理员**

---

## 第四步: 验证数据库状态

检查关键字段是否正确：

```javascript
const phone = '13800000001'  // 替换为测试账号
const userRes = await db.collection('users').where({ phone }).get()

if (userRes.data.length > 0) {
  const user = userRes.data[0]
  console.log('【roles字段】:', user.roles)
  console.log('【roleApplications】:', user.roleApplications)
  console.log('【isAdmin】:', user.isAdmin)
  
  // 验证角色隔离
  const activeRoles = (user.roleApplications || [])
    .filter(a => a.status === 'active')
    .map(a => a.role)
  console.log('【active角色】:', activeRoles)
  console.log('【是否一致】:', 
    activeRoles.every(r => user.roles.includes(r)))
}
```

---

## 常见问题排查

### 问题 1: 登录时还是看到所有角色
**原因**: 云函数未部署成功
**解决**: 重新部署 user 云函数

### 问题 2: 待审批角色也能登录
**原因**: `getValidatedRoles` 函数未正确实现
**解决**: 检查代码中是否使用了 `app.status === 'active'` 筛选

### 问题 3: 管理员手机号仍然自动通过
**原因**: 代码中还有 `isAdminPhone` 逻辑
**解决**: 检查并删除所有 `isAdminPhone` 相关代码

---

## 测试通过标准

以下所有条件必须满足：

- [ ] 新用户注册后 roles 为空数组
- [ ] 待审批状态登录被拦截
- [ ] 审批通过后 roles 包含对应角色
- [ ] 已通过角色不被 pending 角色影响
- [ ] 管理员手机号不会自动通过
- [ ] 管理员手机号不会自动成为管理员

---

## 测试完成后

请填写 `ROLE_ISOLATION_TEST_RESULT.md` 中的测试结果。
