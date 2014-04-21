'use strict';

var exec = require('child_process').exec;
var logger = require('lets').logger;
var pkg = require('../package');

var requiredFields = [
  'host',
  'remotePath',
  'username',
  'password'
];

module.exports = function (options, next) {
  var err;

  // Make sure required options are set or abort
  requiredFields.forEach(function (field) {
    if(!options[field]) {
      err = field + ' field required';
      logger.error(pkg.name, err);
    }
  });

  if(err) {
    return next(new Error(pkg.name + ' missing fields required'));
  }

  // Ensure git is initialized
  //## Support other vcs in the future
  exec('git status', function (err, stdout, stderr) {
    if(err) {
      logger.error(pkg.name, 'Currently lets-ftp requires an initialized git repository');
      logger.error(pkg.name, err);
      logger.debug(pkg.name, 'stdout:', stdout);
      logger.debug(pkg.name, 'stderr:', stderr);

      return next(err);
    }

    next();
  });
};
