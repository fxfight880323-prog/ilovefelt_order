// 格式化日期
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

// 格式化金额
const formatMoney = (amount) => {
  if (amount === undefined || amount === null) return '¥0.00'
  return '¥' + parseFloat(amount).toFixed(2)
}

// 显示提示
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 2000
  })
}

// 显示加载
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

// 隐藏加载
const hideLoading = () => {
  wx.hideLoading()
}

// 确认对话框
const showConfirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

// 获取用户openid
const getOpenid = async () => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'craftsman',
      data: { action: 'getOpenid' }
    })
    return res.result.openid
  } catch (err) {
    console.error('获取openid失败:', err)
    return null
  }
}

// 检查是否是管理员
const checkAdmin = async () => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'craftsman',
      data: { action: 'checkAdmin' }
    })
    return res.result.isAdmin
  } catch (err) {
    console.error('检查管理员失败:', err)
    return false
  }
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 验证手机号
const isValidPhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 防抖函数
const debounce = (fn, delay = 500) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 节流函数
const throttle = (fn, interval = 500) => {
  let lastTime = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

// 订阅消息
const requestSubscribeMessage = async (tmplIds) => {
  // 过滤空的模板ID
  const validTmplIds = tmplIds.filter(id => id && id.trim() !== '')
  
  if (validTmplIds.length === 0) {
    console.log('订阅消息模板ID未配置，跳过订阅')
    return null
  }
  
  try {
    const res = await wx.requestSubscribeMessage({
      tmplIds: validTmplIds
    })
    return res
  } catch (err) {
    // 用户取消或模板ID错误
    if (err.errCode === 20001) {
      console.warn('订阅消息模板ID无效，请检查模板ID是否正确配置')
      wx.showToast({
        title: '订阅功能暂未配置',
        icon: 'none'
      })
    } else {
      console.error('订阅消息失败:', err)
    }
    return null
  }
}

module.exports = {
  formatDate,
  formatMoney,
  showToast,
  showLoading,
  hideLoading,
  showConfirm,
  getOpenid,
  checkAdmin,
  generateId,
  isValidPhone,
  debounce,
  throttle,
  requestSubscribeMessage
}
