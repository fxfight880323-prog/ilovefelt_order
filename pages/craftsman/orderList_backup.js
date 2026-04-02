const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    // 订阅消息功能已取消
    // this.checkSubscribe()
    this.getCraftsmanInfo() // 获取手艺人信息
    this.getOrderList()
  },

  // 获取手艺人信息
  async getCraftsmanInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'checkUserRole' }
      })
      
      if (res.result.code === 0 && res.result.data.craftsmanInfo) {
        app.globalData.craftsmanInfo = res.result.data.craftsmanInfo
        console.log('已更新 craftsmanInfo:', res.result.data.craftsmanInfo)
      }
    } catch (err) {
      console.error('获取手艺人信息失败:', err)
    }
  },

  onShow() {
    // 刷新 craftsmanInfo
    console.log('onShow - craftsmanInfo:', app.globalData.craftsmanInfo)
    this.refreshList()
    
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
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
    
    console.log('点击接单，订单ID:', id)
    console.log('全局 craftsmanInfo:', app.globalData.craftsmanInfo)
    
    // 检查用户是否已注册为手工艺人
    const craftsmanInfo = app.globalData.craftsmanInfo
    if (!craftsmanInfo) {
      console.error('craftsmanInfo 为空')
      util.showToast('您还未注册成为手工艺人，请先完善信息')
      return
    }
    
    console.log('手艺人ID:', craftsmanInfo._id)

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
      } else {
        util.showToast(res.result.message || '接单失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('接单失败:', err)
      util.showToast('接单失败')
    }
  },

})
