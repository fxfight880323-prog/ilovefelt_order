/**
 * 快速测试脚本 - 可直接粘贴到控制台运行
 */

console.log('🧪 快速测试开始...\n');

// 测试1: 管理员账号
async function test1() {
  console.log('1. 初始化管理员...');
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'initAdmin',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  console.log('   结果:', res.result.code === 0 ? '✓' : '✗', res.result.message);
  return res.result.code === 0;
}

// 测试2: 管理员登录
async function test2() {
  console.log('2. 管理员登录...');
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone: '13810062394', password: '880323' }
    }
  });
  console.log('   结果:', res.result.code === 0 ? '✓' : '✗');
  if (res.result.code === 0) {
    console.log('   角色:', res.result.data.roles);
    console.log('   管理员:', res.result.data.isAdmin);
  }
  return res.result.code === 0;
}

// 测试3: 注册新用户
async function test3() {
  console.log('3. 注册新用户...');
  const phone = '138' + Date.now().toString().slice(-8);
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'applyRole',
      data: {
        role: 'craftsman',
        applyData: { phone, name: '测试', password: '123456', specialty: '针毯' }
      }
    }
  });
  console.log('   结果:', res.result.code === 0 ? '✓' : '✗');
  console.log('   状态:', res.result.data?.status);
  return { success: res.result.code === 0, phone };
}

// 测试4: pending登录拦截
async function test4(phone) {
  console.log('4. 测试pending登录拦截...');
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: {
      action: 'loginByPhone',
      data: { phone, password: '123456' }
    }
  });
  console.log('   结果:', res.result.code !== 0 ? '✓ 被拦截' : '✗ 未拦截');
  console.log('   错误码:', res.result.code);
  return res.result.code !== 0;
}

// 运行所有测试
async function run() {
  const r1 = await test1();
  const r2 = await test2();
  const r3 = await test3();
  const r4 = await test3.phone ? await test4(r3.phone) : false;
  
  console.log('\n' + '='.repeat(30));
  console.log('测试完成!');
  console.log('通过:', [r1, r2, r3.success, r4].filter(Boolean).length, '/ 4');
}

run();
