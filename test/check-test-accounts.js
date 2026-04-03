/**
 * 检查测试账号状态
 * 在微信开发者工具控制台运行:
 *   await checkTestAccounts()
 */

async function checkTestAccounts() {
  const db = wx.cloud.database()
  
  console.log('\n' + '='.repeat(60))
  console.log('🔍 测试账号状态检查')
  console.log('='.repeat(60))

  const testAccounts = [
    { phone: '13800138001', password: '123456', role: '派单人' },
    { phone: '13800138002', password: '123456', role: '手艺人' },
    { phone: '13810062394', password: '880323', role: '超级管理员' }
  ]

  for (const account of testAccounts) {
    console.log(`\n📱 ${account.role}: ${account.phone}`)
    console.log('-'.repeat(40))
    
    try {
      // 查询用户
      const { data: users } = await db.collection('users').where({
        phone: account.phone
      }).get()
      
      if (users.length === 0) {
        console.log('❌ 状态: 账号不存在（未注册）')
        console.log('💡 解决方案: 先运行注册流程或创建账号')
        continue
      }
      
      const user = users[0]
      
      // 显示基本信息
      console.log('✅ 状态: 已注册')
      console.log(`   用户名: ${user.name}`)
      console.log(`   密码类型: ${user.password.length === 32 ? 'MD5加密' : '明文存储'}`)
      console.log(`   OpenID: ${user.openid ? '已绑定' : '未绑定'}`)
      
      // 检查角色申请状态
      if (user.roleApplications && user.roleApplications.length > 0) {
        console.log('\n   角色申请状态:')
        user.roleApplications.forEach((app, idx) => {
          const statusIcon = app.status === 'active' ? '✅' : (app.status === 'pending' ? '⏳' : '❌')
          console.log(`     ${idx + 1}. ${app.role}: ${statusIcon} ${app.status}`)
        })
      } else {
        console.log('   角色申请: 无')
      }
      
      // 检查已分配角色
      console.log(`\n   已分配角色: ${user.roles?.join(', ') || '无'}`)
      console.log(`   当前角色: ${user.currentRole || '无'}`)
      
      // 检查对应角色集合状态
      const roleColl = account.role === '手艺人' ? 'craftsmen' : 
                       account.role === '派单人' ? 'dispatchers' : null
      
      if (roleColl) {
        const { data: roleDocs } = await db.collection(roleColl).where({
          phone: account.phone
        }).get()
        
        if (roleDocs.length > 0) {
          console.log(`\n   ${account.role}集合状态: ${roleDocs[0].status || '无状态'}`)
        } else {
          console.log(`\n   ⚠️ ${account.role}集合: 不存在`)
        }
      }
      
      // 验证密码
      console.log('\n   密码验证:')
      const crypto = {
        createHash: (algo) => ({
          update: (data) => ({
            digest: (format) => {
              // 简单的MD5模拟，仅用于显示
              return 'md5_hash_' + data
            }
          })
        })
      }
      
      // 检查密码是否匹配
      const inputPassword = account.password
      const storedPassword = user.password
      
      if (inputPassword === storedPassword) {
        console.log('     ✅ 明文密码匹配')
      } else if (storedPassword.length === 32) {
        console.log('     ℹ️ 密码为MD5加密，请使用正确的密码登录')
        console.log(`     存储的MD5: ${storedPassword}`)
      } else {
        console.log('     ❌ 密码不匹配')
        console.log(`     输入: ${inputPassword}`)
        console.log(`     存储: ${storedPassword}`)
      }
      
      // 登录可行性总结
      console.log('\n   登录检查:')
      if (!user.roles || user.roles.length === 0) {
        console.log('     ⚠️ 警告: 账号未分配角色，无法登录')
        console.log('     💡 解决方案: 使用超级管理员审批此账号')
      } else if (!user.currentRole) {
        console.log('     ⚠️ 警告: 账号无当前角色，可能无法登录')
      } else {
        console.log('     ✅ 账号状态正常，可以登录')
      }
      
    } catch (err) {
      console.log('❌ 查询失败:', err.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('检查完成')
  console.log('='.repeat(60))
}

// 修复测试账号
async function fixTestAccounts() {
  const db = wx.cloud.database()
  const _ = db.command
  
  console.log('\n' + '='.repeat(60))
  console.log('🔧 修复测试账号')
  console.log('='.repeat(60))
  
  // 修复派单人
  console.log('\n📱 修复派单人 (13800138001)...')
  const { data: dispatcherUsers } = await db.collection('users').where({
    phone: '13800138001'
  }).get()
  
  if (dispatcherUsers.length > 0) {
    const user = dispatcherUsers[0]
    
    // 确保密码正确
    let needUpdate = false
    const updateData = {}
    
    if (user.password !== '123456' && user.password.length !== 32) {
      // 密码不正确，需要修复
      const crypto = require('crypto')
      updateData.password = crypto.createHash('md5').update('123456').digest('hex')
      needUpdate = true
      console.log('   修复密码为MD5加密')
    }
    
    // 确保有角色
    if (!user.roles || user.roles.length === 0) {
      updateData.roles = ['dispatcher']
      updateData.currentRole = 'dispatcher'
      updateData.roleApplications = [{
        role: 'dispatcher',
        status: 'active',
        applyTime: new Date(),
        reviewTime: new Date()
      }]
      needUpdate = true
      console.log('   修复角色分配')
    }
    
    if (needUpdate) {
      updateData.updateTime = new Date()
      await db.collection('users').doc(user._id).update({ data: updateData })
      console.log('   ✅ 派单人账号已修复')
    } else {
      console.log('   ✅ 派单人账号正常')
    }
    
    // 确保dispatchers集合有记录
    const { data: dispatchers } = await db.collection('dispatchers').where({
      phone: '13800138001'
    }).get()
    
    if (dispatchers.length === 0) {
      await db.collection('dispatchers').add({
        data: {
          phone: '13800138001',
          name: '测试派单人A',
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      console.log('   ✅ 创建dispatchers记录')
    }
  } else {
    console.log('   派单人不存在，创建新账号...')
    const crypto = require('crypto')
    await db.collection('users').add({
      data: {
        phone: '13800138001',
        password: crypto.createHash('md5').update('123456').digest('hex'),
        name: '测试派单人A',
        roles: ['dispatcher'],
        currentRole: 'dispatcher',
        roleApplications: [{
          role: 'dispatcher',
          status: 'active',
          applyTime: new Date(),
          reviewTime: new Date()
        }],
        createTime: new Date(),
        updateTime: new Date()
      }
    })
    await db.collection('dispatchers').add({
      data: {
        phone: '13800138001',
        name: '测试派单人A',
        status: 'active',
        createTime: new Date(),
        updateTime: new Date()
      }
    })
    console.log('   ✅ 派单人账号已创建')
  }
  
  // 修复手艺人
  console.log('\n📱 修复手艺人 (13800138002)...')
  const { data: craftsmanUsers } = await db.collection('users').where({
    phone: '13800138002'
  }).get()
  
  if (craftsmanUsers.length > 0) {
    const user = craftsmanUsers[0]
    
    let needUpdate = false
    const updateData = {}
    
    if (user.password !== '123456' && user.password.length !== 32) {
      const crypto = require('crypto')
      updateData.password = crypto.createHash('md5').update('123456').digest('hex')
      needUpdate = true
      console.log('   修复密码为MD5加密')
    }
    
    if (!user.roles || user.roles.length === 0) {
      updateData.roles = ['craftsman']
      updateData.currentRole = 'craftsman'
      updateData.roleApplications = [{
        role: 'craftsman',
        status: 'active',
        applyTime: new Date(),
        reviewTime: new Date()
      }]
      needUpdate = true
      console.log('   修复角色分配')
    }
    
    if (needUpdate) {
      updateData.updateTime = new Date()
      await db.collection('users').doc(user._id).update({ data: updateData })
      console.log('   ✅ 手艺人账号已修复')
    } else {
      console.log('   ✅ 手艺人账号正常')
    }
    
    // 确保craftsmen集合有记录
    const { data: craftsmen } = await db.collection('craftsmen').where({
      phone: '13800138002'
    }).get()
    
    if (craftsmen.length === 0) {
      await db.collection('craftsmen').add({
        data: {
          phone: '13800138002',
          name: '测试手艺人B',
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      console.log('   ✅ 创建craftsmen记录')
    }
  } else {
    console.log('   手艺人不存在，创建新账号...')
    const crypto = require('crypto')
    await db.collection('users').add({
      data: {
        phone: '13800138002',
        password: crypto.createHash('md5').update('123456').digest('hex'),
        name: '测试手艺人B',
        roles: ['craftsman'],
        currentRole: 'craftsman',
        roleApplications: [{
          role: 'craftsman',
          status: 'active',
          applyTime: new Date(),
          reviewTime: new Date()
        }],
        createTime: new Date(),
        updateTime: new Date()
      }
    })
    await db.collection('craftsmen').add({
      data: {
        phone: '13800138002',
        name: '测试手艺人B',
        status: 'active',
        createTime: new Date(),
        updateTime: new Date()
      }
    })
    console.log('   ✅ 手艺人账号已创建')
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('修复完成！请重新尝试登录')
  console.log('='.repeat(60))
}

// 挂载到全局
if (typeof window !== 'undefined') {
  window.checkTestAccounts = checkTestAccounts
  window.fixTestAccounts = fixTestAccounts
}
if (typeof globalThis !== 'undefined') {
  globalThis.checkTestAccounts = checkTestAccounts
  globalThis.fixTestAccounts = fixTestAccounts
}

console.log('\n' + '='.repeat(60))
console.log('✅ 账号检查工具已加载')
console.log('='.repeat(60))
console.log('使用方式:')
console.log('  await checkTestAccounts()  // 检查账号状态')
console.log('  await fixTestAccounts()    // 修复账号问题')
console.log('='.repeat(60) + '\n')

module.exports = { checkTestAccounts, fixTestAccounts }
