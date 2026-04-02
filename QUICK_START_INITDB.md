# 快速开始 - 初始化数据库

## 方法一：通过管理员控制台（推荐）

### 步骤 1：成为管理员

首先需要一个管理员账号。使用手机号 `13810062394` 注册派单人或手艺人，系统会自动赋予管理员权限。

### 步骤 2：进入管理员控制台

1. 登录小程序
2. 切换到管理员角色（如果有多个角色）
3. 点击"控制台"功能

### 步骤 3：初始化数据库

1. 在控制台页面底部找到"系统管理"区域
2. 点击"数据库初始化"
3. 在初始化页面点击"初始化数据库"按钮
4. 等待完成，查看结果

---

## 方法二：在小程序页面直接调用

在任何页面添加调试按钮：

```javascript
// 在页面的 js 文件中添加方法
async initDb() {
  try {
    wx.showLoading({ title: '初始化中...' })
    
    const res = await wx.cloud.callFunction({
      name: 'initDb',
      data: { checkOnly: false }
    })
    
    wx.hideLoading()
    console.log('初始化结果:', res.result)
    
    // 显示结果
    wx.showModal({
      title: '初始化完成',
      content: JSON.stringify(res.result.data.summary, null, 2),
      showCancel: false
    })
  } catch (err) {
    wx.hideLoading()
    console.error('初始化失败:', err)
    wx.showToast({ title: '初始化失败', icon: 'none' })
  }
}
```

在页面上添加按钮：

```html
<button bindtap="initDb">初始化数据库</button>
```

---

## 方法三：微信开发者工具云控制台

### 步骤 1：打开云开发控制台

1. 在微信开发者工具中点击"云开发"按钮
2. 进入"数据库"标签页

### 步骤 2：创建集合

点击"添加集合"，依次创建以下集合：

1. `users` - 用户表
2. `craftsmen` - 手艺人表
3. `dispatchers` - 派单人表
4. `orders` - 订单表
5. `styles` - 样式表
6. `verifyCodes` - 验证码表
7. `smsLogs` - 短信日志表
8. `subscribers` - 订阅者表
9. `notices` - 公告表
10. `adminRequests` - 管理员审核表
11. `ratings` - 评分表
12. `craftsmanWorks` - 工作记录表

---

## 验证初始化结果

### 检查集合是否创建成功

在初始化页面点击"检查数据库状态"，会显示：
- ✅ 已创建的集合
- 📋 已存在的集合
- ⚠️ 缺失的集合

### 检查具体集合

在云开发控制台的数据库页面，查看每个集合的结构：

**users 集合应该包含的字段：**
- openid
- role
- roles
- currentRole
- phone
- status
- createTime
- updateTime

**dispatchers 集合应该包含的字段：**
- openid
- name
- phone
- company
- status
- createTime
- updateTime

---

## 常见问题

### Q1: 提示 "无权操作"

**原因**：只有管理员可以初始化数据库

**解决**：使用管理员手机号（13810062394）注册

### Q2: 某些集合创建失败

**原因**：可能是权限问题或集合已存在

**解决**：
1. 在云控制台手动删除失败的集合
2. 重新运行初始化

### Q3: 云函数调用失败

**原因**：initDb 云函数未部署

**解决**：
1. 右键点击 `cloudfunctions/initDb` 文件夹
2. 选择"创建并部署：云端安装依赖"
3. 等待部署完成

---

## 初始化参数说明

```javascript
// 检查模式 - 只检查集合是否存在，不创建
wx.cloud.callFunction({
  name: 'initDb',
  data: { checkOnly: true }
})

// 创建模式 - 创建缺失的集合和索引
wx.cloud.callFunction({
  name: 'initDb',
  data: { checkOnly: false }
})
```

---

## 下一步

数据库初始化完成后：

1. ✅ 注册派单人账号
2. ✅ 注册手艺人账号
3. ✅ 派单人发布订单
4. ✅ 手艺人接单制作
5. ✅ 完成订单流程
