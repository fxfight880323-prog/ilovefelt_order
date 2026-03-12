const util = require('../../utils/util.js')

Page({
  data: {
    // 订单列表
    orderList: [],
    // 当前筛选状态
    currentStatus: 'all',
    // 状态选项
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待接单' },
      { value: 'accepted', label: '进行中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ],
    // 页码
    page: 1,
    pageSize: 10,
    // 是否还有更多
    hasMore: true,
    // 加载中
    loading: false,
    // 搜索关键词
    keyword: ''
  },

  onLoad() {
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

  // 刷新列表
  refreshList() {
    this.setData({
      page: 1,
      hasMore: true,
      orderList: []
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
          action: 'getList',
          page: this.data.page,
          pageSize: this.data.pageSize,
          status: this.data.currentStatus === 'all' ? '' : this.data.currentStatus,
          keyword: this.data.keyword
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

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    })
  },

  // 搜索
  onSearch() {
    this.refreshList()
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/craftsman/orderDetail?id=${id}&from=admin`
    })
  },

  // 编辑订单
  editOrder(e) {
    const id = e.currentTarget.dataset.id
    // 只能编辑待接单的订单
    const order = this.data.orderList.find(item => item._id === id)
    if (order && order.status !== 'pending') {
      util.showToast('只能编辑待接单的订单')
      return
    }
    wx.navigateTo({
      url: `/pages/admin/orderForm?id=${id}&action=edit`
    })
  },

  // 取消订单
  async cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认取消', '确定要取消这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'cancel',
          orderId: id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('已取消', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '取消失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('取消订单失败:', err)
      util.showToast('取消失败')
    }
  },

  // 删除订单
  async deleteOrder(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认删除', '删除后无法恢复，确定要删除吗？')
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
        util.showToast('已删除', 'success')
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

  // 新建订单
  createOrder() {
    wx.navigateTo({
      url: '/pages/admin/orderForm'
    })
  }
})
