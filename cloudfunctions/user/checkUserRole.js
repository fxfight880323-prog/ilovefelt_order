/**
 * 用户角色状态检查脚本
 * 用于测试角色隔离功能
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 检查用户角色状态
 * @param {string} phone - 用户手机号
 */
async function checkUserRole(phone) {
  const userRes = await db.collection('users').where({ phone }).get()
  
  if (userRes.data.length === 0) {
    console.log(`[${phone}] 用户不存在`)
    return null
  }
  
  const user = userRes.data[0]
  const roleApps = user.roleApplications || []
  
  console.log(`\n========== 用户 ${phone} 角色状态 ==========`)
  console.log('OpenID:', user.openid)
  console.log('\n【roleApplications 数组】:')
  roleApps.forEach((app, i) => {
    console.log(`  ${i + 1}. ${app.role}: ${app.status}`)
  })
  
  console.log('\n【roles 字段】:', user.roles || [])
  console.log('【currentRole】:', user.currentRole || user.role || '空')
  console.log('【isAdmin】:', user.isAdmin || false)
  
  // 角色隔离验证
  const activeRoles = roleApps
    .filter(app => app.status === 'active')
    .map(app => app.role)
  const pendingRoles = roleApps
    .filter(app => app.status === 'pending')
    .map(app => app.role)
  
  console.log('\n【角色隔离验证】:')
  console.log('  应该返回的角色 (active):', activeRoles)
  console.log('  审核中的角色 (pending):', pendingRoles)
  
  // 验证一致性
  const dbRoles = user.roles || []
  const hasMismatch = !activeRoles.every(r => dbRoles.includes(r))
  if (hasMismatch) {
    console.log('\n⚠️ 警告: roles 字段与 active 状态不一致!')
    console.log('  建议修复: 将 roles 设置为', activeRoles)
  }
  
  console.log('\n========================================\n')
  
  return {
    phone,
    openid: user.openid,
    activeRoles,
    pendingRoles,
    dbRoles,
    isAdmin: user.isAdmin || false
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const phone = process.argv[2] || '13800000001'
  checkUserRole(phone).then(result => {
    console.log('检查完成')
    process.exit(0)
  }).catch(err => {
    console.error('检查失败:', err)
    process.exit(1)
  })
}

module.exports = { checkUserRole }
