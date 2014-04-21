'use strict';

var lets = require('lets');
var ftp = require('lets-ftp');


module.exports = lets.plugin(function (stage, options) {
  // Use ftp connection
  stage.plugin(ftp(options));

  stage.on('first', require('./first'));
  stage.on('deploy:update', require('./update'));
});
