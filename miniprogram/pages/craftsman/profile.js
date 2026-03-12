const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    craftsmanInfo: null,
    stats: {
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalIncome: 0
    },
    loading: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  // 加载数据
  async loadData() {
    const craftsmanInfo = app.globalData.craftsmanInfo
    this.setData({ craftsmanInfo })
    
    if (craftsmanInfo) {
      this.getStats()
    }
  },

  // 获取统计数据
  async getStats() {
    if (!this.data.craftsmanInfo) return
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: {
          action: 'getStats',
          craftsmanId: this.data.craftsmanInfo._id
        }
      })

      if (res.result.code === 0) {
        this.setData({
          stats: res.result.data
        })
      }
    } catch (err) {
      console.error('获取统计数据失败:', err)
    }
  },

  // 更新订阅设置
  async updateSubscribe() {
    const tmplIds = [
      'YOUR_TMPL_ID_1', // 新订单提醒
      'YOUR_TMPL_ID_2'  // 订单状态变更提醒
    ]

    try {
      const res = await util.requestSubscribeMessage(tmplIds)
      if (res) {
        // 保存订阅记录到数据库
        await wx.cloud.callFunction({
          name: 'subscribe',
          data: {
            action: 'saveSubscribe',
            tmplIds: tmplIds.filter(id => res[id] === 'accept')
          }
        })
        util.showToast('订阅成功', 'success')
      }
    } catch (err) {
      console.error('订阅失败:', err)
    }
  },

  // 联系管理员
  contactAdmin() {
    wx.showModal({
      title: '联系管理员',
      content: '请联系管理员微信：admin_example',
      showCancel: false
    })
  },

  // 查看使用帮助
  viewHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '1. 在"接单大厅"浏览可接订单\n2. 点击"立即接单"抢单\n3. 在"我的订单"查看已接订单\n4. 制作完成后点击"完成订单"\n\n如有问题请联系管理员',
      showCancel: false
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地数据
          wx.clearStorage()
          // 重新加载
          wx.reLaunch({
            url: '/pages/common/index'
          })
        }
      }
    })
  }
})
