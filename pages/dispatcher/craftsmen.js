const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    craftsmenList: [],
    filteredList: [],
    keyword: '',
    loading: false,
    dispatcherId: '',
    userRole: ''
  },

  onLoad() {
    console.log('craftsmen page onLoad')
    const app = getApp()
    this.setData({ userRole: app.globalData.userRole || 'guest' })
    console.log('current userRole:', this.data.userRole)
    this.loadCraftsmenList()
  },

  onShow() {
    console.log('craftsmen page onShow')
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
  },

  // 加载手艺人列表
  async loadCraftsmenList() {
    console.log('开始加载手艺人列表')
    this.setData({ loading: true })
    
    try {
      // 获取该派单人的所有订单
      const orderRes = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getDispatcherOrders',
          page: 1,
          pageSize: 1000
        }
      })

      console.log('获取订单结果:', orderRes.result)

      if (orderRes.result.code === 0) {
        const orders = orderRes.result.data.list || []
        console.log('订单数量:', orders.length)
        
        // 统计手艺人数据
        const craftsmenMap = this.processCraftsmenData(orders)
        const craftsmenList = Object.values(craftsmenMap).sort((a, b) => {
          return new Date(b.lastOrderDate) - new Date(a.lastOrderDate)
        })
        
        console.log('手艺人数量:', craftsmenList.length)
        
        this.setData({
          craftsmenList,
          filteredList: craftsmenList
        })
      } else {
        console.error('获取订单失败:', orderRes.result.message)
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载手艺人列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    
    this.setData({ loading: false })
  },

  // 处理手艺人数据
  processCraftsmenData(orders) {
    const craftsmenMap = {}

    orders.forEach(order => {
      if (!order.craftsmanId) return

      const craftsmanId = order.craftsmanId
      if (!craftsmenMap[craftsmanId]) {
        craftsmenMap[craftsmanId] = {
          _id: craftsmanId,
          name: order.craftsmanName || '未知手艺人',
          phone: order.craftsmanPhone || '',
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          rating: order.craftsmanRating || null,
          lastOrderDate: null,
          orders: []
        }
      }

      const craftsman = craftsmenMap[craftsmanId]
      craftsman.totalOrders++
      craftsman.orders.push(order)

      if (order.status === 'completed') {
        craftsman.completedOrders++
      } else if (order.status === 'accepted' || order.status === 'shipped') {
        craftsman.pendingOrders++
      }

      // 更新最近合作时间
      const orderDate = order.createTime || order.acceptDate
      if (orderDate) {
        const dateStr = this.formatDate(orderDate)
        if (!craftsman.lastOrderDate || dateStr > craftsman.lastOrderDate) {
          craftsman.lastOrderDate = dateStr
        }
      }
    })

    return craftsmenMap
  },

  // 格式化日期
  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  // 搜索
  onSearch() {
    const keyword = this.data.keyword.trim().toLowerCase()
    if (!keyword) {
      this.setData({ filteredList: this.data.craftsmenList })
      return
    }

    const filtered = this.data.craftsmenList.filter(item => {
      return item.name.toLowerCase().includes(keyword) ||
             (item.phone && item.phone.includes(keyword))
    })
    this.setData({ filteredList: filtered })
  },

  // 查看手艺人详情
  viewCraftsmanDetail(e) {
    const id = e.currentTarget.dataset.id
    const craftsman = this.data.craftsmenList.find(item => item._id === id)
    if (craftsman) {
      wx.navigateTo({
        url: `/pages/dispatcher/craftsmanOrders?craftsmanId=${id}&name=${encodeURIComponent(craftsman.name)}`
      })
    }
  }
})
