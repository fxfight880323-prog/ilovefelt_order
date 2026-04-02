const API = require('../../utils/api.js')

Page({
  data: {
    isLoading: true,
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    statusFilter: '',
    orderNo: '',
    editingId: null,
    editForm: {
      name: '',
      quantity: '',
      price: '',
      status: '',
      remark: '',
      receiveDate: ''
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  onShow() {
    if (this.data.isAdmin) {
      this.loadList()
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
      this.loadList()
    } catch (err) {
      console.error('检查权限失败:', err)
      wx.showToast({ title: '权限检查失败', icon: 'none' })
    }
  },

  // 加载订单列表
  async loadList(refresh = false) {
    if (refresh) {
      this.setData({ page: 1, list: [], hasMore: true })
    }

    if (!this.data.hasMore && !refresh) return

    this.setData({ isLoading: true })

    try {
      const res = await API.call('admin', 'getOrdersList', {
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.statusFilter,
        orderNo: this.data.orderNo
      })

      if (res.success) {
        const newList = res.data.list.map(item => ({
          ...item,
          statusText: this.getStatusText(item.status),
          createTimeText: this.formatTime(item.createTime),
          totalAmount: (item.quantity * item.price).toFixed(2)
        }))

        this.setData({
          list: refresh ? newList : [...this.data.list, ...newList],
          total: res.data.total,
          hasMore: this.data.list.length + newList.length < res.data.total,
          page: this.data.page + 1
        })
      }
    } catch (err) {
      console.error('加载列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      pending: '待接单',
      accepted: '已接单',
      completed: '已完成',
      cancelled: '已取消'
    }
    return map[status] || status
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  },

  // 状态筛选
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ statusFilter: status })
    this.loadList(true)
  },

  // 搜索
  onOrderNoInput(e) {
    this.setData({ orderNo: e.detail.value })
  },

  onSearch() {
    this.setData({ page: 1 })
    this.loadList(true)
  },

  // 加载更多
  loadMore() {
    this.loadList()
  },

  // 编辑
  onEdit(e) {
    const { id } = e.currentTarget.dataset
    const item = this.data.list.find(i => i._id === id)
    
    if (!item) return

    this.setData({
      editingId: id,
      editForm: {
        name: item.name || '',
        quantity: String(item.quantity || ''),
        price: String(item.price || ''),
        status: item.status || 'pending',
        remark: item.remark || '',
        receiveDate: item.receiveDate || ''
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

  // 表单输入
  onEditInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`editForm.${field}`]: e.detail.value
    })
  },

  // 状态选择
  onEditStatusChange(e) {
    const statusList = ['pending', 'accepted', 'completed', 'cancelled']
    this.setData({
      'editForm.status': statusList[e.detail.value]
    })
  },

  // 保存编辑
  async onSaveEdit() {
    const { editingId, editForm } = this.data
    
    if (!editForm.name.trim()) {
      wx.showToast({ title: '请输入订单名称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const res = await API.call('admin', 'updateOrder', {
        id: editingId,
        ...editForm
      })

      wx.hideLoading()

      if (res.success) {
        wx.showToast({ title: '保存成功' })
        this.hideEditModal()
        this.loadList(true)
      } else {
        wx.showToast({ title: res.msg || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 删除订单
  onDelete(e) {
    const { id, orderNo } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定删除订单 "${orderNo}" 吗？此操作不可恢复`,
      confirmColor: '#ff6b6b',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })

          try {
            const result = await API.call('admin', 'deleteOrder', { id })

            wx.hideLoading()

            if (result.success) {
              wx.showToast({ title: '已删除' })
              this.loadList(true)
            } else {
              wx.showToast({ title: result.msg || '删除失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 取消订单
  onCancel(e) {
    const { id, orderNo } = e.currentTarget.dataset

    wx.showModal({
      title: '确认取消',
      content: `确定取消订单 "${orderNo}" 吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })

          try {
            const result = await API.call('admin', 'updateOrder', {
              id,
              status: 'cancelled'
            })

            wx.hideLoading()

            if (result.success) {
              wx.showToast({ title: '已取消' })
              this.loadList(true)
            } else {
              wx.showToast({ title: result.msg || '取消失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '取消失败', icon: 'none' })
          }
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
    this.loadList(true)
    wx.showToast({ title: '已刷新' })
  }
})
