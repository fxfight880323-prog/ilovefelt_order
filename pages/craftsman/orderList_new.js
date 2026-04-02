const util = require('../../utils/util.js')
const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  async onLoad() {
    await this.getCraftsmanInfo()
    this.getOrderList()
  },

  // 获取手艺人信息 - 使用新API
  async getCraftsmanInfo() {
    try {
      const res = await API.user.getInfo()
      
      if (res.data.rolesInfo && res.data.rolesInfo.craftsman) {
        app.globalData.craftsmanInfo = res.data.rolesInfo.craftsman
        console.log('已更新 craftsmanInfo:', res.data.rolesInfo.craftsman)
      }
    } catch (err) {
      console.error('获取手艺人信息失败:', err)
    }
  },

  onShow() {
    console.log('onShow - craftsmanInfo:', app.globalData.craftsmanInfo)
    this.refreshList()
    
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
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

  refreshList() {
    this.setData({
      page: 1,
      hasMore: true,
      orderList: []
    })
    this.getOrderList()
  },

  // 获取订单列表 - 使用新API
  async getOrderList() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 使用新API获取订单列表
      const res = await API.order.list()

      // 格式化数据
      const list = res.data.map(item => ({
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
    } catch (err) {
      console.error('获取订单列表失败:', err)
      this.setData({ loading: false })
      util.showToast('获取订单列表失败')
    }
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.getOrderList()
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/craftsman/orderDetail?id=${id}` })
  },

  // 立即接单 - 使用新API
  async takeOrder(e) {
    const id = e.currentTarget.dataset.id
    
    console.log('点击接单，订单ID:', id)
    console.log('全局 craftsmanInfo:', app.globalData.craftsmanInfo)
    
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
      // 使用新API接单
      await API.order.accept(id)

      util.hideLoading()
      util.showToast('接单成功', 'success')
      this.refreshList()
      
    } catch (err) {
      util.hideLoading()
      console.error('接单失败:', err)
      util.showToast(err.message || '接单失败')
    }
  }
})
