// 订阅消息模板ID配置
// 需要在微信公众平台申请模板，获取模板ID后填入此处

module.exports = {
  // 新订单提醒（给手艺人）
  // 模板内容示例：{{thing1.DATA}}有新的订单，金额{{amount2.DATA}}元
  NEW_ORDER: 'dUvWdLqKFxuJmYM69-V0X7SJ0LfeBx5bS9igrDgf6-4',
  
  // 订单状态变更提醒（给派单人）
  // 模板内容示例：您的订单{{thing1.DATA}}已被{{thing2.DATA}}接单
  ORDER_STATUS_CHANGE: '',
  
  // 订单完成提醒（给派单人）
  // 模板内容示例：您的订单{{thing1.DATA}}已完成
  ORDER_COMPLETE: '',
  
  // 审核结果通知（给手艺人）
  // 模板内容示例：您的注册申请{{thing1.DATA}}
  AUDIT_RESULT: ''
}

// 使用说明：
// 1. 登录微信公众平台 (mp.weixin.qq.com)
// 2. 进入"功能" → "订阅消息"
// 3. 选择适合的模板或申请自定义模板
// 4. 获取模板ID后填入上方对应位置
