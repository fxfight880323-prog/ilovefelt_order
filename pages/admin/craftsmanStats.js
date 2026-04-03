const API = require('../../utils/api.js')

Page({
  data: {
    isLoading: true,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    sortBy: 'avgRating', // avgRating, totalAmount, completedOrders
    sortOrder: 'desc',
    editingId: null,
    editForm: {
      rating: 0,
      level: '',
      comment: ''
    }
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

  // 加载手艺人统计
  async loadStats(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, list: [], hasMore: true })
    }

    if (!this.data.hasMore && !refresh) return

    this.setData({ isLoading: true })

    try {
      const res = await API.call('admin', 'getCraftsmanStats', {
        page: this.data.page,
        pageSize: this.data.pageSize
      })

      if (res.success) {
        // 排序
        let sortedList = res.data.list
        const { sortBy, sortOrder } = this.data
        
        sortedList.sort((a, b) => {
          let aVal, bVal
          if (sortBy === 'avgRating') {
            aVal = a.stats.avgRating || a.rating || 0
            bVal = b.stats.avgRating || b.rating || 0
          } else {
            aVal = parseFloat(a.stats[sortBy]) || 0
            bVal = parseFloat(b.stats[sortBy]) || 0
          }
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
      this.setData({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' })
    } else {
      this.setData({ sortBy: field, sortOrder: 'desc' })
    }
    
    this.loadStats(true)
  },

  // 加载更多
  loadMore() {
    this.loadStats()
  },

  // 编辑评分
  onEditRating(e) {
    const { id } = e.currentTarget.dataset
    const item = this.data.list.find(i => i._id === id)
    
    if (!item) return

    this.setData({
      editingId: id,
      editForm: {
        rating: item.rating || item.stats.avgRating || 0,
        level: item.level || '',
        comment: item.adminComment || ''
      }
    })

    this.showEditModal()
  },

  // 显示编辑弹窗
  showEditModal() {
    this.setData({ showEdit: true })
  },

  // 隐藏编辑弹窗
  hideEditModal() {
    this.setData({ showEdit: false, editingId: null })
  },

  // 评分输入
  onRatingInput(e) {
    let value = parseFloat(e.detail.value)
    if (value < 0) value = 0
    if (value > 5) value = 5
    this.setData({ 'editForm.rating': value })
  },

  // 等级输入
  onLevelInput(e) {
    this.setData({ 'editForm.level': e.detail.value })
  },

  // 备注输入
  onCommentInput(e) {
    this.setData({ 'editForm.comment': e.detail.value })
  },

  // 保存评分
  async onSaveRating() {
    const { editingId, editForm } = this.data
    
    if (editForm.rating < 0 || editForm.rating > 5) {
      wx.showToast({ title: '评分必须在0-5之间', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const res = await API.call('admin', 'updateCraftsmanRating', {
        id: editingId,
        rating: editForm.rating,
        level: editForm.level,
        comment: editForm.comment
      })

      wx.hideLoading()

      if (res.success) {
        wx.showToast({ title: '评分更新成功' })
        this.hideEditModal()
        this.loadStats(true)
      } else {
        wx.showToast({ title: res.msg || '更新失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
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
