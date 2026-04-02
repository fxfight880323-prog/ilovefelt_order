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
      { value: 'accepted', label: '已指派' },
      { value: 'shipped', label: '已发货' },
      { value: 'completed', label: '已完成' },
      { value: 'closed', label: '已结束' },
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
    keyword: '',
    // 指派相关
    showAssignModal: false,
    craftsmanList: [],
    currentOrderId: '',
    selectedCraftsmanId: ''
  },

  onLoad() {
    this.getOrderList()
  },

  onShow() {
    this.refreshList()
    
    // 设置自定义 tabBar 选中状态（订单管理是第3个，索引2）
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

  // 获取订单列表
  async getOrderList() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      console.log('获取订单列表:', {
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.currentStatus,
        keyword: this.data.keyword
      })

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

      console.log('订单列表结果:', res.result)

      if (res.result.code === 0) {
        const list = await Promise.all((res.result.data.list || []).map(async item => {
          let imageUrl = item.imageUrl || ''
          
          // 如果是 fileID，转换为临时 URL
          if (imageUrl && imageUrl.startsWith('cloud://')) {
            try {
              const tempRes = await wx.cloud.getTempFileURL({
                fileList: [imageUrl]
              })
              imageUrl = tempRes.fileList[0].tempFileURL || imageUrl
            } catch (err) {
              console.error('获取图片临时链接失败:', err)
            }
          }
          
          return {
            ...item,
            imageUrl,
            totalPrice: (item.quantity || 1) * (item.price || 0),
            dispatchDate: util.formatDate(item.dispatchDate),
            receiveDate: util.formatDate(item.receiveDate),
            createTime: util.formatDate(item.createTime, 'MM-DD HH:mm')
          }
        }))

        this.setData({
          orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
          hasMore: list.length >= this.data.pageSize,
          loading: false
        })
      } else {
        console.error('获取订单列表失败:', res.result.message)
        this.setData({ loading: false })
        util.showToast(res.result.message || '获取订单失败')
      }
    } catch (err) {
      console.error('获取订单列表失败:', err)
      this.setData({ loading: false })
      if (err.message && err.message.includes('FunctionName')) {
        util.showToast('请先部署 order 云函数')
      } else {
        util.showToast('获取订单列表失败')
      }
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
  },

  // 阻止冒泡
  preventClose() {},

  // 显示指派弹窗
  async showAssignModal(e) {
    const orderId = e.currentTarget.dataset.id
    this.setData({
      showAssignModal: true,
      currentOrderId: orderId,
      selectedCraftsmanId: ''
    })
    await this.loadCraftsmanList()
  },

  // 关闭指派弹窗
  closeAssignModal() {
    this.setData({
      showAssignModal: false,
      currentOrderId: '',
      selectedCraftsmanId: ''
    })
  },

  // 加载手艺人列表
  async loadCraftsmanList() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'getList' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          craftsmanList: res.result.data || []
        })
      }
    } catch (err) {
      console.error('获取手艺人列表失败:', err)
      util.showToast('获取手艺人列表失败')
    }
  },

  // 选择手艺人
  selectCraftsman(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedCraftsmanId: id
    })
  },

  // 确认指派
  async confirmAssign() {
    const { currentOrderId, selectedCraftsmanId } = this.data
    
    if (!selectedCraftsmanId) {
      util.showToast('请选择手艺人')
      return
    }

    util.showLoading('指派中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'assign',
          data: {
            orderId: currentOrderId,
            craftsmanId: selectedCraftsmanId
          }
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('指派成功', 'success')
        this.closeAssignModal()
        this.refreshList()
      } else {
        util.showToast(res.result.message || '指派失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('指派订单失败:', err)
      util.showToast('指派失败')
    }
  },

  // 确认付款
  async confirmPayment(e) {
    const orderId = e.currentTarget.dataset.id
    
    const confirmed = await util.showConfirm('确认付款', '确定已向对方付款吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmPayment',
          orderId: orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('付款确认成功', 'success')
        this.refreshList()
      } else {
        util.showToast(res.result.message || '确认付款失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('确认付款失败:', err)
      util.showToast('确认付款失败')
    }
  },

  // 预览订单图片
  previewOrderImage(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    
    // 收集当前页面所有订单图片用于预览切换
    const urls = this.data.orderList
      .filter(item => item.imageUrl)
      .map(item => item.imageUrl)
    
    wx.previewImage({
      current: url,
      urls: urls.length > 0 ? urls : [url]
    })
  }
})
