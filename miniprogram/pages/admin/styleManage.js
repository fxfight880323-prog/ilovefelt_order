const util = require('../../utils/util.js')

Page({
  data: {
    styleList: [],
    loading: false,
    showAddModal: false,
    editingId: null,
    form: {
      name: ''
    }
  },

  onLoad() {
    this.getStyleList()
  },

  onShow() {
    this.getStyleList()
  },

  onPullDownRefresh() {
    this.getStyleList()
    wx.stopPullDownRefresh()
  },

  // 获取样式列表
  async getStyleList() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: { action: 'getList' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          styleList: res.result.data.map(item => ({
            ...item,
            createTime: util.formatDate(item.createTime, 'YYYY-MM-DD')
          })),
          loading: false
        })
      }
    } catch (err) {
      console.error('获取样式列表失败:', err)
      this.setData({ loading: false })
      util.showToast('获取失败')
    }
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showAddModal: true,
      editingId: null,
      'form.name': ''
    })
  },

  // 显示编辑弹窗
  showEditModal(e) {
    const id = e.currentTarget.dataset.id
    const style = this.data.styleList.find(item => item._id === id)
    if (style) {
      this.setData({
        showAddModal: true,
        editingId: id,
        'form.name': style.name
      })
    }
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showAddModal: false
    })
  },

  // 输入名称
  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value
    })
  },

  // 保存样式
  async saveStyle() {
    const name = this.data.form.name.trim()
    if (!name) {
      util.showToast('请输入样式名称')
      return
    }

    util.showLoading('保存中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: {
          action: this.data.editingId ? 'update' : 'add',
          data: {
            id: this.data.editingId,
            name
          }
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('保存成功', 'success')
        this.closeModal()
        this.getStyleList()
      } else {
        util.showToast(res.result.message || '保存失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('保存样式失败:', err)
      util.showToast('保存失败')
    }
  },

  // 删除样式
  async deleteStyle(e) {
    const id = e.currentTarget.dataset.id
    
    // 检查是否有订单使用此样式
    const usedCount = await this.checkStyleUsed(id)
    if (usedCount > 0) {
      util.showToast(`该样式已被${usedCount}个订单使用，无法删除`)
      return
    }

    const confirmed = await util.showConfirm('确认删除', '删除后无法恢复，确定要删除吗？')
    if (!confirmed) return

    util.showLoading('删除中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'style',
        data: {
          action: 'delete',
          id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('删除成功', 'success')
        this.getStyleList()
      } else {
        util.showToast(res.result.message || '删除失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('删除样式失败:', err)
      util.showToast('删除失败')
    }
  },

  // 检查样式是否被使用
  async checkStyleUsed(styleId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'countByStyle',
          styleId
        }
      })
      return res.result.count || 0
    } catch (err) {
      return 0
    }
  }
})
