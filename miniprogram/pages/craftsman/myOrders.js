const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    craftsmanInfo: null,
    // 当前筛选状态
    currentStatus: 'all',
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'accepted', label: '进行中' },
      { value: 'completed', label: '已完成' }
    ]
  },

  onLoad() {
    const craftsmanInfo = app.globalData.craftsmanInfo
    this.setData({ craftsmanInfo })
    
    if (craftsmanInfo) {
      this.getOrderList()
    }
  },

  onShow() {
    if (this.data.craftsmanInfo) {
      this.refreshList()
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

  // 获取我的订单列表
  async getOrderList() {
    if (!this.data.craftsmanInfo) {
      util.showToast('您还未注册成为手工艺人')
      return
    }
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getMyOrders',
          craftsmanId: this.data.craftsmanInfo._id,
          page: this.data.page,
          pageSize: this.data.pageSize,
          status: this.data.currentStatus === 'all' ? '' : this.data.currentStatus
        }
      })

      if (res.result.code === 0) {
        const list = res.result.data.list.map(item => ({
          ...item,
          dispatchDate: util.formatDate(item.dispatchDate),
          receiveDate: util.formatDate(item.receiveDate),
          acceptDate: item.acceptDate ? util.formatDate(item.acceptDate, 'MM-DD') : '',
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

  // 切换状态筛选
  switchStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      currentStatus: status,
      page: 1,
      orderList: [],
      hasMore: true
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

  // 完成订单
  async completeOrder(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认完成', '确定要完成这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'complete',
          orderId: id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('订单已完成', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '操作失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('完成订单失败:', err)
      util.showToast('操作失败')
    }
  }
})
