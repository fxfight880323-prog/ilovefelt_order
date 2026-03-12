const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    orderId: '',
    orderInfo: null,
    from: '', // 来源：admin或craftsman
    loading: false,
    isAdmin: false,
    craftsmanInfo: null
  },

  onLoad(options) {
    this.setData({
      orderId: options.id,
      from: options.from || '',
      isAdmin: app.globalData.isAdmin,
      craftsmanInfo: app.globalData.craftsmanInfo
    })
    this.getOrderDetail()
  },

  // 获取订单详情
  async getOrderDetail() {
    if (!this.data.orderId) return

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
        this.setData({
          orderInfo: {
            ...order,
            dispatchDate: util.formatDate(order.dispatchDate),
            receiveDate: util.formatDate(order.receiveDate),
            acceptDate: order.acceptDate ? util.formatDate(order.acceptDate, 'YYYY-MM-DD HH:mm') : '',
            completeDate: order.completeDate ? util.formatDate(order.completeDate, 'YYYY-MM-DD HH:mm') : '',
            createTime: util.formatDate(order.createTime, 'YYYY-MM-DD HH:mm')
          },
          loading: false
        })
      }
    } catch (err) {
      console.error('获取订单详情失败:', err)
      this.setData({ loading: false })
      util.showToast('获取订单详情失败')
    }
  },

  // 接单
  async acceptOrder() {
    const craftsmanInfo = this.data.craftsmanInfo
    if (!craftsmanInfo) {
      util.showToast('您还未注册成为手工艺人')
      return
    }

    const confirmed = await util.showConfirm('确认接单', '确定要接这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'accept',
          orderId: this.data.orderId,
          craftsmanId: craftsmanInfo._id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('接单成功', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '接单失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('接单失败:', err)
      util.showToast('接单失败')
    }
  },

  // 完成订单
  async completeOrder() {
    const confirmed = await util.showConfirm('确认完成', '确定要完成这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'complete',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('订单已完成', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '操作失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('完成订单失败:', err)
      util.showToast('操作失败')
    }
  },

  // 取消订单
  async cancelOrder() {
    const confirmed = await util.showConfirm('确认取消', '确定要取消这个订单吗？')
    if (!confirmed) return

    util.showLoading('处理中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'cancel',
          orderId: this.data.orderId
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('已取消', 'success')
        this.getOrderDetail()
      } else {
        util.showToast(res.result.message || '取消失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('取消订单失败:', err)
      util.showToast('取消失败')
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
})
