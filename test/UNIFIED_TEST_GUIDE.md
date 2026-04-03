# UnifiedCompleteTest - 统一完整测试指南

## 📖 简介

`UnifiedCompleteTest` 是一个整合了所有历史测试功能的统一测试框架，包含了：

- **complete-test.js** - 环境检查、系统化测试结构
- **full-workflow-test.js** - 完整业务流程测试
- **quick-test.js** - 快速测试流程
- **test-admin-login.js** - 管理员登录验证
- **full-test.js** - 系统化测试报告

## 🚀 快速开始

### 运行方式

在微信开发者工具控制台执行：

```javascript
// 1. 加载测试脚本
// 复制 test/unified-test.js 的全部内容到控制台

// 2. 运行标准测试
await UnifiedCompleteTest.run()

// 3. 运行快速测试（跳过列表管理）
await UnifiedCompleteTest.quick()

// 4. 运行完整测试（含数据清理）
await UnifiedCompleteTest.full()
```

## 📋 测试阶段说明

### Phase 1: 环境检查
- 数据库连接检查
- 云函数API检查
- 必要集合检查（users, craftsmen, dispatchers, orders）

### Phase 2: 超级管理员验证
- 超级管理员登录（13810062394/880323）
- 权限验证
- 统计数据获取

### Phase 3: 用户注册与审批
- 派单人注册（13800138001）
- 手艺人注册（13800138002）
- 超级管理员审批

### Phase 4: 完整订单流程
- 派单人创建订单
- 手艺人接单
- 订单状态验证
- 取消订单测试
- 完成订单

### Phase 5: 列表管理功能（可选）
- 手艺人列表查询
- 派单人列表查询
- 订单列表查询
- 信息更新测试

### Phase 6: 数据统计验证
- 系统统计获取
- 派单人订单查询
- 手艺人订单查询

### Phase 7: 清理测试数据（可选）
- 删除测试订单
- 删除测试用户

## 📊 测试数据

| 角色 | 手机号 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | 13810062394 | 880323 | 审批所有角色 |
| 测试派单人 | 13800138001 | 123456 | 创建订单 |
| 测试手艺人 | 13800138002 | 123456 | 接单完成 |

## 🔧 API 封装

测试脚本内置了便捷的 API 调用方法：

```javascript
// 调用云函数
const result = await UnifiedCompleteTest.callAPI('auth', 'loginByPhone', {
  phone: '13810062394',
  password: '880323'
})

// 直接操作数据库
const db = UnifiedCompleteTest.db()
const { data } = await db.collection('users').where({ phone }).get()
```

## 📈 测试报告

测试完成后会输出详细报告：

```
============================================================
📊 测试报告
============================================================

总计: 25 项测试
✅ 通过: 23 项 (92.0%)
❌ 失败: 2 项 (8.0%)

失败的测试:
  ❌ 取消订单: 权限验证失败
  ❌ 更新手艺人: 未找到记录

测试完成时间: 2026/4/2 18:30:45
============================================================
```

## 🛠️ 自定义配置

修改测试配置：

```javascript
UnifiedCompleteTest.config = {
  superAdmin: {
    phone: '您的手机号',
    password: '您的密码'
  },
  testDispatcher: {
    phone: '测试派单人手机号',
    password: '密码',
    name: '名称'
  },
  testCraftsman: {
    phone: '测试手艺人手机号',
    password: '密码',
    name: '名称'
  },
  testOrder: {
    name: '订单名称',
    quantity: 10,
    price: 50
  }
}
```

## 📝 扩展测试

添加自定义测试步骤：

```javascript
// 在 unified-test.js 中添加新方法
async myCustomTest() {
  console.log('我的自定义测试')
  const res = await this.callAPI('module', 'action', {})
  this.record('自定义测试', res.success, res.msg)
}

// 在 run() 方法中调用
await this.myCustomTest()
```

## 🐛 故障排查

### 测试失败常见原因

1. **云函数未部署**
   ```
   错误: 未知操作
   解决: 右键 cloudfunctions/api → "创建并部署"
   ```

2. **超级管理员未创建**
   ```
   错误: 账号或密码错误
   解决: 运行 test/init-super-admin.js 创建管理员
   ```

3. **数据库权限问题**
   ```
   错误: cannot remove document
   解决: 设置数据库权限为 "所有用户可读可写"
   ```

## 📦 文件清单

```
test/
├── unified-test.js          # 统一完整测试（主要文件）
├── UNIFIED_TEST_GUIDE.md    # 本指南
├── complete-test.js         # 历史测试（已整合）
├── full-workflow-test.js    # 历史测试（已整合）
├── quick-test.js            # 历史测试（已整合）
└── ...                      # 其他历史测试
```

## ✅ 执行前检查清单

- [ ] 云函数 `api` 已部署
- [ ] 数据库集合已创建
- [ ] 超级管理员 13810062394/880323 已创建
- [ ] 数据库权限设置为可读写
- [ ] 微信开发者工具控制台已打开

## 🎯 最佳实践

1. **首次运行**: 使用 `await UnifiedCompleteTest.run()`
2. **快速验证**: 使用 `await UnifiedCompleteTest.quick()`
3. **最终清理**: 使用 `await UnifiedCompleteTest.full()`
4. **定期测试**: 每次代码更新后运行一次完整测试

## 📮 反馈

如遇到问题，请检查：
1. 云函数日志输出
2. 数据库中的实际数据
3. 测试报告的失败项详情
