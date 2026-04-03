const API = require('../../utils/api.js')

Page({
  data: {
    isLoading: true,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    sortBy: 'totalAmount', // totalAmount, totalOrders, completedOrders
    sortOrder: 'desc'
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadStats()
    }
  },

  // 检查超级管理员权限
  async checkAdmin() {
    try {
      const res = await API.auth.checkStatus()
      
      if (!res.success || !res.data.isSuperAdmin) {
        wx.showModal({
          title: '无权限访问',
          content: '只有超级管理员可以访问此页面',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }

      this.setData({ isAdmin: true })
      this.loadStats()
    } catch (err) {
      console.error('检查权限失败:', err)
      wx.showToast({ title: '权限检查失败', icon: 'none' })
    }
  },

  // 加载派单人统计
  async loadStats(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, list: [], hasMore: true })
    }

    if (!this.data.hasMore && !refresh) return

    this.setData({ isLoading: true })

    try {
      console.log('[DispatcherStats] 开始加载数据...')
      
      // 先尝试使用API
      let list = []
      let total = 0
      
      try {
        const res = await API.call('admin', 'getDispatcherStats', {
          page: this.data.page,
          pageSize: this.data.pageSize
        })
        
        if (res.success) {
          list = res.data.list || []
          total = res.data.total || 0
        } else {
          throw new Error(res.msg)
        }
      } catch (apiErr) {
        console.log('[DispatcherStats] API调用失败，使用直接查询:', apiErr.message)
        
        // 备选：直接查询数据库
        const db = wx.cloud.database()
        const { data: dispatchers } = await db.collection('dispatchers')
          .orderBy('createTime', 'desc')
          .get()
        
        console.log('[DispatcherStats] 直接查询到:', dispatchers.length)
        
        // 统计每个派单人的订单
        list = await Promise.all(dispatchers.map(async (d) => {
          const { data: orders } = await db.collection('orders')
            .where({ dispatcherPhone: d.phone })
            .get()
          
          return {
            ...d,
            stats: {
              totalOrders: orders.length,
              pendingOrders: orders.filter(o => o.status === 'pending').length,
              acceptedOrders: orders.filter(o => o.status === 'accepted').length,
              completedOrders: orders.filter(o => o.status === 'completed').length,
              cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
              totalAmount: orders.filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2),
              estimatedAmount: orders.filter(o => o.status !== 'cancelled')
                .reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2)
            }
          }
        }))
        
        total = list.length
      }
      
      // 排序
      const { sortBy, sortOrder } = this.data
      list.sort((a, b) => {
        const aVal = parseFloat(a.stats?.[sortBy]) || 0
        const bVal = parseFloat(b.stats?.[sortBy]) || 0
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
      })

      this.setData({
        list: refresh ? list : [...this.data.list, ...list],
        total: total,
        hasMore: false, // 直接查询一次性返回所有
        page: this.data.page + 1
      })
      
      console.log('[DispatcherStats] 加载成功:', list.length, '条数据')
    } catch (err) {
      console.error('[DispatcherStats] 加载统计失败:', err)
      wx.showToast({ title: '加载失败: ' + err.message, icon: 'none' })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 排序
  onSortChange(e) {
    const { field } = e.currentTarget.dataset
    const { sortBy, sortOrder } = this.data
    
    if (sortBy === field) {
      // 切换排序方向
      this.setData({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' })
    } else {
      // 切换排序字段
      this.setData({ sortBy: field, sortOrder: 'desc' })
    }
    
    this.loadStats(true)
  },

  // 加载更多
  loadMore() {
    this.loadStats()
  },

  // 查看派单人详情
  viewDetail(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '查看详情',
      content: `查看 ${name} 的详细派单记录？`,
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/admin/dispatcherOrders?dispatcherId=${id}`
          })
        }
      }
    })
  },

  // 返回
  onBack() {
    wx.navigateBack()
  },

  // 刷新
  onRefresh() {
    this.loadStats(true)
    wx.showToast({ title: '已刷新' })
  }
})
