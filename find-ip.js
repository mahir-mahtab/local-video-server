const os = require('os');

const nets = os.networkInterfaces();
const ips = [];

for (const name of Object.keys(nets)) {
  for (const net of nets[name] || []) {
    if (net.family === 'IPv4' && !net.internal) {
      ips.push({ name, address: net.address });
    }
  }
}

if (ips.length === 0) {
  console.log('No LAN IPv4 address found.');
  process.exit(0);
}

console.log('Use one of these URLs on your phone:');
for (const ip of ips) {
  console.log(`- http://${ip.address}:8000  (${ip.name})`);
}
