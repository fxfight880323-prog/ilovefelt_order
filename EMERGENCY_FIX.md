# 紧急修复方案 - 云函数部署问题

## 问题诊断

所有测试失败的根本原因：**云函数 `api` 仍然是旧代码！**

证据：
- "缺少必要信息" → 新代码没有这个提示
- "返回格式不正确" → 新代码返回 `success/data/msg`，旧代码不是
- "账号未审批" → 新代码已修复审批逻辑

## 解决方案

### 步骤1：修复数据库权限（必须）

所有集合需要设置为：
```json
{
  "read": true,
  "write": true
}
```

**操作路径：**
1. 微信开发者工具 → 云开发 → 数据库
2. 依次点击每个集合：users、craftsmen、dispatchers、orders
3. 点击 "数据权限" → 选择 "所有用户可读可写"
4. 保存

### 步骤2：强制重新部署云函数

#### 方法A：通过云开发CLI（推荐）

```bash
# 1. 安装 CLI
npm install -g @cloudbase/cli

# 2. 登录（扫码）
npx tcb login

# 3. 进入项目目录
cd "C:\Users\xfugm\Desktop\微信小程序派单"

# 4. 创建云函数（如不存在）
npx tcb fn create api -e YOUR_ENV_ID

# 5. 部署代码
npx tcb fn deploy api -e YOUR_ENV_ID
```

#### 方法B：通过云开发控制台

1. 微信开发者工具 → 云开发 → 云函数
2. 如果 `api` 存在 → 点击 "编辑代码" → 全选删除 → 粘贴新代码 → 保存
3. 如果 `api` 不存在 → 新建云函数 → 名称 `api` → 粘贴代码 → 保存

#### 方法C：本地文件 + 强制上传

创建 `cloudfunctions/api/config.json`：
```json
{
  "permissions": {
    "openapi": []
  }
}
```

确保三个文件都存在：
- `cloudfunctions/api/index.js` （主代码）
- `cloudfunctions/api/package.json` （依赖）
- `cloudfunctions/api/config.json` （配置）

然后右键 `cloudfunctions/api` → "创建并部署：云端安装依赖"

### 步骤3：验证部署成功

部署后立即测试：

```javascript
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', res.result)
  
  // ✅ 新代码应该显示:
  // { success: true, code: 0, data: {...}, msg: "..." }
  
  // ❌ 旧代码显示:
  // { registered: false, approved: false }
})
```

### 步骤4：重新运行测试

```javascript
await FullTest.run()
```

## 快速诊断命令

在控制台执行以下代码，检查云函数版本：

```javascript
// 测试1：检查返回格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(r => {
  const result = r.result
  if (result.success !== undefined && result.data !== undefined) {
    console.log('✅ 云函数已更新到新版本')
  } else {
    console.log('❌ 云函数仍是旧版本')
    console.log('返回结构:', Object.keys(result))
  }
})
```

## 如果所有方法都失败

### 备选方案：修改调用方式

如果 `api` 云函数实在无法更新，创建一个 `api2` 云函数：

1. 云开发控制台 → 云函数 → 新建
2. 名称：`api2`
3. 复制 `cloudfunctions/api/index.js` 代码
4. 保存并部署

然后修改 `utils/api.js` 第15行：
```javascript
const result = await wx.cloud.callFunction({
  name: 'api2',  // 改成 api2
  data: { module, action, ...data }
})
```

## 常见错误及解决

| 错误 | 原因 | 解决 |
|-----|------|------|
| "未找到指定的Function" | 云函数被删除 | 重新创建 |
| "FunctionName已存在" | 创建时重复 | 直接编辑现有函数 |
| "cannot remove document" | 数据库权限 | 设置 read:true, write:true |
| "multiple write errors" | 数组更新语法 | 已修复在新代码中 |
| "缺少必要信息" | 旧代码提示 | 必须部署新代码 |

## 下一步

请执行步骤2中的任意一种部署方法，然后告诉我：
1. 部署是否成功？
2. 运行诊断命令的结果是什么？
