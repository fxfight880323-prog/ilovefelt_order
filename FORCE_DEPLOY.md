# 强制部署云函数指南

## 问题确认

**根本原因：** 云函数 `api` 还没有部署到云端，旧代码仍在运行。

**证据：**
- 错误信息仍然显示 `adminNotifications` 相关错误
- 但代码中已经添加了 try-catch

---

## 强制部署步骤

### 方法1：标准部署（推荐）

1. **打开微信开发者工具**

2. **找到云函数**
   - 左侧文件树 → `cloudfunctions` → `api`

3. **右键点击 `api` 文件夹**
   - 确保点击的是文件夹，不是文件

4. **选择 "创建并部署：云端安装依赖"**
   
5. **观察控制台输出**
   - 应该看到类似：
   ```
   [开始部署云函数 api]
   [部署云函数 api] 开始...
   [部署云函数 api] 成功！
   ```

6. **检查部署状态**
   - 点击顶部 "云开发" 按钮
   - 选择 "云函数"
   - 查看 `api` 状态是否为 "正常"

### 方法2：如果方法1失败

**步骤A：删除 node_modules**
1. 在文件资源管理器中打开：`cloudfunctions/api/`
2. 删除 `node_modules` 文件夹（如果存在）

**步骤B：重新部署**
1. 回到微信开发者工具
2. 右键 `cloudfunctions/api`
3. 选择 "创建并部署：云端安装依赖"

### 方法3：命令行部署

如果微信开发者工具部署失败：

```bash
# 打开命令行，进入项目目录
cd "c:\Users\xfugm\Desktop\微信小程序派单"

# 安装 cloudbase-cli（如果未安装）
npm install -g @cloudbase/cli

# 登录
npx tcb login

# 部署云函数（将 YOUR_ENV_ID 替换为你的环境ID）
npx tcb fn deploy api -e YOUR_ENV_ID
```

---

## 验证部署成功

### 方法1：检查云函数状态

```javascript
// 在控制台运行
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('云函数返回:', res.result)
  // 应该看到正常的返回结构
})
```

### 方法2：检查版本

```javascript
// 测试注册功能（使用新手机号）
wx.cloud.callFunction({
  name: 'api',
  data: {
    module: 'auth',
    action: 'register',
    data: {
      name: '测试用户' + Date.now(),
      phone: '13800' + Math.floor(Math.random() * 100000),
      requestRole: 'craftsman',
      specialty: '木工'
    }
  }
}).then(res => {
  // 如果部署成功，应该返回 "注册成功"，而不是 "adminNotifications 不存在"
  console.log('注册结果:', res.result)
})
```

---

## 常见部署问题

### 问题1：部署按钮灰色/不可点击

**解决：**
1. 确保选中的是 `cloudfunctions/api` 文件夹
2. 确保文件已保存（没有未保存的 * 标记）

### 问题2：部署超时

**解决：**
1. 检查网络连接
2. 删除 `node_modules` 后重试

### 问题3：部署成功但代码未更新

**验证：**
```javascript
// 检查代码是否更新
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'xxx', action: 'xxx' }  // 传入不存在的 action
}).catch(err => {
  // 查看错误信息中是否包含 "adminNotifications"
  console.log(err)
})
```

如果错误信息仍然包含 "adminNotifications"，说明代码未更新。

### 问题4：权限错误

**解决：**
1. 确保你是云开发环境的管理员
2. 检查云开发控制台 → 设置 → 成员管理

---

## 快速修复方案（绕过云函数）

如果云函数一直部署失败，可以临时绕过：

### 方案：直接在小程序端调用数据库

但这会破坏架构，不推荐长期使用。

**推荐做法：**
继续尝试部署云函数，直到成功。

---

## 最后的检查清单

部署前：
- [ ] 文件已保存
- [ ] 网络连接正常
- [ ] 已登录云开发

部署中：
- [ ] 右键的是 `api` 文件夹
- [ ] 选择 "创建并部署：云端安装依赖"
- [ ] 等待部署完成

部署后：
- [ ] 控制台显示 "部署成功"
- [ ] 云函数列表显示 `api` 状态为 "正常"
- [ ] 测试注册不再报 "adminNotifications" 错误

---

## 求助

如果以上方法都无法部署成功：

1. 截图微信开发者工具的 "云函数" 页面
2. 截图右键 `api` 文件夹的菜单
3. 截图部署时的控制台输出
4. 提供这些信息以便进一步诊断
