/**
 * 用户上下文验证模块
 * 确保所有数据操作都是当前登录用户自己的数据
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 获取当前登录用户的完整上下文
 * @returns {Promise<Object>} 用户上下文
 */
async function getCurrentUserContext() {
  const { OPENID } = cloud.getWXContext()
  
  if (!OPENID) {
    throw new Error('未登录')
  }
  
  // 通过openid查找用户
  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  
  if (userRes.data.length === 0) {
    throw new Error('用户不存在')
  }
  
  const user = userRes.data[0]
  
  // 验证openid匹配
  if (user.openid !== OPENID) {
    throw new Error('身份验证失败')
  }
  
  // 获取验证后的角色
  const roleApps = user.roleApplications || []
  const validRoles = roleApps
    .filter(app => app.status === 'active')
    .map(app => app.role)
  
  // 合并传统角色（向下兼容）
  const legacyRoles = user.roles || []
  const allValidRoles = [...new Set([...validRoles, ...legacyRoles])]
  
  return {
    openid: OPENID,
    userId: user._id,
    phone: user.phone,
    name: user.name,
    roles: allValidRoles,
    currentRole: user.currentRole,
    isAdmin: allValidRoles.includes('admin') || user.isAdmin === true,
    rawUser: user
  }
}

/**
 * 获取当前用户的角色详情信息
 * @param {string} role - 角色名称 (craftsman/dispatcher)
 * @returns {Promise<Object|null>} 角色信息
 */
async function getCurrentUserRoleInfo(role) {
  const context = await getCurrentUserContext()
  
  // 验证用户有该角色
  if (!context.roles.includes(role)) {
    return null
  }
  
  const collection = role === 'craftsman' ? 'craftsmen' : 'dispatchers'
  
  // 通过openid查询（确保只能查到自己的）
  const roleRes = await db.collection(collection).where({ 
    openid: context.openid 
  }).get()
  
  if (roleRes.data.length === 0) {
    return null
  }
  
  return roleRes.data[0]
}

/**
 * 构建安全的订单查询条件
 * 确保只能查询当前用户自己的订单
 * @param {string} role - 当前角色
 * @returns {Promise<Object>} 安全的查询条件
 */
async function buildSecureOrderQuery(role) {
  const context = await getCurrentUserContext()
  const roleInfo = await getCurrentUserRoleInfo(role)
  
  if (!roleInfo) {
    throw new Error('无权访问该角色数据')
  }
  
  // 根据角色返回对应的查询字段
  if (role === 'craftsman') {
    return { 
      craftsmanId: roleInfo._id,
      craftsmanPhone: context.phone  // 双重验证
    }
  } else if (role === 'dispatcher') {
    return { 
      dispatcherId: roleInfo._id,
      dispatcherPhone: context.phone  // 双重验证
    }
  }
  
  throw new Error('未知角色')
}

/**
 * 验证用户是否有权访问特定订单
 * @param {string} orderId - 订单ID
 * @returns {Promise<boolean>} 是否有权
 */
async function canAccessOrder(orderId) {
  const context = await getCurrentUserContext()
  
  const orderRes = await db.collection('orders').doc(orderId).get()
  
  if (!orderRes.data) {
    return false
  }
  
  const order = orderRes.data
  
  // 验证用户是订单的派单人或手艺人
  const isDispatcher = order.dispatcherPhone === context.phone
  const isCraftsman = order.craftsmanPhone === context.phone
  
  return isDispatcher || isCraftsman
}

module.exports = {
  getCurrentUserContext,
  getCurrentUserRoleInfo,
  buildSecureOrderQuery,
  canAccessOrder
}
