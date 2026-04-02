/**
 * 初始化超级管理员 - 完整版
 * 确保超级管理员 13810062394 / 880323 可以正常登录
 * 在微信开发者工具控制台完整粘贴执行
 */

async function initSuperAdmin() {
  const db = wx.cloud.database()
  
  console.log('🚀 开始初始化超级管理员...\n')
  
  try {
    // 步骤1: 确保 users 集合存在
    console.log('步骤1: 检查 users 集合...')
    try {
      await db.collection('users').limit(1).get()
      console.log('✅ users 集合已存在\n')
    } catch (e) {
      console.log('⚠️ users 集合不存在，尝试创建...')
      try {
        await db.collection('users').add({
          data: { _temp: true, createTime: new Date() }
        })
        const temp = await db.collection('users').where({ _temp: true }).get()
        if (temp.data.length > 0) {
          await db.collection('users').doc(temp.data[0]._id).remove()
        }
        console.log('✅ users 集合创建成功\n')
      } catch (err) {
        console.error('❌ 创建集合失败:', err.message)
        console.log('请手动创建: 云开发 → 数据库 → 添加集合 → 输入 "users"\n')
        return { success: false, msg: '集合创建失败' }
      }
    }
    
    // 步骤2: 检查是否已存在超级管理员
    console.log('步骤2: 检查超级管理员是否存在...')
    const { data: existing } = await db.collection('users')
      .where({ phone: '13810062394' })
      .get()
    
    const now = new Date()
    
    if (existing.length > 0) {
      console.log('ℹ️ 超级管理员记录已存在，更新信息...')
      
      const userId = existing[0]._id
      
      // 更新为超级管理员（密码明文存储便于测试，生产环境应加密）
      await db.collection('users').doc(userId).update({
        data: {
          password: '880323',
          name: '超级管理员',
          roles: ['admin'],
          currentRole: 'admin',
          isSuperAdmin: true,
          status: 'active',
          'roleApplications.0.status': 'active',
          updateTime: now
        }
      })
      
      console.log('✅ 超级管理员信息已更新\n')
    } else {
      console.log('ℹ️ 创建新的超级管理员记录...')
      
      // 创建超级管理员
      await db.collection('users').add({
        data: {
          phone: '13810062394',
          password: '880323',
          name: '超级管理员',
          roles: ['admin'],
          currentRole: 'admin',
          isSuperAdmin: true,
          status: 'active',
          roleApplications: [{
            role: 'admin',
            status: 'active',
            applyTime: now
          }],
          createTime: now,
          updateTime: now
        }
      })
      
      console.log('✅ 超级管理员创建成功\n')
    }
    
    // 步骤3: 验证创建结果
    console.log('步骤3: 验证超级管理员...')
    const { data: verify } = await db.collection('users')
      .where({ phone: '13810062394' })
      .get()
    
    if (verify.length === 0) {
      console.error('❌ 验证失败: 超级管理员不存在\n')
      return { success: false, msg: '验证失败' }
    }
    
    const admin = verify[0]
    
    console.log('📋 超级管理员信息:')
    console.log('  - ID:', admin._id)
    console.log('  - 姓名:', admin.name)
    console.log('  - 手机号:', admin.phone)
    console.log('  - 密码:', admin.password)
    console.log('  - 角色:', admin.roles?.join(', '))
    console.log('  - 是否超级管理员:', admin.isSuperAdmin ? '是' : '否')
    console.log('')
    
    // 步骤4: 测试登录接口
    console.log('步骤4: 测试登录接口...')
    try {
      const loginRes = await wx.cloud.callFunction({
        name: 'api',
        data: {
          module: 'auth',
          action: 'loginByPhone',
          phone: '13810062394',
          password: '880323'
        }
      })
      
      const result = loginRes.result
      
      if (result.success) {
        console.log('✅ 登录接口测试成功!')
        console.log('  - 返回角色:', result.data.roles?.join(', '))
        console.log('  - 是否超级管理员:', result.data.isSuperAdmin ? '是' : '否')
        console.log('')
      } else {
        console.error('❌ 登录接口测试失败:', result.msg)
        console.log('')
      }
    } catch (err) {
      console.error('❌ 登录接口调用失败:', err.message)
      console.log('提示: 请确保 cloudfunctions/api 已部署')
      console.log('')
    }
    
    console.log('========================================')
    console.log('🎉 超级管理员初始化完成!')
    console.log('========================================')
    console.log('📱 登录信息:')
    console.log('  手机号: 13810062394')
    console.log('  密码: 880323')
    console.log('')
    console.log('📝 使用说明:')
    console.log('  1. 打开登录页面')
    console.log('  2. 选择"账号密码登录"')
    console.log('  3. 输入手机号和密码')
    console.log('  4. 自动跳转到管理后台')
    console.log('========================================')
    
    return { 
      success: true, 
      msg: '初始化成功',
      admin: {
        phone: '13810062394',
        password: '880323',
        name: admin.name
      }
    }
    
  } catch (err) {
    console.error('❌ 初始化失败:', err)
    return { success: false, msg: err.message }
  }
}

// 执行初始化
initSuperAdmin().then(result => {
  console.log('最终结果:', result)
})

// 挂载到全局
if (typeof window !== 'undefined') window.initSuperAdmin = initSuperAdmin
if (typeof globalThis !== 'undefined') globalThis.initSuperAdmin = initSuperAdmin
