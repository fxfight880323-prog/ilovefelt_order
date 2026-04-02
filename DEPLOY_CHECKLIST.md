# 角色系统部署检查清单

## 云函数部署

### user 云函数
- [x] applyRole 接口
- [x] getRoleApplicationStatus 接口
- [x] checkRoleAccess 接口
- [x] switchRole 接口（已修改）

### admin 云函数
- [x] getRoleApplications 接口
- [x] reviewRoleApplication 接口

### craftsman 云函数（可选）
- [x] getPendingList 接口（兼容旧逻辑）

## 页面文件

### 新增页面
- [x] pages/common/pendingApproval.wxml
- [x] pages/common/pendingApproval.js
- [x] pages/common/pendingApproval.wxss

### 修改页面
- [x] pages/auth/roleSelect.js（使用新接口）
- [x] pages/auth/craftsmanRegister.js（使用 applyRole）
- [x] pages/auth/dispatcherAuth.js（使用 applyRole）
- [x] pages/admin/console.js（使用新审批接口）
- [x] pages/admin/console.wxml（使用 role 字段）

## 配置文件

### app.json
- [x] 注册 pendingApproval 页面

## 数据库集合

### 需要创建的集合
- [x] roleApplications（会自动创建）
- [x] users（已存在，需要更新数据结构）
- [x] craftsmen（已存在）
- [x] dispatchers（已存在）

## 部署命令

```bash
# 1. 部署 user 云函数
cd cloudfunctions/user
wxcloud deploy --env <your-env-id>

# 2. 部署 admin 云函数
cd cloudfunctions/admin
wxcloud deploy --env <your-env-id>

# 3. 部署 craftsman 云函数（可选）
cd cloudfunctions/craftsman
wxcloud deploy --env <your-env-id>
```

## 测试验证

### 功能测试
- [ ] 新用户申请手艺人
- [ ] 新用户申请派单人
- [ ] 管理员审批手艺人
- [ ] 管理员审批派单人
- [ ] 审核中状态显示
- [ ] 已通过状态显示
- [ ] 已拒绝状态显示
- [ ] 切换角色检查权限
- [ ] 管理员手机号自动通过

### 边界测试
- [ ] 重复申请同一角色
- [ ] 申请不同角色
- [ ] 拒绝后重新申请
- [ ] 旧数据兼容性

## 回滚方案

如需回滚到旧系统：
1. 恢复 user 云函数的 registerCraftsman 和 verifyDispatcher 接口
2. 恢复前端页面调用旧接口
3. 保留 roleApplications 数据作为备份

## 常见问题

### 1. 数据库权限错误
确保数据库权限设置为：
```json
{
  "read": true,
  "write": true
}
```

### 2. 云函数调用失败
检查云函数是否正确部署：
- 在微信开发者工具中查看云函数列表
- 确认所有函数已部署且版本最新

### 3. 页面跳转失败
检查 app.json 中是否正确注册页面路径

### 4. 数据不同步
审批后检查：
- roleApplications 表状态是否更新
- users 表 roleApplications 是否同步
- users 表 roles 是否正确添加

## 完成标记

- [ ] 所有云函数已部署
- [ ] 所有页面已测试
- [ ] 所有功能正常
- [ ] 准备上线
