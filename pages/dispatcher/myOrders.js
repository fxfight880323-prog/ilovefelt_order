const util = require('../../utils/util.js')
const app = getApp()
const API = require('../../utils/api.js')

Page({
  data: {
    orderList: [],
    loading: false,
    currentFilter: 'all',
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    this.getOrderList()
  },

  onShow() {
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

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.getOrderList()
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({
      currentFilter: filter,
      page: 1,
      orderList: [],
      hasMore: true
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

      // 根据当前筛选过滤
      let list = res.data
      if (this.data.currentFilter !== 'all') {
        list = list.filter(item => item.status === this.data.currentFilter)
      }

      // 格式化数据
      list = list.map(item => ({
        ...item,
        createTime: util.formatDate(item.createTime, 'YYYY-MM-DD HH:mm')
      }))

      this.setData({
        orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
        hasMore: list.length >= this.data.pageSize,
        loading: false
      })
    } catch (err) {
      console.error('获取订单列表失败:', err)
      util.showToast(err.message || '获取失败')
      this.setData({ loading: false })
    }
  },

  editOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/admin/orderForm?id=${id}&mode=edit` })
  },

  // 删除订单 - 使用新API
  async deleteOrder(e) {
    const id = e.currentTarget.dataset.id
    
    const confirmed = await util.showConfirm('删除订单', '确定要删除这个订单吗？删除后无法恢复。')
    if (!confirmed) return

    util.showLoading('删除中...')
    try {
      // 使用新API删除订单（取消订单）
      await API.order.cancel(id, '派单人删除')

      util.hideLoading()
      util.showToast('删除成功', 'success')
      this.refreshList()
      
    } catch (err) {
      util.hideLoading()
      console.error('删除订单失败:', err)
      util.showToast(err.message || '删除失败')
    }
  },

  trackOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/dispatcher/orderTrack?id=${id}` })
  },

  contactCraftsman(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orderList.find(item => item._id === id)
    if (order && order.craftsmanPhone) {
      wx.makePhoneCall({ phoneNumber: order.craftsmanPhone })
    } else {
      util.showToast('手艺人电话不存在')
    }
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/dispatcher/orderDetail?id=${id}` })
  },

  rateCraftsman(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/dispatcher/rateCraftsman?orderId=${id}` })
  },

  goToCreateOrder() {
    wx.navigateTo({ url: '/pages/admin/orderForm' })
  }
})
