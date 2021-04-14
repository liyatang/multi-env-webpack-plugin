const path = require('path');
const fs = require('fs');

// 核心场景是该 路由文件，所以优先 tsx jsx
const defaultExtArr = ['.tsx', '.jsx', '.ts', '.js'];

function resolveEnvFilePath (p, env, extArr = defaultExtArr) {
  for (let i = 0; i < extArr.length; i++) {
    const item = extArr[i];

    if (fs.existsSync(`${p}.${env}${item}`)) {
      return `${p}.${env}${item}`;
    }
  }
}

/**
 * MultiEnvWebpackPlugin
 *
 * @param {string} [source='described-resolve'] source resolver hook 类别。
 * @param {string} [target='resolve'] 解析完成后需要触发的钩子。
 * @param {Object} options 插件配置项。
 * @param {string} options.env 环境，默认 local。
 * @param {string[]} options.include 默认忽略 node_modules，如果需要提供 include ，比如 ['@ones-ai']。
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
  }

  apply (resolver) {
    const target = resolver.ensureHook(this.target);
    resolver
      .getHook(this.source)
      .tapAsync('MultiEnvWebpackPlugin', (request, resolveContext, callback) => {
        const innerRequest = request.request || request.path;

        // 使用 require.context 的时候 request.directory 为 true
        if (!innerRequest || request.directory) {
          return callback();
        }

        // 有后缀的忽略，算精准 import 了
        if (path.extname(innerRequest)) {
          return callback();
        }

        let srcRequest;

        if (path.isAbsolute(innerRequest)) {
          // absolute path
          srcRequest = innerRequest;
        } else if (!path.isAbsolute(innerRequest) && /^\./.test(innerRequest)) {
          // relative path
          srcRequest = path.resolve(request.path, request.request);
        } else {
          return callback();
        }

        if (/node_modules/.test(srcRequest) && !this.includes(srcRequest)) {
          return callback();
        }


        const newRequestStr = resolveEnvFilePath(srcRequest, this.options.env);
        if (!newRequestStr) {
          return callback();
        }

        console.log('MultiEnvWebpackPlugin', srcRequest, newRequestStr)

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

  includes (filePath) {
    if (!this.options.include || !this.options.include.length) {
      return false;
    }

    filePath = filePath.replace(path.sep, '/');
    const res = this.options.include.find((item) => filePath.includes(item));

    return !!res;
  }
}

module.exports = MultiEnvWebpackPlugin;
