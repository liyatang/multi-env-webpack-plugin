const path = require('path')
const fs = require('fs')

function resolveEnvFilePath(p, env, extArr = ['.js', '.jsx', '.ts', '.tsx']) {
  const realPath = p

  for (let i = 0; i < extArr.length; i++) {
    const item = extArr[i]

    const pathArr = [`${p}.${env}${item}`, `${p}.${item}`]

    for (let j = 0; j < pathArr.length; j++) {
      const jItem = pathArr[j]
      if (fs.existsSync(jItem)) {
        return jItem
      }
    }
  }

  return realPath
}

/**
 * MultiEnvWebpackPlugin 根据环境解析不同的文件。基于 enhance-resolve。
 * 比如 src/index.js 解析 src/index.local.js
 *
 * @param {string} [source='described-resolve'] source resolver hook 类别。
 * @param {string} [target='resolve'] 解析完成后需要触发的钩子
 * @param {object} options 插件配置项
 */
class MultiEnvWebpackPlugin {
  constructor(source = 'described-resolve', target = 'resolve', options) {
    this.source = source
    this.target = target
    this.options = Object.assign(
      {
        env: 'local',
      },
      options,
    )
  }

  apply(resolver) {
    const target = resolver.ensureHook(this.target)
    resolver
      .getHook(this.source)
      .tapAsync('MultiEnvWebpackPlugin', (request, resolveContext, callback) => {
        const innerRequest = request.request || request.path

        // 使用 require.context 的时候 request.directory 为 true
        if (!innerRequest || request.directory) {
          return callback()
        }

        // 有后缀
        if (path.extname(innerRequest)) {
          return callback()
        }

        let srcRequest

        if (path.isAbsolute(innerRequest)) {
          // absolute path
          srcRequest = innerRequest
        } else if (!path.isAbsolute(innerRequest) && /^\./.test(innerRequest)) {
          // relative path
          srcRequest = path.resolve(request.path, request.request)
        } else {
          return callback()
        }

        if (/node_modules/.test(srcRequest) && !this.includes(srcRequest)) {
          return callback()
        }

        const newRequestStr = resolveEnvFilePath(srcRequest, this.options.env)
        if (newRequestStr === innerRequest) {
          return callback()
        }

        const obj = Object.assign({}, request, {
          request: newRequestStr,
        })

        return resolver.doResolve(
          target,
          obj,
          'resolve env file path',
          resolveContext,
          (err, result) => {
            if (err) {
              return callback(err)
            }

            if (result === undefined) {
              return callback(null, null)
            }

            return callback(null, result)
          },
        )
      })
  }

  includes(filePath) {
    if (!this.options.include || !this.options.include.length) {
      return false
    }

    filePath = filePath.replace(path.sep, '/')
    const res = this.options.include.find((item) => filePath.includes(item))

    return Boolean(res)
  }
}

module.exports = MultiEnvWebpackPlugin
