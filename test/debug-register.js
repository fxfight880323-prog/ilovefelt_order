// 注册流程诊断测试
(function() {

console.log('🔧 开始注册流程诊断...\n');

const testPhone = '139' + Date.now().toString().slice(-8);
console.log('测试手机号:', testPhone);

// 步骤1: 注册
wx.cloud.callFunction({
  name: 'user',
  data: {
    action: 'applyRole',
    data: {
      role: 'dispatcher',
      applyData: {
        phone: testPhone,
        name: '测试派单员',
        password: '123456',
        company: '测试公司'
      }
    }
  }
}).then(registerRes => {
  console.log('\n✅ 注册返回:', JSON.stringify(registerRes.result));
  
  // 等待一下
  return new Promise(resolve => setTimeout(() => resolve(registerRes), 500));
}).then(registerRes => {
  // 步骤2: 查询users表
  return wx.cloud.database().collection('users').where({ phone: testPhone }).get();
}).then(userRes => {
  console.log('\n✅ 查询users表:', userRes.data.length, '条记录');
  
  if (userRes.data.length > 0) {
    console.log('   用户信息:', {
      _id: userRes.data[0]._id,
      phone: userRes.data[0].phone,
      roles: userRes.data[0].roles,
      roleApplications: userRes.data[0].roleApplications
    });
  } else {
    console.log('   ⚠️ 未找到用户，注册可能失败！');
    
    // 尝试查询所有users
    return wx.cloud.database().collection('users').get().then(allUsers => {
      console.log('\n   所有用户数量:', allUsers.data.length);
      console.log('   最近注册的用户:', allUsers.data.slice(-3).map(u => ({phone: u.phone, roles: u.roles})));
    });
  }
}).catch(err => {
  console.error('❌ 错误:', err);
});

})();
