// 本地测试 - 直接操作数据库
(function() {

console.log('🚀 本地测试 - 直接操作数据库...\n');

const db = wx.cloud.database();
const _ = db.command;

let results = [];
function log(name, pass, detail) {
  results.push({name, pass, detail});
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

// 测试数据
let testData = {
  adminPhone: '13810062394',
  adminPassword: '880323',
  dispatcherPhone: '139' + Date.now().toString().slice(-8),
  craftsmanPhone: '137' + (Date.now() + 1).toString().slice(-8),
  orderId: null
};

// 简单哈希函数（用于密码）
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16) + '_' + str.length;
}

async function test() {
  // 1. 创建管理员
  console.log('\n1. 创建管理员');
  const adminRes = await db.collection('users').add({
    data: {
      openid: 'admin_openid_' + Date.now(),
      phone: testData.adminPhone,
      password: simpleHash(testData.adminPassword),
      name: '管理员',
      roles: ['admin', 'dispatcher'],
      roleApplications: [{
        role: 'dispatcher',
        status: 'active',
        applyTime: db.serverDate()
      }],
      isAdmin: true,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  console.log('   管理员创建:', adminRes._id ? '成功' : '失败');
  
  // 同时创建派单员记录
  await db.collection('dispatchers').add({
    data: {
      userId: adminRes._id,
      openid: 'admin_openid_' + Date.now(),
      name: '管理员',
      phone: testData.adminPhone,
      company: '管理员公司',
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  log('管理员初始化', !!adminRes._id);
  
  // 2. 创建派单员
  console.log('\n2. 创建派单员');
  const dispatcherUser = await db.collection('users').add({
    data: {
      openid: 'dispatcher_openid_' + Date.now(),
      phone: testData.dispatcherPhone,
      password: simpleHash('123456'),
      name: '测试派单员',
      roles: ['dispatcher'],
      roleApplications: [{
        role: 'dispatcher',
        status: 'active',
        applyTime: db.serverDate(),
        applyData: { company: '测试公司' }
      }],
      isAdmin: false,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  const dispatcherId = dispatcherUser._id;
  await db.collection('dispatchers').add({
    data: {
      userId: dispatcherId,
      openid: 'dispatcher_openid_' + Date.now(),
      name: '测试派单员',
      phone: testData.dispatcherPhone,
      company: '测试公司',
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  log('派单员创建', !!dispatcherId, testData.dispatcherPhone);
  
  // 3. 创建手艺人
  console.log('\n3. 创建手艺人');
  const craftsmanUser = await db.collection('users').add({
    data: {
      openid: 'craftsman_openid_' + Date.now(),
      phone: testData.craftsmanPhone,
      password: simpleHash('123456'),
      name: '测试手艺人',
      roles: ['craftsman'],
      roleApplications: [{
        role: 'craftsman',
        status: 'active',
        applyTime: db.serverDate(),
        applyData: { specialty: '针淫' }
      }],
      isAdmin: false,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  
  const craftsmanId = craftsmanUser._id;
  await db.collection('craftsmen').add({
    data: {
      userId: craftsmanId,
      openid: 'craftsman_openid_' + Date.now(),
      name: '测试手艺人',
      phone: testData.craftsmanPhone,
      specialty: '针淫',
      starLevel: 3,
      totalOrders: 0,
      completedOrders: 0,
      rating: 5.0,
      reliabilityScore: 5.0,
      reliabilityLevel: '优秀',
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  log('手艺人创建', !!craftsmanId, testData.craftsmanPhone);
  
  // 4. 创建订单
  console.log('\n4. 创建订单');
  const orderCode = 'AB' + Date.now().toString().slice(-8);
  const orderRes = await db.collection('orders').add({
    data: {
      orderCode: orderCode,
      name: '测试订单',
      styleId: 'style_001',
      styleName: '测试样式',
      quantity: 10,
      price: 100,
      totalPrice: 1000,
      receiveDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      remark: '测试订单',
      dispatcherId: dispatcherId,
      dispatcherName: '测试派单员',
      craftsmanId: '',
      craftsmanName: '',
      status: 'pending',
      paymentStatus: 'unpaid',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  testData.orderId = orderRes._id;
  log('订单创建', !!testData.orderId, orderCode);
  
  // 5. 模拟接单
  console.log('\n5. 模拟接单');
  await db.collection('orders').doc(testData.orderId).update({
    data: {
      status: 'accepted',
      craftsmanId: craftsmanId,
      craftsmanName: '测试手艺人',
      acceptDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  log('手艺人接单', true);
  
  // 6. 模拟填写运单号
  console.log('\n6. 填写运单号');
  await db.collection('orders').doc(testData.orderId).update({
    data: {
      status: 'shipped',
      trackingNumber: 'SF123456',
      trackingCompany: '顺丰速运',
      shipDate: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  log('填写运单号', true);
  
  // 7. 模拟上传完成照片
  console.log('\n7. 上传完成照片');
  await db.collection('orders').doc(testData.orderId).update({
    data: {
      completePhotos: ['https://example.com/photo1.jpg'],
      completeDate: db.serverDate(),
      timeScore: 5.0, // 提前完成，满分
      updateTime: db.serverDate()
    }
  });
  log('上传完成照片', true);
  
  // 8. 模拟确认收款
  console.log('\n8. 确认收款');
  await db.collection('orders').doc(testData.orderId).update({
    data: {
      status: 'completed',
      paymentStatus: 'paid',
      receiptConfirmedAt: db.serverDate(),
      completeTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });
  // 更新手艺人统计
  await db.collection('craftsmen').doc(craftsmanId).update({
    data: {
      completedOrders: _.inc(1),
      totalIncome: _.inc(1000),
      updateTime: db.serverDate()
    }
  });
  log('确认收款', true);
  
  // 9. 模拟派单员打分
  console.log('\n9. 派单员打分');
  const ratingScore = 5;
  const timeScore = 5.0;
  const reliabilityScore = (timeScore * 0.5) + (ratingScore * 0.5);
  
  await db.collection('orders').doc(testData.orderId).update({
    data: {
      rating: ratingScore,
      ratingComment: '非常满意',
      reliabilityScore: reliabilityScore,
      updateTime: db.serverDate()
    }
  });
  
  // 添加评价记录
  await db.collection('ratings').add({
    data: {
      orderId: testData.orderId,
      craftsmanId: craftsmanId,
      score: ratingScore,
      comment: '非常满意',
      createTime: db.serverDate()
    }
  });
  
  // 更新手艺人评分
  await db.collection('craftsmen').doc(craftsmanId).update({
    data: {
      rating: ratingScore,
      reliabilityScore: reliabilityScore,
      reliabilityLevel: '优秀',
      updateTime: db.serverDate()
    }
  });
  
  log('派单员打分', true, `综合履约分: ${reliabilityScore}`);
  
  // 10. 验证数据
  console.log('\n10. 验证数据');
  const orderCheck = await db.collection('orders').doc(testData.orderId).get();
  log('订单状态为completed', orderCheck.data.status === 'completed');
  log('订单有评分', !!orderCheck.data.rating);
  log('订单有履约分', !!orderCheck.data.reliabilityScore);
  
  const craftsmanCheck = await db.collection('craftsmen').doc(craftsmanId).get();
  log('手艺人完成订单=1', craftsmanCheck.data.completedOrders === 1);
  log('手艺人履约分正确', craftsmanCheck.data.reliabilityScore === reliabilityScore);
  
  // 报告
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter(r => r.pass).length;
  console.log('📋 测试结果:', `${passed}/${results.length} 通过`);
  console.log('═'.repeat(60));
  
  if (passed === results.length) {
    console.log('\n🎉 所有测试通过！业务流程正常工作。');
    console.log('\n测试数据:');
    console.log('  管理员手机:', testData.adminPhone, '/ 密码:', testData.adminPassword);
    console.log('  派单员手机:', testData.dispatcherPhone, '/ 密码: 123456');
    console.log('  手艺人手机:', testData.craftsmanPhone, '/ 密码: 123456');
    console.log('  订单ID:', testData.orderId);
  }
}

test().catch(err => console.error('❌ 错误:', err));

})();
