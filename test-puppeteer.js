const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('🧪 Testing Puppeteer Chrome Configuration...');

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Users/hiteksofftware/.cache/puppeteer/chrome/mac_arm-134.0.6998.35/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions'
      ]
    });

    console.log('✅ Puppeteer launched successfully!');

    const page = await browser.newPage();
    await page.setContent('<html><body><h1>Test PDF</h1><p>This is a test document.</p></body></html>');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });

    console.log(`✅ PDF generated successfully! Size: ${pdfBuffer.length} bytes`);

    await browser.close();
    console.log('🎉 Puppeteer test completed successfully!');

  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('1. Make sure Google Chrome is installed in /Applications/');
    console.log('2. Try running: npx puppeteer browsers install chrome');
    console.log('3. Check Chrome permissions in macOS Security settings');
  }
}

testPuppeteer();
