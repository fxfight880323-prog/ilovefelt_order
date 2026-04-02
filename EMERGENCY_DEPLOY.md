# 紧急部署方案 - 云函数无法更新

## 问题确认

**症状：**
- 错误信息仍然显示旧代码的问题
- `adminNotifications` 相关错误（代码中已添加try-catch）
- "审核中" 提示（注册逻辑已修改）

**结论：** 云函数 `api` 部署失败，云端仍是旧代码

---

## 方案A：强制重新部署（推荐）

### 步骤1：删除旧云函数

1. 打开微信开发者工具
2. 点击顶部 **"云开发"** 按钮
3. 点击 **"云函数"**
4. 找到 `api` 函数
5. **删除它**（点击删除按钮）

### 步骤2：重新创建云函数

1. 在云函数页面点击 **"新建云函数"**
2. 函数名输入：`api`
3. 点击确定
4. 等待创建完成

### 步骤3：复制代码

1. 在本地找到 `cloudfunctions/api/index.js`
2. **复制全部代码**
3. 在云开发控制台点击 `api` 函数的 **"编辑代码"**
4. **粘贴代码**
5. 点击 **"保存并安装依赖"**
6. 等待部署完成

### 步骤4：测试

```javascript
// 测试云函数是否更新
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', res.result)
  // 应该看到正常的 success/data/msg 结构
})
```

---

## 方案B：使用微信开发者工具部署

### 步骤1：确认文件已保存

检查 `cloudfunctions/api/index.js` 右上角是否有 **"*"** 标记（未保存）
- 如果有，按 `Ctrl+S` 保存

### 步骤2：强制刷新

1. 关闭微信开发者工具
2. 重新打开
3. 等待项目加载完成
4. **右键** `cloudfunctions/api` 文件夹
5. 点击 **"创建并部署：云端安装依赖"**
6. **盯着控制台**，等待 "部署成功" 信息

### 步骤3：验证

部署后，在云开发控制台查看：
1. 云函数列表中 `api` 的状态
2. 应该显示 "正常"

---

## 方案C：命令行部署（最可靠）

### 步骤1：安装 CLI

```bash
npm install -g @cloudbase/cli
```

### 步骤2：登录

```bash
npx tcb login
```

### 步骤3：部署

```bash
# 进入项目目录
cd "c:\Users\xfugm\Desktop\微信小程序派单"

# 部署云函数（替换 YOUR_ENV_ID 为你的环境ID）
npx tcb fn deploy api -e YOUR_ENV_ID
```

**如何获取环境ID：**
1. 微信开发者工具 → 云开发 → 设置
2. 复制 "环境ID"

---

## 验证部署成功的方法

### 方法1：查看云函数日志

1. 云开发控制台 → 云函数
2. 点击 `api`
3. 查看 "日志" 标签
4. 应该有最新的调用记录

### 方法2：测试特定功能

```javascript
// 测试1：检查返回格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log(JSON.stringify(res.result, null, 2))
})

// 预期输出：
// {
//   "success": true,
//   "code": 0,
//   "data": { "registered": false, "approved": false },
//   "msg": "未注册"
// }
```

### 方法3：检查代码版本

```javascript
// 故意调用不存在的 action
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'xxx' }
}).then(res => {
  console.log(res.result)
}).catch(err => {
  // 查看错误信息
  console.log(err.message)
})
```

如果错误信息中包含 "adminNotifications"，说明仍是旧代码。

---

## 临时绕过方案（仅测试）

如果云函数实在无法部署，可以直接操作数据库：

### 手动创建测试数据

```javascript
const db = wx.cloud.database()

// 1. 创建管理员
db.collection('users').add({
  data: {
    openid: 'admin_' + Date.now(),
    phone: '13810062394',
    name: '管理员',
    roles: ['admin'],
    currentRole: 'admin',
    createTime: new Date()
  }
})

// 2. 创建已审批的手艺人
db.collection('users').add({
  data: {
    openid: 'craftsman_' + Date.now(),
    phone: '13800138001',
    name: '手艺人A',
    roles: ['craftsman'],
    currentRole: 'craftsman',
    createTime: new Date()
  }
})

db.collection('craftsmen').add({
  data: {
    name: '手艺人A',
    phone: '13800138001',
    status: 'active',
    createTime: new Date()
  }
})

// 3. 创建测试订单
db.collection('orders').add({
  data: {
    name: '测试订单',
    status: 'pending',
    createTime: new Date()
  }
})
```

---

## 下一步

**请选择以下任一方案执行：**

- [ ] 方案A：删除并重新创建云函数
- [ ] 方案B：使用微信开发者工具重新部署
- [ ] 方案C：使用命令行部署

执行后告诉我结果，如果还有问题我会提供进一步支持。
