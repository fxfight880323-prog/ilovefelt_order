const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 履约分配置
const RELIABILITY_CONFIG = {
  INITIAL_SCORE: 5.0,      // 初始分数
  MAX_SCORE: 6.0,          // 封顶分数
  MIN_SCORE: 0.0,          // 封底分数
  WEIGHT_TIME: 0.5,        // 完成时间权重 50%
  WEIGHT_RATING: 0.5,      // 派单打分权重 50%
  LEVELS: {
    EXCELLENT: { min: 4.0, label: '优秀', color: '#52c41a' },
    MEDIUM: { min: 2.0, label: '中等', color: '#faad14' },
    WARNING: { min: 0.4, label: '警告', color: '#fa8c16' },
    DANGER: { min: 0, label: '危险', color: '#f5222d' }
  }
}

// 计算履约等级
function calculateReliabilityLevel(score) {
  if (score >= RELIABILITY_CONFIG.LEVELS.EXCELLENT.min) {
    return RELIABILITY_CONFIG.LEVELS.EXCELLENT
  } else if (score >= RELIABILITY_CONFIG.LEVELS.MEDIUM.min) {
    return RELIABILITY_CONFIG.LEVELS.MEDIUM
  } else if (score >= RELIABILITY_CONFIG.LEVELS.WARNING.min) {
    return RELIABILITY_CONFIG.LEVELS.WARNING
  }
  return RELIABILITY_CONFIG.LEVELS.DANGER
}

// 计算时间履约分（基于是否在约定时间内完成寄出）
function calculateTimeScore(order) {
  const receiveDate = order.receiveDate ? new Date(order.receiveDate) : null
  const shipDate = order.shipDate ? new Date(order.shipDate) : null
  const completeDate = order.completeDate ? new Date(order.completeDate) : null
  
  // 如果没有约定收货日期，默认给满分
  if (!receiveDate) return 5.0
  
  // 判断寄出时间（优先使用 shipDate，如果没有则使用 completeDate）
  const actualShipDate = shipDate || completeDate
  if (!actualShipDate) return 3.0 // 无寄出时间，给中等分
  
  // 计算提前/延迟天数
  const diffMs = receiveDate.getTime() - actualShipDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  // 在约定时间前寄出：满分
  if (diffDays >= 0) {
    return 5.0
  }
  
  // 延迟寄出：根据延迟天数扣分
  const delayDays = Math.abs(diffDays)
  if (delayDays <= 1) {
    return 4.5 // 延迟1天内
  } else if (delayDays <= 2) {
    return 4.0 // 延迟2天内
  } else if (delayDays <= 3) {
    return 3.5 // 延迟3天内
  } else if (delayDays <= 5) {
    return 3.0 // 延迟5天内
  } else if (delayDays <= 7) {
    return 2.5 // 延迟7天内
  } else if (delayDays <= 10) {
    return 2.0 // 延迟10天内
  } else if (delayDays <= 15) {
    return 1.5 // 延迟15天内
  } else {
    return 1.0 // 延迟超过15天
  }
}

// 更新订单履约分（综合时间分和派单评分）
async function updateOrderReliabilityScore(orderId, timeScore, dispatcherRating = null) {
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) return null
  
  const order = orderRes.data
  const updateData = {
    timeScore: timeScore,
    updateTime: db.serverDate()
  }
  
  // 如果有派单评分，计算综合履约分
  if (dispatcherRating !== null) {
    const ratingScore = parseFloat(dispatcherRating)
    // 综合履约分 = 时间分 * 50% + 派单评分 * 50%
    const reliabilityScore = (timeScore * RELIABILITY_CONFIG.WEIGHT_TIME) + 
                            (ratingScore * RELIABILITY_CONFIG.WEIGHT_RATING)
    updateData.reliabilityScore = parseFloat(reliabilityScore.toFixed(2))
  }
  
  await db.collection('orders').doc(orderId).update({ data: updateData })
  
  return updateData.reliabilityScore || timeScore
}

// 更新手艺人的总履约分（基于所有已完成订单的平均值）
async function updateCraftsmanReliabilityScore(craftsmanId) {
  const craftsmanRes = await db.collection('craftsmen').doc(craftsmanId).get()
  if (!craftsmanRes.data) return null
  
  const craftsman = craftsmanRes.data
  
  // 获取该手艺人所有已评价的订单
  const ratedOrders = await db.collection('orders').where({
    craftsmanId: craftsmanId,
    status: 'completed',
    reliabilityScore: _.exists(true)
  }).get()
  
  if (ratedOrders.data.length === 0) {
    // 没有已评价订单，保持初始分
    return {
      score: craftsman.reliabilityScore || RELIABILITY_CONFIG.INITIAL_SCORE,
      level: craftsman.reliabilityLevel || '优秀',
      color: RELIABILITY_CONFIG.LEVELS.EXCELLENT.color,
      ratedOrders: 0
    }
  }
  
  // 计算平均履约分
  const totalScore = ratedOrders.data.reduce((sum, order) => sum + (order.reliabilityScore || 0), 0)
  const avgScore = totalScore / ratedOrders.data.length
  
  // 限制在0-6分范围内
  const finalScore = Math.max(RELIABILITY_CONFIG.MIN_SCORE, 
                             Math.min(RELIABILITY_CONFIG.MAX_SCORE, avgScore))
  
  const level = calculateReliabilityLevel(finalScore)
  
  await db.collection('craftsmen').doc(craftsmanId).update({
    data: {
      reliabilityScore: parseFloat(finalScore.toFixed(2)),
      reliabilityLevel: level.label,
      ratedOrders: ratedOrders.data.length,
      updateTime: db.serverDate()
    }
  })
  
  return {
    score: parseFloat(finalScore.toFixed(2)),
    level: level.label,
    color: level.color,
    ratedOrders: ratedOrders.data.length
  }
}

