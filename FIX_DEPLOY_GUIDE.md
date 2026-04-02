# 注册问题修复部署指南

## 问题说明

**错误信息**：`您已注册为派单人`

**问题原因**：
云函数检查到用户 openid 已在 dispatchers/craftsmen 表中存在时，直接返回错误，没有考虑不同状态：
- `active` - 确实已通过审核，应该提示已注册
- `pending` - 正在审核中，应该提示审核中
- `rejected` - 被拒绝，应该允许重新注册

## 修复内容

### 1. 派单人注册 (cloudfunctions/user/index.js)
```javascript
// 修复前
if (existRes.data.length > 0) {
  return { code: -1, message: '您已注册为派单人' }
}

// 修复后
if (existRes.data.length > 0) {
  const existingDispatcher = existRes.data[0]
  if (existingDispatcher.status === 'active') {
    return { code: -1, message: '您已通过审核，请勿重复注册' }
  } else if (existingDispatcher.status === 'pending') {
    return { code: -1, message: '您的申请正在审核中，请耐心等待' }
  } else if (existingDispatcher.status === 'rejected') {
    // 删除旧记录，允许重新注册
    await db.collection('dispatchers').doc(existingDispatcher._id).remove()
  }
}
```

### 2. 手艺人注册 (cloudfunctions/user/index.js)
同上逻辑修复

## 部署步骤

```bash
# 部署 user 云函数
cd cloudfunctions/user
wxcloud deploy --env <your-env-id>
```

## 测试验证

### 场景1：已通过用户重新注册
1. 已通过审核的派单人尝试重新注册
2. **预期**：提示"您已通过审核，请勿重复注册"

### 场景2：审核中用户重新注册
1. 正在审核中的派单人尝试重新注册
2. **预期**：提示"您的申请正在审核中，请耐心等待"

### 场景3：被拒绝用户重新注册
1. 被拒绝的派单人尝试重新注册
2. **预期**：允许重新注册，旧记录被删除

### 场景4：新用户正常注册
1. 新用户注册派单人
2. **预期**：正常提交，状态为 pending

## 数据库状态说明

| 状态 | 含义 | 处理方式 |
|------|------|---------|
| active | 已通过审核 | 禁止重复注册 |
| pending | 审核中 | 禁止重复提交，提示等待 |
| rejected | 被拒绝 | 允许重新注册 |
| 无记录 | 新用户 | 正常注册 |

## 相关文件

- `cloudfunctions/user/index.js` - 用户注册逻辑
- `pages/auth/dispatcherAuth.js` - 派单人注册页面
- `pages/auth/craftsmanRegister.js` - 手艺人注册页面
