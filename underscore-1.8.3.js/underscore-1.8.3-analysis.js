//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.
//     中文注释 by hanzichi @https://github.com/hanzichi
//     我的源码解读顺序（跟系列解读文章相对应）
//     Object -> Array -> Collection -> Function -> Utility

(function() {

  // Baseline setup
  // 基本设置、配置
  // --------------
  
  // Establish the root object, `window` in the browser, or `exports` on the server.
  // 将 this 赋值给局部变量 root
  // root 的值, 客户端为 `window`, 服务端(node) 中为 `exports`
  var root = this;
  
  // Save the previous value of the `_` variable.
  // 将原来全局环境中的变量 `_` 赋值给变量 previousUnderscore 进行缓存 
  // 在后面的 noConflict 方法中有用到
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  // 缓存变量, 便于压缩代码
  // 此 `压缩` 为压缩到 min.js 版本
  // 而不是 gzip 压缩
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  // 缓存变量, 便于压缩代码
  // 同时可减少在原型链中的查找次数(提高代码效率)
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  // ES5 原生方法, 如果浏览器支持, 则 underscore 中会优先使用
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  // 核心函数
  // `_` 其实是一个构造函数
  // 支持无 new 调用的构造函数（思考 jQuery 的无 new 调用）
  // 将传入的参数（实际要操作的数据）赋值给 this._wrapped 属性
  var _ = function(obj) {
    // 以下均针对 OOP 形式的调用
    // 如果是非 OOP 形式的调用，不会进入该函数内部 

    // 如果 obj 已经是 `_` 函数的实例，则直接返回 obj
    if (obj instanceof _) return obj;

    // 如果不是 `_` 函数的实例
    // 则调用 new 运算符，返回实例化的对象
    if (!(this instanceof _)) return new _(obj);

    // 将 obj 赋值给 this._wrapped 属性
    this._wrapped = obj;
  };  

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  // 将上面定义的 `_` 局部变量赋值给全局对象中的 `_` 属性
  // 即客户端中 window._ = _
  // 服务端(node)中 exports._ = _
  // 同时在服务端向后兼容老的 require() API
  // 这样暴露给全局后便可以在全局环境中使用 `_` 变量(方法)
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  // 当前 underscore 版本号
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  // underscore 内部方法
  // 根据 this 指向（context 参数）
  // 以及 argCount 参数
  // 二次操作返回一些回调、迭代方法
  var optimizeCb = function(func, context, argCount) {
    // 如果没有指定 this 指向，则返回原函数
    if (context === void 0) return func;

    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };

      // 如果有指定 this，但没有传入 argCount 参数
      // 则执行以下 case
      // each、map
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };

      // reduce
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };


  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  // 有三个方法用到了这个内部函数
  // _.extend & _.extendOwn & _.defaults
  // _.extend = createAssigner(_.allKeys);
  // _.extendOwn = _.assign = createAssigner(_.keys);
  // _.defaults = createAssigner(_.allKeys, true);
  var createAssigner = function(keysFunc, undefinedOnly) {
    // 返回函数
    // 经典闭包（undefinedOnly 参数在返回的函数中被引用）
    // 返回的函数参数个数 >= 1
    // 将第二个开始的对象参数的键值对 "继承" 给第一个参数
    return function(obj) {
      var length = arguments.length;
      // 只传入了一个参数（或者 0 个？）
      // 或者传入的第一个参数是 null
      if (length < 2 || obj == null) return obj;

      // 枚举第一个参数除外的对象参数
      // 即 arguments[1], arguments[2] ...
      for (var index = 1; index < length; index++) {
        // source 即为对象参数
        var source = arguments[index],
            // 提取对象参数的 keys 值
            // keysFunc 参数表示 _.keys 
            // 或者 _.allKeys
            keys = keysFunc(source),
            l = keys.length;

        // 遍历该对象的键值对
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          // _.extend 和 _.extendOwn 方法
          // 没有传入 undefinedOnly 参数，即 !undefinedOnly 为 true
          // 即肯定会执行 obj[key] = source[key] 
          // 后面对象的键值对直接覆盖 obj
          // ==========================================
          // _.defaults 方法，undefinedOnly 参数为 true
          // 即 !undefinedOnly 为 false
          // 那么当且仅当 obj[key] 为 undefined 时才覆盖
          // 即如果有相同的 key 值，取最早出现的 value 值
          // *defaults 中有相同 key 的也是一样取首次出现的
          if (!undefinedOnly || obj[key] === void 0) 
            obj[key] = source[key];
        }
      }

      // 返回已经继承后面对象参数属性的第一个参数对象
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  // _.create
  var baseCreate = function(prototype) {
    // 如果 prototype 参数不是对象
    if (!_.isObject(prototype)) return {};

    // 如果浏览器支持 ES5 Object.create
    if (nativeCreate) return nativeCreate(prototype);

    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  // 闭包
  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094

  // Math.pow(2, 53) - 1 是 JavaScript 中能精确表示的最大数字
  // 
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

  // getLength 函数
  // 该函数传入一个参数，返回参数的 length 属性值
  // 用来获取数组（类数组）长度
  var getLength = property('length');

  // 判断是否是数组或者类数组
  // 如果是，则返回 true
  // 类数组包括 arguments、HTML Collection 以及 NodeList
  // 不能传入一个带有 length 属性，并且属性值是 number 类型的对象
  var isArrayLike = function(collection) {
    // 返回 collection 的 length 属性值
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // 数组或者对象的扩展方法
  // 共 25 个扩展方法
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  // 与 ES5 中 Array.forEach 使用方法类似
  // 遍历数组或者对象的每个元素
  // 第一个参数为数组（包括类数组）或者对象
  // 第二个参数为迭代方法，对数组或者对象每个元素都执行该方法
  // 该方法又能传入三个参数，分别为 item、index、array（value、key、obj）
  // 与 ES5 中 forEach 方法传参格式一致
  // 第三个参数（可省略）确定第二个参数 iteratee 函数中的（可能有的）this 指向
  // 即 iteratee 中所有 this 都指向 context
  // notice: 不要传入一个带有 key 类型为 number 的对象！
  // notice: _.each 方法不能用 return 跳出循环
  _.each = _.forEach = function(obj, iteratee, context) {
    // 根据 context 确定不同的迭代函数
    iteratee = optimizeCb(iteratee, context);

    var i, length;

    // 如果是数组或者类数组
    if (isArrayLike(obj)) {
      // 遍历
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else { // 如果 obj 是对象
      // 获取对象的所有 key 值
      var keys = _.keys(obj);

      // 如果是对象，则遍历处理 values 值
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj); // (value, key, obj)
      }
    }
    // 返回 obj 以支持链式调用
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  // 与 ES5 中 Array.map 使用方法类似
  // 传参与 each 方法类似
  // 遍历数组（每个元素）或者对象的每个元素（values）
  // 对每个元素执行 iteratee 迭代方法
  // 将结果保存到新的数组中
  _.map = _.collect = function(obj, iteratee, context) {
    // 根据 context 确定不同的迭代函数
    iteratee = cb(iteratee, context);

    // 如果传参是对象，则获取它的 keys 值数组（短路表达式）
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length); // 结果数组
    // 遍历
    for (var index = 0; index < length; index++) {
      // 判断是数组还是对象
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    // 返回新的结果数组
    return results;
  };

  // Create a reducing function iterating left or right.
  // dir === 1 -> _.reduce
  // dir === -1 -> _.reduceRight
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        // 迭代，返回值供下次迭代调用
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      // 每次迭代返回值，供下次迭代调用
      return memo;
    }

    // reduce（reduceRight）可传入的 4 个参数
    // obj 数组或者对象
    // iteratee 迭代方法，对数组或者对象每个元素执行该方法
    // memo 初始值，如果有，则从 obj 第一个元素开始迭代
    // 如果没有，则从 obj 第二个元素开始迭代，将第一个元素作为初始值
    // context 为迭代函数中的 this 指向
    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;

      // Determine the initial value if none is provided.
      // 如果没有指定初始值
      // 则把第一个元素指定为初始值
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }

      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  // 与 ES5 中 Array.reduce 使用方法类似
  // reduce 方法最多可传入 4 个参数
  // 其中前三个参数传递与 Array.reduce 传参类似（第三个可选）
  // 第四个可选参数可指定迭代方法中的 this 指向
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  // 与 ES5 中 Array.reduceRight 使用方法类似
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  // 寻找数组或者对象中第一个满足条件（predicate 函数返回 true）的元素
  // 并返回该元素值
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    // 如果 obj 是数组，则找出满足条件的下标
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      // 如果 obj 是对象，则找出满足条件的元素的 key 值
      key = _.findKey(obj, predicate, context);
    }

    // 如果该元素存在，则返回该元素
    // 如果不存在，则默认返回 undefined（函数没有返回，即返回 undefined）
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  // 与 ES5 中 Array.filter 使用方法类似
  // 寻找数组或者对象中所有满足条件的元素
  // 如果是数组，则将 `元素值` 存入数组
  // 如果是对象，则将 `value 值` 存入数组
  // 返回该数组
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];

    // 根据 this 指向，返回 predicate 函数（判断函数）
    predicate = cb(predicate, context);

    // 遍历每个元素，如果符合条件则存入数组
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });

    return results;
  };

  // Return all the elements for which a truth test fails.
  // 寻找数组或者对象中所有不满足条件的元素
  // 并以数组方式返回
  // 与 filter 方法相对
  // 求得结果是 filter 方法的补集
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  // 与 ES5 中的 Array.every 方法类似
  // 判断数组中的每个元素或者对象中每个 values 值是否都满足 predicate 函数中的判断条件
  // 如果是，则返回 ture；否则返回 false
  _.every = _.all = function(obj, predicate, context) {
    // 根据 this 指向，返回相应 predicate 函数
    predicate = cb(predicate, context);

    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // 如果有一个不能满足 predicate 中的条件
      // 则返回 false
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  // 与 ES5 中 Array.some 方法类似
  // 判断数组或者对象中是否有一个元素（values 值）满足 predicate 函数中的条件
  // 如果是则返回 true；否则返回 false
  _.some = _.any = function(obj, predicate, context) {
    // 根据 context 返回 predicate 函数
    predicate = cb(predicate, context);
    // 如果传参是对象，则返回该对象的 keys 数组
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // 如果有一个元素满足条件，则返回 true
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  // 判断数组或者对象中（value 值）是否有指定元素
  // 返回布尔值
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    // 如果是对象，返回 values 组成的数组
    if (!isArrayLike(obj)) obj = _.values(obj);

    // fromIndex 表示查询起始位置
    // 如果没有指定该参数，则默认从头找起
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;

    // _.indexOf 是数组才有的扩展方法
    // 数组中寻找某一元素
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  // invoke_.invoke(list, methodName, *arguments) 
  // Calls the method named by methodName on each value in the list.
  // Any extra arguments passed to invoke will be forwarded on to the method invocation.
  // 数组或者对象中的每个元素都调用 method 方法
  // 返回调用后的结果（数组或者关联数组）
  // method 参数后的参数会被当做参数传入 method 方法中
  _.invoke = function(obj, method) {
    // method 之后的参数
    var args = slice.call(arguments, 2);

    // 判断 method 是不是函数
    var isFunc = _.isFunction(method);

    // 用 map 方法对数组或者对象每个元素调用方法
    // 并且返回另一个数组（参数为数组）或者关联数组（参数为对象）
    return _.map(obj, function(value) {
      // 如果 method 不是函数，则可能是 obj 的 key 值
      // 而 obj[method] 可能为函数
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  // 一个数组，元素都是对象
  // 根据指定的 key 值
  // 返回一个数组，元素都是指定 key 值的 value 值
  /*
  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };
  */
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  // 根据指定的键值对
  // 选择对象
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };
  
  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  // 寻找第一个有指定 key-value 键值对的对象
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  // 寻找数组中的最大元素
  // 或者对象中的最大 value 值
  // 如果有 iteratee 参数，则求每个元素经过该函数迭代后的最值
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;

    // 单纯地寻找最值
    if (iteratee == null && obj != null) {
      // 如果是数组，则寻找数组中最大元素
      // 如果是对象，则寻找最大 value 值
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {  // 寻找元素经过迭代后的最值
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  // 寻找最小的元素
  // 类似 _.max
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // 将数组乱序
  // 如果是对象，则返回一个数组，数组中的元素是对象 values 值集合
  // Fisher-Yates shuffle 算法
  // 最优的洗牌算法，复杂度 O(n)
  // 乱序不要用 sort + Math.random()，复杂度 O(nlogn)
  _.shuffle = function(obj) {
    // 如果是对象，则对 values 值进行乱序
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;

    // 乱序后返回的数组副本（参数是对象则返回乱序后的 values 数组）
    var shuffled = Array(length);

    // 枚举元素
    for (var index = 0, rand; index < length; index++) {
      // 将当前所枚举位置的元素和 `index=rand` 位置的元素交换
      // 保证 0-index 位置的元素已经乱序 
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  // 随机返回数组或者对象中的一个元素
  // 如果指定了参数 `n`，则随机返回 n 个元素组成的数组
  // 如果参数是对象，则数组由 values 组成
  _.sample = function(obj, n, guard) {
    // 随机返回一个元素
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }

    // 随机返回 n 个
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  // 排序
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);

    // 根据指定的 key 返回 values 数组
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        // 对元素进行迭代
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  // groupBy_  _.groupBy(list, iteratee, [context]) 
  // 根据特定规则对数组或者对象中的元素进行分组
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  // 伪数组 -> 数组
  // 对象 -> 提取 value 值组成的数组
  _.toArray = function(obj) {
    if (!obj) return [];

    // 如果是数组，则返回副本数组
    // 是否用 obj.concat() 更方便？
    if (_.isArray(obj)) return slice.call(obj);

    // 如果是类数组，则重新构造新的数组
    // 是否也可以直接用 slice 方法？
    if (isArrayLike(obj)) return _.map(obj, _.identity);

    // 如果是对象，则返回 values 集合
    return _.values(obj);
  };

  // Return the number of elements in an object.
  // 如果是数组（类数组），返回长度（length 属性）
  // 如果是对象，返回键值对数量
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  // 将数组或者对象中符合条件（predicate）的元素
  // 和不符合条件的元素（数组为元素，对象为 values）
  // 分别放入两个数组中
  // 返回一个数组，数组元素为以上两个数组
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };


  // Array Functions
  // 数组的扩展方法
  // 共 20 个扩展方法
  // Note: All array functions will also work on the arguments object. 
  // However, Underscore functions are not designed to work on "sparse" arrays.
  // ---------------  
  
  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  // 返回数组第一个元素
  // 如果有参数 n，则返回数组前 n 个元素（组成的数组）
  _.first = _.head = _.take = function(array, n, guard) {
    // 容错，数组为空则返回 undefined
    if (array == null) return void 0;
    
    // 没指定参数 n，则默认返回第一个元素
    if (n == null || guard) return array[0];

    // 如果传入参数 n，则返回前 n 个元素组成的数组
    // 返回前 n 个元素，即剔除后 array.length - n 个元素
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  // 传入一个数组
  // 返回剔除最后一个元素之后的数组副本
  // 如果传入参数 n，则剔除最后 n 个元素
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };
  
  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  // 返回数组最后一个元素
  // 如果传入参数 n
  // 则返回该数组后 n 个元素组成的数组
  // 即剔除前 array.length - n 个元素
  _.last = function(array, n, guard) {
    // 容错
    if (array == null) return void 0;

    // 如果没有指定参数 n，则返回最后一个元素
    if (n == null || guard) return array[array.length - 1];

    // 如果传入参数 n，则返回后 n 个元素组成的数组
    // 即剔除前 array.length - n 个元素
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  // 传入一个数组
  // 返回剔除第一个元素后的数组副本
  // 如果传入参数 n，则剔除前 n 个元素
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  // 去掉数组中所有的假值
  // 返回数组副本
  // JavaScript 中的假值包括 false、null、undefined、''、NaN、0
  // 联想 PHP 中的 array_filter() 函数
  // _.identity = function(value) {
  //   return value;
  // };
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };
  
  // Internal implementation of a recursive `flatten` function.
  // 递归调用数组，将数组展开
  // 即 [1, 2, [3, 4]] => [1, 2, 3, 4]
  // flatten(array, shallow, false)
  // flatten(arguments, true, true, 1)
  // flatten(arguments, true, true)
  // flatten(arguments, false, false, 1)
  // =====//
  // input => Array 或者 arguments
  // shallow => 是否只展开一层
  // strict === true，说明需要展开的是纯数组
  // strict === false，说明需要保存的可能有单个键值
  // startIndex => 从 input 的第几项开始展开
  var flatten = function(input, shallow, strict, startIndex) {
    // output 数组保存结果
    // 即 flatten 方法返回数据
    // idx 为 output 的累计数组下标
    var output = [], idx = 0;

    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      // 数组 或者 arguments
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // flatten current level of array or arguments object
        // !shallow 为 true，即 shallow 值为 false
        // 则表示需深度展开
        // 继续递归展开
        if (!shallow) 
          // flatten 返回数组
          // 将上面定义的 value 重新赋值
          value = flatten(value, shallow, strict);

        // 递归展开到最后一层（没有嵌套的数组了）
        // 或者 (shallow === true) => 只展开一层
        var j = 0, len = value.length;

        output.length += len;

        // 将 value 数组的元素添加到 output 数组中
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) { 
        // !strict 为 true，则 strict 为 false
        // 说明 value 不是数组（是基本类型）
        // 直接加到 output 数组中即可
        output[idx++] = value;
      }
    }

    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  // 将嵌套的数组展开
  // 如果参数 (shallow === true)，则仅展开一层
  // _.flatten([1, [2], [3, [[4]]]]);
  // => [1, 2, 3, 4];
  // ====== //
  // _.flatten([1, [2], [3, [[4]]]], true);
  // => [1, 2, 3, [[4]]];
  _.flatten = function(array, shallow) {
    // array => 需要展开的数组
    // shallow => 是否只展开一层
    // false 为 flatten 方法 strict 变量
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  // without_.without(array, *values) 
  // Returns a copy of the array with all instances of the values removed.
  // ====== //
  // _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
  // => [2, 3, 4]
  // ===== //
  // 从数组中移除指定的元素
  // 返回移除后的数组副本
  _.without = function(array) {
    // slice.call(arguments, 1)
    // 将 arguments 转为数组（同时去掉第一个元素）
    // 之后便可以调用 _.difference 方法
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  // 数组去重
  // 如果第二个参数 `isSorted` 为 true
  // 则说明事先已经知道数组有序
  // 程序会跑一个更快的算法（一次线性比较，元素和数组前一个元素比较即可）
  // 如果有第三个参数 iteratee，则对数组每个元素迭代
  // 对迭代之后的结果进行去重
  // 返回去重后的数组（array 的子数组）
  // PS: 暴露的 API 中没 context 参数
  // _.uniq(array, [isSorted], [iteratee]) 
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    // 没有传入 isSorted 参数
    // 转为 _.unique(array, false, undefined, iteratee)
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }

    // 如果有迭代函数
    // 则根据 this 指向二次返回新的迭代函数
    if (iteratee != null) 
      iteratee = cb(iteratee, context);

    // 结果数组，是 array 的子集
    var result = [];

    // 已经出现过的元素（或者经过迭代过的值）
    // 用来过滤重复值
    var seen = [];

    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          // 如果指定了迭代函数
          // 则对数组每一个元素进行迭代
          // 迭代函数传入的三个参数通常是 value, index, array 形式
          computed = iteratee ? iteratee(value, i, array) : value;

      // 如果是有序数组，则当前元素只需跟上一个元素对比即可
      // 用 seen 变量保存上一个元素
      if (isSorted) {
        // 如果 i === 0，是第一个元素，则直接 push
        // 否则比较当前元素是否和前一个元素相等
        if (!i || seen !== computed) result.push(value);
        // seen 保存当前元素，供下一次对比
        seen = computed;
      } else if (iteratee) {
        // 如果 seen[] 中没有 computed 这个元素值
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {  
        // 如果不用经过迭代函数计算，也就不用 seen[] 变量了
        result.push(value);
      }
    }

    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  // union_.union(*arrays) 
  // Computes the union of the passed-in arrays: 
  // the list of unique items, in order, that are present in one or more of the arrays.
  // ========== //
  // _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
  // => [1, 2, 3, 101, 10]
  // ========== //
  // 将多个数组的元素集中到一个数组中
  // 并且去重，返回数组副本
  _.union = function() {
    // 首先用 flatten 方法将传入的数组展开成一个数组
    // 然后就可以愉快地调用 _.uniq 方法了
    // 假设 _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
    // arguments 为 [[1, 2, 3], [101, 2, 1, 10], [2, 1]]
    // shodow 为 true，展开一层
    // 结果为 [1, 2, 3, 101, 2, 1, 10, 2, 1]
    // 然后对其去重
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  // 寻找几个数组中共有的元素
  // 将这些每个数组中都有的元素存入另一个数组中返回
  // _.intersection(*arrays) 
  // _.intersection([1, 2, 3, 1], [101, 2, 1, 10, 1], [2, 1, 1])
  // => [1, 2]
  // 注意：返回的结果数组是去重的
  _.intersection = function(array) {
    // 结果数组
    var result = [];

    // 传入的参数（数组）个数
    var argsLength = arguments.length;

     // 遍历第一个数组的元素
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];

      // 如果 result[] 中已经有 item 元素了，continue
      // 即 array 中出现了相同的元素
      // 返回的 result[] 其实是个 "集合"（是去重的）
      if (_.contains(result, item)) continue;

      // 判断其他参数数组中是否都有 item 这个元素
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      
      // 遍历其他参数数组完毕
      // j === argsLength 说明其他参数数组中都有 item 元素
      // 则将其放入 result[] 中
      if (j === argsLength) result.push(item);
    }

    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  // _.difference(array, *others) 
  // Similar to without, but returns the values from array that are not present in the other arrays.
  // ===== //
  // _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
  // => [1, 3, 4]
  // ===== //
  // 剔除 array 数组中在 others 数组中出现的元素
  _.difference = function(array) {
    // 将 others 数组深度展开
    // rest[] 保存展开后的元素组成的数组
    // strict 参数为 true
    // 不可以这样用 _.difference([1, 2, 3, 4, 5], [5, 2], 10);
    // 10 就会取不到
    var rest = flatten(arguments, true, true, 1);

    // 遍历 array，过滤
    return _.filter(array, function(value){
      // 如果 value 存在在 rest 中，则过滤掉
      return !_.contains(rest, value);
    });
  };
  
  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // ===== //
  // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
  // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
  // ===== //
  // 将多个数组中相同位置的元素归类
  // 返回一个数组
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  // The opposite of zip. Given an array of arrays, 
  // returns a series of new arrays, 
  // the first of which contains all of the first elements in the input arrays, 
  // the second of which contains all of the second elements, and so on.
  // ===== //
  // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
  // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
  // ===== //
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  // 将数组转化为对象
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };
  
  // Generator function to create the findIndex and findLastIndex functions
  // (dir === 1) => 从前往后找 
  // (dir === -1) => 从后往前找
  function createPredicateIndexFinder(dir) {
    // 经典闭包
    return function(array, predicate, context) {
      predicate = cb(predicate, context);

      var length = getLength(array);

      // 根据 dir 变量来确定数组遍历的起始位置
      var index = dir > 0 ? 0 : length - 1;

      for (; index >= 0 && index < length; index += dir) {
        // 找到第一个符合条件的元素
        // 并返回下标值
        if (predicate(array[index], index, array)) 
          return index;
      }

      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  // 从前往后找到数组中 `第一个满足条件` 的元素，并返回下标值
  // 没找到返回 -1
  // _.findIndex(array, predicate, [context]) 
  _.findIndex = createPredicateIndexFinder(1);

  // 从后往前找到数组中 `第一个满足条件` 的元素，并返回下标值
  // 没找到返回 -1
  // _.findLastIndex(array, predicate, [context]) 
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  // The iteratee may also be the string name of the property to sort by (eg. length).
  // ===== //
  // _.sortedIndex([10, 20, 30, 40, 50], 35);
  // => 3
  // ===== //
  // var stooges = [{name: 'moe', age: 40}, {name: 'curly', age: 60}];
  // _.sortedIndex(stooges, {name: 'larry', age: 50}, 'age');
  // => 1
  // ===== //
  // 二分查找
  // 将一个元素插入已排序的数组
  // 返回该插入的位置下标
  // _.sortedIndex(list, value, [iteratee], [context]) 
  _.sortedIndex = function(array, obj, iteratee, context) {
    // 注意 cb 方法
    // iteratee 为空 || 为 String 类型（key 值）时会返回不同方法
    iteratee = cb(iteratee, context, 1);

    // 经过迭代函数计算的值
    // 可打印 iteratee 出来看看
    var value = iteratee(obj);

    var low = 0, high = getLength(array);

    // 二分查找
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) 
        low = mid + 1; 
      else 
        high = mid;
    }

    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  // _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  // _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);
  function createIndexFinder(dir, predicateFind, sortedIndex) {

    // API 调用形式
    // _.indexOf(array, value, [isSorted]) 
    // _.indexOf(array, value, [fromIndex]) 
    // _.lastIndexOf(array, value, [fromIndex]) 
    return function(array, item, idx) {
      var i = 0, length = getLength(array);

      // 如果 idx 为 Number 类型
      // 则规定查找位置的起始点
      // 那么第三个参数不是 [isSorted]
      // 所以不能用二分查找优化了
      // 只能遍历查找
      if (typeof idx == 'number') {
        if (dir > 0) { // 正向查找
          // 重置查找的起始位置
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else { // 反向查找
          // 如果是反向查找，重置 length 属性值
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        // 能用二分查找加速的条件
        // 有序 & idx !== 0 && length !== 0

        // 用 _.sortIndex 找到有序数组中 item 正好插入的位置
        idx = sortedIndex(array, item);

        // 如果正好插入的位置的值和 item 刚好相等
        // 说明该位置就是 item 第一次出现的位置
        // 返回下标
        // 否则即是没找到，返回 -1
        return array[idx] === item ? idx : -1;
      }

      // 特判，如果要查找的元素是 NaN 类型
      // 如果 item !== item
      // 那么 item => NaN
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }

      // O(n) 遍历数组
      // 寻找和 item 相同的元素
      // 特判排除了 item 为 NaN 的情况
      // 可以放心地用 `===` 来判断是否相等了
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }

      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  // _.indexOf(array, value, [isSorted]) 
  // 找到数组 array 中 value 第一次出现的位置
  // 并返回其下标值
  // 如果数组有序，则第三个参数可以传入 true
  // 这样算法效率会更高（二分查找）
  // [isSorted] 参数表示数组是否有序
  // 同时第三个参数也可以表示 [fromIndex] （见下面的 _.lastIndexOf）
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

  // 和 _indexOf 相似
  // 反序查找
  // _.lastIndexOf(array, value, [fromIndex]) 
  // [fromIndex] 参数表示从倒数第几个开始往前找
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  // 返回某一个范围内的数组成的数组
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }

    step = step || 1;

    // 返回数组的长度
    var length = Math.max(Math.ceil((stop - start) / step), 0);

    // 返回的数组
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };
  

  // Function (ahem) Functions
  // 函数的扩展方法
  // 共 14 个扩展方法
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  // ES5 bind 方法的扩展
  // 将 func 中的 this 指向 context
  _.bind = function(func, context) {
    // 如果支持 ES5 bind，则优先使用
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    // 如果 bind 不是对 func 使用，则抛出一个错误
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  // 将一些函数中的 this 指向 obj 变量
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  // 延迟触发某方法
  _.delay = function(func, wait) {
    // 获取 _delay 方法 index=2 后的参数
    // 是 func 函数所需要的参数
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      // 将参数赋予 func 函数
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  // 函数节流
  // 间隔时间触发
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  // 函数去抖
  // 只触发一次
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  // 返回一个 predicate 方法的对立方法
  // 即该方法可以对原来的 predicate 迭代结果值取反
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  // 一个函数会在第 N 次被调用时执行
  // 有什么用呢？
  // 如果有 N 个异步事件，所有异步执行完后执行该回调
  // 思考 eventproxy
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  // 至多调用函数 N 次
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  // 函数至多只能被调用一次
  _.once = _.partial(_.before, 2);

  
  // Object Functions
  // 对象的扩展方法
  // 共 38 个扩展方法
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  // IE < 9 下 不能用 for key in ... 来枚举对象的某些 key
  // 比如重写了对象的 `toString` 方法，这个 key 值就不能在 IE < 9 下用 for in 枚举到
  // IE < 9，{toString: null}.propertyIsEnumerable('toString') 返回 false
  // IE < 9，重写的 `toString` 属性被认为不可枚举
  // 据此可以判断是否在 IE < 9 浏览器环境中
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  
  // IE < 9 下不能用 for in 来枚举的 key 值集合
  // 其实还有个 `constructor` 属性
  // 个人觉得可能是 `constructor` 和其他属性不属于一类
  // nonEnumerableProps[] 中都是方法
  // 而 constructor 表示的是对象的构造函数
  // 所以区分开来了
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  // obj 为需要遍历键值对的对象
  // keys 为键数组
  // 利用 JavaScript 按值传递的特点
  // 传入数组作为参数，能直接改变数组的值          
  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;

    // 获取对象的原型
    // 如果 obj 的 constructor 被重写
    // 则 proto 变量为 Object.prototype
    // 如果没有被重写
    // 则为 obj.constructor.prototype
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    // `constructor` 属性需要特殊处理 (是否有必要？)
    // see https://github.com/hanzichi/underscore-analysis/issues/3
    // 如果 obj 有 `constructor` 这个 key
    // 并且该 key 没有在 keys 数组中
    // 存入 keys 数组
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);
    
    // 遍历 nonEnumerableProps 数组中的 keys
    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      // prop in obj 应该肯定返回 true 吧？是否有判断必要？
      // obj[prop] !== proto[prop] 判断该 key 是否来自于原型链
      // 即是否重写了原型链上的属性
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  // ===== //
  // _.keys({one: 1, two: 2, three: 3});
  // => ["one", "two", "three"]
  // ===== //
  // 返回一个对象的 keys 组成的数组
  // 仅返回 own enumerable properties 组成的数组
  _.keys = function(obj) {
    // 容错
    // 如果传入的参数不是对象，则返回空数组
    if (!_.isObject(obj)) return [];

    // 如果浏览器支持 ES5 Object.key() 方法
    // 则优先使用该方法
    if (nativeKeys) return nativeKeys(obj);

    var keys = [];

    // own enumerable properties
    for (var key in obj) 
      // hasOwnProperty
      if (_.has(obj, key)) keys.push(key);

    // Ahem, IE < 9.
    // IE < 9 下不能用 for in 来枚举某些 key 值
    // 传入 keys 数组为参数
    // 因为 JavaScript 下函数参数按值传递
    // 所以 keys 当做参数传入后会在 `collectNonEnumProps` 方法中改变值
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    
    return keys;
  };

  // Retrieve all the property names of an object.
  // 返回一个对象的 keys 数组
  // 不仅仅是 own enumerable properties
  // 还包括原型链上继承的属性
  _.allKeys = function(obj) {
    // 容错
    // 不是对象，则返回空数组
    if (!_.isObject(obj)) return [];

    var keys = [];
    for (var key in obj) keys.push(key);

    // Ahem, IE < 9.
    // IE < 9 下的 bug，同 _.keys 方法
    if (hasEnumBug) collectNonEnumProps(obj, keys);

    return keys;
  };

  // Retrieve the values of an object's properties.
  // ===== //
  // _.values({one: 1, two: 2, three: 3});
  // => [1, 2, 3]
  // ===== //
  // 将一个对象的所有 values 值放入数组中
  // 仅限 own properties 上的 values
  // 不包括原型链上的
  // 并返回该数组
  _.values = function(obj) {
    // 仅包括 own properties
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  // 跟 _.map 方法很像
  // 但是是专门为对象服务的 map 方法
  // 迭代函数改变对象的 values 值
  // 返回对象副本
  _.mapObject = function(obj, iteratee, context) {
    // 迭代函数
    // 对每个键值对进行迭代
    iteratee = cb(iteratee, context);

    var keys =  _.keys(obj),
        length = keys.length,
        results = {}, // 对象副本，该方法返回的对象
        currentKey;

    for (var index = 0; index < length; index++) {
      currentKey = keys[index];
      // key 值不变
      // 对每个 value 值用迭代函数迭代
      // 返回经过函数运算后的值
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // 将一个对象转换为元素为 [key, value] 形式的数组
  // _.pairs({one: 1, two: 2, three: 3});
  // => [["one", 1], ["two", 2], ["three", 3]]
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };
  
  // Invert the keys and values of an object. The values must be serializable.
  // 将一个对象的 key-value 键值对颠倒
  // 即原来的 key 为 value 值，原来的 value 值为 key 值
  // 需要注意的是，value 值不能重复（不然后面的会覆盖前面的）
  // 且新构造的对象符合对象构造规则
  // 并且返回新构造的对象
  _.invert = function(obj) {
    // 返回的新的对象
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };
  
  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  // 传入一个对象
  // 遍历该对象的键值对（包括 own properties 以及 原型链上的）
  // 如果某个 value 的类型是方法（function），则将该 key 存入数组
  // 将该数组排序后返回
  _.functions = _.methods = function(obj) {
    // 返回的数组
    var names = [];

    // if IE < 9
    // 且对象重写了 `nonEnumerableProps` 数组中的某些方法
    // 那么这些方法名是不会被返回的
    // 可见放弃了 IE < 9 可能对 `toString` 等方法的重写支持
    for (var key in obj) {
      // 如果某个 key 对应的 value 值类型是函数
      // 则将这个 key 值存入数组
      if (_.isFunction(obj[key])) names.push(key);
    }

    // 返回排序后的数组
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  // extend_.extend(destination, *sources) 
  // Copy all of the properties in the source objects over to the destination object
  // and return the destination object
  // It's in-order, so the last source will override properties of the same name in previous arguments.
  // 将几个对象上（第二个参数开始，根据参数而定）的所有键值对添加到 destination 对象（第一个参数）上
  // 因为 key 值可能会相同，所以后面的（键值对）可能会覆盖前面的
  // 参数个数 >= 1
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  // 跟 extend 方法类似，但是只把 own properties 拷贝给第一个参数对象
  // 只继承 own properties 的键值对
  // 参数个数 >= 1
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  // 跟数组方法的 _.findIndex 类似
  // 找到对象的键值对中第一个满足条件的键值对
  // 并返回该键值对 key 值
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    // 遍历键值对
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      // 符合条件，直接返回 key 值
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  // 根据一定的需求（key 值，或者通过 predicate 函数返回真假）
  // 返回拥有一定键值对的对象副本
  // 第二个参数可以是一个 predicate 函数
  // 也可以是 >= 0 个 key
  // _.pick(object, *keys) 
  // Return a copy of the object
  // filtered to only have values for the whitelisted keys (or array of valid keys)
  // Alternatively accepts a predicate indicating which keys to pick.
  /*
  _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
  => {name: 'moe', age: 50}
  _.pick({name: 'moe', age: 50, userid: 'moe1'}, ['name', 'age']);
  => {name: 'moe', age: 50}
  _.pick({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
    return _.isNumber(value);
  });
  => {age: 50}
  */
  _.pick = function(object, oiteratee, context) {
    // result 为返回的对象副本
    var result = {}, obj = object, iteratee, keys;

    // 容错
    if (obj == null) return result;

    // 如果第二个参数是函数
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      // 如果第二个参数不是函数
      // 则后面的 keys 可能是数组
      // 也可能是连续的几个并列的参数
      // 用 flatten 将它们展开
      keys = flatten(arguments, false, false, 1);

      // 也转为 predicate 函数判断形式
      // 将指定 key 转化为 predicate 函数
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }

    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      // 满足条件
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
   // 跟 _.pick 方法相对
   // 返回 _.pick 的补集
   // 即返回没有指定 keys 值的对象副本
   // 或者返回不能通过 predicate 函数的对象副本
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      // _.negate 方法对 iteratee 的结果取反
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // _.defaults(object, *defaults) 
  // Fill in a given object with default properties.
  // Fill in undefined properties in object 
  // with the first value present in the following list of defaults objects.
  // 和 _.extend 非常类似
  // 区别是如果 *defaults 中出现了和 object 中一样的键
  // 则不覆盖 object 的键值对
  // 如果 *defaults 多个参数对象中有相同 key 的对象
  // 则取最早出现的 value 值
  // 参数个数 >= 1
  _.defaults = createAssigner(_.allKeys, true);
  
  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  // 给定 prototype 
  // 以及一些 own properties
  // 构造一个新的对象并返回
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);

    // 将 props 的键值对覆盖 result 对象
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  // 对象的 `浅复制` 副本
  // 注意点：所有嵌套的对象或者数组都会跟原对象用同一个引用
  // 所以是为浅复制，而不是深度克隆
  _.clone = function(obj) {
    // 容错，如果不是对象或者数组类型，则可以直接返回
    // 因为一些基础类型是直接按值传递的
    // 思考，arguments 呢？ Nodelists 呢？ HTML Collections 呢？
    if (!_.isObject(obj)) return obj;

    // 如果是数组，则用 obj.slice() 返回数组副本
    // 如果是对象，则提取所有 obj 的键值对覆盖空对象，返回
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  // _.chain([1,2,3,200])
  // .filter(function(num) { return num % 2 == 0; })
  // .tap(alert)
  // .map(function(num) { return num * num })
  // .value();
  // => // [2, 200] (alerted)
  // => [4, 40000]
  // 主要是用在链式调用中
  // 对中间值立即进行处理
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  // attrs 参数为一个对象
  // 判断 object 对象中是否有 attrs 中的所有 key-value 键值对
  // 返回布尔值
  _.isMatch = function(object, attrs) {
    // 提取 attrs 对象的所有 keys
    var keys = _.keys(attrs), length = keys.length;

    // 如果 object 为空
    // 根据 attrs 的键值对数量返回布尔值
    if (object == null) return !length;

    // 这一步有必要？
    var obj = Object(object);

    // 遍历 attrs 对象键值对
    for (var i = 0; i < length; i++) {
      var key = keys[i];

      // 如果 obj 对象没有 attrs 对象的某个 key
      // 或者对于某个 key，它们的 value 值不同
      // 则证明 object 并不拥有 attrs 的所有键值对
      // 则返回 false
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }

    return true;
  };

  
  // Internal recursive comparison function for `isEqual`.
  // "内部的"/ "递归地"/ "比较"
  // 该内部方法会被递归调用
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    // a === b 时
    // 需要注意 `0 === -0` 这个 special case
    // 0 和 -0 被认为不相同（unequal）
    // 至于原因可以参考上面的链接
    if (a === b) return a !== 0 || 1 / a === 1 / b;

    // A strict comparison is necessary because `null == undefined`.
    // 如果 a 和 b 有一个为 null（或者 undefined）
    // 判断 a === b
    if (a == null || b == null) return a === b;

    // Unwrap any wrapped objects.
    // 如果 a 和 b 是 underscore OOP 的对象
    // 那么比较 _wrapped 属性值（Unwrap）
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;

    // Compare `[[Class]]` names.
    // 用 Object.prototype.toString.call 方法获取 a 变量类型
    var className = toString.call(a);

    // 如果 a 和 b 类型不相同，则返回 false
    // 类型都不同了还比较个蛋！
    if (className !== toString.call(b)) return false;

    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      // 以上五种类型的元素可以直接根据其 value 值来比较是否相等
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        // 转为 String 类型进行比较 
        return '' + a === '' + b;

      // RegExp 和 String 可以看做一类
      // 如果 obj 为 RegExp 或者 String 类型
      // 那么 '' + obj 会将 obj 强制转为 String
      // 根据 '' + a === '' + b 即可判断 a 和 b 是否相等
      // ================ 

      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        // 如果 +a !== +a 
        // 那么 a 就是 NaN
        // 判断 b 是否也是 NaN 即可
        if (+a !== +a) return +b !== +b;

        // An `egal` comparison is performed for other numeric values.
        // 排除了 NaN 干扰
        // 还要考虑 0 的干扰
        // 用 +a 将 Number() 形式转为基本类型
        // 即 +Number(1) ==> 1
        // 0 需要特判
        // 如果 a 为 0，判断 1 / +a === 1 / b
        // 否则判断 +a === +b
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;

      // 如果 a 为 Number 类型
      // 要注意 NaN 这个 special number
      // NaN 和 NaN 被认为 equal
      // ================ 

      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;

      // Date 和 Boolean 可以看做一类
      // 如果 obj 为 Date 或者 Boolean
      // 那么 +obj 会将 obj 转为 Number 类型
      // 然后比较即可
      // +new Date() 是当前时间距离 1970 年 1 月 1 日 0 点的毫秒数
      // +true => 1
      // +new Boolean(false) => 0
    }


    // 判断 a 是否是数组
    var areArrays = className === '[object Array]';
    
    // 如果 a 不是数组类型
    if (!areArrays) {
      // 如果 a 不是 object 或者 b 不是 object
      // 则返回 false
      if (typeof a != 'object' || typeof b != 'object') return false;

      // 通过上个步骤的 if 过滤
      // !!保证到此的 a 和 b 均为对象!!

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      // 通过构造函数来判断 a 和 b 是否相同
      // 但是，如果 a 和 b 的构造函数不同
      // 也并不一定 a 和 b 就是 unequal
      // 比如 a 和 b 在不同的 iframes 中！
      // aCtor instanceof aCtor 这步有点不大理解，啥用？
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }

    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    // 第一次调用 eq() 函数，没有传入 aStack 和 bStack 参数
    // 之后递归调用都会传入这两个参数
    aStack = aStack || [];
    bStack = bStack || [];

    var length = aStack.length;

    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    // 将嵌套的对象和数组展开
    // 如果 a 是数组
    // 因为嵌套，所以需要展开深度比较
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      // 根据 length 判断是否应该继续递归对比
      length = a.length;

      // 如果 a 和 b length 属性大小不同
      // 那么显然 a 和 b 不同
      // return false 不用继续比较了
      if (length !== b.length) return false;

      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        // 递归
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // 如果 a 不是数组
      // 进入这个判断分支

      // Deep compare objects.
      // 两个对象的深度比较
      var keys = _.keys(a), key;
      length = keys.length;

      // Ensure that both objects contain the same number of properties before comparing deep equality.
      // a 和 b 对象的键数量不同
      // 那还比较毛？
      if (_.keys(b).length !== length) return false;

      while (length--) {
        // Deep compare each member
        // 递归比较
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }

    // Remove the first object from the stack of traversed objects.
    // 与 aStack.push(a) 对应
    // 此时 aStack 栈顶元素正是 a
    // 而代码走到此步
    // a 和 b isEqual 确认
    // 所以 a，b 两个元素可以出栈
    aStack.pop();
    bStack.pop();

    // 深度搜索递归比较完毕
    // 放心地 return true
    return true;
  };
  
  // Perform a deep comparison to check if two objects are equal.
  // 判断两个对象是否一样
  // new Boolean(true)，true 被认为 equal
  // [1, 2, 3], [1, 2, 3] 被认为 equal
  // 0 和 -0 被认为 unequal
  // NaN 和 NaN 被认为 equal
  _.isEqual = function(a, b) {
    return eq(a, b);
  };
  
  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  // 是否是 {}、[] 或者 "" 或者 null、undefined
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    
    // 如果是数组、类数组、或者字符串
    // 根据 length 属性判断是否为空
    // 后面的条件是为了过滤 isArrayLike 对于 {length: 10} 这样对象的判断 bug？
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    
    // 如果是对象
    // 根据 keys 数量判断是否为 Empty
    return _.keys(obj).length === 0;
  };

  
  // Is a given value a DOM element?
  // 判断是否为 DOM 元素
  _.isElement = function(obj) {
    // 确保 obj 不是 null, undefined 等假值
    // 并且 obj.nodeType === 1
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // 判断是否为数组
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  // 判断是否为对象
  // 这里的对象包括 function 和 object 
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  // 其他类型判断
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  // _.isArguments 方法在 IE < 9 下的兼容
  // IE < 9 下对 arguments 调用 Object.prototype.toString.call 方法
  // 结果是 => [object Object]
  // 而并非我们期望的 [object Arguments]。
  // so 用是否含有 callee 属性来做兼容
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  // _.isFunction 在 old v8, IE 11 和 Safari 8 下的兼容
  // 觉得这里有点问题
  // 我用的 chrome 49 (显然不是 old v8)
  // 却也进入了这个 if 判断内部
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  // 判断是否是有限的数字
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  // 判断是否是 NaN
  // NaN 是唯一的一个 `自己不等于自己` 的 number 类型
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  // 判断是否是布尔值
  // 基础类型（true、 false）
  // 以及 new Boolean() 两个方向判断
  // 有点多余了吧？
  // 个人觉得直接用 toString.call(obj) 来判断就可以了
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  // 判断是否是 null
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  // 判断是否是 undefined
  // undefined 能被改写 （IE < 9）
  // undefined 只是全局对象的一个属性
  // 在局部环境能被重新定义
  // 但是 void 0 始终是 undefined 
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  // 判断对象中是否有指定 key
  // own properties, not on a prototype
  _.has = function(obj, key) {
    // obj 不能为 null 或者 undefined
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // 工具类方法
  // 共 14 个扩展方法
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  // 如果全局环境中已经使用了 `_` 变量
  // 可以用该方法返回其他变量
  // 继续使用 underscore 中的方法
  // var us = _.noConflict();
  // us.each(..);
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  // 返回传入的参数
  // 看起来好像没什么卵用
  // 其实 _.identity 在 undescore 内大量作为迭代函数出现
  // 能简化很多迭代函数的书写
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  // 传送门
  // var property = function(key) {
  //   return function(obj) {
  //     return obj == null ? void 0 : obj[key];
  //   };
  // };
  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  // 判断一个给定的对象是否有某些键值对
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  // 执行某函数 n 次
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  // 返回一个 [min, max] 范围内的任意整数
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  // 返回当前时间的 "时间戳"
  // 其实并不是时间戳，时间戳还要除以 1000
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  // HTML 实体编码
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  // 轻量级的模板解析函数
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  // 使支持链式调用
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  
  // OOP
  // 如果 `_` 被当做方法（构造函数）调用, 则返回一个被包装过的对象
  // 该对象能使用 underscore 的所有方法
  // 并且支持链式调用

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.

  // 可向 underscore 类库扩展自己的方法
  // obj 参数必须是一个对象
  // 且自己的方法定义在 obj 的属性上
  // 如 obj.myFunc = function() {...}
  // 之后便可使用如下: _.myFunc(..) 或者 OOP _(..).myFunc(..)
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  // 将前面定义的 underscore 方法添加给包装过的对象
  // 即添加到 _.prototype 中
  // 使 underscore 支持面向对象形式的调用
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  // 将 Array 原型链上有的方法都添加到 underscore 中
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  // 添加 concat、join、slice 方法
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  // 一个包装过(OOP)并且链式调用的对象
  // 用 value 方法获取结果
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // 兼容 AMD 规范
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));