// ==================== 主入口 ====================
exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  // 兼容性处理
  const params = data || event
  
  try {
    switch (action) {
      // 订单CRUD
      case 'create':
        return await createOrder(params, OPENID)
      case 'getList':
        return await getOrderList(params, OPENID)
      case 'getDetail':
        return await getOrderDetail(params, OPENID)
      case 'update':
        return await updateOrder(params, OPENID)
      case 'delete':
        return await deleteOrder(params, OPENID)
      
      // 订单流程
      case 'accept':
        return await acceptOrder(params, OPENID)
      case 'cancel':
        return await cancelOrder(params, OPENID)
      case 'complete':
        return await completeOrder(params, OPENID)
      case 'revert':
        return await revertOrder(params, OPENID)
      case 'addTracking':
        return await addTrackingNumber(params, OPENID)
      case 'confirmPayment':
        return await confirmPayment(params, OPENID)
      case 'confirmReceipt':
        return await confirmReceipt(params, OPENID)
      
      // 订单查询（按角色）
      case 'getPendingList':
        return await getPendingList(params)
      case 'getMyOrders':
        return await getMyOrders(params, OPENID)
      case 'getDispatcherOrders':
        return await getDispatcherOrders(params, OPENID)
      case 'getCraftsmanOrders':
        return await getCraftsmanOrders(params, OPENID)
      
      // 统计与报表
      case 'getOrderStats':
        return await getOrderStatsWithDate(params, OPENID)
      case 'getDispatcherStats':
        return await getDispatcherStats(OPENID)
      case 'getCraftsmanStats':
        return await getCraftsmanStats(params.craftsmanId)
      case 'getChartData':
        return await getChartData(OPENID, params.role)
      
      // 新增统计接口
      case 'getMonthlyTrend':
        return await getMonthlyTrend(params, OPENID)
      case 'getRanking':
        return await getRanking(params, OPENID)
      case 'getPersonalStats':
        return await getPersonalStats(params, OPENID)
      case 'getStyleStats':
        return await getStyleStats(params, OPENID)
      
      // 评价打分
      case 'rateCraftsman':
        return await rateCraftsman(params, OPENID)
      case 'getCraftsmanRating':
        return await getCraftsmanRating(params.craftsmanId)
      
      // 测试接口（仅用于开发测试）
      case 'testConfirmPayment':
        return await testConfirmPayment(params, OPENID)
      case 'testConfirmReceipt':
        return await testConfirmReceipt(params, OPENID)
      
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// ==================== 权限检查工具函数 ====================

// 检查用户角色
async function checkUserRole(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { role: 'guest', isAdmin: false }
  }
  
  const user = userRes.data[0]
  const roles = user.roles || [user.role]
  const isAdmin = roles.includes('admin') || user.role === 'admin'
  
  return {
    role: user.currentRole || user.role,
    roles,
    isAdmin,
    userId: user._id,
    openid
  }
}

// 检查是否为订单创建者（派单人）
async function isOrderCreator(orderId, openid) {
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return false
  
  // 获取派单人信息
  const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
  if (dispatcherRes.data.length === 0) return false
  
  return order.data.dispatcherId === dispatcherRes.data[0]._id
}

// 检查是否为订单接单人（手艺人）
async function isOrderAcceptor(orderId, openid) {
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return false
  
  const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
  if (craftsmanRes.data.length === 0) return false
  
  return order.data.craftsmanId === craftsmanRes.data[0]._id
}

// ==================== 订单编码生成 ====================

/**
 * 生成10位唯一订单编码（2位字母 + 8位数字）
 * 格式：AB24031578
 * 规则：
 * - 前2位：随机字母 A-Z（排除易混淆的 I, O）
 * - 后8位：日期(6位YYMMDD) + 随机数(2位)
 * - 唯一性：通过数据库检查确保不重复
 */
async function generateOrderCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // 24个字母，排除 I, O 避免与数字混淆
  const maxAttempts = 10  // 最大尝试次数
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 生成2位随机字母
    const letter1 = letters[Math.floor(Math.random() * letters.length)]
    const letter2 = letters[Math.floor(Math.random() * letters.length)]
    const letterPrefix = letter1 + letter2  // 2位字母前缀
    
    // 生成8位数字：YYMMDD(6位) + 随机数(2位)
    const now = new Date()
    const year = String(now.getFullYear()).slice(2)  // 取年份后2位
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')  // 00-99
    
    const digits = year + month + day + random  // 共8位
    const orderCode = letterPrefix + digits  // 共10位
    
    // 检查是否已存在
    try {
      const existRes = await db.collection('orders').where({ orderCode }).count()
      if (existRes.total === 0) {
        // 唯一，可以使用
        return orderCode
      }
      // 已存在，继续下一次尝试
      console.log(`订单编码 ${orderCode} 已存在，尝试重新生成...`)
    } catch (err) {
      console.error('检查订单编码唯一性失败:', err)
      // 出错时继续尝试
    }
  }
  
  // 多次尝试后仍未生成唯一编码，抛出错误
  throw new Error('无法生成唯一订单编码，请重试')
}

// ==================== 订单CRUD ====================

