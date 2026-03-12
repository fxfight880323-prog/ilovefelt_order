const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    // 订阅消息模板ID
    tmplIds: [
      'YOUR_TMPL_ID_1', // 新订单提醒
      'YOUR_TMPL_ID_2'  // 订单状态变更提醒
    ]
  },

  onLoad() {
    this.checkSubscribe()
    this.getOrderList()
  },

  onShow() {
    this.refreshList()
  },

  onPullDownRefresh() {
    this.refreshList()
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // 检查订阅状态
  async checkSubscribe() {
    try {
      const setting = await wx.getSetting()
      if (!setting.subscriptionsSetting || !setting.subscriptionsSetting.mainSwitch) {
        // 引导用户开启订阅
        this.showSubscribeTip()
      }
    } catch (err) {
      console.error('检查订阅设置失败:', err)
    }
  },

  // 显示订阅提示
  showSubscribeTip() {
    wx.showModal({
      title: '开启消息提醒',
      content: '开启后可以及时收到新订单提醒',
      confirmText: '去开启',
      success: (res) => {
        if (res.confirm) {
          this.requestSubscribe()
        }
      }
    })
  },

  // 请求订阅
  async requestSubscribe() {
    try {
      await util.requestSubscribeMessage(this.data.tmplIds)
    } catch (err) {
      console.error('订阅失败:', err)
    }
  },

  // 刷新列表
  refreshList() {
    this.setData({
      page: 1,
      hasMore: true,
      orderList: []
    })
    this.getOrderList()
  },

  // 获取订单列表（只显示待接单的）
  async getOrderList() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getPendingList',
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })

      if (res.result.code === 0) {
        const list = res.result.data.list.map(item => ({
          ...item,
          dispatchDate: util.formatDate(item.dispatchDate),
          receiveDate: util.formatDate(item.receiveDate),
          createTime: util.formatDate(item.createTime, 'MM-DD HH:mm')
        }))

        this.setData({
          orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
          hasMore: list.length >= this.data.pageSize,
          loading: false
        })
      }
    } catch (err) {
      console.error('获取订单列表失败:', err)
      this.setData({ loading: false })
      util.showToast('获取订单列表失败')
    }
  },

  // 加载更多
  loadMore() {
    this.setData({
      page: this.data.page + 1
    })
    this.getOrderList()
  },

  // 查看订单详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/craftsman/orderDetail?id=${id}`
    })
  },

  // 立即接单
  async takeOrder(e) {
    const id = e.currentTarget.dataset.id
    
    // 检查用户是否已注册为手工艺人
    const craftsmanInfo = app.globalData.craftsmanInfo
    if (!craftsmanInfo) {
      util.showToast('您还未注册成为手工艺人')
      return
    }

    const confirmed = await util.showConfirm('确认接单', '确定要接这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'accept',
          orderId: id,
          craftsmanId: craftsmanInfo._id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('接单成功', 'success')
        // 刷新列表
        this.refreshList()
        // 发送订阅消息确认
        this.sendAcceptConfirm(id)
      } else {
        util.showToast(res.result.message || '接单失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('接单失败:', err)
      util.showToast('接单失败')
    }
  },

  // 发送接单确认通知
  async sendAcceptConfirm(orderId) {
    try {
      await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'sendAcceptConfirm',
          orderId
        }
      })
    } catch (err) {
      console.error('发送确认通知失败:', err)
    }
  }
})
