const YeahPayService = require('./services/yeahpay.service');

async function testRealTerminal() {
  const yeahpay = new YeahPayService();
  const deviceSn = 'P30224BSJ0633';
  const salt = 'HPIZLZA1SY2NTFHAUQ9HRSRJTWDULPUJ';
  const appId = 'bin38m42efz4ta6f';

  console.log('Sending probe with REAL terminal credentials:');
  console.log({ deviceSn, appId, salt: salt ? 'YES' : 'NO' });

  try {
    const res = await yeahpay.processPayNowPayment({
      amount: 0.01,
      deviceSn,
      salt,
      appId
    });
    console.log('PayNow Response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testRealTerminal();
