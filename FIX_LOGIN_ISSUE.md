# 修复登录页面问题

## 问题

未注册的用户停留在登录页面，没有显示登录/注册按钮。

## 原因

1. 云函数 `checkStatus` 返回格式不正确，或
2. 登录页面的错误处理逻辑有问题

## 修复步骤

### 第1步：确认云函数已部署

**必须执行：**
1. 右键 `cloudfunctions/api` 
2. 选择 "创建并部署：云端安装依赖"
3. 等待部署完成

### 第2步：测试 checkStatus 接口

在控制台运行：

```javascript
// 测试未注册用户
dx.cloud.callFunction({
  name: 'api',
  data: { module: 'auth', action: 'checkStatus' }
}).then(res => {
  console.log('返回结果:', res.result)
  // 预期: { success: true, code: 0, data: { registered: false, approved: false }, msg: '未注册' }
}).catch(err => {
  console.error('错误:', err)
})
```

**如果返回格式不正确，说明云函数没有部署成功。**

### 第3步：修复登录页面

登录页面代码已更新。关键修改：

```javascript
// 原来的代码没有处理错误情况
try {
  checkRes = await API.auth.checkStatus()
} catch (err) {
  // 用户不存在，显示登录按钮
  console.log('用户未注册:', err)
  this.showLoginButtons()
  return
}
```

### 第4步：强制刷新缓存

如果修改后仍有问题：

1. **清除微信开发者工具缓存**
   - 工具栏 → 详情 → 本地设置 → 清除缓存

2. **重启微信开发者工具**

3. **重新编译**
   - 点击 "编译" 按钮

### 第5步：验证修复

打开小程序，观察：

- **未注册用户：** 应该显示 "微信一键登录" 和 "手机号登录" 按钮
- **已注册用户：** 自动跳转到首页
- **未审批用户：** 显示 "等待审批" 提示

---

## 调试方法

如果还有问题，在控制台查看日志：

```javascript
// 开启详细日志
console.log('登录页 onLoad')

// 检查每个步骤
Page({
  async onLoad() {
    console.log('1. 页面加载')
    
    // 检查缓存
    const cachedRole = wx.getStorageSync('userRole')
    console.log('2. 缓存角色:', cachedRole)
    
    // 调用API
    try {
      const res = await API.auth.checkStatus()
      console.log('3. API返回:', res)
    } catch (err) {
      console.log('3. API错误:', err)
    }
  }
})
```

查看控制台输出，定位问题所在步骤。

---

## 预期行为

| 用户状态 | 页面显示 |
|---------|---------|
| 未注册 | 显示登录/注册按钮 |
| 已注册未审批 | 显示 "等待审批" 弹窗 |
| 已注册已审批 | 自动跳转首页 |

---

## 快速验证

修复后，用这个账号测试：

**未注册用户测试：**
1. 清除缓存
2. 打开小程序
3. 应该看到登录按钮

**已注册手艺人测试：**
- 账号：13800138001 / 123456
- 应该自动进入手艺人首页

**已注册派单人测试：**
- 账号：13800138002 / 123456  
- 应该自动进入派单人首页
