const util = require('../../utils/util.js')

Page({
  data: {
    craftsmanId: '',
    craftsmanName: '',
    orders: [],
    filteredOrders: [],
    currentFilter: 'all',
    loading: false,
    stats: {
      total: 0,
      completed: 0,
      pending: 0
    }
  },

  onLoad(options) {
    if (options.craftsmanId) {
      this.setData({
        craftsmanId: options.craftsmanId,
        craftsmanName: decodeURIComponent(options.name || '手艺人')
      })
      this.loadOrders()
    } else {
      util.showToast('参数错误', 'error')
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载订单列表
  async loadOrders() {
    this.setData({ loading: true })
    try {
      // 获取该手艺人的所有订单（通过派单人视角）
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDispatcherOrders',
          page: 1,
          pageSize: 1000
        }
      })

      if (res.result.code === 0) {
        const allOrders = res.result.data.list || []
        // 筛选出该手艺人的订单
        const craftsmanOrders = allOrders.filter(order => 
          order.craftsmanId === this.data.craftsmanId
        ).map(order => {
          return {
            ...order,
            createTime: this.formatDate(order.createTime),
            completeDate: order.completeDate ? this.formatDate(order.completeDate) : null
          }
        })

        // 计算统计
        const stats = {
          total: craftsmanOrders.length,
          completed: craftsmanOrders.filter(o => o.status === 'completed').length,
          pending: craftsmanOrders.filter(o => o.status === 'accepted' || o.status === 'shipped').length
        }

        this.setData({
          orders: craftsmanOrders,
          stats
        })
        this.filterOrders()
      } else {
        util.showToast('加载失败', 'error')
      }
    } catch (err) {
      console.error('加载订单失败:', err)
      util.showToast('加载失败', 'error')
    }
    this.setData({ loading: false })
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  // 切换筛选
  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ currentFilter: filter })
    this.filterOrders()
  },

  // 筛选订单
  filterOrders() {
    const { orders, currentFilter } = this.data
    let filtered = orders

    if (currentFilter !== 'all') {
      filtered = orders.filter(order => order.status === currentFilter)
    }

    // 按时间倒序
    filtered = filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))

    this.setData({ filteredOrders: filtered })
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/dispatcher/orderDetail?id=${id}`
    })
  },

  // 评价订单
  rateOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/dispatcher/rateCraftsman?orderId=${id}`
    })
  }
})
