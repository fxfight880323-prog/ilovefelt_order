# 角色隔离修复 - 部署指南

## 修复内容

### 1. 新增辅助函数 `getValidatedRoles`
从 `roleApplications` 数组中筛选出状态为 `active` 的角色，实现真正的角色隔离。

### 2. 修复的函数
- `login` - 微信登录，只返回已通过审批的角色
- `loginByPhone` - 手机号登录，只返回已通过审批的角色
- `getUserInfo` - 获取用户信息，使用角色隔离筛选
- `getUserInfoByPhone` - 通过手机号获取用户信息，使用角色隔离筛选
- `getUserRoles` - 获取用户所有角色，使用角色隔离筛选
- `checkRoleAccess` - 检查角色访问权限，使用角色隔离筛选
- `getRoleApplicationStatus` - 获取角色申请状态，使用角色隔离筛选
- `switchRole` - 切换角色，只允许切换已通过审批的角色
- `checkAdminStatus` - 检查管理员状态，**不再根据手机号自动设置**
- `checkIsAdmin` - 检查是否为管理员，**不再根据手机号自动设置**

### 3. 关键变化：移除管理员手机号特权

**之前的行为**：
- 管理员手机号(13810062394)注册时自动通过审批
- 管理员手机号登录时自动获得管理员权限

**现在的行为**：
- **所有用户（包括管理员手机号）都需要审批**
- **管理员权限必须显式授予**（在数据库中手动设置 `roles: ['admin']` 或通过管理后台授予）
- 管理员手机号可以用来测试非管理员账号，不会自动成为管理员

## 部署步骤

### 方法一：使用微信开发者工具
1. 打开微信开发者工具
2. 点击顶部菜单「云开发」→「云函数」
3. 找到 `user` 函数，右键选择「上传并部署：云端安装依赖」
4. 等待部署完成

### 方法二：使用命令行
```bash
# 安装云开发 CLI
npm install -g @cloudbase/cli

# 登录（需要在浏览器中授权）
tcb login

# 部署云函数
cd cloudfunctions/user
tcb fn deploy -e handicraft-dispatch-5f36b9 --force --yes
```

## 测试验证

### 测试场景 1：已通过工匠，派单人待审批
1. 使用测试账号登录
2. 期望结果：直接进入工匠首页，不被拦截

### 测试场景 2：多角色切换
1. 使用已通过工匠和派单人的账号登录
2. 期望结果：显示角色选择器，可以自由切换

### 测试场景 3：管理员手机号测试
1. 使用管理员手机号(13810062394)注册新账号
2. 期望结果：**需要等待审批**，不会自动通过
3. 登录时也不会自动成为管理员

### 测试场景 4：所有角色都待审批
1. 使用只有待审批角色的账号登录
2. 期望结果：显示「等待审批」页面

## 如何授予管理员权限

由于不再自动根据手机号设置管理员，需要手动授予：

### 方法一：直接修改数据库
```javascript
// 在 users 集合中找到对应用户，添加 admin 到 roles 数组
db.collection('users').doc('用户ID').update({
  data: {
    roles: ['admin'], // 或者在现有角色中添加 'admin'
    isAdmin: true
  }
})
```

### 方法二：通过管理后台
在管理后台的用户管理页面，可以为特定用户授予管理员角色。

## 数据库检查

确保用户数据包含正确的字段结构：
```javascript
{
  "openid": "xxx",
  "phone": "13800138000",
  "roles": ["craftsman"],  // 只包含已通过的角色
  "roleApplications": [
    {
      "role": "craftsman",
      "status": "active",
      "applyTime": "..."
    },
    {
      "role": "dispatcher", 
      "status": "pending",
      "applyTime": "..."
    }
  ]
}
```