// 创建订单（派单人/管理员）
async function createOrder(data, openid) {
  const { name, styleId, styleName, quantity, price, receiveDate, remark, imageUrl } = data
  
  // 参数验证
  if (!name || !name.trim()) return { code: -1, message: '请输入订单名称' }
  if (!styleId) return { code: -1, message: '请选择样式' }
  if (!quantity || parseInt(quantity) <= 0) return { code: -1, message: '请输入有效数量' }
  if (!price || parseFloat(price) <= 0) return { code: -1, message: '请输入有效价格' }
  if (!receiveDate) return { code: -1, message: '请选择收货日期' }
  
  // 获取当前用户信息
  const userInfo = await checkUserRole(openid)
  
  // 获取派单人ID
  let dispatcherId = ''
  let dispatcherName = ''
  
  if (userInfo.isAdmin && data.dispatcherId) {
    // 管理员可以指定派单人
    const dispatcher = await db.collection('dispatchers').doc(data.dispatcherId).get()
    if (dispatcher.data) {
      dispatcherId = data.dispatcherId
      dispatcherName = dispatcher.data.name
    }
  } else {
    // 普通用户只能以自己的身份创建
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      dispatcherId = dispatcherRes.data[0]._id
      dispatcherName = dispatcherRes.data[0].name
    }
  }
  
  // 生成唯一订单编码
  let orderCode
  try {
    orderCode = await generateOrderCode()
    console.log('生成订单编码:', orderCode)
  } catch (err) {
    console.error('生成订单编码失败:', err)
    return { code: -1, message: '生成订单编码失败，请重试' }
  }
  
  const result = await db.collection('orders').add({
    data: {
      orderCode,  // 10位唯一订单编码
      name: name.trim(),
      styleId,
      styleName: styleName || '',
      quantity: parseInt(quantity),
      price: parseFloat(price),
      totalPrice: parseFloat(price) * parseInt(quantity),
      receiveDate: new Date(receiveDate),
      remark: remark || '',
      imageUrl: imageUrl || '',
      
      // 创建者信息（派单人）
      dispatcherId,
      dispatcherName,
      
      // 接单人信息（初始为空）
      craftsmanId: '',
      craftsmanName: '',
      craftsmanPhone: '',
      
      // 订单状态
      status: 'pending', // pending, accepted, shipped, completed, cancelled, closed
      
      // 物流信息
      trackingNumber: '',
      trackingCompany: '',
      
      // 完成信息
      completePhotos: [],
      completeDate: null,
      
      // 评价信息
      rating: null,
      ratingComment: '',
      
      // 付款状态
      paymentStatus: 'unpaid', // unpaid, pending_receipt, paid
      paymentConfirmedBy: '',
      paymentConfirmedAt: null,
      paymentMethod: '',
      paymentRemark: '',
      receiptConfirmedAt: null,
      receiptRemark: '',
      closeTime: null,
      
      // 时间戳
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 发送新订单订阅消息给所有手艺人
  try {
    await cloud.callFunction({
      name: 'message',
      data: {
        action: 'sendNewOrderNotice',
        orderId: result._id
      }
    })
  } catch (err) {
    console.error('发送新订单订阅消息失败:', err)
  }
  
  return { code: 0, message: '创建成功', data: { _id: result._id, orderCode } }
}

// 获取订单列表（根据角色返回不同数据）
async function getOrderList(params, openid) {
  const { status = '', keyword = '', page = 1, pageSize = 20 } = params
  const userInfo = await checkUserRole(openid)
  
  let where = {}
  
  // 状态筛选
  if (status) where.status = status
  
  // 角色权限过滤
  if (!userInfo.isAdmin) {
    // 非管理员只能看自己的相关订单
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    
    const orConditions = []
    
    if (dispatcherRes.data.length > 0) {
      orConditions.push({ dispatcherId: dispatcherRes.data[0]._id })
    }
    
    if (craftsmanRes.data.length > 0) {
      orConditions.push({ craftsmanId: craftsmanRes.data[0]._id })
    }
    
    if (orConditions.length > 0) {
      where = { ...where, $or: orConditions }
    }
  }
  
  // 关键词搜索
  if (keyword) {
    where.name = db.RegExp({ regexp: keyword, options: 'i' })
  }
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

// 获取订单详情
async function getOrderDetail(params, openid) {
  const { orderId } = params
  const userInfo = await checkUserRole(openid)
  
  if (!orderId) return { code: -1, message: '缺少订单ID' }
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  const orderData = order.data
  
  // 权限检查（非管理员）
  if (!userInfo.isAdmin) {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    
    const isDispatcher = dispatcherRes.data.length > 0 && orderData.dispatcherId === dispatcherRes.data[0]._id
    const isCraftsman = craftsmanRes.data.length > 0 && orderData.craftsmanId === craftsmanRes.data[0]._id
    
    // 待接单订单任何人可看，已接单订单只有相关人可看
    if (orderData.status !== 'pending' && !isDispatcher && !isCraftsman) {
      return { code: -1, message: '无权查看此订单' }
    }
  }
  
  return { code: 0, data: orderData }
}

// 更新订单
async function updateOrder(params, openid) {
  const { orderId, ...updateData } = params
  const userInfo = await checkUserRole(openid)
  
  // 检查权限
  if (!userInfo.isAdmin) {
    const isCreator = await isOrderCreator(orderId, openid)
    if (!isCreator) {
      return { code: -1, message: '无权修改此订单' }
    }
    
    // 派单人只能修改未接单的订单
    const order = await db.collection('orders').doc(orderId).get()
    if (order.data && order.data.status !== 'pending') {
      return { code: -1, message: '订单已接单，无法修改' }
    }
  }
  
  await db.collection('orders').doc(orderId).update({
    data: {
      ...updateData,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 删除订单
async function deleteOrder(params, openid) {
  const { orderId } = params
  const userInfo = await checkUserRole(openid)
  
  // 检查权限
  if (!userInfo.isAdmin) {
    const isCreator = await isOrderCreator(orderId, openid)
    if (!isCreator) {
      return { code: -1, message: '无权删除此订单' }
    }
    
    // 派单人只能删除未接单的订单
    const order = await db.collection('orders').doc(orderId).get()
    if (order.data && order.data.status !== 'pending') {
      return { code: -1, message: '订单已接单，无法删除' }
    }
  }
  
  await db.collection('orders').doc(orderId).remove()
  return { code: 0, message: '删除成功' }
}

// ==================== 订单流程 ====================

// 接单（手艺人）
async function acceptOrder(params, openid) {
  const { orderId } = params
  
  // 获取手艺人信息
  const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
  if (craftsmanRes.data.length === 0) {
    return { code: -1, message: '您还未注册为手艺人' }
  }
  
  const craftsman = craftsmanRes.data[0]
  
  // 检查订单状态
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  if (order.data.status !== 'pending') {
    return { code: -1, message: '该订单已被接' }
  }
  
  // 更新订单
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'accepted',
      craftsmanId: craftsman._id,
      craftsmanName: craftsman.name,
      craftsmanPhone: craftsman.phone || '',
      acceptDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 更新手艺人接单数
  await db.collection('craftsmen').doc(craftsman._id).update({
    data: {
      totalOrders: _.inc(1),
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '接单成功' }
}

// 取消订单
async function cancelOrder(params, openid) {
  const { orderId, reason } = params
  const userInfo = await checkUserRole(openid)
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  const orderData = order.data
  
  // 权限检查
  let canCancel = userInfo.isAdmin
  let isCraftsmanCancel = false
  
  if (!canCancel) {
    // 检查是否是创建者（派单人）
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0 && orderData.dispatcherId === dispatcherRes.data[0]._id) {
      canCancel = true
    }
    
    // 检查是否是接单人（手艺人）且订单已接单
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    if (craftsmanRes.data.length > 0 && orderData.craftsmanId === craftsmanRes.data[0]._id) {
      // 手艺人只能取消进行中的订单
      if (orderData.status === 'accepted') {
        canCancel = true
        isCraftsmanCancel = true
      }
    }
  }
  
  if (!canCancel) {
    return { code: -1, message: '无权取消此订单' }
  }
  
  // 已完成的订单不能取消
  if (orderData.status === 'completed') {
    return { code: -1, message: '已完成订单不能取消' }
  }
  
  // 更新订单
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'cancelled',
      cancelReason: reason || '',
      cancelledBy: isCraftsmanCancel ? 'craftsman' : (userInfo.isAdmin ? 'admin' : 'dispatcher'),
      cancelTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 如果已接单，更新手艺人接单数
  if (orderData.craftsmanId && orderData.status === 'accepted') {
    await db.collection('craftsmen').doc(orderData.craftsmanId).update({
      data: {
        totalOrders: _.inc(-1),
        updateTime: db.serverDate()
      }
    })
  }
  
  // 注意：取消订单不再直接扣履约分，履约分只根据已完成订单的时间表现和派单评分计算
  
  return { 
    code: 0, 
    message: '订单已取消'
  }
}

// 填写运单号（手艺人）
async function addTrackingNumber(params, openid) {
  const { orderId, trackingNumber, trackingCompany } = params
  
  if (!trackingNumber || !trackingNumber.trim()) {
    return { code: -1, message: '请输入运单号' }
  }
  
  // 检查权限
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  const isAcceptor = await isOrderAcceptor(orderId, openid)
  if (!isAcceptor) {
    return { code: -1, message: '无权操作此订单' }
  }
  
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'shipped',
      trackingNumber: trackingNumber.trim(),
      trackingCompany: trackingCompany || '其他快递',
      shipDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '运单号提交成功' }
}

// 完成订单（手艺人上传照片）- 新流程：上传后状态保持为 shipped（已发货）
async function completeOrder(params, openid) {
  const { orderId, completePhotos } = params
  
  // 验证必须上传成品图片
  if (!completePhotos || completePhotos.length === 0) {
    return { code: -1, message: '请至少上传一张成品照片' }
  }
  
  // 检查权限
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  const isAcceptor = await isOrderAcceptor(orderId, openid)
  if (!isAcceptor) {
    return { code: -1, message: '无权操作此订单' }
  }
  
  // 必须先填写运单号（订单状态为 shipped）才能上传完成照片
  if (order.data.status !== 'shipped') {
    return { code: -1, message: '请先填写运单号并发货后再完成订单' }
  }
  
  // 计算完成时间
  const completeDate = db.serverDate()
  
  // 新流程：上传照片后状态保持为 shipped（已发货），等待确认收款
  await db.collection('orders').doc(orderId).update({
    data: {
      completePhotos: completePhotos || [],
      completeDate: completeDate,
      updateTime: db.serverDate()
    }
  })
  
  // 计算时间履约分
  let timeScoreResult = null
  if (order.data.craftsmanId) {
    // 计算时间履约分（基于是否在约定时间内完成寄出）
    const updatedOrder = {
      ...order.data,
      completeDate: new Date(),
      completePhotos: completePhotos || []
    }
    const timeScore = calculateTimeScore(updatedOrder)
    
    // 保存时间履约分到订单
    await db.collection('orders').doc(orderId).update({
      data: {
        timeScore: timeScore,
        updateTime: db.serverDate()
      }
    })
    
    timeScoreResult = {
      timeScore: timeScore,
      message: '已记录时间履约分，确认收款后完成订单'
    }
  }
  
  return { 
    code: 0, 
    message: '照片上传成功，订单进入已发货列表',
    data: {
      timeScoreResult
    }
  }
}

// 撤回订单（已完成→进行中）
async function revertOrder(params, openid) {
  const { orderId } = params
  const userInfo = await checkUserRole(openid)
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  // 只有管理员或接单人可以撤回
  let canRevert = userInfo.isAdmin
  
  if (!canRevert) {
    const isAcceptor = await isOrderAcceptor(orderId, openid)
    canRevert = isAcceptor
  }
  
  if (!canRevert) {
    return { code: -1, message: '无权撤回此订单' }
  }
  
  if (order.data.status !== 'completed') {
    return { code: -1, message: '只有已完成的订单可以撤回' }
  }
  
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'accepted',
      completeDate: null,
      completePhotos: [],
      updateTime: db.serverDate()
    }
  })
  
  // 更新手艺人完成数
  if (order.data.craftsmanId) {
    await db.collection('craftsmen').doc(order.data.craftsmanId).update({
      data: {
        completedOrders: _.inc(-1),
        updateTime: db.serverDate()
      }
    })
  }
  
  return { code: 0, message: '订单已撤回' }
}

// 确认付款（派单人/管理员）
async function confirmPayment(params, openid) {
  const { orderId, paymentMethod = 'bank_transfer', paymentRemark = '' } = params
  
  const userInfo = await checkUserRole(openid)
  
  // 检查订单
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  // 只有已完成的订单可以确认付款
  if (order.data.status !== 'completed') {
    return { code: -1, message: '只有已完成的订单可以确认付款' }
  }
  
  // 检查权限（派单人或管理员）
  let canConfirm = userInfo.isAdmin
  
  if (!canConfirm) {
    // 检查是否是订单创建者（派单人）
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0 && order.data.dispatcherId === dispatcherRes.data[0]._id) {
      canConfirm = true
    }
  }
  
  if (!canConfirm) {
    return { code: -1, message: '无权确认付款' }
  }
  
  // 更新订单为待收款状态
  await db.collection('orders').doc(orderId).update({
    data: {
      paymentStatus: 'pending_receipt', // 待收款
      paymentConfirmedBy: userInfo.isAdmin ? 'admin' : 'dispatcher',
      paymentConfirmedAt: db.serverDate(),
      paymentMethod: paymentMethod,
      paymentRemark: paymentRemark,
      updateTime: db.serverDate()
    }
  })
  
  // 发送通知给手艺人
  try {
    await cloud.callFunction({
      name: 'message',
      data: {
        action: 'sendPaymentNotice',
        orderId: orderId,
        craftsmanId: order.data.craftsmanId,
        orderName: order.data.name,
        totalPrice: order.data.totalPrice
      }
    })
  } catch (err) {
    console.error('发送付款通知失败:', err)
  }
  
  return { 
    code: 0, 
    message: '付款确认成功，等待手艺人确认收款',
    data: {
      paymentStatus: 'pending_receipt',
      paymentConfirmedAt: new Date()
    }
  }
}

// 确认收款（手艺人）
async function confirmReceipt(params, openid) {
  const { orderId, receiptRemark = '' } = params
  
  // 检查订单
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  
  // 检查权限（必须是接单人）
  const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
  if (craftsmanRes.data.length === 0) {
    return { code: -1, message: '您还未注册为手艺人' }
  }
  
  if (order.data.craftsmanId !== craftsmanRes.data[0]._id) {
    return { code: -1, message: '无权确认收款' }
  }
  
  // 新流程：检查订单状态为 shipped（已发货）
  if (order.data.status !== 'shipped') {
    return { code: -1, message: '订单未发货，无法确认收款' }
  }
  
  // 更新订单为已完成（新流程：shipped → completed）
  await db.collection('orders').doc(orderId).update({
    data: {
      paymentStatus: 'paid', // 已收款
      receiptConfirmedAt: db.serverDate(),
      receiptRemark: receiptRemark,
      status: 'completed', // 新流程：确认收款后变为已完成
      completeTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  // 更新手艺人完成数和收入统计
  if (order.data.craftsmanId) {
    await db.collection('craftsmen').doc(order.data.craftsmanId).update({
      data: {
        completedOrders: _.inc(1),
        totalIncome: _.inc(order.data.totalPrice || 0),
        paidOrders: _.inc(1),
        updateTime: db.serverDate()
      }
    })
  }
  
  // 发送通知给派单人
  try {
    await cloud.callFunction({
      name: 'message',
      data: {
        action: 'sendReceiptNotice',
        orderId: orderId,
        dispatcherId: order.data.dispatcherId,
        orderName: order.data.name,
        craftsmanName: craftsmanRes.data[0].name
      }
    })
  } catch (err) {
    console.error('发送收款通知失败:', err)
  }
  
  return { 
    code: 0, 
    message: '收款确认成功，订单已完成',
    data: {
      paymentStatus: 'paid',
      status: 'completed',
      receiptConfirmedAt: new Date()
    }
  }
}

// ==================== 查询接口 ====================

// 获取待接单列表（派单大厅）
async function getPendingList(params) {
  const { page = 1, pageSize = 20 } = params
  
  const total = await db.collection('orders').where({ status: 'pending' }).count()
  
  const list = await db.collection('orders')
    .where({ status: 'pending' })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total
    }
  }
}

// 获取我的订单（手艺人）
async function getMyOrders(params, openid) {
  const { status = '', page = 1, pageSize = 20 } = params
  
  const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
  if (craftsmanRes.data.length === 0) {
    return { code: -1, message: '您还未注册为手艺人' }
  }
  
  const craftsmanId = craftsmanRes.data[0]._id
  
  let where = { craftsmanId }
  if (status) where.status = status
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('acceptDate', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total
    }
  }
}

// 获取派单人的订单
async function getDispatcherOrders(params, openid) {
  const { status = '', page = 1, pageSize = 20 } = params
  
  const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
  if (dispatcherRes.data.length === 0) {
    return { code: -1, message: '您还未注册为派单人' }
  }
  
  const dispatcherId = dispatcherRes.data[0]._id
  
  let where = { dispatcherId }
  if (status) where.status = status
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total
    }
  }
}

// 获取手艺人的订单（管理员用）
async function getCraftsmanOrders(params, openid) {
  const { craftsmanId, status = '', page = 1, pageSize = 20 } = params
  
  let where = { craftsmanId }
  if (status) where.status = status
  
  const total = await db.collection('orders').where(where).count()
  
  const list = await db.collection('orders')
    .where(where)
    .orderBy('acceptDate', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    data: {
      list: list.data,
      total: total.total
    }
  }
}

// ==================== 统计报表 ====================

// 获取全局统计（管理员）或派单人统计
async function getOrderStats(openid) {
  const userInfo = await checkUserRole(openid)
  
  let where = {}
  
  // 派单人只能看自己的统计
  if (!userInfo.isAdmin) {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      where.dispatcherId = dispatcherRes.data[0]._id
    }
  }
  
  const pending = await db.collection('orders').where({ ...where, status: 'pending' }).count()
  const accepted = await db.collection('orders').where({ ...where, status: 'accepted' }).count()
  const shipped = await db.collection('orders').where({ ...where, status: 'shipped' }).count()
  const completed = await db.collection('orders').where({ ...where, status: 'completed' }).count()
  const closed = await db.collection('orders').where({ ...where, status: 'closed' }).count()
  const cancelled = await db.collection('orders').where({ ...where, status: 'cancelled' }).count()
  const total = await db.collection('orders').where(where).count()
  
  return {
    code: 0,
    data: {
      pending: pending.total,
      accepted: accepted.total,
      shipped: shipped.total,
      completed: completed.total,
      closed: closed.total,
      cancelled: cancelled.total,
      total: total.total
    }
  }
}

