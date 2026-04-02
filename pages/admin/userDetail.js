const util = require('../../utils/util.js')

Page({
  data: {
    userId: '',
    userType: '', // craftsman 或 dispatcher
    userInfo: null,
    workList: [],
    loading: false,
    activeTab: 'info'
  },

  onLoad(options) {
    this.setData({
      userId: options.id,
      userType: options.type || 'craftsman'
    })
    this.loadUserDetail()
  },

  // 加载用户详情
  async loadUserDetail() {
    if (!this.data.userId) {
      util.showToast('用户ID不存在')
      return
    }

    this.setData({ loading: true })

    try {
      if (this.data.userType === 'craftsman') {
        // 获取手艺人详情
        const res = await wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'getCraftsmanDetail',
            data: { craftsmanId: this.data.userId }
          }
        })

        if (res.result.code === 0) {
          this.setData({
            userInfo: res.result.data,
            loading: false
          })
          // 加载工作记录
          this.loadWorkList()
        }
      } else {
        // 获取派单人详情
        const res = await wx.cloud.callFunction({
          name: 'admin',
          data: {
            action: 'getDispatcherDetail',
            data: { dispatcherId: this.data.userId }
          }
        })

        if (res.result.code === 0) {
          this.setData({
            userInfo: res.result.data,
            loading: false
          })
        }
      }
    } catch (err) {
      console.error('加载用户详情失败:', err)
      this.setData({ loading: false })
      util.showToast('加载失败')
    }
  },

  // 加载工作记录
  async loadWorkList() {
    if (this.data.userType !== 'craftsman') return

    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsmanWorks',
        data: {
          action: 'getList',
          craftsmanId: this.data.userId
        }
      })

      if (res.result.code === 0) {
        this.setData({
          workList: res.result.data.list
        })
      }
    } catch (err) {
      console.error('加载工作记录失败:', err)
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },

  // 头像加载失败时重新加载
  onAvatarError() {
    console.log('头像加载失败，重新加载用户详情')
    // 清空头像，然后重新加载
    this.setData({
      'userInfo.avatarUrl': ''
    })
    this.loadUserDetail()
  }
})
