const util = require('../../utils/util.js')

Page({
  data: {
    orderId: '',
    orderInfo: null,
    loading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id })
      this.loadOrderDetail()
    } else {
      util.showToast('参数错误', 'error')
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载订单详情
  async loadOrderDetail() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId: this.data.orderId
        }
      })

      if (res.result.code === 0) {
        const order = res.result.data
        // 格式化日期
        if (order.createTime) {
          order.createTime = this.formatDate(order.createTime)
        }
        if (order.receiveDate) {
          order.receiveDate = this.formatDate(order.receiveDate)
        }
        if (order.shipDate) {
          order.shipDate = this.formatDate(order.shipDate)
        }
        if (order.completeDate) {
          order.completeDate = this.formatDate(order.completeDate)
        }
        this.setData({ orderInfo: order })
      } else {
        util.showToast(res.result.message || '加载失败', 'error')
      }
    } catch (err) {
      console.error('加载订单详情失败:', err)
      util.showToast('加载失败', 'error')
    }
    this.setData({ loading: false })
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  // 预览图片
  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.orderInfo.completePhotos || []
    wx.previewImage({
      current: url,
      urls: urls
    })
  }
})
