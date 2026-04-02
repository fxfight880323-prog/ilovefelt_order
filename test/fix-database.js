/**
 * 数据库修复脚本
 * 用于修复常见的数据库问题
 */

const DBFix = {
  async fixAll() {
    console.log('========== 开始修复数据库 ==========')
    
    await this.createCollections()
    await this.fixAdmin()
    await this.listCollections()
    
    console.log('\n✅ 数据库修复完成')
  },

  // 检查并创建集合
  async createCollections() {
    console.log('\n--- 检查集合 ---')
    
    const db = wx.cloud.database()
    const collections = ['users', 'craftsmen', 'dispatchers', 'orders', 'adminNotifications']
    
    for (const collName of collections) {
      try {
        // 尝试访问集合
        await db.collection(collName).limit(1).get()
        console.log(`✅ ${collName} 集合存在`)
      } catch (err) {
        if (err.errCode === -502005 || err.message.includes('not exist')) {
          console.log(`❌ ${collName} 集合不存在，尝试创建...`)
          try {
            // 创建集合（通过添加空数据然后删除）
            const res = await db.collection(collName).add({
              data: { _init: true, createTime: new Date() }
            })
            await db.collection(collName).doc(res._id).remove()
            console.log(`✅ ${collName} 集合创建成功`)
          } catch (e) {
            console.error(`❌ ${collName} 集合创建失败:`, e.message)
            console.log(`   请手动在云开发控制台创建 ${collName} 集合`)
          }
        } else {
          console.error(`❌ 访问 ${collName} 失败:`, err.message)
        }
      }
    }
  },

  // 修复管理员账号
  async fixAdmin() {
    console.log('\n--- 检查管理员账号 ---')
    
    const db = wx.cloud.database()
    const adminPhone = '13810062394'
    
    try {
      const exist = await db.collection('users').where({ phone: adminPhone }).get()
      
      if (exist.data.length === 0) {
        console.log('管理员不存在，创建中...')
        
        const openid = 'admin_' + Date.now()
        await db.collection('users').add({
          data: {
            openid,
            phone: adminPhone,
            name: '系统管理员',
            roles: ['admin'],
            currentRole: 'admin',
            roleApplications: [{
              role: 'admin',
              status: 'active',
              applyTime: new Date()
            }],
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        console.log('✅ 管理员创建成功')
      } else {
        const user = exist.data[0]
        const hasAdminRole = user.roles && user.roles.includes('admin')
        
        if (!hasAdminRole) {
          console.log('用户存在但不是管理员，更新中...')
          await db.collection('users').doc(user._id).update({
            data: {
              roles: ['admin'],
              currentRole: 'admin',
              updateTime: new Date()
            }
          })
          console.log('✅ 管理员权限更新成功')
        } else {
          console.log('✅ 管理员账号正常')
        }
      }
    } catch (err) {
      console.error('修复管理员失败:', err)
    }
  },

  // 列出所有集合
  async listCollections() {
    console.log('\n--- 当前数据概览 ---')
    
    const db = wx.cloud.database()
    
    try {
      const users = await db.collection('users').count()
      console.log(`users: ${users.total} 条记录`)
      
      const craftsmen = await db.collection('craftsmen').count()
      console.log(`craftsmen: ${craftsmen.total} 条记录`)
      
      const dispatchers = await db.collection('dispatchers').count()
      console.log(`dispatchers: ${dispatchers.total} 条记录`)
      
      const orders = await db.collection('orders').count()
      console.log(`orders: ${orders.total} 条记录`)
      
      // 列出所有用户
      const userList = await db.collection('users').limit(10).get()
      console.log('\n用户列表:')
      userList.data.forEach(u => {
        const roles = u.roles || []
        const pending = (u.roleApplications || [])
          .filter(a => a.status === 'pending').length
        console.log(`  - ${u.name} (${u.phone}): roles=[${roles.join(',')}], pending=${pending}`)
      })
      
    } catch (err) {
      console.error('获取数据概览失败:', err)
    }
  },

  // 清理测试数据
  async cleanTestData() {
    console.log('========== 清理测试数据 ==========')
    
    const db = wx.cloud.database()
    const testPhones = ['13800138001', '13800138002', '13800138003']
    
    for (const phone of testPhones) {
      console.log(`\n清理 ${phone}...`)
      
      try {
        // 清理 users
        const users = await db.collection('users').where({ phone }).get()
        for (const u of users.data) {
          await db.collection('users').doc(u._id).remove()
          console.log(`  删除 user: ${u._id}`)
        }
        
        // 清理 craftsmen
        const craftsmen = await db.collection('craftsmen').where({ phone }).get()
        for (const c of craftsmen.data) {
          await db.collection('craftsmen').doc(c._id).remove()
          console.log(`  删除 craftsman: ${c._id}`)
        }
        
        // 清理 dispatchers
        const dispatchers = await db.collection('dispatchers').where({ phone }).get()
        for (const d of dispatchers.data) {
          await db.collection('dispatchers').doc(d._id).remove()
          console.log(`  删除 dispatcher: ${d._id}`)
        }
      } catch (err) {
        console.error(`清理 ${phone} 失败:`, err)
      }
    }
    
    console.log('\n✅ 测试数据清理完成')
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = DBFix
}
if (typeof window !== 'undefined') {
  window.DBFix = DBFix
}
if (typeof global !== 'undefined') {
  global.DBFix = DBFix
}

console.log('数据库修复脚本已加载')
console.log('运行: await DBFix.fixAll()')
console.log('清理: await DBFix.cleanTestData()')