// 获取派单人统计
async function getDispatcherStats(openid) {
  const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
  if (dispatcherRes.data.length === 0) {
    return { code: -1, message: '您还未注册为派单人' }
  }
  
  const dispatcherId = dispatcherRes.data[0]._id
  
  // 按状态统计
  const pending = await db.collection('orders').where({ dispatcherId, status: 'pending' }).count()
  const accepted = await db.collection('orders').where({ dispatcherId, status: 'accepted' }).count()
  const shipped = await db.collection('orders').where({ dispatcherId, status: 'shipped' }).count()
  const completed = await db.collection('orders').where({ dispatcherId, status: 'completed' }).count()
  const closed = await db.collection('orders').where({ dispatcherId, status: 'closed' }).count()
  const cancelled = await db.collection('orders').where({ dispatcherId, status: 'cancelled' }).count()
  
  // 统计本月完成的订单
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthCompleted = await db.collection('orders').where({
    dispatcherId,
    status: 'completed',
    completeDate: _.gte(monthStart)
  }).count()
  
  // 统计本月金额
  const monthOrders = await db.collection('orders').where({
    dispatcherId,
    status: 'completed',
    completeDate: _.gte(monthStart)
  }).get()
  
  const monthAmount = monthOrders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  
  return {
    code: 0,
    data: {
      pending: pending.total,
      accepted: accepted.total,
      shipped: shipped.total,
      completed: completed.total,
      closed: closed.total,
      cancelled: cancelled.total,
      monthCompleted: monthCompleted.total,
      monthAmount
    }
  }
}

