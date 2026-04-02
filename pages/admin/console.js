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
      orderCount: 0
    },
    pendingList: [],
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

  // 加载数据
  async loadData() {
    this.setData({ isLoading: true })
    
    try {
      // 加载统计数据
      const statsRes = await API.admin.getStats()
      if (statsRes.success) {
        this.setData({ stats: statsRes.data })
      }

      // 加载待审批列表
      await this.loadPendingList()
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 加载待审批列表
  async loadPendingList() {
    try {
      const res = await API.admin.getPendingRequests()
      if (res.success) {
        this.setData({ pendingList: res.data.list || [] })
      }
    } catch (err) {
      console.error('加载待审批列表失败:', err)
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    if (tab === 'pending') {
      this.loadPendingList()
    }
  },

  // 审批通过
  async approve(e) {
    const { userId, role, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认通过',
      content: `批准 ${name} 成为${role === 'craftsman' ? '手艺人' : '派单人'}？`,
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
          wx.clearStorage()
          wx.reLaunch({ url: '/pages/login/index' })
        }
      }
    })
  }
})
