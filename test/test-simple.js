// 简化版测试 - 使用已有的管理员账号测试
(function() {

console.log('🚀 简化版测试...\n');

const ADMIN_PHONE = '13810062394';
const ADMIN_PASSWORD = '880323';

let results = [];
function log(name, pass, detail) {
  results.push({name, pass, detail});
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

async function test() {
  // 1. 管理员登录
  console.log('\n1. 管理员登录');
  const adminLogin = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD }
    }
  });
  log('管理员登录', adminLogin.result.code === 0, adminLogin.result.message);
  
  if (adminLogin.result.code !== 0) {
    console.log('❌ 管理员登录失败，测试中止');
    return;
  }
  
  const adminOpenid = adminLogin.result.data?.openid;
  log('获取openid', !!adminOpenid);
  
  // 2. 获取手艺人列表
  console.log('\n2. 管理员查看手艺人');
  const craftsmanList = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getCraftsmanList' }
  });
  log('手艺人列表', craftsmanList.result.code === 0, `${craftsmanList.result.data?.length || 0} 人`);
  
  // 3. 获取派单员列表
  console.log('\n3. 管理员查看派单员');
  const dispatcherList = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getDispatcherList' }
  });
  log('派单员列表', dispatcherList.result.code === 0, `${dispatcherList.result.data?.length || 0} 人`);
  
  // 4. 获取待审批列表
  console.log('\n4. 查看待审批');
  const pendingList = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getRoleApplications', data: { status: 'pending' } }
  });
  log('待审批列表', pendingList.result.code === 0, `${pendingList.result.data?.length || 0} 条`);
  
  // 5. 获取订单列表
  console.log('\n5. 查看订单');
  const orderList = await wx.cloud.callFunction({
    name: 'order',
    data: { action: 'getList', data: { page: 1, pageSize: 10 } }
  });
  log('订单列表', orderList.result.code === 0, `${orderList.result.data?.total || 0} 条`);
  
  // 6. 获取统计
  console.log('\n6. 管理员统计');
  const stats = await wx.cloud.callFunction({
    name: 'admin',
    data: { action: 'getStats' }
  });
  log('统计数据', stats.result.code === 0);
  if (stats.result.data) {
    console.log('   手艺人:', stats.result.data.craftsmanCount);
    console.log('   派单员:', stats.result.data.dispatcherCount);
    console.log('   待审批:', stats.result.data.pendingCount);
  }
  
  // 报告
  console.log('\n' + '═'.repeat(50));
  const passed = results.filter(r => r.pass).length;
  console.log(`测试结果: ${passed}/${results.length} 通过`);
  console.log('═'.repeat(50));
}

test().catch(err => console.error('错误:', err));

})();