// 获取手艺人统计
async function getCraftsmanStats(craftsmanId) {
  // 按状态统计
  const accepted = await db.collection('orders').where({ craftsmanId, status: 'accepted' }).count()
  const shipped = await db.collection('orders').where({ craftsmanId, status: 'shipped' }).count()
  const completed = await db.collection('orders').where({ craftsmanId, status: 'completed' }).count()
  const closed = await db.collection('orders').where({ craftsmanId, status: 'closed' }).count()
  
  // 统计本月完成的订单
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthCompleted = await db.collection('orders').where({
    craftsmanId,
    status: 'completed',
    completeDate: _.gte(monthStart)
  }).count()
  
  // 计算平均评分
  const ratings = await db.collection('ratings').where({ craftsmanId }).get()
  const avgRating = ratings.data.length > 0
    ? (ratings.data.reduce((sum, item) => sum + item.score, 0) / ratings.data.length).toFixed(1)
    : 0
  
  return {
    code: 0,
    data: {
      accepted: accepted.total,
      shipped: shipped.total,
      completed: completed.total,
      closed: closed.total,
      monthCompleted: monthCompleted.total,
      avgRating,
      totalRating: ratings.data.length
    }
  }
}

// 获取图表数据
async function getChartData(openid, role) {
  const userInfo = await checkUserRole(openid)
  
  // 获取最近30天的数据
  const days = 30
  const chartData = []
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    
    let where = {
      createTime: _.gte(date).and(_.lt(nextDate))
    }
    
    // 根据角色过滤
    if (!userInfo.isAdmin) {
      if (role === 'dispatcher') {
        const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
        if (dispatcherRes.data.length > 0) {
          where.dispatcherId = dispatcherRes.data[0]._id
        }
      } else if (role === 'craftsman') {
        const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
        if (craftsmanRes.data.length > 0) {
          where.craftsmanId = craftsmanRes.data[0]._id
        }
      }
    }
    
    const count = await db.collection('orders').where(where).count()
    
    chartData.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      count: count.total
    })
  }
  
  return {
    code: 0,
    data: chartData
  }
}

