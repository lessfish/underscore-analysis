# Why underscore

最近开始看 underscore源码，并将 [underscore源码解读](https://github.com/hanzichi/underscore-analysis) 放在了我的 [2016计划](http://www.cnblogs.com/zichi/p/5107820.html) 中。

阅读一些著名框架类库的源码，就好像和一个个大师对话，你会学到很多。为什么是 underscore？最主要的原因是 underscore 简短精悍（约 1.5k 行），封装了 100 多个有用的方法，耦合度低，非常适合逐个方法阅读，适合楼主这样的 JavaScript 初学者。从中，你不仅可以学到用 void 0 代替 undefined 避免 undefined 被重写等一些小技巧 ，也可以学到变量类型判断、函数节流&函数去抖等常用的方法，还可以学到很多浏览器兼容的 hack，更可以学到作者的整体设计思路以及 API 设计的原理（向后兼容）。

之后楼主会写一系列的文章跟大家分享在源码阅读中学习到的知识。

- underscore-1.8.3 源码全文注释 <https://github.com/hanzichi/underscore-analysis/blob/master/underscore-1.8.3-analysis.js>
- underscore-1.8.3 源码解读项目地址 <https://github.com/hanzichi/underscore-analysis>


欢迎围观~ （**如果有兴趣，欢迎 star & watch~**）您的关注是楼主继续写作的动力


# Why does void 0 replace undefined

说来惭愧，underscore 源码解读这个 Repo 放在 Github 都已经 20 天没有更新了，要不是今天 "不小心" 注意到，我居然都快忘了（是不是 lu 多了），所以今晚无论如何都要 lu 出第一篇（毕竟万事开头难）。相对于其他源码解读的文章，基本都会从整体设计开始讲起，楼主觉得 underscore 这个库有点特殊，so 决定按照自己的思路，从用 void 0 代替 undefined 说起。

underscore 源码没有出现 undefined（注意，其实有出现一处，是为 "undefined"，而不是 undefined），而用 void 0 代替之。为什么要这么做？我们可以从两部分解读，其一是 undefined 哪里不好了，你非得找个替代品？其二就是替代品为毛要找 void 0？

我们先看第一点，答案很简单，undefined 并不是保留词（reserved word），它只是全局对象的一个属性，在低版本 IE 中能被重写。

```javascript
var undefined = 10;

// undefined -- chrome
// 10 -- IE 8
alert(undefined);
```

事实上，undefined 在 ES5 中已经是全局对象的一个只读（read-only）属性了，它不能被重写。但是在局部作用域中，还是可以被重写的。

```javascript
(function() {
  var undefined = 10;

  // 10 -- chrome
  alert(undefined);
})();

(function() {
  undefined = 10;

  // undefined -- chrome
  alert(undefined);
})();
```

接下来思考第二个问题，为毛找的替代品是 void 0？

我们来看看 [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/void) 的解释：

> The void operator evaluates the given expression and then returns undefined.

意思是说 void 运算符能对给定的表达式进行求值，然后返回 undefined。也就是说，void 后面你随便跟上一个表达式，返回的都是 undefined，都能完美代替 undefined！那么，这其中最短的是什么呢？毫无疑问就是 void 0 了。其实用 void 1，void (1+1)，void (0) 或者 void "hello"，void (new Date()) 等等，都是一样的效果。更重要的前提是，void 是不能被重写的（cannot be overidden）。

那么，ES5 大环境下，void 0 就没有用武之地了吗？答案是否定的，用 void 0 代替 undefined 能节省不少字节的大小，事实上，不少 JavaScript 压缩工具在压缩过程中，正是将 undefined 用 void 0 代替掉了。

一篇不长的文章写了两个小时，心累，不点个赞、不关注下楼主的 Repo 你觉得好意思吗？<https://github.com/hanzichi/underscore-analysis>

# Read More

- [void MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/void)
- [What does void 0 mean?](http://stackoverflow.com/questions/7452341/what-does-void-0-mean)