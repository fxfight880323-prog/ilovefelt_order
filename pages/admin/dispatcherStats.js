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
      const res = await API.call('admin', 'getDispatcherStats', {
        page: this.data.page,
        pageSize: this.data.pageSize
      })

      if (res.success) {
        // 排序
        let sortedList = res.data.list
        const { sortBy, sortOrder } = this.data
        
        sortedList.sort((a, b) => {
          const aVal = parseFloat(a.stats[sortBy]) || 0
          const bVal = parseFloat(b.stats[sortBy]) || 0
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
        })

        this.setData({
          list: refresh ? sortedList : [...this.data.list, ...sortedList],
          total: res.data.total,
          hasMore: this.data.list.length + sortedList.length < res.data.total,
          page: this.data.page + 1
        })
      }
    } catch (err) {
      console.error('加载统计失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
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
