# 修复部署说明

## 问题原因

`roleApplications` 数据库集合不存在，导致写入失败。

## 解决方案

移除了单独的 `roleApplications` 集合写入，改为只使用 `users` 表的 `roleApplications` 字段存储申请信息。

### 修改内容

#### 1. user 云函数
- 移除了 `roleApplications` 集合的写入代码
- 申请信息只保存在 `users.roleApplications` 字段中

#### 2. admin 云函数
- `getRoleApplications`：改为从 `users` 表查询待审批申请
- `reviewRoleApplication`：改为从 `users` 表更新申请状态
- 使用组合 ID（`userId_role`）作为申请记录标识

## 部署命令

```bash
# 部署 user 云函数
cd cloudfunctions/user
wxcloud deploy --env <your-env-id>

# 部署 admin 云函数
cd cloudfunctions/admin
wxcloud deploy --env <your-env-id>
```

## 测试验证

1. 新用户申请手艺人
   - 检查 users 表中是否正确添加 roleApplications 记录

2. 管理员查看待审批列表
   - 应该能正常显示待审批申请

3. 管理员审批
   - 审批后检查 users 表中状态是否更新
   - 检查 roles 数组是否正确添加角色

## 数据结构

### users 表
```javascript
{
  _id: "xxx",
  openid: "xxx",
  phone: "13800138000",
  name: "张三",
  roles: ["guest"],
  roleApplications: [
    {
      role: "craftsman",
      status: "pending",  // pending/active/rejected
      applyTime: Date,
      applyData: { ... },
      approveTime: Date,
      approveBy: "adminId",
      rejectReason: ""
    }
  ]
}
```

### 申请ID格式
```
格式：userId_role
示例：abc123_craftsman
```
