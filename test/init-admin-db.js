/**
 * 初始化管理员集合 - 控制台直接执行版本
 * 在控制台粘贴并执行此代码
 */

async function initAdminCollection() {
  const db = wx.cloud.database()
  
  console.log('开始初始化管理员集合...')
  
  try {
    // 1. 检查集合是否存在（通过查询触发自动创建）
    try {
      await db.collection('adminUsers').limit(1).get()
      console.log('✅ adminUsers 集合已存在')
    } catch (e) {
      console.log('ℹ️ 集合不存在，将自动创建')
    }
    
    // 2. 检查管理员是否已存在
    const { data: existing } = await db.collection('adminUsers')
      .where({ phone: '13810062394' })
      .get()
    
    if (existing.length > 0) {
      // 更新密码
      await db.collection('adminUsers').doc(existing[0]._id).update({
        data: {
          password: '880323',
          name: '超级管理员',
          roles: ['admin'],
          isSuperAdmin: true,
          status: 'active',
          updateTime: new Date()
        }
      })
      console.log('✅ 管理员密码已更新为: 880323')
      console.log('管理员ID:', existing[0]._id)
    } else {
      // 创建新管理员
      const result = await db.collection('adminUsers').add({
        data: {
          phone: '13810062394',
          password: '880323',
          name: '超级管理员',
          roles: ['admin'],
          isSuperAdmin: true,
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      console.log('✅ 管理员创建成功!')
      console.log('手机号: 13810062394')
      console.log('密码: 880323')
      console.log('ID:', result._id)
    }
    
    // 3. 验证创建
    const { data: verify } = await db.collection('adminUsers')
      .where({ phone: '13810062394' })
      .get()
    
    if (verify.length > 0) {
      console.log('\n📋 管理员信息:')
      console.log('  - 姓名:', verify[0].name)
      console.log('  - 手机号:', verify[0].phone)
      console.log('  - 角色:', verify[0].roles?.join(', '))
      console.log('  - 状态:', verify[0].status)
      console.log('\n🎉 初始化完成!')
    }
    
    return { success: true }
    
  } catch (err) {
    console.error('❌ 初始化失败:', err.message)
    return { success: false, msg: err.message }
  }
}

// 执行
initAdminCollection().then(r => console.log('结果:', r))

// 挂载到全局供后续调用
if (typeof window !== 'undefined') {
  window.initAdminCollection = initAdminCollection
}
if (typeof globalThis !== 'undefined') {
  globalThis.initAdminCollection = initAdminCollection
}