// ==================== 评价打分 ====================

// 给手艺人打分（派单人/管理员）
async function rateCraftsman(params, openid) {
  const { orderId, craftsmanId, score, comment } = params
  
  if (!score || score < 1 || score > 5) {
    return { code: -1, message: '评分必须在1-5之间' }
  }
  
  const userInfo = await checkUserRole(openid)
  
  // 检查订单是否已完成
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) return { code: -1, message: '订单不存在' }
  if (order.data.status !== 'completed') {
    return { code: -1, message: '只能给已完成的订单评分' }
  }
  
  // 检查权限（创建者或管理员）
  let canRate = userInfo.isAdmin
  if (!canRate) {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      canRate = order.data.dispatcherId === dispatcherRes.data[0]._id
    }
  }
  
  if (!canRate) {
    return { code: -1, message: '无权评价此订单' }
  }
  
  // 保存评分
  await db.collection('ratings').add({
    data: {
      orderId,
      craftsmanId,
      score,
      comment: comment || '',
      createTime: db.serverDate()
    }
  })
  
  // 获取订单的时间履约分（如果没有则重新计算）
  let timeScore = order.data.timeScore
  if (timeScore === undefined) {
    timeScore = calculateTimeScore(order.data)
    // 保存时间分到订单
    await db.collection('orders').doc(orderId).update({
      data: {
        timeScore: timeScore,
        updateTime: db.serverDate()
      }
    })
  }
  
  // 计算综合履约分 = 时间分 * 50% + 派单评分 * 50%
  const reliabilityScore = (timeScore * RELIABILITY_CONFIG.WEIGHT_TIME) + 
                          (score * RELIABILITY_CONFIG.WEIGHT_RATING)
  
  // 更新订单评分和综合履约分
  await db.collection('orders').doc(orderId).update({
    data: {
      rating: score,
      ratingComment: comment || '',
      reliabilityScore: parseFloat(reliabilityScore.toFixed(2)),
      updateTime: db.serverDate()
    }
  })
  
  // 更新手艺人平均评分
  const ratings = await db.collection('ratings').where({ craftsmanId }).get()
  const avgScore = (ratings.data.reduce((sum, item) => sum + item.score, 0) / ratings.data.length).toFixed(1)
  
  // 更新手艺人的履约分（基于所有订单的平均值）
  const reliabilityUpdate = await updateCraftsmanReliabilityScore(craftsmanId)
  
  await db.collection('craftsmen').doc(craftsmanId).update({
    data: {
      rating: parseFloat(avgScore),
      updateTime: db.serverDate()
    }
  })
  
  return { 
    code: 0, 
    message: '评价成功',
    data: {
      timeScore: timeScore,
      ratingScore: score,
      reliabilityScore: parseFloat(reliabilityScore.toFixed(2)),
      craftsmanReliability: reliabilityUpdate
    }
  }
}

