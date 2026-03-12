const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取微信小程序 access_token
// 注意：此云函数仅作为示例，实际发送订阅消息可以直接使用 cloud.openapi.subscribeMessage.send
// 云开发会自动处理 access_token，无需手动获取

exports.main = async (event, context) => {
  try {
    // 方式1：直接使用云开发封装的接口（推荐）
    // 发送订阅消息示例：
    // await cloud.openapi.subscribeMessage.send({...})
    
    // 方式2：如果需要手动调用其他微信接口，需要获取 access_token
    // 从环境变量读取 AppSecret（推荐做法）
    const APPID = 'wx19302c485b354857'
    const APPSECRET = process.env.APPSECRET
    
    if (!APPSECRET) {
      return {
        code: -1,
        message: '请在云函数环境变量中设置 APPSECRET'
      }
    }
    
    // 调用微信接口获取 access_token
    const axios = require('axios')
    const response = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
    )
    
    if (response.data.access_token) {
      return {
        code: 0,
        message: '获取成功',
        data: {
          access_token: response.data.access_token,
          expires_in: response.data.expires_in
        }
      }
    } else {
      return {
        code: -1,
        message: response.data.errmsg || '获取失败'
      }
    }
  } catch (err) {
    console.error('获取 access_token 失败:', err)
    return {
      code: -1,
      message: err.message
    }
  }
}
