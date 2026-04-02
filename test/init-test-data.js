/**
 * 测试数据初始化脚本
 * 一键创建测试环境所需的所有数据
 * 
 * 使用方法：
 * 1. 在微信开发者工具控制台运行此脚本
 * 2. 或复制到控制台执行
 */

const TestDataInit = {
  config: {
    admin: {
      phone: '13810062394',
      name: '系统管理员',
      password: '123456'
    },
    craftsman: {
      phone: '13800138001',
      name: '测试手艺人A',
      password: '123456',
      specialty: '木工',
      experience: '3-5年'
    },
    dispatcher: {
      phone: '13800138002',
      name: '测试派单人B',
      password: '123456',
      company: '测试公司'
    }
  },

  async init() {
    console.log('========== 开始初始化测试数据 ==========')
    
    try {
      await this.initAdmin()
      await this.initCraftsman()
      await this.initDispatcher()
      await this.initTestOrders()
      
      console.log('\n✅ 测试数据初始化完成！')
      console.log('\n测试账号信息：')
      console.log(`  管理员: ${this.config.admin.phone} / ${this.config.admin.password}`)
      console.log(`  手艺人: ${this.config.craftsman.phone} / ${this.config.craftsman.password}`)
      console.log(`  派单人: ${this.config.dispatcher.phone} / ${this.config.dispatcher.password}`)
      
    } catch (err) {
      console.error('初始化失败:', err)
    }
  },

  // 初始化管理员
  async initAdmin() {
    console.log('\n--- 初始化管理员 ---')
    
    const db = wx.cloud.database()
    
    // 检查是否已存在
    const exist = await db.collection('users').where({
      phone: this.config.admin.phone
    }).get()
    
    if (exist.data.length > 0) {
      console.log('管理员已存在，跳过')
      return
    }
    
    const openid = 'admin_' + Date.now()
    
    // 创建管理员
    await db.collection('users').add({
      data: {
        openid,
        phone: this.config.admin.phone,
        name: this.config.admin.name,
        roles: ['admin'],
        currentRole: 'admin',
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
  },

  // 初始化手艺人（已审批）
  async initCraftsman() {
    console.log('\n--- 初始化手艺人 ---')
    
    const db = wx.cloud.database()
    
    // 清理旧数据
    await this.cleanUser(this.config.craftsman.phone)
    
    const openid = 'test_craftsman_' + Date.now()
    
    // 创建用户
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone: this.config.craftsman.phone,
        name: this.config.craftsman.name,
        roles: ['craftsman'],
        currentRole: 'craftsman',
        roleApplications: [{
          role: 'craftsman',
          status: 'active',
          applyTime: db.serverDate(),
          approveTime: db.serverDate()
        }],
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // 创建手艺人详情
    await db.collection('craftsmen').add({
      data: {
        userId: userRes._id,
        openid,
        name: this.config.craftsman.name,
        phone: this.config.craftsman.phone,
        specialty: this.config.craftsman.specialty,
        experience: this.config.craftsman.experience,
        starLevel: 3,
        status: 'active',
        totalOrders: 0,
        completedOrders: 0,
        rating: 5.0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    console.log('✅ 手艺人创建成功')
  },

  // 初始化派单人（已审批）
  async initDispatcher() {
    console.log('\n--- 初始化派单人 ---')
    
    const db = wx.cloud.database()
    
    // 清理旧数据
    await this.cleanUser(this.config.dispatcher.phone)
    
    const openid = 'test_dispatcher_' + Date.now()
    
    // 创建用户
    const userRes = await db.collection('users').add({
      data: {
        openid,
        phone: this.config.dispatcher.phone,
        name: this.config.dispatcher.name,
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
    
    // 创建派单人详情
    await db.collection('dispatchers').add({
      data: {
        userId: userRes._id,
        openid,
        name: this.config.dispatcher.name,
        phone: this.config.dispatcher.phone,
        company: this.config.dispatcher.company,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    console.log('✅ 派单人创建成功')
  },

  // 初始化测试订单
  async initTestOrders() {
    console.log('\n--- 初始化测试订单 ---')
    
    const db = wx.cloud.database()
    
    // 获取派单人信息
    const dispatcherRes = await db.collection('dispatchers')
      .where({ phone: this.config.dispatcher.phone }).get()
    
    if (dispatcherRes.data.length === 0) {
      console.log('派单人不存在，跳过订单创建')
      return
    }
    
    const dispatcher = dispatcherRes.data[0]
    
    // 生成订单编码
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const orderCode = letters[Math.floor(Math.random() * 24)] + 
                      letters[Math.floor(Math.random() * 24)] +
                      String(Date.now()).slice(-8)
    
    // 创建待接单订单
    await db.collection('orders').add({
      data: {
        orderCode,
        name: '测试订单-' + Date.now(),
        styleName: '测试样式',
        quantity: 10,
        price: 50,
        totalPrice: 500,
        receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        remark: '这是测试订单，用于端到端测试',
        dispatcherId: dispatcher.openid,
        dispatcherName: dispatcher.name,
        craftsmanId: '',
        craftsmanName: '',
        status: 'pending',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    console.log('✅ 测试订单创建成功')
  },

  // 清理用户数据
  async cleanUser(phone) {
    const db = wx.cloud.database()
    
    try {
      // 删除users
      const users = await db.collection('users').where({ phone }).get()
      for (const u of users.data) {
        await db.collection('users').doc(u._id).remove()
      }
      
      // 删除craftsmen
      const craftsmen = await db.collection('craftsmen').where({ phone }).get()
      for (const c of craftsmen.data) {
        await db.collection('craftsmen').doc(c._id).remove()
      }
      
      // 删除dispatchers
      const dispatchers = await db.collection('dispatchers').where({ phone }).get()
      for (const d of dispatchers.data) {
        await db.collection('dispatchers').doc(d._id).remove()
      }
    } catch (err) {
      console.log('清理旧数据失败:', err)
    }
  },

  // 清理所有测试数据
  async cleanAll() {
    console.log('========== 清理测试数据 ==========')
    
    await this.cleanUser(this.config.craftsman.phone)
    await this.cleanUser(this.config.dispatcher.phone)
    
    // 清理测试订单
    const db = wx.cloud.database()
    const orders = await db.collection('orders').where({
      name: db.RegExp({ regexp: '测试', options: 'i' })
    }).get()
    
    for (const order of orders.data) {
      await db.collection('orders').doc(order._id).remove()
    }
    
    console.log('✅ 测试数据清理完成')
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = TestDataInit
}
if (typeof window !== 'undefined') {
  window.TestDataInit = TestDataInit
}
if (typeof global !== 'undefined') {
  global.TestDataInit = TestDataInit
}

console.log('测试数据初始化脚本已加载')
console.log('运行命令: await TestDataInit.init()')
console.log('清理命令: await TestDataInit.cleanAll()')
