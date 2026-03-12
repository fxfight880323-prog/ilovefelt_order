# 部署指南

## 一、准备工作

### 1. 注册微信小程序
1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册小程序账号（选择 "小程序" 类型）
3. 完成邮箱验证和信息登记
4. 获取小程序 AppID

### 2. 开通云开发
1. 登录小程序后台
2. 点击左侧菜单 "云开发"
3. 点击 "开通" 按钮
4. 选择环境（可以创建多个环境，建议先创建 "开发环境"）
5. 记录环境ID

### 3. 安装微信开发者工具
1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 安装并登录

## 二、导入项目

### 1. 导入代码
1. 打开微信开发者工具
2. 点击 "导入项目"
3. 选择项目目录
4. 输入小程序 AppID
5. 点击 "导入"

### 2. 修改配置

#### 修改 appid
打开 `project.config.json`，修改 `appid`：
```json
{
  "appid": "wx YOUR_APPID_HERE"
}
```

#### 修改云开发环境ID
打开 `miniprogram/app.js`，修改环境ID：
```javascript
wx.cloud.init({
  env: 'your-env-id', // 替换为你的云开发环境ID
  traceUser: true,
})
```

## 三、配置管理员

### 1. 获取你的 OpenID
1. 在开发者工具中点击 "云开发" → "云函数"
2. 创建一个临时的云函数或直接查看日志
3. 运行以下代码获取当前用户的 openid：

```javascript
// 在任意页面的 onLoad 中添加
wx.cloud.callFunction({
  name: 'craftsman',
  data: { action: 'getOpenid' }
}).then(res => {
  console.log('你的 openid:', res.result.openid)
})
```

### 2. 设置管理员
打开 `cloudfunctions/craftsman/index.js`，将你的 openid 添加到管理员列表：

```javascript
const ADMIN_OPENIDS = ['o-xxxxxxxxxxxxxxxx'] // 替换为你的 openid
```

### 3. 重新部署云函数
右键 `cloudfunctions/craftsman` 选择 "创建并部署：云端安装依赖"

## 四、部署云函数

按顺序部署以下云函数：

1. **右键** `cloudfunctions/init` → "创建并部署：云端安装依赖"
2. **右键** `cloudfunctions/order` → "创建并部署：云端安装依赖"
3. **右键** `cloudfunctions/style` → "创建并部署：云端安装依赖"
4. **右键** `cloudfunctions/craftsman` → "创建并部署：云端安装依赖"
5. **右键** `cloudfunctions/message` → "创建并部署：云端安装依赖"
6. **右键** `cloudfunctions/subscribe` → "创建并部署：云端安装依赖"

## 五、初始化数据库

### 1. 运行初始化云函数
在开发者工具的控制台中执行：

```javascript
wx.cloud.callFunction({
  name: 'init'
}).then(res => {
  console.log(res)
})
```

### 2. 设置数据库权限
1. 点击 "云开发" → "数据库"
2. 分别设置以下集合的权限：

#### orders（订单）集合
- 选择 "所有用户可读，仅创建者可写"

#### styles（样式）集合
- 选择 "所有用户可读，仅创建者可写"

#### craftsmen（手工艺人）集合
- 选择 "所有用户可读，仅创建者可写"

#### subscribers（订阅）集合
- 选择 "仅用户自己可读写"

#### notices（公告）集合
- 选择 "所有用户可读，仅创建者可写"

## 六、配置订阅消息

### 1. 添加模板
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 "功能" → "订阅消息"
3. 点击 "添加" 按钮
4. 搜索并添加以下模板：

| 模板名称 | 用途 | 字段 |
|---------|------|------|
| 新订单提醒 | 新订单通知 | 订单名称、样式、数量、总价、收货日期 |
| 接单成功提醒 | 接单确认 | 订单名称、状态、接单时间、截止日期 |
| 订单完成提醒 | 完成通知 | 订单名称、完成状态、完成时间、收入金额 |

### 2. 更新模板ID
打开 `cloudfunctions/message/index.js`，替换模板ID：

```javascript
const TMPL_IDS = {
  NEW_ORDER: '替换为你的模板ID',
  ORDER_ACCEPTED: '替换为你的模板ID',
  ORDER_COMPLETED: '替换为你的模板ID'
}
```

### 3. 重新部署云函数
右键 `cloudfunctions/message` → "创建并部署：云端安装依赖"

## 七、测试运行

### 1. 管理员测试
1. 使用管理员账号登录小程序
2. 测试创建样式：进入 "样式管理" → "+" 添加样式
3. 测试添加手工艺人：进入 "匠人管理" → "+" 添加手工艺人
4. 测试创建订单：进入 "订单管理" → 右下角 "+" 创建订单

### 2. 手工艺人测试
1. 让手工艺人使用微信登录小程序
2. 手工艺人联系管理员进行注册
3. 手工艺人进入 "接单大厅" 测试接单
4. 测试消息提醒功能

## 八、发布上线

### 1. 上传代码
1. 点击微信开发者工具右上角的 "上传" 按钮
2. 填写版本号和项目备注
3. 点击 "上传"

### 2. 提交审核
1. 登录微信公众平台
2. 进入 "管理" → "版本管理"
3. 找到开发版本，点击 "提交审核"
4. 填写相关信息并提交

### 3. 发布
审核通过后，点击 "发布" 按钮即可上线

## 九、常见问题

### Q1: 云函数调用失败？
A: 检查是否正确部署了云函数，以及云开发环境ID是否配置正确。

### Q2: 数据库权限错误？
A: 确保已在云开发控制台正确设置了各集合的权限。

### Q3: 订阅消息发送失败？
A: 
- 检查模板ID是否正确
- 确保用户已授权订阅
- 检查模板字段格式是否符合要求

### Q4: 管理员功能无法使用？
A: 检查管理员openid是否正确配置在云函数中，并重新部署云函数。

### Q5: 手工艺人无法接单？
A: 确保手工艺人已在 "匠人管理" 中注册，并且openid已绑定。

## 十、技术支持

如有问题，可以通过以下方式获取帮助：
1. 查看小程序官方文档：https://developers.weixin.qq.com/miniprogram/dev/
2. 查看云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
3. 提交 Issue
