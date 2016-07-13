# rake-parser-vue-component
parser vue component for fisp

> [FISP](http://fis.baidu.com/) parser 阶段插件，用于在fisp rake-zbj中编译[Vue](http://vuejs.org.cn/)组件。

## 原理

参考[vue-loader](https://github.com/vuejs/vue-loader)源码，结合fisp的编译特性而编写,下面是parser阶段的主要过程：

1. 解析vue文件，找到其中的`style`,`template`,`script`标签。

2. 每一个`style`标签创建一个对应的文件，后缀为`lang`属性指定，默认`css`，你可以指定`less`或其它的后缀。创建的文件，一样会进行fisp的编译流程（属性`lang`的值决定该文件怎么编译），并加入到当前文件的依赖中，编译完成后删除该文件。

3. `template`标签的内容为Vue组件的模板，`template`标签同样有`lang`属性，默认`html`(暂时只支持`html`，`jade`等模板语言之后加入)，会进行html特性处理，模板的内容最终会输出到`module.exports.template`中。

4. `script`标签为文件最后输出的内容，支持`lang`属性,支持es6语法。

## 组件编写规范

`style`标签可以有多个，`template`和`script`标签只能有一个，具体请参考[vue 单文件组件](http://vuejs.org.cn/guide/application.html)。

## 注意

- 组件中的样式、模板、脚本都会先进行片段处理，会使用对应的`parser`进行编译处理。
- 每一个style标签会对应产出一个css文件，与vue组件同目录。
- script标签内容编译后，为组件的最终产出内容。

## 安装配置

安装：`npm install rake-parser-vue-component --save-dev`。

配置：
```javascript:;
fis.config.set('modules.parser.vue', 'vue-component');
fis.config.set('settings.parser.vue-component', {
    // 组件的配置
});
fis.config.set('roadmap.ext.vue', 'js'); 
```

## css scoped支持

> 为了保证每一个组件样式的独立性，是当前组件定义的样式只在当前的组件内生效，引入css scoped机制。

1. 在模板的元素上（一般是根节点）加上scoped标志，默认为'vuec'， 你可以通过`cssScopedFlag`自定义。可以加在class，或者属性，或者id。
```html
<template>
  <div class="test" vuec></div>
</template>
```
2. 在样式中使用scoped标志。
```css
.test[vuec] {
  //
}
```
3. scoped标志会解析为组件唯一id：`vue-component-{index}`;

4. 配置：scoped标志默认为'vuec'，你可以自定义。
```js
fis.config.set('settings.parser.vue-component', {  
	cssScopedFlag: 'myCssScopedFlag'  
});
```

## 测试demo

`npm install`

`cd test`, 编写代码…

`npm install`

`rk release`

`rk server start`
