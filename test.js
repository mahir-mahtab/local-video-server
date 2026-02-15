const screenshot = require('screenshot-desktop');
const frame = screenshot({
     format: 'png'
     
}).then((frame) => {
console.log(frame);
});
