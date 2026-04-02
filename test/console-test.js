/**
 * 控制台快速测试脚本
 * 在微信开发者工具控制台中运行
 * 
 * 使用方法：
 * 1. 复制此文件内容到控制台
 * 2. 或直接 require('/test/console-test.js')
 */

const E2E_TEST = {
  // 测试配置
  config: {
    adminPhone: '13810062394',
    craftsmanPhone: '13800138001',
    dispatcherPhone: '13800138002',
    password: '123456'
  },

  // 清理测试数据
  async clean() {
    console.log('清理测试数据...')
    const db = wx.cloud.database()
    
    const phones = [this.config.craftsmanPhone, this.config.dispatcherPhone]
    
    for (const phone of phones) {
      // 清理 users
      const users = await db.collection('users').where({ phone }).get()
      for (const u of users.data) {
        await db.collection('users').doc(u._id).remove()
      }
      
      // 清理 craftsmen
      const craftsmen = await db.collection('craftsmen').where({ phone }).get()
      for (const c of craftsmen.data) {
        await db.collection('craftsmen').doc(c._id).remove()
      }
      
      // 清理 dispatchers
      const dispatchers = await db.collection('dispatchers').where({ phone }).get()
      for (const d of dispatchers.data) {
        await db.collection('dispatchers').doc(d._id).remove()
      }
    }
    
    // 清理测试订单
    const orders = await db.collection('orders').where({
      name: db.RegExp({ regexp: '测试', options: 'i' })
    }).get()
    for (const o of orders.data) {
      await db.collection('orders').doc(o._id).remove()
    }
    
    console.log('✅ 清理完成')
  },

  // 快速创建测试数据
  async init() {
    console.log('初始化测试数据...')
    const db = wx.cloud.database()
    
    // 1. 创建管理员
    const adminExist = await db.collection('users').where({ phone: this.config.adminPhone }).get()
    if (adminExist.data.length === 0) {
      await db.collection('users').add({
        data: {
          openid: 'admin_' + Date.now(),
          phone: this.config.adminPhone,
          name: '系统管理员',
          roles: ['admin'],
          currentRole: 'admin',
          isAdmin: true,
          roleApplications: [{
            role: 'admin',
            status: 'active',
            applyTime: db.serverDate()
          }],
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      console.log('✅ 管理员创建成功')
    } else {
      console.log('管理员已存在')
    }
    
    // 2. 创建已激活手艺人
    const craftsmanOpenid = 'test_craftsman_' + Date.now()
    const userRes = await db.collection('users').add({
      data: {
        openid: craftsmanOpenid,
        phone: this.config.craftsmanPhone,
        name: '测试手艺人',
        roles: ['craftsman'],
        currentRole: 'craftsman',
        roleApplications: [{
          role: 'craftsman',
          status: 'active',
          applyTime: db.serverDate(),
          approveTime: db.serverDate(),
          applyData: { specialty: '木工', experience: '3-5年' }
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    const craftsmanRes = await db.collection('craftsmen').add({
      data: {
        userId: userRes._id,
        openid: craftsmanOpenid,
        name: '测试手艺人',
        phone: this.config.craftsmanPhone,
        specialty: '木工',
        experience: '3-5年',
        starLevel: 3,
        totalOrders: 0,
        completedOrders: 0,
        rating: 5.0,
        reliabilityScore: 5.0,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    console.log('✅ 手艺人创建成功，ID:', craftsmanRes._id)
    
    // 3. 创建已激活派单人
    const dispatcherOpenid = 'test_dispatcher_' + Date.now()
    const userRes2 = await db.collection('users').add({
      data: {
        openid: dispatcherOpenid,
        phone: this.config.dispatcherPhone,
        name: '测试派单人',
        roles: ['dispatcher'],
        currentRole: 'dispatcher',
        roleApplications: [{
          role: 'dispatcher',
          status: 'active',
          applyTime: db.serverDate(),
          approveTime: db.serverDate()
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    const dispatcherRes = await db.collection('dispatchers').add({
      data: {
        userId: userRes2._id,
        openid: dispatcherOpenid,
        name: '测试派单人',
        phone: this.config.dispatcherPhone,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    console.log('✅ 派单人创建成功，ID:', dispatcherRes._id)
    
    // 4. 创建测试订单
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const orderCode = letters[Math.floor(Math.random() * 24)] + 
                      letters[Math.floor(Math.random() * 24)] +
                      String(Date.now()).slice(-8)
    
    const orderRes = await db.collection('orders').add({
      data: {
        orderCode,
        name: '测试订单-' + Date.now(),
        styleName: '测试样式',
        quantity: 10,
        price: 50,
        totalPrice: 500,
        receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        dispatcherId: dispatcherRes._id,
        dispatcherName: '测试派单人',
        craftsmanId: '',
        craftsmanName: '',
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    console.log('✅ 测试订单创建成功，编号:', orderCode)
    
    console.log('\n========== 测试数据准备完成 ==========')
    console.log('手艺人登录: ' + this.config.craftsmanPhone + ' / ' + this.config.password)
    console.log('派单人登录: ' + this.config.dispatcherPhone + ' / ' + this.config.password)
    console.log('订单编号: ' + orderCode)
    
    return {
      craftsmanId: craftsmanRes._id,
      dispatcherId: dispatcherRes._id,
      orderId: orderRes._id,
      orderCode
    }
  },

  // 检查数据库状态
  async status() {
    console.log('检查数据库状态...')
    const db = wx.cloud.database()
    
    // 检查用户
    const users = await db.collection('users').get()
    console.log('\n📊 用户总数:', users.data.length)
    users.data.forEach(u => {
      console.log(`  - ${u.name || '未命名'} (${u.phone}): ${u.roles?.join(', ') || '无角色'}`)
    })
    
    // 检查手艺人
    const craftsmen = await db.collection('craftsmen').get()
    console.log('\n📊 手艺人总数:', craftsmen.data.length)
    craftsmen.data.forEach(c => {
      console.log(`  - ${c.name} (${c.phone}): ${c.status}, 接单${c.totalOrders}, 完成${c.completedOrders}`)
    })
    
    // 检查派单人
    const dispatchers = await db.collection('dispatchers').get()
    console.log('\n📊 派单人总数:', dispatchers.data.length)
    dispatchers.data.forEach(d => {
      console.log(`  - ${d.name} (${d.phone}): ${d.status}`)
    })
    
    // 检查订单
    const orders = await db.collection('orders').get()
    console.log('\n📊 订单总数:', orders.data.length)
    const statusCount = {}
    orders.data.forEach(o => {
      statusCount[o.status] = (statusCount[o.status] || 0) + 1
    })
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`)
    })
  },

  // 快速审批
  async approve(phone) {
    console.log('审批用户:', phone)
    const db = wx.cloud.database()
    
    const userRes = await db.collection('users').where({ phone }).get()
    if (userRes.data.length === 0) {
      console.error('用户不存在')
      return
    }
    
    const user = userRes.data[0]
    const roleApps = user.roleApplications || []
    
    for (const app of roleApps) {
      if (app.status === 'pending') {
        app.status = 'active'
        app.approveTime = db.serverDate()
        
        // 更新对应角色表
        if (app.role === 'craftsman') {
          const cRes = await db.collection('craftsmen').where({ phone }).get()
          if (cRes.data.length > 0) {
            await db.collection('craftsmen').doc(cRes.data[0]._id).update({
              data: { status: 'active', updateTime: db.serverDate() }
            })
          }
        } else if (app.role === 'dispatcher') {
          const dRes = await db.collection('dispatchers').where({ phone }).get()
          if (dRes.data.length > 0) {
            await db.collection('dispatchers').doc(dRes.data[0]._id).update({
              data: { status: 'active', updateTime: db.serverDate() }
            })
          }
        }
      }
    }
    
    const roles = roleApps.filter(a => a.status === 'active').map(a => a.role)
    
    await db.collection('users').doc(user._id).update({
      data: {
        roles,
        currentRole: roles[0] || '',
        roleApplications: roleApps,
        updateTime: db.serverDate()
      }
    })
    
    console.log('✅ 审批完成，角色:', roles.join(', '))
  },

  // 帮助信息
  help() {
    console.log(`
========== E2E测试助手 ==========

可用命令：
  E2E_TEST.init()       - 初始化测试数据（创建管理员、手艺人、派单人、测试订单）
  E2E_TEST.clean()      - 清理所有测试数据
  E2E_TEST.status()     - 查看数据库状态
  E2E_TEST.approve(phone) - 审批指定手机号用户
  E2E_TEST.help()       - 显示帮助

测试账号：
  管理员: ${this.config.adminPhone}
  手艺人: ${this.config.craftsmanPhone} / ${this.config.password}
  派单人: ${this.config.dispatcherPhone} / ${this.config.password}

使用示例：
  // 初始化数据
  await E2E_TEST.init()
  
  // 查看状态
  await E2E_TEST.status()
  
  // 审批待审核用户
  await E2E_TEST.approve('13800138005')
  
  // 清理数据
  await E2E_TEST.clean()
`)
  }
}

// 挂载到全局
if (typeof global !== 'undefined') {
  global.E2E_TEST = E2E_TEST
}
if (typeof window !== 'undefined') {
  window.E2E_TEST = E2E_TEST
}

console.log('E2E测试助手已加载，输入 E2E_TEST.help() 查看帮助')
console.log('快速开始：await E2E_TEST.init()')
