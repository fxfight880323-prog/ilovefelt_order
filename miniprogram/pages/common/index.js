const app = getApp()
const util = require('../../utils/util.js')

Page({
  data: {
    isAdmin: false,
    craftsmanInfo: null,
    stats: {
      pendingCount: 0,
      acceptedCount: 0,
      completedCount: 0,
      totalCount: 0
    },
    noticeList: [],
    loading: false
  },

  onLoad() {
    this.checkUserRole()
  },

  onShow() {
    this.getOrderStats()
    this.getNoticeList()
  },

  onPullDownRefresh() {
    this.checkUserRole()
    this.getOrderStats()
    this.getNoticeList()
    wx.stopPullDownRefresh()
  },

  // 检查用户角色
  async checkUserRole() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'checkUserRole' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          isAdmin: res.result.data.isAdmin,
          craftsmanInfo: res.result.data.craftsmanInfo
        })
        app.globalData.isAdmin = res.result.data.isAdmin
        app.globalData.craftsmanInfo = res.result.data.craftsmanInfo
      }
    } catch (err) {
      console.error('检查角色失败:', err)
    }
  },

  // 获取订单统计
  async getOrderStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: { action: 'getOrderStats' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          stats: res.result.data
        })
      }
    } catch (err) {
      console.error('获取统计失败:', err)
    }
  },

  // 获取公告列表
  async getNoticeList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: { 
          action: 'getNoticeList',
          limit: 3
        }
      })
      
      if (res.result.code === 0) {
        this.setData({
          noticeList: res.result.data
        })
      }
    } catch (err) {
      console.error('获取公告失败:', err)
    }
  },

  // 跳转到订单管理（管理员）
  goToOrderManage() {
    wx.navigateTo({
      url: '/pages/admin/orderManage'
    })
  },

  // 跳转到样式管理
  goToStyleManage() {
    wx.navigateTo({
      url: '/pages/admin/styleManage'
    })
  },

  // 跳转到手工艺人管理
  goToCraftsmanManage() {
    wx.navigateTo({
      url: '/pages/admin/craftsmanManage'
    })
  },

  // 跳转到创建订单
  goToCreateOrder() {
    wx.navigateTo({
      url: '/pages/admin/orderForm'
    })
  },

  // 跳转到接单大厅
  goToOrderHall() {
    wx.switchTab({
      url: '/pages/craftsman/orderList'
    })
  },

  // 跳转到我的订单
  goToMyOrders() {
    wx.switchTab({
      url: '/pages/craftsman/myOrders'
    })
  },

  // 跳转到个人中心
  goToProfile() {
    wx.switchTab({
      url: '/pages/craftsman/profile'
    })
  }
})
