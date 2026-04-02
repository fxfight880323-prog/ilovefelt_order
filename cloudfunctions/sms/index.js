const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 管理员手机号（接收验证请求）
const ADMIN_PHONE = '13810062394'

// 验证码有效期（分钟）
const CODE_EXPIRE_MINUTES = 10

exports.main = async (event, context) => {
  const { action, data } = event
  
  try {
    switch (action) {
      case 'sendVerifyCode':
        return await sendVerifyCode(data)
      case 'verifyCode':
        return await verifyCode(data)
      case 'sendRequestToAdmin':
        return await sendRequestToAdmin(data)
      case 'getPendingRequests':
        return await getPendingRequests()
      case 'approveRequest':
        return await approveRequest(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 生成随机验证码
function generateCode() {
  return Math.random().toString().slice(2, 8)
}

// 发送验证码
async function sendVerifyCode(data) {
  const { phone, type } = data // type: 'craftsman' | 'dispatcher'
  
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { code: -1, message: '手机号格式错误' }
  }
  
  // 检查是否频繁发送（1分钟内只能发一次）
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
  const recentRecord = await db.collection('verifyCodes').where({
    phone,
    createTime: _.gte(oneMinuteAgo)
  }).get()
  
  if (recentRecord.data.length > 0) {
    return { code: -1, message: '发送过于频繁，请稍后再试' }
  }
  
  // 生成验证码
  const code = generateCode()
  
  // 保存到数据库
  await db.collection('verifyCodes').add({
    data: {
      phone,
      code,
      type, // 'craftsman' 或 'dispatcher'
      used: false,
      createTime: db.serverDate(),
      expireTime: new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000)
    }
  })
  
  // 记录短信日志
  await db.collection('smsLogs').add({
    data: {
      to: phone,
      content: `【手工艺派单系统】您的验证码是：${code}，${CODE_EXPIRE_MINUTES}分钟内有效。`,
      type: 'verifyCode',
      status: 'sent',
      createTime: db.serverDate()
    }
  })
  
  // 向管理员发送通知
  await db.collection('smsLogs').add({
    data: {
      to: ADMIN_PHONE,
      content: `【验证码通知】向 ${phone} 发送验证码：${code}（${type === 'craftsman' ? '手艺人注册' : '派单人认证'}）`,
      type: 'adminNotify',
      status: 'sent',
      createTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '验证码已发送',
    // 测试环境返回验证码，生产环境请删除
    data: { code }
  }
}

// 验证验证码
async function verifyCode(data) {
  const { phone, code, type } = data
  
  if (!phone || !code) {
    return { code: -1, message: '请输入手机号和验证码' }
  }
  
  // 查找未使用的验证码
  const verifyRecord = await db.collection('verifyCodes').where({
    phone,
    code,
    type,
    used: false,
    expireTime: _.gte(new Date())
  }).get()
  
  if (verifyRecord.data.length === 0) {
    return { code: -1, message: '验证码错误或已过期' }
  }
  
  // 标记为已使用
  await db.collection('verifyCodes').doc(verifyRecord.data[0]._id).update({
    data: { used: true, usedTime: db.serverDate() }
  })
  
  return { code: 0, message: '验证成功' }
}

// 向管理员发送认证请求
async function sendRequestToAdmin(data) {
  const { openid, type, info } = data // type: 'dispatcher_auth'
  
  // 创建审核请求记录
  const result = await db.collection('adminRequests').add({
    data: {
      openid,
      type, // 'dispatcher_auth'
      info, // 申请人信息
      status: 'pending', // pending, approved, rejected
      phone: ADMIN_PHONE,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 发送通知给管理员
  await db.collection('smsLogs').add({
    data: {
      to: ADMIN_PHONE,
      content: `【审核通知】有新的${type === 'dispatcher_auth' ? '派单人认证' : '手艺人注册'}申请，请登录后台审核。申请人：${info.name}，手机号：${info.phone}`,
      type: 'adminNotify',
      requestId: result._id,
      status: 'sent',
      createTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '申请已提交，请等待管理员审核',
    data: { requestId: result._id }
  }
}

// 获取待处理的审核请求
async function getPendingRequests() {
  const requests = await db.collection('adminRequests')
    .where({ status: 'pending' })
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: requests.data
  }
}

// 审核请求
async function approveRequest(data) {
  const { requestId, approved, reason } = data
  
  await db.collection('adminRequests').doc(requestId).update({
    data: {
      status: approved ? 'approved' : 'rejected',
      reason: reason || '',
      updateTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: approved ? '已通过' : '已拒绝'
  }
}
