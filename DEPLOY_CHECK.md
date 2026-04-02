# 部署验证清单

## 必须执行的步骤

### 步骤 1: 修复代码已应用
以下文件已修改，请确认文件内容：

1. ✓ `pages/common/pendingApproval.js` - 删除了自动审核通过弹窗
2. ✓ `pages/common/pendingApproval.wxml` - 添加了"返回登录"按钮
3. ✓ `pages/auth/craftsmanRegister.js` - 注册后返回登录页
4. ✓ `pages/auth/dispatcherAuth.js` - 注册后返回登录页

### 步骤 2: 清理缓存
在微信开发者工具中：
1. 点击菜单栏 "工具" → "清理缓存" → "全部清理"
2. 或者按下 Ctrl+Shift+Alt+C（Windows）

### 步骤 3: 重新编译
点击工具栏上的 "编译" 按钮（或按 Ctrl+B）

### 步骤 4: 部署云函数
```
云开发 → 云函数 → user → 右键 → 上传并部署：云端安装依赖
```

## 验证修复是否成功

### 验证 1: 检查 pendingApproval.js
打开 `pages/common/pendingApproval.js`，确认第 69-77 行是：
```javascript
// 如果已通过，显示通知但不自动跳转
if (data.status === 'active' && data.hasRole) {
  wx.showToast({
    title: '您的申请已通过！',
    icon: 'success',
    duration: 2000
  })
}
```

如果你看到的是 `wx.showModal` 弹窗，说明修复未生效。

### 验证 2: 检查注册页面
打开 `pages/auth/craftsmanRegister.js`，确认第 254-257 行是：
```javascript
wx.reLaunch({
  url: '/pages/login/index'
})
```

而不是：
```javascript
wx.redirectTo({
  url: '/pages/common/pendingApproval?role=craftsman'
})
```

## 测试步骤

1. 使用新手机号注册
2. 应该看到："申请已提交..."弹窗
3. 点击"知道了"
4. 应误返回到登录页（不是pendingApproval页面）
5. 尝试登录
6. 应该看到："等待审批"提示

如果仍然看到"审核通过"弹窗，请检查：
- 数据库中该手机号是否已经存在（清理数据）
- 代码是否重新编译