// 获取手艺人评分
async function getCraftsmanRating(craftsmanId) {
  const ratings = await db.collection('ratings').where({ craftsmanId }).orderBy('createTime', 'desc').get()
  
  const avgScore = ratings.data.length > 0
    ? (ratings.data.reduce((sum, item) => sum + item.score, 0) / ratings.data.length).toFixed(1)
    : 0
  
  return {
    code: 0,
    data: {
      avgScore: parseFloat(avgScore),
      total: ratings.data.length,
      list: ratings.data
    }
  }
}

// ==================== 新增统计方法 ====================

// 获取月度趋势
async function getMonthlyTrend(params = {}, openid) {
  const userInfo = await checkUserRole(openid)
  const { months = 6, role } = params
  
  const result = []
  const now = new Date()
  
  for (let i = months - 1; i >= 0; i--) {
    const year = now.getFullYear()
    const month = now.getMonth() - i
    const targetDate = new Date(year, month, 1)
    const yearStr = targetDate.getFullYear()
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0')
    const monthKey = `${yearStr}-${monthStr}`
    
    const monthStart = new Date(yearStr, targetDate.getMonth(), 1)
    const monthEnd = new Date(yearStr, targetDate.getMonth() + 1, 1)
    
    let where = {
      createTime: _.gte(monthStart).and(_.lt(monthEnd))
    }
    
    // 根据角色过滤
    if (!userInfo.isAdmin) {
      if (role === 'dispatcher') {
        const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
        if (dispatcherRes.data.length > 0) {
          where.dispatcherId = dispatcherRes.data[0]._id
        }
      } else if (role === 'craftsman') {
        const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
        if (craftsmanRes.data.length > 0) {
          where.craftsmanId = craftsmanRes.data[0]._id
        }
      }
    }
    
    // 统计订单数
    const orderCount = await db.collection('orders').where(where).count()
    
    // 统计金额（仅已完成订单）
    let amountWhere = { ...where, status: 'completed' }
    const completedOrders = await db.collection('orders').where(amountWhere).get()
    const amount = completedOrders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    
    // 计算百分比（用于图表显示）
    const maxCount = 100 // 假设最大100单
    const orderPercent = Math.min((orderCount.total / maxCount) * 100, 100)
    
    result.push({
      month: monthKey,
      orderCount: orderCount.total,
      amount: amount.toFixed(2),
      completedCount: completedOrders.data.length,
      orderPercent,
      amountPercent: Math.min((amount / 10000) * 100, 100) // 假设最大1万
    })
  }
  
  return { code: 0, data: result }
}

// 获取排行榜（手艺人按完成订单金额和评价排序）
async function getRanking(params = {}, openid) {
  const userInfo = await checkUserRole(openid)
  
  // 只有管理员和派单人能看到排行
  if (!userInfo.isAdmin && userInfo.role !== 'dispatcher') {
    return { code: -1, message: '无权查看排行' }
  }
  
  const { type = 'craftsman', limit = 10 } = params
  
  if (type === 'craftsman') {
    // 获取所有手艺人
    const craftsmen = await db.collection('craftsmen').get()
    
    // 获取每个手艺人的完成订单金额和评价
    const ranking = await Promise.all(craftsmen.data.map(async (c) => {
      const orders = await db.collection('orders').where({
        craftsmanId: c._id,
        status: 'completed'
      }).get()
      
      const totalAmount = orders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
      
      return {
        _id: c._id,
        name: c.name,
        avatar: c.avatar || '',
        starLevel: c.starLevel || 0,
        completedOrders: c.completedOrders || 0,
        totalOrders: c.totalOrders || 0,
        totalAmount: totalAmount,
        rating: c.rating || 0
      }
    }))
    
    // 排序：先按完成订单金额降序，金额相同按评价降序
    ranking.sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) {
        return b.totalAmount - a.totalAmount
      }
      return b.rating - a.rating
    })
    
    // 取前 limit 个
    const topRanking = ranking.slice(0, limit)
    
    // 格式化金额
    const formattedRanking = topRanking.map(item => ({
      ...item,
      totalAmount: item.totalAmount.toFixed(2)
    }))
    
    return { code: 0, data: formattedRanking }
  }
  
  return { code: 0, data: [] }
}

// 获取个人统计（手艺人/派单人）
async function getPersonalStats(params = {}, openid) {
  const { role } = params
  
  if (role === 'craftsman') {
    // 手艺人统计
    const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
    if (craftsmanRes.data.length === 0) {
      return { code: -1, message: '未找到手艺人信息' }
    }
    
    const craftsman = craftsmanRes.data[0]
    
    // 统计各状态订单
    const total = await db.collection('orders').where({ craftsmanId: craftsman._id }).count()
    const accepted = await db.collection('orders').where({ craftsmanId: craftsman._id, status: 'accepted' }).count()
    const shipped = await db.collection('orders').where({ craftsmanId: craftsman._id, status: 'shipped' }).count()
    const completed = await db.collection('orders').where({ craftsmanId: craftsman._id, status: 'completed' }).count()
    
    // 计算总收入
    const completedOrders = await db.collection('orders').where({
      craftsmanId: craftsman._id,
      status: 'completed'
    }).get()
    
    const totalAmount = completedOrders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const completedAmount = totalAmount // 简化处理，实际可能需要扣除手续费等
    
    // 获取排名
    const higherCount = await db.collection('craftsmen').where({
      completedOrders: _.gt(craftsman.completedOrders || 0)
    }).count()
    
    return {
      code: 0,
      data: {
        totalOrders: total.total,
        completedOrders: completed.total,
        inProgressOrders: accepted.total + shipped.total,
        totalAmount,
        completedAmount,
        rating: craftsman.rating || 0,
        rank: higherCount.total + 1
      }
    }
  } else if (role === 'dispatcher') {
    // 派单人统计
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length === 0) {
      return { code: -1, message: '未找到派单人信息' }
    }
    
    const dispatcher = dispatcherRes.data[0]
    
    const total = await db.collection('orders').where({ dispatcherId: dispatcher._id }).count()
    const pending = await db.collection('orders').where({ dispatcherId: dispatcher._id, status: 'pending' }).count()
    const accepted = await db.collection('orders').where({ dispatcherId: dispatcher._id, status: 'accepted' }).count()
    const shipped = await db.collection('orders').where({ dispatcherId: dispatcher._id, status: 'shipped' }).count()
    const completed = await db.collection('orders').where({ dispatcherId: dispatcher._id, status: 'completed' }).count()
    
    const completedOrders = await db.collection('orders').where({
      dispatcherId: dispatcher._id,
      status: 'completed'
    }).get()
    
    const totalAmount = completedOrders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    
    return {
      code: 0,
      data: {
        totalOrders: total.total,
        pendingOrders: pending.total,
        acceptedOrders: accepted.total,
        shippedOrders: shipped.total,
        completedOrders: completed.total,
        totalAmount
      }
    }
  }
  
  return { code: -1, message: '未知角色类型' }
}

