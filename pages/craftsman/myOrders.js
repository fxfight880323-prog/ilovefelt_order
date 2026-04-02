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
    // 当前筛选状态（新流程：已发货→已完成，已结束改为已撤回）
    currentStatus: 'all',
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'accepted', label: '进行中' },
      { value: 'shipped', label: '已发货' },
      { value: 'completed', label: '已完成' },
      { value: 'closed', label: '已撤回' }
    ]
  },

  onLoad() {
    this.loadCraftsmanInfo()
  },

  // 加载手艺人信息
  async loadCraftsmanInfo() {
    try {
      // 从云函数获取最新的手艺人信息
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'checkUserRole' }
      })
      
      if (res.result.code === 0 && res.result.data.craftsmanInfo) {
        const craftsmanInfo = res.result.data.craftsmanInfo
        this.setData({ craftsmanInfo })
        app.globalData.craftsmanInfo = craftsmanInfo
        this.getOrderList()
      } else {
        util.showToast('您还未注册为手艺人')
      }
    } catch (err) {
      console.error('获取手艺人信息失败:', err)
      util.showToast('获取信息失败')
    }
  },

  onShow() {
    // 检查是否有从其他页面传递过来的筛选参数
    const filter = app.globalData.myOrdersFilter
    if (filter) {
      // 清除全局参数，避免重复触发
      app.globalData.myOrdersFilter = null
      
      // 设置筛选并刷新列表
      this.setData({
        currentStatus: filter,
        page: 1,
        orderList: [],
        hasMore: true
      }, () => {
        // 在 setData 回调中重新加载数据
        this.loadCraftsmanInfo()
      })
    } else {
      // 每次显示页面时重新加载手艺人信息和订单列表
      this.loadCraftsmanInfo()
    }
    
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
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
    wx.navigateTo({
      url: `/pages/craftsman/orderDetail?id=${id}`
    })
  },

  // 跳转到接单大厅
  goToOrderHall() {
    wx.switchTab({
      url: '/pages/craftsman/orderList'
    })
  },

  // 确认收款
  async confirmReceipt(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认收款', '确定已收到款项吗？确认后订单将正式结束。')
    if (!confirmed) return

    util.showLoading('确认中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmReceipt',
          orderId: id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('确认收款成功', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '确认收款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('确认收款失败:', err)
      util.showToast('确认收款失败')
    }
  },

  // 撤回订单（已完成→进行中）
  async revertOrder(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认撤回', '确定要将该订单撤回到进行中状态吗？')
    if (!confirmed) return

    util.showLoading('撤回中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'revert',
          orderId: id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('撤回成功', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '撤回失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('撤回订单失败:', err)
      util.showToast('撤回失败')
    }
  }
})
