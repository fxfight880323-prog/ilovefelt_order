const util = require('../../utils/util.js')
const app = getApp()

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

  // 加载更多
  loadMore() {
    this.setData({
      page: this.data.page + 1
    })
    this.getOrderList()
  },

  // 切换筛选
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

  // 获取订单列表
  async getOrderList() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDispatcherOrders',
          page: this.data.page,
          pageSize: this.data.pageSize,
          status: this.data.currentFilter === 'all' ? '' : this.data.currentFilter
        }
      })

      if (res.result.code === 0) {
        const list = res.result.data.list.map(item => ({
          ...item,
          createTime: util.formatDate(item.createTime, 'YYYY-MM-DD HH:mm')
        }))

        this.setData({
          orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
          hasMore: list.length >= this.data.pageSize,
          loading: false
        })
      } else {
        util.showToast(res.result.message || '获取失败')
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('获取订单列表失败:', err)
      util.showToast('获取失败')
      this.setData({ loading: false })
    }
  },

  // 编辑订单
  editOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/orderForm?id=${id}&mode=edit`
    })
  },

  // 删除订单
  async deleteOrder(e) {
    const id = e.currentTarget.dataset.id
    
    const confirmed = await util.showConfirm('删除订单', '确定要删除这个订单吗？删除后无法恢复。')
    if (!confirmed) return

    util.showLoading('删除中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'delete',
          orderId: id
        }
      })

      util.hideLoading()

      if (res.result.code === 0) {
        util.showToast('删除成功', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '删除失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('删除订单失败:', err)
      util.showToast('删除失败')
    }
  },

  // 跟踪订单
  trackOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/dispatcher/orderTrack?id=${id}`
    })
  },

  // 联系手艺人
  contactCraftsman(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.orderList.find(item => item._id === id)
    if (order && order.craftsmanPhone) {
      wx.makePhoneCall({
        phoneNumber: order.craftsmanPhone
      })
    } else {
      util.showToast('手艺人电话不存在')
    }
  },

  // 查看详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/dispatcher/orderDetail?id=${id}`
    })
  },

  // 评价手艺人
  rateCraftsman(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/dispatcher/rateCraftsman?orderId=${id}`
    })
  },

  // 创建新订单
  goToCreateOrder() {
    wx.navigateTo({
      url: '/pages/admin/orderForm'
    })
  }
})
