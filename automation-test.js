/**
 * 微信小程序自动化测试脚本
 * 在微信开发者工具控制台运行
 * 命令: await runTests()
 */

const TestRunner = {
  results: [],
  currentTest: null,
  assert(condition, message) {
    const status = condition ? '✓' : '✗';
    this.results.push({ status, message, test: this.currentTest });
    console.log(`  ${status} ${message}`);
    return condition;
  },
  suite(name, fn) {
    console.log(`\n[${name}]`);
    this.currentTest = name;
    return fn();
  },
  report() {
    console.log('\n' + '='.repeat(50));
    const passed = this.results.filter(r => r.status === '✓').length;
    const failed = this.results.filter(r => r.status === '✗').length;
    console.log(`测试完成: 共${this.results.length}项, 通过${passed}, 失败${failed}`);
    return { passed, failed };
  },
  cleanup() {
    wx.removeStorageSync('users');
    wx.removeStorageSync('currentUser');
    wx.removeStorageSync('userRole');
    console.log('清理完成');
  }
};

async function runTests() {
  console.log('🚀 开始测试...\n');
  TestRunner.cleanup();

  // 测试1: 注册
  let testPhone;
  await TestRunner.suite('注册流程测试', async () => {
    testPhone = '138' + Date.now().toString().slice(-8);
    const res = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'applyRole',
        data: {
          role: 'craftsman',
          applyData: { phone: testPhone, name: '测试', password: '123456', specialty: '针毯' }
        }
      }
    });
    TestRunner.assert(res.result.code === 0, '注册成功');
    TestRunner.assert(res.result.data.status === 'pending', '状态为pending');
  });

  // 测试2: 登录拦截
  await TestRunner.suite('登录拦截测试', async () => {
    const res = await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'loginByPhone', data: { phone: testPhone, password: '123456' } }
    });
    TestRunner.assert(res.result.code === -1002 || res.result.code === -1003, 'pending被拦截');
  });

  // 测试3: 管理员
  await TestRunner.suite('管理员测试', async () => {
    const init = await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'initAdmin', data: { phone: '13810062394', password: '880323' } }
    });
    TestRunner.assert(init.result.code === 0, '管理员初始化');
    
    const login = await wx.cloud.callFunction({
      name: 'user',
      data: { action: 'loginByPhone', data: { phone: '13810062394', password: '880323' } }
    });
    TestRunner.assert(login.result.code === 0, '管理员登录');
    TestRunner.assert(login.result.data.isAdmin, '身份验证');
  });

  return TestRunner.report();
}

// 快捷函数
window.runTests = runTests;
window.quickTest = async () => {
  const res = await wx.cloud.callFunction({
    name: 'user',
    data: { action: 'initAdmin', data: { phone: '13810062394', password: '880323' } }
  });
  console.log('管理员测试:', res.result.code === 0 ? '✓' : '✗');
};

console.log('脚本已加载: await runTests()');
