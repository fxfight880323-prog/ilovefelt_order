const util = require('../../utils/util.js')

Page({
  data: {
    craftsmanList: [],
    loading: false,
    showModal: false,
    editingId: null,
    // 星级选项
    starOptions: [1, 2, 3, 4, 5],
    starIndex: 2,
    // 擅长方向选项
    specialtyOptions: ['刺绣', '编织', '陶艺', '木工', '剪纸', '绘画', '其他'],
    specialtyIndex: -1,
    form: {
      name: '',
      phone: '',
      starLevel: 3,
      specialty: '',
      performance: ''
    }
  },

  onLoad() {
    this.getCraftsmanList()
  },

  onShow() {
    this.getCraftsmanList()
  },

  onPullDownRefresh() {
    this.getCraftsmanList()
    wx.stopPullDownRefresh()
  },

  // 获取手工艺人列表
  async getCraftsmanList() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: { action: 'getList' }
      })
      
      if (res.result.code === 0) {
        this.setData({
          craftsmanList: res.result.data,
          loading: false
        })
      }
    } catch (err) {
      console.error('获取手工艺人列表失败:', err)
      this.setData({ loading: false })
      util.showToast('获取失败')
    }
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      editingId: null,
      starIndex: 2,
      specialtyIndex: -1,
      form: {
        name: '',
        phone: '',
        starLevel: 3,
        specialty: '',
        performance: '良好'
      }
    })
  },

  // 显示编辑弹窗
  showEditModal(e) {
    const id = e.currentTarget.dataset.id
    const craftsman = this.data.craftsmanList.find(item => item._id === id)
    if (craftsman) {
      const starIndex = this.data.starOptions.indexOf(craftsman.starLevel)
      const specialtyIndex = this.data.specialtyOptions.indexOf(craftsman.specialty)
      this.setData({
        showModal: true,
        editingId: id,
        starIndex: starIndex >= 0 ? starIndex : 2,
        specialtyIndex: specialtyIndex >= 0 ? specialtyIndex : -1,
        form: {
          name: craftsman.name,
          phone: craftsman.phone || '',
          starLevel: craftsman.starLevel,
          specialty: craftsman.specialty,
          performance: craftsman.performance || '良好'
        }
      })
    }
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showModal: false
    })
  },

  preventClose() {
    // 阻止冒泡
  },

  // 输入名称
  onNameInput(e) {
    this.setData({
      'form.name': e.detail.value
    })
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      'form.phone': e.detail.value
    })
  },

  // 选择星级
  onStarChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      starIndex: index,
      'form.starLevel': this.data.starOptions[index]
    })
  },

  // 选择擅长方向
  onSpecialtyChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      specialtyIndex: index,
      'form.specialty': this.data.specialtyOptions[index]
    })
  },

  // 输入履约情况
  onPerformanceInput(e) {
    this.setData({
      'form.performance': e.detail.value
    })
  },

  // 验证表单
  validateForm() {
    const { form } = this.data
    if (!form.name.trim()) {
      util.showToast('请输入姓名')
      return false
    }
    if (form.phone && !util.isValidPhone(form.phone)) {
      util.showToast('请输入正确的手机号')
      return false
    }
    if (!form.specialty) {
      util.showToast('请选择擅长方向')
      return false
    }
    return true
  },

  // 保存手工艺人
  async saveCraftsman() {
    if (!this.validateForm()) return

    util.showLoading('保存中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: {
          action: this.data.editingId ? 'update' : 'add',
          data: {
            id: this.data.editingId,
            ...this.data.form
          }
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('保存成功', 'success')
        this.closeModal()
        this.getCraftsmanList()
      } else {
        util.showToast(res.result.message || '保存失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('保存手工艺人失败:', err)
      util.showToast('保存失败')
    }
  },

  // 删除手工艺人
  async deleteCraftsman(e) {
    const id = e.currentTarget.dataset.id
    const confirmed = await util.showConfirm('确认删除', '删除后该手工艺人将无法接单，确定要删除吗？')
    if (!confirmed) return

    util.showLoading('删除中...')
    try {
      const res = await wx.cloud.callFunction({
        name: 'craftsman',
        data: {
          action: 'delete',
          id
        }
      })

      util.hideLoading()
      if (res.result.code === 0) {
        util.showToast('删除成功', 'success')
        this.getCraftsmanList()
      } else {
        util.showToast(res.result.message || '删除失败')
      }
    } catch (err) {
      util.hideLoading()
      console.error('删除手工艺人失败:', err)
      util.showToast('删除失败')
    }
  },

  // 获取统计信息
  getCraftsmanStats(craftsman) {
    // 这里可以返回该手工艺人的接单统计
    return {
      totalOrders: craftsman.totalOrders || 0,
      completedOrders: craftsman.completedOrders || 0
    }
  }
})
