/**
 * 用户状态诊断脚本
 * 用于检查和修复用户角色状态问题
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 检查用户状态
 */
async function debugUserStatus(openid) {
  console.log('[debug] 检查用户:', openid)
  
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  const report = {
    userId: user._id,
    phone: user.phone,
    openid: user.openid,
    roles: user.roles || [],
    currentRole: user.currentRole || '',
    isAdmin: user.isAdmin || false,
    roleApplications: (user.roleApplications || []).map(app => ({
      role: app.role,
      status: app.status,
      applyTime: app.applyTime
    })),
    issues: []
  }
  
  // 检查问题
  
  // 问题1: roles 中有角色但 roleApplications 中没有对应的 active 记录
  const activeApps = (user.roleApplications || [])
    .filter(app => app.status === 'active')
    .map(app => app.role)
  
  for (const role of (user.roles || [])) {
    if (!activeApps.includes(role) && role !== 'admin') {
      report.issues.push({
        type: '数据不一致',
        detail: `roles中有'${role}'，但roleApplications中没有active记录`,
        fixable: true
      })
    }
  }
  
  // 问题2: roleApplications 中有 active 但 roles 中没有
  for (const role of activeApps) {
    if (!(user.roles || []).includes(role)) {
      report.issues.push({
        type: '数据不一致',
        detail: `roleApplications中'${role}'为active，但roles中没有`,
        fixable: true
      })
    }
  }
  
  // 问题3: 有多个 pending 状态的同一角色
  const pendingApps = (user.roleApplications || [])
    .filter(app => app.status === 'pending')
  const pendingRoles = pendingApps.map(app => app.role)
  const uniquePendingRoles = [...new Set(pendingRoles)]
  if (pendingRoles.length > uniquePendingRoles.length) {
    report.issues.push({
      type: '重复申请',
      detail: '有重复的pending状态角色',
      fixable: true
    })
  }
  
  return { code: 0, data: report }
}

/**
 * 重置用户角色状态（用于测试）
 */
async function resetUserRole(openid, role) {
  const userRes = await db.collection('users').where({ openid }).get()
  
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  // 清除指定角色的所有记录
  const newRoleApps = (user.roleApplications || [])
    .filter(app => app.role !== role)
  
  const newRoles = (user.roles || [])
    .filter(r => r !== role)
  
  await db.collection('users').doc(user._id).update({
    data: {
      roles: newRoles,
      roleApplications: newRoleApps,
      updateTime: db.serverDate()
    }
  })
  
  // 同时删除角色详情记录
  if (role === 'craftsman') {
    await db.collection('craftsmen').where({ openid }).remove()
  } else if (role === 'dispatcher') {
    await db.collection('dispatchers').where({ openid }).remove()
  }
  
  return { code: 0, message: '已重置' }
}

module.exports = { debugUserStatus, resetUserRole }
