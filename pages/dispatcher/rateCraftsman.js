const app = getApp()

Page({
  data: {
    orderId: '',
    orderInfo: null,
    rating: 0,
    comment: '',
    loading: true,
    submitting: false,
    ratingText: '请点击星星评分'
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId })
      this.loadOrderInfo()
    } else {
      wx.showToast({ title: '参数错误', icon: 'error' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载订单信息
  async loadOrderInfo() {
    this.setData({ loading: true })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId: this.data.orderId
        }
      })

      if (result.code === 0) {
        this.setData({ orderInfo: result.data })
      } else {
        wx.showToast({ title: '加载失败', icon: 'error' })
      }
    } catch (err) {
      console.error('加载订单失败:', err)
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
    this.setData({ loading: false })
  },

  // 设置评分
  setRating(e) {
    const score = e.currentTarget.dataset.score
    const texts = ['', '非常不满意', '不满意', '一般', '满意', '非常满意']
    this.setData({
      rating: score,
      ratingText: texts[score]
    })
  },

  // 输入评价
  onCommentInput(e) {
    this.setData({ comment: e.detail.value })
  },

  // 提交评价
  async submitRating() {
    if (this.data.rating === 0) {
      wx.showToast({ title: '请选择评分', icon: 'none' })
      return
    }

    if (!this.data.orderInfo || !this.data.orderInfo.craftsmanId) {
      wx.showToast({ title: '无法获取手艺人信息', icon: 'error' })
      return
    }

    this.setData({ submitting: true })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'rateCraftsman',
          orderId: this.data.orderId,
          craftsmanId: this.data.orderInfo.craftsmanId,
          score: this.data.rating,
          comment: this.data.comment
        }
      })

      if (result.code === 0) {
        wx.showToast({ 
          title: '评价成功',
          icon: 'success',
          success: () => {
            setTimeout(() => wx.navigateBack(), 1500)
          }
        })
      } else {
        wx.showToast({ title: result.message || '评价失败', icon: 'error' })
      }
    } catch (err) {
      console.error('提交评价失败:', err)
      wx.showToast({ title: '评价失败', icon: 'error' })
    }

    this.setData({ submitting: false })
  }
})
