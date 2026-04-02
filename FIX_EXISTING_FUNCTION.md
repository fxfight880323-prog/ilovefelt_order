# 编辑现有 api 云函数

云函数其实还存在，直接编辑它即可。

---

## 步骤1：找到 api 函数

1. 微信开发者工具 → **云开发**
2. 点击 **"云函数"**
3. 在列表中应该能看到 `api`
4. 点击 `api` 右侧的 **"编辑代码"** 按钮

如果列表中没有 `api`，点击 **"刷新"** 按钮。

---

## 步骤2：替换代码

### 获取最新代码

打开本地文件 `cloudfunctions/api/index.js`，**全部复制**。

或者执行命令行复制到剪贴板：

```powershell
Get-Content "cloudfunctions/api/index.js" -Raw | Set-Clipboard
```

### 粘贴到云端编辑器

1. 在云端代码编辑器中，**删除所有现有代码**（Ctrl+A → Delete）
2. **粘贴** 新代码（Ctrl+V）
3. 点击 **"保存并安装依赖"**
4. 等待显示 **"部署成功"**

---

## 步骤3：验证更新

部署完成后，立即测试：

```javascript
// 测试1：检查返回格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', JSON.stringify(res.result, null, 2))
  // 应该显示新的返回格式：success/data/msg
})
```

**关键验证点：**
- 返回包含 `success: true` → 新代码生效
- 返回包含 `registered: xxx`（第一层）→ 仍是旧代码

---

## 备选方案：命令行强制更新

如果云端编辑器无法保存，使用命令行：

```bash
# 1. 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 2. 登录（会打开二维码，用微信扫码）
npx tcb login

# 3. 进入项目目录
cd "c:\Users\xfugm\Desktop\微信小程序派单\cloudfunctions\api"

# 4. 部署（替换 YOUR_ENV_ID 为你的环境ID）
npx tcb fn deploy api -e YOUR_ENV_ID
```

**获取环境ID：**
- 微信开发者工具 → 云开发 → 设置 → 环境ID

---

## 如果编辑器打不开

尝试以下方法：

### 方法1：本地右键部署

1. 确保 `cloudfunctions/api/index.js` 文件已保存
2. 在微信开发者工具的文件树中
3. 右键 `cloudfunctions/api` 文件夹
4. 点击 **"创建并部署：云端安装依赖"**
5. 盯着控制台输出，等待完成

### 方法2：重启开发者工具

1. 完全关闭微信开发者工具
2. 重新打开
3. 等待云开发初始化完成
4. 再试编辑或部署

---

## 部署成功标志

```javascript
// 执行此测试
wx.cloud.callFunction({
  name: 'api', 
  data: { module: 'auth', action: 'checkStatus' }
}).then(r => console.log(r.result))

// ✅ 成功输出（新代码）：
// { success: true, code: 0, data: {...}, msg: "..." }

// ❌ 失败输出（旧代码）：
// { registered: false, approved: false }
```

---

## 下一步

确认部署成功后，重新运行完整测试：

```javascript
await CompleteTest.run()
```
