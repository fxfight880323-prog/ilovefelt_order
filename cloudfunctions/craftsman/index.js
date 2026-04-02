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
  // 等级划分
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

// 获取手艺人的履约分统计
async function getCraftsmanReliabilityStats(craftsmanId) {
  const craftsmanRes = await db.collection('craftsmen').doc(craftsmanId).get()
  if (!craftsmanRes.data) return null
  
  const craftsman = craftsmanRes.data
  
  // 获取该手艺人所有已评价的订单
  const ratedOrders = await db.collection('orders').where({
    craftsmanId: craftsmanId,
    status: 'completed',
    reliabilityScore: _.exists(true)
  }).get()
  
  // 计算各项平均分
  let avgTimeScore = 0
  let avgRatingScore = 0
  let avgReliabilityScore = craftsman.reliabilityScore || RELIABILITY_CONFIG.INITIAL_SCORE
  
  if (ratedOrders.data.length > 0) {
    const totalTimeScore = ratedOrders.data.reduce((sum, order) => sum + (order.timeScore || 0), 0)
    const totalRatingScore = ratedOrders.data.reduce((sum, order) => sum + (order.rating || 0), 0)
    const totalReliabilityScore = ratedOrders.data.reduce((sum, order) => sum + (order.reliabilityScore || 0), 0)
    
    avgTimeScore = totalTimeScore / ratedOrders.data.length
    avgRatingScore = totalRatingScore / ratedOrders.data.length
    avgReliabilityScore = totalReliabilityScore / ratedOrders.data.length
  }
  
  const level = calculateReliabilityLevel(avgReliabilityScore)
  
  return {
    score: parseFloat(avgReliabilityScore.toFixed(2)),
    level: level.label,
    color: level.color,
    ratedOrders: ratedOrders.data.length,
    avgTimeScore: parseFloat(avgTimeScore.toFixed(2)),
    avgRatingScore: parseFloat(avgRatingScore.toFixed(2))
  }
}

exports.main = async (event, context) => {
  const { action, data } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'getOpenid':
        return { openid: OPENID }
      case 'checkUserRole':
        return await checkUserRole(OPENID)
      case 'getList':
        return await getCraftsmanList()
      case 'getPendingList':
        return await getPendingList()
      case 'getDetail':
        return await getCraftsmanDetail(data)
      case 'add':
        return await addCraftsman(data)
      case 'update':
        return await updateCraftsman(data)
      case 'delete':
        return await deleteCraftsman(data)
      case 'getStats':
        return await getCraftsmanStats(data)
      case 'updateReliabilityScore':
        return await handleUpdateReliabilityScore(data)
      case 'getReliabilityConfig':
        return { 
          code: 0, 
          data: {
            ...RELIABILITY_CONFIG,
            getLevel: calculateReliabilityLevel
          }
        }
      // 以下接口由 user 云函数接管，保留兼容
      case 'register':
        return { code: -1, message: '请使用 user.registerCraftsman 接口' }
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('操作失败:', err)
    return { code: -1, message: err.message }
  }
}

// 检查用户角色（兼容多角色）
async function checkUserRole(openid) {
  // 优先从 users 表查询
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    let craftsmanInfo = null
    
    // 支持多角色：检查 roles 数组或 role 字段
    const roles = user.roles || [user.role]
    const currentRole = user.currentRole || user.role
    
    // 如果用户有手艺人角色，获取手艺人信息
    if (roles.includes('craftsman') || user.role === 'craftsman') {
      const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
      craftsmanInfo = craftsmanRes.data[0] || null
    }
    
    return {
      code: 0,
      data: {
        openid,
        isAdmin: roles.includes('admin'),
        userRole: currentRole,
        roles,
        craftsmanInfo
      }
    }
  }
  
  // 兼容旧数据：直接在 craftsmen 表查询
  const craftsmanRes = await db.collection('craftsmen').where({ openid }).get()
  if (craftsmanRes.data.length > 0) {
    return {
      code: 0,
      data: {
        openid,
        isAdmin: false,
        userRole: 'craftsman',
        roles: ['craftsman'],
        craftsmanInfo: craftsmanRes.data[0]
      }
    }
  }
  
  return {
    code: 0,
    data: {
      openid,
      isAdmin: false,
      userRole: 'guest',
      roles: ['guest'],
      craftsmanInfo: null
    }
  }
}

// 获取手艺人列表
async function getCraftsmanList() {
  const list = await db.collection('craftsmen')
    .where({
      status: _.in(['active', undefined]) // 只显示已审核或旧数据
    })
    .orderBy('starLevel', 'desc')
    .get()
  
  return {
    code: 0,
    data: list.data
  }
}