// 获取样式统计
async function getStyleStats(params = {}, openid) {
  const userInfo = await checkUserRole(openid)
  const { role } = params
  
  // 获取所有样式
  const styles = await db.collection('styles').get()
  
  // 获取订单统计
  let where = {}
  
  if (!userInfo.isAdmin && role === 'dispatcher') {
    const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
    if (dispatcherRes.data.length > 0) {
      where.dispatcherId = dispatcherRes.data[0]._id
    }
  }
  
  // 统计每个样式的订单数
  const stats = await Promise.all(styles.data.map(async (style) => {
    const count = await db.collection('orders').where({
      ...where,
      styleId: style._id
    }).count()
    
    return {
      styleId: style._id,
      styleName: style.name,
      count: count.total
    }
  }))
  
  // 计算百分比
  const totalCount = stats.reduce((sum, item) => sum + item.count, 0)
  const result = stats.map(item => ({
    ...item,
    percent: totalCount > 0 ? (item.count / totalCount * 100).toFixed(1) : 0
  })).sort((a, b) => b.count - a.count)
  
  return { code: 0, data: result }
}

// 更新getOrderStats以支持日期范围
async function getOrderStatsWithDate(params = {}, openid) {
  const userInfo = await checkUserRole(openid)
  const { startDate, endDate, role } = params
  
  let where = {}
  
  // 日期范围
  if (startDate && endDate) {
    where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate + ' 23:59:59')))
  }
  
  // 角色过滤
  if (!userInfo.isAdmin) {
    if (role === 'dispatcher') {
      const dispatcherRes = await db.collection('dispatchers').where({ openid }).get()
      if (dispatcherRes.data.length > 0) {
        where.dispatcherId = dispatcherRes.data[0]._id
      }
    } else if (role === 'craftsman') {
      const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
      if (craftsmanRes.data.length > 0) {
        where.craftsmanId = craftsmanRes.data[0]._id
      }
    }
  }
  
  // 统计各状态订单数
  const pending = await db.collection('orders').where({ ...where, status: 'pending' }).count()
  const accepted = await db.collection('orders').where({ ...where, status: 'accepted' }).count()
  const shipped = await db.collection('orders').where({ ...where, status: 'shipped' }).count()
  const completed = await db.collection('orders').where({ ...where, status: 'completed' }).count()
  const closed = await db.collection('orders').where({ ...where, status: 'closed' }).count()
  const cancelled = await db.collection('orders').where({ ...where, status: 'cancelled' }).count()
  const total = await db.collection('orders').where(where).count()
  
  // 统计总金额（包含已完成和已结束的订单）
  const completedOrders = await db.collection('orders').where({
    ...where,
    status: _.in(['completed', 'closed'])
  }).get()
  const totalAmount = completedOrders.data.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  
  // 计算月增长率
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const thisMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1)
  const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1)
  
  const thisMonthCount = await db.collection('orders').where({
    ...where,
    createTime: _.gte(thisMonthStart)
  }).count()
  
  const lastMonthCount = await db.collection('orders').where({
    ...where,
    createTime: _.gte(lastMonthStart).and(_.lt(thisMonthStart))
  }).count()
  
  const monthGrowth = lastMonthCount.total > 0
    ? ((thisMonthCount.total - lastMonthCount.total) / lastMonthCount.total * 100).toFixed(1)
    : 0
  
  return {
    code: 0,
    data: {
      pendingCount: pending.total,
      acceptedCount: accepted.total,
      shippedCount: shipped.total,
      completedCount: completed.total,
      closedCount: closed.total,
      cancelledCount: cancelled.total,
      totalCount: total.total,
      totalAmount,
      monthGrowth
    }
  }
}

// 注意：不要使用 module.exports 覆盖 exports.main
// 微信云函数需要 exports.main 作为入口

// ==================== 测试接口 ====================

// 测试：模拟确认付款
async function testConfirmPayment(params, openid) {
  const { orderId } = params
  
  if (!orderId) {
    return { code: -1, message: '缺少订单ID' }
  }
  
  try {
    await db.collection('orders').doc(orderId).update({
      data: {
        paymentStatus: 'pending_receipt',
        paymentConfirmedAt: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    return { code: 0, message: '模拟付款成功' }
  } catch (err) {
    console.error('模拟付款失败:', err)
    return { code: -1, message: err.message }
  }
}

// 测试：模拟确认收款
async function testConfirmReceipt(params, openid) {
  const { orderId } = params
  
  if (!orderId) {
    return { code: -1, message: '缺少订单ID' }
  }
  
  try {
    // 获取订单信息
    const orderRes = await db.collection('orders').doc(orderId).get()
    if (!orderRes.data) {
      return { code: -1, message: '订单不存在' }
    }
    
    const order = orderRes.data
    
    // 更新订单状态
    await db.collection('orders').doc(orderId).update({
      data: {
        paymentStatus: 'paid',
        status: 'completed',
        receiptConfirmedAt: db.serverDate(),
        completeTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // 更新手艺人统计
    if (order.craftsmanId) {
      await db.collection('craftsmen').doc(order.craftsmanId).update({
        data: {
          completedOrders: _.inc(1),
          updateTime: db.serverDate()
        }
      })
    }
    
    return { code: 0, message: '测试收款成功' }
  } catch (err) {
    console.error('测试收款失败:', err)
    return { code: -1, message: err.message }
  }
}
