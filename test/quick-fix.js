/**
 * 快速修复测试账号
 * 在微信开发者工具控制台运行:
 *   await quickFixTestAccounts()
 */

async function quickFixTestAccounts() {
  const db = wx.cloud.database()
  const _ = db.command
  
  console.log('\n' + '='.repeat(60))
  console.log('🔧 快速修复测试账号')
  console.log('='.repeat(60))

  // 测试账号配置
  const accounts = [
    {
      phone: '13800138001',
      password: '123456',
      name: '测试派单人A',
      role: 'dispatcher',
      collection: 'dispatchers'
    },
    {
      phone: '13800138002',
      password: '123456',
      name: '测试手艺人B',
      role: 'craftsman',
      collection: 'craftsmen'
    }
  ]

  for (const account of accounts) {
    console.log(`\n📱 处理: ${account.name} (${account.phone})`)
    
    try {
      // 检查用户是否存在
      const { data: users } = await db.collection('users').where({
        phone: account.phone
      }).get()
      
      // 计算MD5密码（云函数使用MD5）
      // 注意：这里我们直接存储明文，因为登录时同时支持明文和MD5
      const passwordToStore = account.password  // 存储明文，方便测试
      
      if (users.length === 0) {
        // 创建用户
        console.log('   创建用户...')
        const userData = {
          phone: account.phone,
          password: passwordToStore,
          name: account.name,
          roles: [account.role],
          currentRole: account.role,
          roleApplications: [{
            role: account.role,
            status: 'active',
            applyTime: new Date(),
            reviewTime: new Date()
          }],
          createTime: new Date(),
          updateTime: new Date()
        }
        
        const { _id } = await db.collection('users').add({ data: userData })
        console.log('   ✅ 用户创建成功:', _id)
      } else {
        // 更新现有用户
        console.log('   更新用户...')
        const user = users[0]
        
        await db.collection('users').doc(user._id).update({
          data: {
            password: passwordToStore,
            roles: [account.role],
            currentRole: account.role,
            'roleApplications.0.status': 'active',
            updateTime: new Date()
          }
        })
        console.log('   ✅ 用户更新成功')
      }
      
      // 检查角色集合
      const { data: roleDocs } = await db.collection(account.collection).where({
        phone: account.phone
      }).get()
      
      if (roleDocs.length === 0) {
        // 创建角色记录
        console.log(`   创建${account.collection}记录...`)
        await db.collection(account.collection).add({
          data: {
            phone: account.phone,
            name: account.name,
            status: 'active',
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        console.log('   ✅ 角色记录创建成功')
      } else {
        // 更新角色记录
        await db.collection(account.collection).doc(roleDocs[0]._id).update({
          data: {
            status: 'active',
            updateTime: new Date()
          }
        })
        console.log('   ✅ 角色记录更新成功')
      }
      
    } catch (err) {
      console.log('   ❌ 错误:', err.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ 修复完成！')
  console.log('\n现在可以使用以下账号登录:')
  console.log('  派单人: 13800138001 / 123456')
  console.log('  手艺人: 13800138002 / 123456')
  console.log('='.repeat(60))
  
  // 验证
  console.log('\n🔍 验证账号...')
  for (const account of accounts) {
    const { data: users } = await db.collection('users').where({
      phone: account.phone
    }).get()
    
    if (users.length > 0) {
      const user = users[0]
      console.log(`\n${account.name}:`)
      console.log(`  密码: ${user.password}`)
      console.log(`  角色: ${user.roles?.join(', ')}`)
      console.log(`  当前角色: ${user.currentRole}`)
      console.log(`  状态: ✅ 正常`)
    }
  }
}

// 检查账号详情
async function showAccountDetails() {
  const db = wx.cloud.database()
  
  console.log('\n' + '='.repeat(60))
  console.log('🔍 账号详情')
  console.log('='.repeat(60))
  
  const phones = ['13800138001', '13800138002', '13810062394']
  
  for (const phone of phones) {
    const { data: users } = await db.collection('users').where({ phone }).get()
    
    console.log(`\n📱 ${phone}:`)
    
    if (users.length === 0) {
      console.log('  ❌ 不存在')
      continue
    }
    
    const user = users[0]
    console.log(`  用户名: ${user.name}`)
    console.log(`  密码: ${user.password}`)
    console.log(`  密码长度: ${user.password?.length}`)
    console.log(`  角色: ${JSON.stringify(user.roles)}`)
    console.log(`  当前角色: ${user.currentRole}`)
    console.log(`  OpenID: ${user.openid ? '有' : '无'}`)
    
    if (user.roleApplications) {
      console.log('  角色申请:')
      user.roleApplications.forEach(app => {
        console.log(`    - ${app.role}: ${app.status}`)
      })
    }
  }
  
  console.log('\n' + '='.repeat(60))
}

// 挂载到全局
if (typeof window !== 'undefined') {
  window.quickFixTestAccounts = quickFixTestAccounts
  window.showAccountDetails = showAccountDetails
}
if (typeof globalThis !== 'undefined') {
  globalThis.quickFixTestAccounts = quickFixTestAccounts
  globalThis.showAccountDetails = showAccountDetails
}

console.log('\n' + '='.repeat(60))
console.log('✅ 快速修复工具已加载')
console.log('='.repeat(60))
console.log('使用方式:')
console.log('  await quickFixTestAccounts()  // 修复账号')
console.log('  await showAccountDetails()    // 查看详情')
console.log('='.repeat(60) + '\n')

module.exports = { quickFixTestAccounts, showAccountDetails }
