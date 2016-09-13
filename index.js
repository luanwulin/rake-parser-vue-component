'use strict';

var parse5 = require('parse5');
var validateTemplate = require('vue-template-validator');
var deindent = require('de-indent');
var objectAssign = require('object-assign');

var vueComponentNum = 0;

function getAttribute(node, name) {
    if (node.attrs) {
        var i = node.attrs.length;
        var attr;
        while (i--) {
            attr = node.attrs[i];
            if (attr.name === name) {
                return attr.value;
            }
        }
    }
}

function isArray(o) {
    return Object.prototype.toString.call(o) === "[object Array]";
}

function isObject(o) {
    return Object.prototype.toString.call(o) === "[object Object]";
}
// exports
module.exports = function(content, file, conf) {
    file.isMod = true;

    var scriptStr = '';
    var templateFileName, templateFile, templateContent;
    var fragment, output, configs, vuecId, jsLang;

    // configs
    configs = objectAssign({
        cssScopedFlag: 'vuec'
    }, conf);

    // 兼容content为buffer的情况
    content = content.toString();

    // scope replace
    vueComponentNum++;
    vuecId = 'vue-component-' + vueComponentNum;
    content = content.replace(new RegExp(configs.cssScopedFlag, 'g'), vuecId);

    // parse
    fragment = parse5.parseFragment(content.toString(), {
        locationInfo: true
    });

    output = {
        template: [],
        style: [],
        script: []
    };

    fragment.childNodes.forEach(function(node) {
        var type = node.tagName;
        var lang = getAttribute(node, 'lang');
        var src = getAttribute(node, 'src');
        var warnings = null;
        var content;

        if (!output[type]) return;

        if (type == 'style' && (!node.childNodes || !node.childNodes.length)) {
            return;
        }

        if (!lang) {
            if (type == 'script') lang = 'js';
            if (type == 'style') lang = 'css';
            if (type == 'template') lang = 'html';
        }

        if (type == 'template') {
            content = parse5.serialize(node.content);
        } else {
            content = parse5.serialize(node);
        }

        content = deindent(content);
        content = content.replace(/(^[\r\n]*)|([\r\n]*$)/g, '');

        // node count check
        if ((type === 'script' || type === 'template') && output[type].length > 0) {
            throw new Error(
                '[fis3-parser-vue-component] Only one <script> or <template> tag is ' +
                'allowed inside a Vue component.'
            )
        } else {
            output[type].push({
                content: content,
                lang: lang
            });
        }
    });

    // script
    if (output['script'].length) {
        scriptStr = output['script'][0].content;
        jsLang = output['script'][0].lang;

        switch (jsLang.toLowerCase()) {
            case "es6":
                var es6FileName = file.dirname + "/" + file.filename + '-vue-es6.es6';

                //新建一个对应拓展名的文件，写入内容
                fis.util.write(es6FileName, scriptStr, 'utf-8');

                var es6File = fis.file.wrap(es6FileName);

                //用 fis 来 compile
                es6File.cache = file.cache;
                es6File.isJsLike = true;
                es6File.isMod = false;
                es6File.release = false;
                es6File.useMap = false;

                fis.compile(es6File);

                scriptStr = es6File.getContent();
                fis.util.del(es6FileName);
                break;
            default:
                break;
        }
    } else {
        scriptStr += 'module.exports = {}';
        jsLang = 'js';
    }

    // template
    if (output['template'].length) {
        validateTemplate(output['template'][0].content).forEach(function(msg) {
            console.log(msg)
        });

        scriptStr += '\nvar _vueTemplateString = ' + JSON.stringify(output['template'][0].content) + ';\n';
        scriptStr += '\nmodule && module.exports && (module.exports.template = _vueTemplateString);\n';
        scriptStr += '\nexports && exports.default && (exports.default.template = _vueTemplateString);\n';
    } else {
        scriptStr += '\nmodule && module.exports && (module.exports.template = "");\n';
        scriptStr += '\nexports && exports.default && (exports.default.template = "");\n';
    }

    // style
    output['style'].forEach(function(item, index) {
        if (item.content) {
            var styleFileName = file.dirname + "/" + file.filename + '-vue-style-' + index + "." + item.lang;

            //新建一个对应拓展名的文件，写入内容
            fis.util.write(styleFileName, item.content, 'utf-8');

            var styleFile = fis.file.wrap(styleFileName);
            var styleContent;

            //用 fis 来 compile
            styleFile.cache = file.cache;
            styleFile.isCssLike = true;
            styleFile.useMap = true;
            styleFile.isMod = true;
            fis.compile(styleFile);

            //生成 seajs-config 与该项目的 seajs-config 合并
            var seajs_config = fis.file(fis.project.getProjectPath(), 'static', 'seajs-config.js');

            var originalContent = '';
            var conf = {
                'map': [],
                'pkg': []
            };

            var release = fis.compile.settings.domain ? styleFile.getUrl(fis.compile.settings.hash,  fis.compile.settings.domain) : styleFile.release.substring(1);

            if (seajs_config.exists()) {
                //如果该文件存在
                originalContent = seajs_config.getContent();

                originalContent = originalContent.replace(/([\r\n\t])/g, '');

                //主要是为了处理本地测试环境与本地推送本地时候，仍然是同一个 seajs-config 不清除会造成多余数据问题
                if(fis.compile.settings.domain && originalContent.indexOf(fis.config.get('roadmap').domain) < 0){
                    originalContent = '';
                }else if(!fis.compile.settings.domain && originalContent.indexOf(fis.config.get('roadmap').domain) > 0){
                    originalContent = '';
                }

                //已经有了的依赖就不要重复添加
                if (originalContent.indexOf(styleFile.id) < 0) {
                    let mapJson = originalContent.match(/(\{.*\})/g);
                    mapJson = mapJson ? JSON.parse(mapJson[0]) : mapJson;

                    conf.map = isObject(mapJson) && mapJson.hasOwnProperty("map") && isArray(mapJson.map) ? mapJson.map : conf.map;
                    conf.map.push([styleFile.getId(), release]);

                    fis.util.write(seajs_config.origin, 'seajs.config(' + JSON.stringify(conf, null, fis.compile.optimize ? null : 4) + ');', 'utf-8');
                }
            } else {
                //不存在就生成一个
                conf.map.push([styleFile.getId(), release]);

                fis.util.write(seajs_config.origin, 'seajs.config(' + JSON.stringify(conf, null, fis.compile.optimize ? null : 4) + ');', 'utf-8')
            }

            //最后将style 文件依赖添加进去,删除生成的 style 文件
            file.addRequire(styleFile.getId());
            fis.util.del(styleFileName);
        }
    });

    return scriptStr;
};
