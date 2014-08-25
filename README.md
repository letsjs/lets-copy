# lets-copy

Deploy files by copying/syncing them to a remote over SFTP or FTP.


## Current status

This project is in early testing phase. Do not rely on it for production/
critical stuff.


## Basic example

```javascript
// Letsfile.js
var letsCopy = require('lets-copy');

module.exports = function (lets) {
  var stage = lets.Stage({
    host: '1.2.3.4',
    username: 'root',
    password: '****',
    remotePath: '/var/www', // Where your files shall be located
    localPath: 'src', // Optional. Which folder relative to the current folder, to sync
    revisionFile: '.REVISION' // Optional. Name of the file storing the last synced commit
  });

  stage.plugin(letsCopy());

  lets.addStage('sitename', stage);
};
```

```bash
$ lets deploy sitename
```
