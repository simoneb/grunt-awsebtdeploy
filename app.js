require('http').createServer(function(req, res) {
  res.end(require('./package.json').version);
}).listen(process.env.PORT || 3000);
