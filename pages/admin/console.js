const API = require('../../utils/api.js')

Page({
  data: {
    isLoading: true,
    isAdmin: false,
    stats: {
      pendingCount: 0,
      userCount: 0,
      craftsmanCount: 0,
      dispatcherCount: 0,
      orderCount: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0
    },
    pendingList: [],
    orderList: [],
    userList: [],
    currentTab: 'pending',
    adminPhone: '13810062394',
    adminPassword: '880323'
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadData()
    }
  },

  // 验证超级管理员
  async checkAdmin() {
    try {
      const res = await API.auth.checkStatus()
      
      if (!res.success || !res.data.isSuperAdmin) {
        wx.showModal({
          title: '无权限访问',
          content: '只有超级管理员可以访问此页面',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }

      this.setData({ isAdmin: true })
      this.loadData()
    } catch (err) {
      console.error('检查权限失败:', err)
      wx.showToast({ title: '权限检查失败', icon: 'none' })
    }
  },

  // 加载所有数据
  async loadData() {
    this.setData({ isLoading: true })
    
    try {
      // 并行加载数据
      await Promise.all([
        this.loadStats(),
        this.loadPendingList(),
        this.loadOrders(),
        this.loadUsers()
      ])
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      // 获取基础统计
      const statsRes = await API.admin.getStats()
      if (statsRes.success) {
        const stats = statsRes.data
        
        // 获取订单状态统计
        const db = wx.cloud.database()
        const [{ total: pendingOrders }, { total: acceptedOrders }, 
               { total: completedOrders }, { total: cancelledOrders }] = await Promise.all([
          db.collection('orders').where({ status: 'pending' }).count(),
          db.collection('orders').where({ status: 'accepted' }).count(),
          db.collection('orders').where({ status: 'completed' }).count(),
          db.collection('orders').where({ status: 'cancelled' }).count()
        ])
        
        this.setData({
          stats: {
            ...stats,
            pendingOrders,
            acceptedOrders,
            completedOrders,
            cancelledOrders
          }
        })
      }
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  // 加载待审批列表
  async loadPendingList() {
    try {
      const res = await API.admin.getPendingRequests()
      if (res.success) {
        // 格式化时间
        const list = res.data.list.map(item => ({
          ...item,
          roleText: item.role === 'craftsman' ? '手艺人' : '派单人',
          applyTimeText: this.formatTime(item.applyTime)
        }))
        this.setData({ pendingList: list })
      }
    } catch (err) {
      console.error('加载待审批列表失败:', err)
    }
  },

  // 加载订单列表
  async loadOrders() {
    try {
      const db = wx.cloud.database()
      const { data: orders } = await db.collection('orders')
        .orderBy('createTime', 'desc')
        .limit(50)
        .get()
      
      const formattedOrders = orders.map(order => ({
        ...order,
        statusText: this.getStatusText(order.status),
        createTimeText: this.formatTime(order.createTime),
        totalAmount: (order.quantity * order.price).toFixed(2)
      }))
      
      this.setData({ orderList: formattedOrders })
    } catch (err) {
      console.error('加载订单失败:', err)
    }
  },

  // 加载用户列表
  async loadUsers() {
    try {
      const db = wx.cloud.database()
      const { data: users } = await db.collection('users')
        .orderBy('createTime', 'desc')
        .limit(50)
        .get()
      
      const formattedUsers = users.map(user => ({
        ...user,
        rolesText: (user.roles || []).map(r => {
          const map = { admin: '管理员', craftsman: '手艺人', dispatcher: '派单人' }
          return map[r] || r
        }).join(', '),
        createTimeText: this.formatTime(user.createTime),
        status: this.getUserStatus(user)
      }))
      
      this.setData({ userList: formattedUsers })
    } catch (err) {
      console.error('加载用户失败:', err)
    }
  },

  // 获取用户状态
  getUserStatus(user) {
    if (user.isSuperAdmin) return '超级管理员'
    const pending = user.roleApplications?.filter(app => app.status === 'pending').length || 0
    if (pending > 0) return '待审批'
    const active = user.roleApplications?.filter(app => app.status === 'active').length || 0
    if (active > 0) return '正常'
    return '未激活'
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      pending: '待接单',
      accepted: '已接单',
      completed: '已完成',
      cancelled: '已取消'
    }
    return map[status] || status
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    
    // 根据标签刷新对应数据
    if (tab === 'pending') {
      this.loadPendingList()
    } else if (tab === 'orders') {
      this.loadOrders()
    } else if (tab === 'users') {
      this.loadUsers()
    } else if (tab === 'stats') {
      this.loadStats()
    }
  },

  // 审批通过
  async approve(e) {
    const { userId, role, name } = e.currentTarget.dataset
    const roleText = role === 'craftsman' ? '手艺人' : '派单人'
    
    wx.showModal({
      title: '确认通过',
      content: `批准 ${name} 成为${roleText}？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          try {
            const result = await API.admin.approve({
              userId,
              role,
              approved: true
            })
            
            wx.hideLoading()
            
            if (result.success) {
              wx.showToast({ title: '审批通过' })
              this.loadData()
            } else {
              wx.showToast({ title: result.msg || '审批失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 拒绝申请
  async reject(e) {
    const { userId, role, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认拒绝',
      content: `拒绝 ${name} 的申请？`,
      editable: true,
      placeholderText: '请输入拒绝原因（可选）',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          try {
            const result = await API.admin.approve({
              userId,
              role,
              approved: false,
              reason: res.content
            })
            
            wx.hideLoading()
            
            if (result.success) {
              wx.showToast({ title: '已拒绝' })
              this.loadData()
            } else {
              wx.showToast({ title: result.msg || '操作失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const { orderId } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/admin/orderDetail?orderId=${orderId}`
    })
  },

  // 取消订单
  async cancelOrder(e) {
    const { orderId, orderNo } = e.currentTarget.dataset
    
    wx.showModal({
      title: '取消订单',
      content: `确定取消订单 ${orderNo} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          try {
            const result = await API.order.cancel(orderId)
            wx.hideLoading()
            
            if (result.success) {
              wx.showToast({ title: '订单已取消' })
              this.loadOrders()
              this.loadStats()
            } else {
              wx.showToast({ title: result.msg || '取消失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 刷新数据
  refresh() {
    this.loadData()
    wx.showToast({ title: '已刷新' })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出管理员账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 设置退出标记，防止自动登录
          wx.setStorageSync('logoutFlag', true)
          // 清除用户相关数据，但保留退出标记
          wx.removeStorageSync('userRole')
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('adminInfo')
          wx.removeStorageSync('isAdmin')
          // 跳转到登录页
          wx.reLaunch({ url: '/pages/login/index' })
        }
      }
    })
  }
})
