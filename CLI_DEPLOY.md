# 命令行强制部署 api 云函数

如果云端编辑器无法打开，使用命令行强制更新。

---

## 步骤1：安装 CloudBase CLI

```bash
npm install -g @cloudbase/cli
```

---

## 步骤2：登录腾讯云

```bash
npx tcb login
```

执行后会显示二维码链接，**复制链接到浏览器打开，用微信扫码授权**。

---

## 步骤3：获取环境ID

1. 微信开发者工具 → 点击 **"云开发"**
2. 点击 **"设置"**
3. 找到 **"环境ID"**（类似 `xxx-xxx-xxx` 格式）
4. **复制** 环境ID

---

## 步骤4：部署云函数

### 方式A：直接部署（推荐）

```bash
# 进入云函数目录
cd "C:\Users\xfugm\Desktop\微信小程序派单\cloudfunctions\api"

# 部署（替换 YOUR_ENV_ID 为你的环境ID）
npx tcb fn deploy api -e YOUR_ENV_ID
```

### 方式B：使用配置文件

创建 `cloudfunctions/api/cloudbaserc.json`：

```json
{
  "version": "2.0",
  "functionRoot": "./",
  "functions": [
    {
      "name": "api",
      "timeout": 5,
      "envVariables": {},
      "runtime": "Nodejs12.16",
      "memorySize": 128
    }
  ]
}
```

然后部署：

```bash
cd "C:\Users\xfugm\Desktop\微信小程序派单\cloudfunctions\api"
npx tcb fn deploy -e YOUR_ENV_ID
```

---

## 步骤5：验证部署

部署成功后，在控制台测试：

```javascript
// 测试返回格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', res.result)
  // 期望: { success: true, code: 0, data: {...}, msg: "..." }
})
```

---

## 常见问题

### Q: 提示 "未授权"
执行 `npx tcb login` 重新扫码登录。

### Q: 找不到环境
确认环境ID正确，可以通过以下命令查看：

```bash
npx tcb env list
```

### Q: 部署失败
1. 检查 `index.js` 文件是否存在
2. 检查文件语法是否正确
3. 查看详细错误信息

### Q: 部署成功但测试仍失败
1. 等待1-2分钟（云函数有缓存）
2. 重启微信开发者工具
3. 清除开发者工具缓存

---

## 快速复制命令

以下是完整命令，复制到 PowerShell 执行（记得替换环境ID）：

```powershell
# 安装CLI（如已安装可跳过）
npm install -g @cloudbase/cli

# 登录（会提示扫码）
npx tcb login

# 进入目录并部署
cd "C:\Users\xfugm\Desktop\微信小程序派单\cloudfunctions\api"
npx tcb fn deploy api -e YOUR_ENV_ID_HERE
```

**把 YOUR_ENV_ID_HERE 换成你的真实环境ID！**
