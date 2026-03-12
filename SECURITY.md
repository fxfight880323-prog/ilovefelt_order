# 安全说明

## ⚠️ 重要提醒

### AppSecret 安全

**您的 AppSecret 是敏感信息，请妥善保管！**

- **不要在代码中硬编码 AppSecret**
- **不要将 AppSecret 提交到 Git 仓库**
- **不要将 AppSecret 分享给他人**

### 当前配置

本项目已配置：
- **AppID**: `wx19302c485b354857` ✓ （已更新到配置文件）
- **AppSecret**: `e50eb591ac000da51efe3ae34b528c48` ⚠️ （需要您手动设置到云函数环境变量）

## 如何安全地使用 AppSecret

### 1. 在云函数环境变量中设置（推荐）

在微信开发者工具中：
1. 点击 "云开发" → "云函数"
2. 选择需要使用 AppSecret 的云函数（如 `getAccessToken`）
3. 点击 "版本与配置"
4. 在 "环境变量" 中添加：
   - 键：`APPSECRET`
   - 值：`e50eb591ac000da51efe3ae34b528c48`
5. 点击 "保存" 并重新部署云函数

### 2. 在代码中使用

```javascript
const APPSECRET = process.env.APPSECRET
```

## 项目中的安全设置

本项目已采取以下安全措施：

1. **创建了 `.gitignore`** - 忽略敏感配置文件
2. **创建了 `cloudfunctions/.env.example`** - 示例环境变量文件
3. **云函数中使用 `process.env`** - 读取环境变量

## 风险提示

如果您的 AppSecret 泄露：
- 他人可以冒充您的小程序调用微信接口
- 可能导致数据泄露或损失
- 建议定期更换 AppSecret

**如怀疑 AppSecret 已泄露，请立即登录微信公众平台重置！**
