# 重新创建 api 云函数 - 详细步骤

## 步骤1：新建云函数

1. 在微信开发者工具中，点击左侧 **"云开发"** 按钮
2. 点击 **"云函数"** 标签
3. 点击 **"新建云函数"** 按钮
4. 输入函数名：`api`
5. 点击 **"确定"**
6. 等待创建完成（约10-30秒）

---

## 步骤2：获取代码

打开文件 `cloudfunctions/api/index.js`，**全选并复制所有代码**。

或者使用以下命令复制到剪贴板：

```powershell
Get-Content "cloudfunctions/api/index.js" -Raw | Set-Clipboard
```

---

## 步骤3：粘贴代码到云端

### 方式A：通过云开发控制台

1. 在云函数列表中找到 `api`
2. 点击 **"编辑代码"**
3. 删除默认生成的所有代码
4. **粘贴** 你复制的代码
5. 点击 **"保存并安装依赖"**
6. 等待显示 "部署成功"

### 方式B：通过本地文件（如果自动同步）

1. 检查 `cloudfunctions/api/index.js` 文件存在且代码正确
2. 右键 `cloudfunctions/api` 文件夹
3. 点击 **"创建并部署：云端安装依赖"**

---

## 步骤4：验证部署

部署完成后，在控制台执行测试：

```javascript
// 测试1：检查返回格式是否为新格式
wx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回:', JSON.stringify(res.result, null, 2))
  // 期望看到:
  // {
  //   "success": true,
  //   "code": 0,
  //   "data": { "registered": false, "approved": false },
  //   "msg": "未注册"
  // }
}).catch(err => {
  console.error('错误:', err)
})
```

**如果返回包含 `success`、`data`、`msg` 字段 → 部署成功！**

---

## 常见问题

### Q: 提示 "云函数不存在"
等待1-2分钟后重试，创建需要时间。

### Q: 粘贴代码后无法保存
确保删除原有所有代码后再粘贴，或者先点 "保存" 再点 "保存并安装依赖"。

### Q: 依赖安装失败
点击 "保存并安装依赖" 后等待，如果失败，再点一次。

### Q: 部署成功但测试仍失败
1. 关闭微信开发者工具
2. 重新打开
3. 清除缓存（工具栏 → 详情 → 本地设置 → 清除缓存）
4. 重新测试

---

## 下一步

部署成功后，运行测试：

```javascript
await CompleteTest.run()
```

预期结果：
- 通过：27/27
- 失败：0/27
