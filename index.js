const path = require('path');
const fs = require('fs');

const readDirWithLocal = (dir, env, files = [], localFiles = []) => {
  const envStr = `.${env}.`
  const dirInfo = fs.readdirSync(dir);

  dirInfo.forEach(item => {
    const file = path.join(dir, item);
    const info = fs.statSync(file);
    if (info.isDirectory()) {
      readDirWithLocal(file, env, files, localFiles);
    } else {
      if (file.includes(envStr)) {
        localFiles.push(file);
        files.push(file.replace(envStr, ''))
      }
    }
  });

  return { files, localFiles };
};

const appPath = fs.realpathSync(process.cwd());

/**
 * MultiEnvWebpackPlugin
 *
 * @param {string} [source='described-resolve'] source resolver hook 类别。
 * @param {string} [target='resolve'] 解析完成后需要触发的钩子。
 * @param {Object} options 插件配置项。
 * @param {string} options.env 环境，默认 local。
 */
class MultiEnvWebpackPlugin {
  constructor (source = 'described-resolve', target = 'resolve', options) {
    this.source = source;
    this.target = target;
    this.options = Object.assign(
      {
        env: 'local',
      },
      options,
    );

    // 提前扫描好 .env. 文件，提高性能
    const { files, localFiles } = readDirWithLocal(path.resolve(appPath, './src'), this.options.env)

    this.files = files
    this.localFiles = localFiles

    if(this.localFiles.length){
      console.log('MultiEnvWebpackPlugin: find env file', this.localFiles)
    }
  }

  apply (resolver) {
    const target = resolver.ensureHook(this.target);
    resolver
      .getHook(this.source)
      .tapAsync('MultiEnvWebpackPlugin', (request, resolveContext, callback) => {
        const innerRequest = request.request || request.path;

        // 忽略 node_moduels
        if (request.path.includes('node_modules')) {
          return callback();
        }

        // 啥来的
        if (request.request[0] !== '.') {
          return callback();
        }

        let srcRequest = path.resolve(request.path, request.request);

        const index = this.files.indexOf(srcRequest)
        if(index === -1){
          return callback()
        }

        const newRequestStr = this.localFiles[index]
        console.log('MultiEnvWebpackPlugin:', newRequestStr);

        const obj = Object.assign({}, request, {
          request: newRequestStr,
        });

        return resolver.doResolve(
          target,
          obj,
          'resolve env file path',
          resolveContext,
          (err, result) => {
            if (err) {
              return callback(err);
            }

            if (result === undefined) {
              return callback(null, null);
            }

            return callback(null, result);
          },
        );
      });
  }
}

module.exports = MultiEnvWebpackPlugin;
