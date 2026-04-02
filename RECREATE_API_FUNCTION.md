# 重新创建 api 云函数（完整步骤）

云函数已彻底删除，现在需要重新创建。

---

## 方法1：通过微信开发者工具创建（推荐）

### 步骤1：创建本地云函数结构

确保本地有以下文件：

```
cloudfunctions/api/
├── index.js      (主代码文件)
├── package.json  (依赖配置)
└── config.json   (可选配置)
```

### 步骤2：确认 package.json 存在

检查 `cloudfunctions/api/package.json`：

```json
{
  "name": "api",
  "version": "1.0.0",
  "description": "统一API云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

如果没有，创建这个文件。

### 步骤3：右键创建并部署

1. 在微信开发者工具的**文件树**中
2. 找到 `cloudfunctions/api` 文件夹
3. **右键** → 点击 **"创建并部署：云端安装依赖"**
4. 等待控制台显示 "部署成功"

### 步骤4：验证

```javascript
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(r => console.log(r.result))
```

---

## 方法2：通过云开发控制台创建

### 步骤1：控制台创建

1. 微信开发者工具 → **云开发**
2. **云函数** → **新建云函数**
3. 函数名：`api`
4. 点击 **确定**
5. 等待创建完成

### 步骤2：编辑代码

1. 在云函数列表中找到 `api`
2. 点击 **"编辑代码"**
3. **删除**默认生成的代码
4. **复制** `cloudfunctions/api/index.js` 的全部内容
5. **粘贴**到编辑器
6. 点击 **"保存并安装依赖"**

### 步骤3：等待部署

等待显示 "部署成功"，然后测试。

---

## 方法3：命令行创建并部署

### 步骤1：创建云函数

```bash
# 登录
npx tcb login

# 创建云函数（替换 YOUR_ENV_ID）
npx tcb fn create api -e YOUR_ENV_ID
```

### 步骤2：部署代码

```bash
# 进入目录
cd "C:\Users\xfugm\Desktop\微信小程序派单\cloudfunctions\api"

# 部署
npx tcb fn deploy api -e YOUR_ENV_ID
```

---

## 验证部署成功

```javascript
// 测试1：检查返回格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', JSON.stringify(res.result, null, 2))
  
  // ✅ 新代码应该显示:
  // {
  //   "success": true,
  //   "code": 0,
  //   "data": { "registered": false, ... },
  //   "msg": "未注册"
  // }
})
```

---

## 如果所有方法都失败

### 备选：使用云开发控制台的 "新建云函数" + 在线编辑

1. 云开发控制台 → 云函数 → 新建云函数
2. 名称：`api2`（换一个名字）
3. 在线编辑粘贴代码
4. 然后修改客户端代码调用 `api2`

修改 `utils/api.js`：

```javascript
// 第10行左右
const result = await wx.cloud.callFunction({
  name: 'api2',  // 改成 api2
  data: { module, action, ...data }
})
```

---

## 下一步

请尝试 **方法1**（右键创建并部署），这是最简单的方式。

如果成功，运行测试：

```javascript
await CompleteTest.run()
```
