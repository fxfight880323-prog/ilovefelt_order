/**
 * 创建管理员集合并添加管理员
 * 在控制台完整粘贴此代码执行
 */

async function createAdminDB() {
  const db = wx.cloud.database()
  
  console.log('🚀 开始创建管理员数据库...')
  
  // 方法1：通过云函数创建（推荐）
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'api',
      data: {
        module: 'auth',
        action: 'register',
        phone: '13810062394',
        password: '880323',
        name: '超级管理员',
        requestRole: 'admin'
      }
    })
    
    console.log('注册结果:', result)
    
    if (result.success || result.code === -1002) {
      console.log('✅ 管理员账号创建成功或已存在')
      
      // 直接在数据库中设置为已审批
      const { data: user } = await db.collection('users')
        .where({ phone: '13810062394' })
        .get()
      
      if (user.length > 0) {
        await db.collection('users').doc(user[0]._id).update({
          data: {
            roles: ['admin'],
            currentRole: 'admin',
            'roleApplications.0.status': 'active'
          }
        })
        console.log('✅ 管理员已审批通过')
      }
      
      return { success: true, msg: '管理员创建成功' }
    }
  } catch (err) {
    console.log('云函数方式失败，尝试直接数据库操作:', err.message)
  }
  
  // 方法2：直接操作数据库
  console.log('📦 使用数据库方式创建...')
  
  try {
    // 步骤1：触发创建 users 集合（如果不存在）
    try {
      await db.collection('users').limit(1).get()
    } catch (e) {
      console.log('集合可能不存在，尝试添加数据...')
    }
    
    // 步骤2：检查管理员是否已存在
    const { data: existing } = await db.collection('users')
      .where({ phone: '13810062394' })
      .get()
    
    if (existing.length > 0) {
      // 更新为管理员
      await db.collection('users').doc(existing[0]._id).update({
        data: {
          name: '超级管理员',
          roles: ['admin'],
          currentRole: 'admin',
          'roleApplications.0.status': 'active'
        }
      })
      console.log('✅ 现有用户已更新为管理员')
      return { success: true, msg: '管理员已更新' }
    }
    
    // 步骤3：创建新管理员
    const result = await db.collection('users').add({
      data: {
        phone: '13810062394',
        password: '880323',
        name: '超级管理员',
        roles: ['admin'],
        currentRole: 'admin',
        roleApplications: [{
          role: 'admin',
          status: 'active',
          applyTime: new Date()
        }],
        createTime: new Date()
      }
    })
    
    console.log('✅ 管理员创建成功!')
    console.log('📱 手机号: 13810062394')
    console.log('🔑 密码: 880323')
    console.log('🆔 ID:', result._id)
    
    return { success: true, msg: '创建成功', id: result._id }
    
  } catch (err) {
    console.error('❌ 创建失败:', err)
    console.log('请检查数据库权限，确保可读写')
    return { success: false, msg: err.message }
  }
}

// 立即执行
createAdminDB().then(r => {
  console.log('最终结果:', r)
})

// 挂载到全局
if (typeof window !== 'undefined') window.createAdminDB = createAdminDB
if (typeof globalThis !== 'undefined') globalThis.createAdminDB = createAdminDB
