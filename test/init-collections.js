/**
 * 初始化数据库集合
 * 在微信开发者工具控制台完整粘贴执行
 */

async function initCollections() {
  const db = wx.cloud.database()
  const collections = ['users', 'craftsmen', 'dispatchers', 'orders', 'adminNotifications']
  
  console.log('🚀 初始化数据库集合...\n')
  
  for (const collName of collections) {
    try {
      // 尝试添加一条数据来触发集合创建
      await db.collection(collName).add({
        data: {
          _init: true,
          createTime: new Date()
        }
      })
      console.log(`✅ 集合 ${collName} 创建成功`)
      
      // 删除初始化数据
      const { data } = await db.collection(collName).where({ _init: true }).get()
      for (const item of data) {
        await db.collection(collName).doc(item._id).remove()
      }
    } catch (err) {
      if (err.message.includes('collection not exist')) {
        console.log(`❌ 集合 ${collName} 创建失败: 需要在控制台手动创建`)
      } else {
        console.log(`✅ 集合 ${collName} 已存在`)
      }
    }
  }
  
  console.log('\n📋 接下来创建管理员账号...')
  
  // 创建管理员
  try {
    const { data: existing } = await db.collection('users')
      .where({ phone: '13810062394' })
      .get()
    
    if (existing.length > 0) {
      // 更新为管理员
      await db.collection('users').doc(existing[0]._id).update({
        data: {
          password: '880323',
          name: '超级管理员',
          roles: ['admin'],
          currentRole: 'admin',
          'roleApplications.0.status': 'active'
        }
      })
      console.log('✅ 管理员已更新: 13810062394 / 880323')
    } else {
      // 创建新管理员
      await db.collection('users').add({
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
      console.log('✅ 管理员创建成功: 13810062394 / 880323')
    }
  } catch (err) {
    console.error('❌ 创建管理员失败:', err.message)
    console.log('请确保 users 集合已创建并有写入权限')
  }
}

// 执行
initCollections()

// 挂载到全局
if (typeof window !== 'undefined') window.initCollections = initCollections
if (typeof globalThis !== 'undefined') globalThis.initCollections = initCollections
