/**
 * 完整重置脚本
 * 一键清理所有数据并重新初始化
 */

const FullReset = {
  async run() {
    console.log('========== 开始完整重置 ==========')
    
    await this.step1_cleanDatabase()
    await this.step2_wait(1000)
    await this.step3_initAdmin()
    await this.step4_initTestData()
    
    console.log('\n✅ 重置完成！')
    console.log('\n请重新部署云函数：')
    console.log('  右键 cloudfunctions/api → "创建并部署：云端安装依赖"')
    console.log('\n然后运行：await SYSTEM_TEST.runAll()')
  },

  // 第1步：清理数据库
  async step1_cleanDatabase() {
    console.log('\n[1/4] 清理数据库...')
    
    const db = wx.cloud.database()
    
    try {
      // 清理 users（保留管理员）
      const users = await db.collection('users').get()
      for (const u of users.data) {
        const isAdmin = u.roles && u.roles.includes('admin')
        if (!isAdmin) {
          await db.collection('users').doc(u._id).remove()
        }
      }
      console.log('  ✅ users 清理完成（保留管理员）')
    } catch (e) {
      console.log('  ⚠️ users 清理失败:', e.message)
    }

    try {
      // 清理 craftsmen
      const craftsmen = await db.collection('craftsmen').get()
      for (const c of craftsmen.data) {
        await db.collection('craftsmen').doc(c._id).remove()
      }
      console.log('  ✅ craftsmen 清理完成')
    } catch (e) {
      console.log('  ⚠️ craftsmen 清理失败:', e.message)
    }

    try {
      // 清理 dispatchers
      const dispatchers = await db.collection('dispatchers').get()
      for (const d of dispatchers.data) {
        await db.collection('dispatchers').doc(d._id).remove()
      }
      console.log('  ✅ dispatchers 清理完成')
    } catch (e) {
      console.log('  ⚠️ dispatchers 清理失败:', e.message)
    }

    try {
      // 清理 adminNotifications
      const notifications = await db.collection('adminNotifications').get()
      for (const n of notifications.data) {
        await db.collection('adminNotifications').doc(n._id).remove()
      }
      console.log('  ✅ adminNotifications 清理完成')
    } catch (e) {
      console.log('  ⚠️ adminNotifications 清理失败:', e.message)
    }

    try {
      // 清理 orders
      const orders = await db.collection('orders').get()
      for (const o of orders.data) {
        await db.collection('orders').doc(o._id).remove()
      }
      console.log('  ✅ orders 清理完成')
    } catch (e) {
      console.log('  ⚠️ orders 清理失败:', e.message)
    }
  },

  // 等待
  step2_wait(ms) {
    console.log(`\n[2/4] 等待 ${ms}ms...`)
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // 第3步：确保管理员存在
  async step3_initAdmin() {
    console.log('\n[3/4] 初始化管理员...')
    
    const db = wx.cloud.database()
    
    try {
      const exist = await db.collection('users').where({ 
        phone: '13810062394' 
      }).get()
      
      if (exist.data.length === 0) {
        await db.collection('users').add({
          data: {
            openid: 'admin_' + Date.now(),
            phone: '13810062394',
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
        console.log('  ✅ 管理员创建成功')
      } else {
        // 确保有admin角色
        const user = exist.data[0]
        if (!user.roles || !user.roles.includes('admin')) {
          await db.collection('users').doc(user._id).update({
            data: {
              roles: ['admin'],
              currentRole: 'admin',
              updateTime: new Date()
            }
          })
          console.log('  ✅ 管理员权限已修复')
        } else {
          console.log('  ✅ 管理员已存在')
        }
      }
    } catch (e) {
      console.log('  ❌ 管理员初始化失败:', e.message)
    }
  },

  // 第4步：初始化测试数据
  async step4_initTestData() {
    console.log('\n[4/4] 初始化测试数据...')
    
    const db = wx.cloud.database()
    
    // 创建手艺人（已审批）
    try {
      const craftsmanOpenid = 'test_craftsman_' + Date.now()
      
      const userRes = await db.collection('users').add({
        data: {
          openid: craftsmanOpenid,
          phone: '13800138001',
          name: '测试手艺人A',
          roles: ['craftsman'],
          currentRole: 'craftsman',
          roleApplications: [{
            role: 'craftsman',
            status: 'active',
            applyTime: new Date(),
            approveTime: new Date()
          }],
          password: require('crypto')?.createHash('sha256')?.update('123456')?.digest('hex') || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      
      await db.collection('craftsmen').add({
        data: {
          userId: userRes._id,
          openid: craftsmanOpenid,
          name: '测试手艺人A',
          phone: '13800138001',
          specialty: '木工',
          experience: '3-5年',
          starLevel: 3,
          status: 'active',
          totalOrders: 0,
          completedOrders: 0,
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      
      console.log('  ✅ 手艺人创建成功')
    } catch (e) {
      console.log('  ⚠️ 手艺人创建失败:', e.message)
    }

    // 创建派单人（已审批）
    try {
      const dispatcherOpenid = 'test_dispatcher_' + Date.now()
      
      const userRes = await db.collection('users').add({
        data: {
          openid: dispatcherOpenid,
          phone: '13800138002',
          name: '测试派单人B',
          roles: ['dispatcher'],
          currentRole: 'dispatcher',
          roleApplications: [{
            role: 'dispatcher',
            status: 'active',
            applyTime: new Date(),
            approveTime: new Date()
          }],
          password: require('crypto')?.createHash('sha256')?.update('123456')?.digest('hex') || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      
      await db.collection('dispatchers').add({
        data: {
          userId: userRes._id,
          openid: dispatcherOpenid,
          name: '测试派单人B',
          phone: '13800138002',
          company: '测试公司',
          status: 'active',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
      
      console.log('  ✅ 派单人创建成功')
    } catch (e) {
      console.log('  ⚠️ 派单人创建失败:', e.message)
    }

    // 创建测试订单
    try {
      const dispatcher = await db.collection('dispatchers')
        .where({ phone: '13800138002' }).get()
      
      if (dispatcher.data.length > 0) {
        const d = dispatcher.data[0]
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        const orderCode = letters[Math.floor(Math.random() * 24)] + 
                         letters[Math.floor(Math.random() * 24)] +
                         String(Date.now()).slice(-8)
        
        await db.collection('orders').add({
          data: {
            orderCode,
            name: '测试订单-' + Date.now(),
            styleName: '测试样式',
            quantity: 10,
            price: 50,
            totalPrice: 500,
            receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            dispatcherId: d.openid,
            dispatcherName: d.name,
            craftsmanId: '',
            craftsmanName: '',
            status: 'pending',
            createTime: new Date(),
            updateTime: new Date()
          }
        })
        
        console.log('  ✅ 测试订单创建成功')
      }
    } catch (e) {
      console.log('  ⚠️ 测试订单创建失败:', e.message)
    }
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = FullReset
}
if (typeof window !== 'undefined') {
  window.FullReset = FullReset
}
if (typeof global !== 'undefined') {
  global.FullReset = FullReset
}

console.log('完整重置脚本已加载')
console.log('运行: await FullReset.run()')
