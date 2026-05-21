const http = require('http');

function checkServer() {
  console.log('Pinging http://localhost:3000/api/notifications...');
  const req = http.get('http://localhost:3000/api/notifications', (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Response Status:', res.statusCode);
      console.log('Response Headers:', res.headers);
      try {
        const json = JSON.parse(data);
        console.log('Response Data (Parsed):', JSON.stringify(json, null, 2));
        if (res.statusCode === 200) {
          console.log('✅ Next.js API route is working perfectly!');
        } else {
          console.log('❌ Next.js API route returned an error:', json.error);
        }
      } catch (e) {
        console.log('Raw Response Data:', data);
        console.log('❌ Failed to parse JSON response:', e.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Connection failed:', err.message);
  });
}

// Wait 3 seconds for Next.js to compile/be ready, then test
setTimeout(checkServer, 3000);