// 获取待审核手艺人列表
async function getPendingList() {
  const res = await db.collection('craftsmen')
    .where({ status: 'pending' })
    .orderBy('createTime', 'desc')
    .get()
  
  return {
    code: 0,
    data: res.data
  }
}

// 获取手艺人详情
async function getCraftsmanDetail(data) {
  const { id } = data
  
  const craftsman = await db.collection('craftsmen').doc(id).get()
  
  return {
    code: 0,
    data: craftsman.data
  }
}

// 添加手艺人（管理员功能）
async function addCraftsman(data) {
  const { name, phone, starLevel, specialty, performance, wechatId, experience, address, avatarUrl, code } = data
  
  const result = await db.collection('craftsmen').add({
    data: {
      name,
      code: code || '', // 制作师代号
      phone: phone || '',
      wechatId: wechatId || '',
      starLevel: starLevel || 3,
      specialty: specialty || '',
      experience: experience || '',
      address: address || '',
      performance: performance || '中',
      avatarUrl: avatarUrl || '',
      openid: '', // 等待用户绑定
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      reliabilityScore: RELIABILITY_CONFIG.INITIAL_SCORE, // 初始履约分
      reliabilityLevel: calculateReliabilityLevel(RELIABILITY_CONFIG.INITIAL_SCORE).label, // 初始等级
      status: 'active', // 管理员添加的直接激活
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  })
  
  return {
    code: 0,
    message: '添加成功',
    data: { _id: result._id }
  }
}

// 更新手艺人
async function updateCraftsman(data) {
  const { id, ...updateData } = data
  
  await db.collection('craftsmen').doc(id).update({
    data: {
      ...updateData,
      updateTime: db.serverDate()
    }
  })
  
  return { code: 0, message: '更新成功' }
}

// 删除手艺人
async function deleteCraftsman(data) {
  const { id } = data
  
  await db.collection('craftsmen').doc(id).remove()
  
  return { code: 0, message: '删除成功' }
}

// 获取手艺人统计
async function getCraftsmanStats(data) {
  const { craftsmanId } = data
  
  // 获取总接单数
  const totalRes = await db.collection('orders').where({
    craftsmanId
  }).count()
  
  // 获取进行中订单数
  const pendingRes = await db.collection('orders').where({
    craftsmanId,
    status: 'accepted'
  }).count()
  
  // 获取已完成订单数
  const completedRes = await db.collection('orders').where({
    craftsmanId,
    status: 'completed'
  }).count()
  
  // 计算总收入
  const orders = await db.collection('orders').where({
    craftsmanId,
    status: 'completed'
  }).get()
  
  const totalIncome = orders.data.reduce((sum, order) => sum + (order.totalPrice || 0), 0)
  
  // 获取手艺人的履约分统计（基于时间和评分综合计算）
  const reliabilityStats = await getCraftsmanReliabilityStats(craftsmanId)
  
  return {
    code: 0,
    data: {
      totalOrders: totalRes.total,
      pendingOrders: pendingRes.total,
      completedOrders: completedRes.total,
      totalIncome: totalIncome.toFixed(2),
      reliabilityScore: reliabilityStats ? reliabilityStats.score.toFixed(1) : RELIABILITY_CONFIG.INITIAL_SCORE.toFixed(1),
      reliabilityLevel: reliabilityStats ? reliabilityStats.level : '优秀',
      reliabilityColor: reliabilityStats ? reliabilityStats.color : RELIABILITY_CONFIG.LEVELS.EXCELLENT.color,
      ratedOrders: reliabilityStats ? reliabilityStats.ratedOrders : 0,
      avgTimeScore: reliabilityStats ? reliabilityStats.avgTimeScore.toFixed(1) : '5.0',
      avgRatingScore: reliabilityStats ? reliabilityStats.avgRatingScore.toFixed(1) : '5.0'
    }
  }
}

// 处理履约分查询（供外部调用）
async function handleUpdateReliabilityScore(data) {
  const { craftsmanId } = data
  if (!craftsmanId) {
    return { code: -1, message: '缺少手艺人ID' }
  }
  
  const result = await getCraftsmanReliabilityStats(craftsmanId)
  if (!result) {
    return { code: -1, message: '手艺人不存在' }
  }
  
  return { code: 0, message: '查询成功', data: result }
}

// 导出让其他云函数使用
module.exports.getCraftsmanReliabilityStats = getCraftsmanReliabilityStats
module.exports.calculateReliabilityLevel = calculateReliabilityLevel
module.exports.calculateTimeScore = calculateTimeScore
module.exports.RELIABILITY_CONFIG = RELIABILITY_CONFIG
