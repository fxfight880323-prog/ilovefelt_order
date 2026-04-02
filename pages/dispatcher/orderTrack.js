const util = require('../../utils/util.js')

Page({
  data: {
    orderId: '',
    orderInfo: {}
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.setData({ orderId: id })
      this.getOrderDetail()
    }
  },

  // 获取订单详情
  async getOrderDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDetail',
          orderId: this.data.orderId
        }
      })

      wx.hideLoading()

      if (res.result.code === 0) {
        const order = res.result.data
        this.setData({
          orderInfo: {
            ...order,
            acceptDate: order.acceptDate ? util.formatDate(order.acceptDate, 'YYYY-MM-DD HH:mm') : '',
            shipDate: order.shipDate ? util.formatDate(order.shipDate, 'YYYY-MM-DD HH:mm') : '',
            completeDate: order.completeDate ? util.formatDate(order.completeDate, 'YYYY-MM-DD HH:mm') : ''
          }
        })
      } else {
        util.showToast(res.result.message || '获取失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('获取订单详情失败:', err)
      util.showToast('获取失败')
    }
  },

  // 预览照片
  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.orderInfo.completePhotos || []
    wx.previewImage({
      current: url,
      urls
    })
  },

  // 联系手艺人
  contactCraftsman() {
    const phone = this.data.orderInfo.craftsmanPhone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone })
    } else {
      util.showToast('手艺人电话不存在')
    }
  },

  // 确认完成
  async confirmComplete() {
    const confirmed = await util.showConfirm('确认完成', '确定该订单已完成吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'confirmComplete',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()

      if (res.result.code === 0) {
        util.showToast('确认成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '确认失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('确认完成失败:', err)
      util.showToast('确认失败')
    }
  }
})
