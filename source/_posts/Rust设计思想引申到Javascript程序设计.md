---
title: Rust设计思想引申到JavaScript程序设计
date: 2024-10-21 22:30:00
categories: '技术'
tags: ['Rust', 'JavaScript', '编程思想']
cover: https://ilikestudy.cn/oss/2024/10/22/14-e3520c449470723dd3a29220cf1d81da-70ad48.png
---
Rust是一门以安全性和性能著称的系统编程语言，其设计思想对JavaScript程序设计有着深远的启示。本文将探讨如何将Rust的设计理念应用到JavaScript开发中，以提升代码的可靠性和效率。

## Rust的设计思想

### 1. 所有权与借用 (Ownership and Borrowing)

Rust通过所有权系统管理内存，避免了常见的内存泄漏和数据竞争问题。

#### 在JavaScript中的应用
虽然JavaScript是垃圾回收语言，但我们仍可以通过明确的资源管理和避免全局状态来借鉴Rust的所有权思想。

```javascript
function createResource() {
  let resource = { data: 'important data' };
  return {
    useResource: () => console.log(resource.data),
    dispose: () => { resource = null; }
  };
}

const res = createResource();
res.useResource();
res.dispose();
```

### 2. 不可变性 (Immutability)

Rust鼓励使用不可变数据，减少了状态变化带来的复杂性。

>Shared mutable state is the root of all evil（共享的可变状态是万恶之源）
>-- Pete Hunt

#### 在JavaScript中的应用
在JavaScript中，我们可以使用`const`声明和不可变数据结构来实现类似的效果。

```javascript
const data = Object.freeze({ name: 'John', age: 30 });
data.age = 31; // TypeError: Cannot assign to read only property 'age'
```

此外，我们还可以使用库如Immutable.js来帮助管理不可变数据。(在React前端应用中尤为重要)

```javascript
const { Map } = require('immutable');
const map1 = Map({ a: 1, b: 2, c: 3 });
const map2 = map1.set('b', 50);

console.log(map1.get('b')); // 2
console.log(map2.get('b')); // 50
```
Immutable 实现的原理是 Persistent Data Structure（持久化数据结构）:

用一种数据结构来保存数据
当数据被修改时，会返回一个对象，但是新的对象会尽可能的利用之前的数据结构而不会对内存造成浪费
也就是使用旧数据创建新数据时，要保证旧数据同时可用且不变，同时为了避免 deepCopy把所有节点都复制一遍带来的性能损耗，Immutable 使用了 Structural Sharing（结构共享）

如果对象树中一个节点发生变化，只修改这个节点和受它影响的父节点，其它节点则进行共享

如下图所示：

![](https://ilikestudy.cn/oss/2024/10/22/14-2b4c801a7b40eefcd4ee6767fb984fdf-df0457.gif)
### 3. 类型系统 (Type System)

Rust的强类型系统在编译时捕获错误，提升了代码的安全性。

#### 在JavaScript中的应用
虽然JavaScript是动态类型语言，但我们可以使用TypeScript来引入静态类型检查。

```typescript
function add(a: number, b: number): number {
  return a + b;
}

console.log(add(2, 3)); // 5
console.log(add('2', '3')); // Error: Argument of type 'string' is not assignable to parameter of type 'number'.
```
使用TypeScript可以在开发阶段捕获许多潜在的错误，提升代码的可靠性。



## Rust特点

### 1. 安全性

Rust通过所有权和借用检查在编译时捕获内存安全问题，JavaScript可以通过严格的编码规范和工具（如ESLint）来提升代码安全性。
```javascript
// ESLint配置示例
module.exports = {
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
};
```

### 2. 性能

Rust的零成本抽象和高效内存管理使其性能卓越。JavaScript可以通过避免不必要的对象创建和使用高效的数据结构来提升性能。
```js
// 使用高效的数据结构
const arr = new Array(1000000).fill(0);
console.time('Array');
for (let i = 0; i < arr.length; i++) {
  arr[i] = i;
}
console.timeEnd('Array'); // Array: 3.83203125 ms

const map = new Map();
console.time('Map');
for (let i = 0; i < 1000000; i++) {
  map.set(i, i);
}
console.timeEnd('Map'); // Map: 65.27001953125 ms
```
### 3. 并发性

Rust的所有权系统天然支持安全的并发编程。JavaScript可以通过Web Workers和异步编程模型来实现高效并发。
```js
// 使用Web Workers
const worker = new Worker('worker.js');
worker.postMessage('start');

worker.onmessage = function(event) {
  console.log('Worker said: ', event.data);
};

// worker.js
self.onmessage = function(event) {
  if (event.data === 'start') {
    self.postMessage('Hello from worker');
  }
};
```
通过这种方式，我们可以在不阻塞主线程的情况下执行耗时任务。
### 模式匹配 (Pattern Matching)
Rust中的模式匹配通过`match`表达式提供了一种强大且灵活的控制流机制。并且Rust 编译器清晰地知道 match 中有哪些分支没有被覆盖，这种行为能强制我们处理所有的可能性，有效避免传说中[价值十亿美金的 null 陷阱](https://linux.cn/article-6503-1.html)。

#### 在JavaScript中的应用
虽然JavaScript没有原生的模式匹配语法，但我们可以使用`switch`语句或第三方库（如`match`库）来实现类似的功能。

```javascript
// 使用switch语句实现模式匹配
function match(value) {
  switch (value) {
    case 'a':
      return 'Matched A';
    case 'b':
      return 'Matched B';
    default:
      return 'No Match';
  }
}

console.log(match('a')); // Matched A
console.log(match('c')); // No Match
```
此外，我们还可以使用第三方库来实现更强大的模式匹配功能。例如，match库提供了类似Rust的模式匹配语法。
```js
const { match, when, otherwise } = require('match');

const value = 'a';

const result = match(value)(
  when('a', () => 'Matched A'),
  when('b', () => 'Matched B'),
  otherwise(() => 'No Match')
);

console.log(result); // Matched A
```
Rust编译器的检查也可以通过引入工具函数实现开发时通过Chrome DevTool进行开发时debugger
```js
const DCHECK_ALWAYS_ON = false;

const NOOP = () => {};

export const DCHECK =
  __DEV__ || DCHECK_ALWAYS_ON
    ? (condition, msg = 'DCHECK failed') => {
        if (!condition) {
          console.warn(new Error(msg));
          debugger;
        }
      }
    : NOOP;

export const UNREACHABLE = (msg = 'UNREACHABLE') => DCHECK(false, msg);

```


## 结论

Rust的设计思想为JavaScript开发提供了宝贵的借鉴。通过引入所有权管理、不可变数据和类型检查等理念，我们可以编写出更安全、高效和可维护的JavaScript代码。

## 参考阅读

- [Rust官方文档](https://www.rust-lang.org/learn)
- [Rust语言圣经](https://course.rs/about-book.html)
- [Immutable 详解及 React 中实践](https://zhuanlan.zhihu.com/p/20295971)
- [Web Workers API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API)