'use strict';

var path = require('path');
var childProcess = require('child_process');
var util = require('util');

var async = require('async');
var logger = require('lets').logger;
var pkg = require('../package');

var MAX_BUFFER = 1024*1000;


module.exports = function (options, done) {
  var server = this;

  server.getConnection(function (c) {
    var remoteCommit = '';
    var localCommit = '';
    var localPath = options.localPath || '';
    var diff = {
      M: [],
      D: []
    };

    async.waterfall([
      // Get remote revision
      function (next) {
        var revisionPath = path.join(options.remotePath, options.revisionFile || '.REVISION');

        logger.debug(pkg.name, 'Fetching revisionFile', revisionPath);
        c.get(revisionPath, function (err, stream) {
          // Assume an error always is because there is no such file
          if(err || !stream) {
            logger.debug(pkg.name, 'No remote revision found');
            return next();
          }

          stream.on('data', function (data) {
            remoteCommit += data.toString();
          });

          stream.on('end', function () {
            logger.debug(pkg.name, 'Remote revision:', remoteCommit);
            next();
          });
        }); 
      },

      // Get current commit (even if checked out somewhere)
      exports.exec.bind(null, 'git rev-parse HEAD', { maxBuffer: MAX_BUFFER }),
      function (stdout, stderr, next) {
        localCommit = stdout.trim();
        next();
      },

      // Select files to put/delete
      function (next) {
        var lsTemplate = 'git ls-tree -r %s --name-only -- %s | sed "s/^/M       /"';
        var lsCommand = util.format(lsTemplate,
          localCommit,
          localPath
        );

        var diffTemplate = 'git diff --name-status %s %s -- %s';
        var diffCommand = util.format(diffTemplate,
          remoteCommit,
          localCommit,
          localPath
        );

        // If no remote revision
        if(!remoteCommit) {
          // Push everything
          logger.info(pkg.name, 'Uploading all tracked files');

          exports.exec(lsCommand, {
            maxBuffer: MAX_BUFFER
          }, next);
        }
        else {
          // Get changed files
          exports.exec(diffCommand, {
            maxBuffer: MAX_BUFFER
          }, next);
        }
      },

      // Filter out file names based on modification type
      function (stdout, stderr, next) {
        stdout.trim().split('\n').forEach(function (string) {
          var status = string[0];
          var file = string.slice(1).trim();

          if(!string) {
            return;
          }

          if(status === 'A' || status === 'M') {
            diff.M.push(file);
          }
          else if(status === 'D') {
            diff.D.push(file);
          }
          else {
            logger.warn(pkg.name, 'git diff status ' + status +
              'not recognized for ' + file);
          }
        });

        next();
      },

      // Put modified/created files
      function (next) {
        if(!diff.M.length) {
          logger.info(pkg.name, 'No modified files');
          return next();
        }

        logger.info(pkg.name, util.format('Uploading %s files. Use verbose mode to see which files'), diff.M.length);

        async.eachLimit(diff.M, options.eachLimit || 10, function (file, next) {
          var remote = path.join(options.remotePath, path.relative(localPath, file));
          var local = path.join(process.cwd(), file);

          logger.debug(pkg.name, 'Uploading ' + file);

          c.put(local, remote, function (err) {
            if(err) {
              // MKDIR recursively
              c.mkdir(path.join(remote, '..'), true, function () {
                c.put(local, remote, next);
              });
            }
            else {
              next();
            }
          });
        }, next);
      },

      // Delete deleted files
      function (next) {
        if(!diff.D.length) {
          logger.info(pkg.name, 'No deleted files');
          return next();
        }

        logger.info(pkg.name, util.format('Deleting %s files. Use verbose mode to see which files'), diff.D.length);

        async.eachLimit(diff.D, options.eachLimit || 10, function (file, next) {
          var remote = path.join(options.remotePath, path.relative(localPath, file));

          logger.debug(pkg.name, 'Deleting ' + remote);

          c.delete(remote, function (err) {
            if(err && +err.code === 550) {
              logger.warn(pkg.name, util.format('Failed to delete %s, file not found'), remote);
            }

            next();
          });
        }, next);
      },

      // Update remote revision
      function (next) {
        if(!diff.M.length && !diff.D.length) {
          return next();
        }

        logger.debug(pkg.name, 'Updating remote revision');
        c.put(new Buffer(localCommit), options.revisionFile || '.REVISION', next);
      }
    ], function (err) {
      if(err) {
        logger.error(pkg.name, err);
      }

      done(err);
    });
  });
};


/* Private helpers
============================================================================= */

/**
 * Helper to auto-debug local commands and output
 */
exports.exec = function (command, options, callback) {
  // Optional options
  if(!callback) {
    callback = options;
    options = {};
  }

  logger.debug(pkg.name, 'Executing locally:', command);

  childProcess.exec(command, options, function (err, stdout, stderr) {
    logger.debug(pkg.name, 'stdout:', stdout);
    logger.debug(pkg.name, 'stderr:', stderr);

    callback(err, stdout, stderr);
  });
};
