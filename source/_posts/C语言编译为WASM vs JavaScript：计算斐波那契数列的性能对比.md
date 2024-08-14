---
title: C语言编译为WASM vs JavaScript：计算斐波那契数列的性能对比
date: 2024-07-24 08:30:59
categories: '技术'
tags: '性能'
cover: https://ilikestudy.cn/oss/2024%2F07%2F24%2F20-9a79f14ca3e3bc00713ed76546f05d7c-26ac8c.webp
---

> 在现代Web开发中，性能优化是一个重要的议题。WebAssembly（WASM）作为一种新兴的技术，为Web应用带来了显著的性能提升。**在需要高性能计算的Web应用程序，例如音视频、协作冲突中起着非常重要的作用。**本文将探讨C语言编译为WASM在计算斐波那契数列时相较于JavaScript的性能优势。

![](https://ilikestudy.cn/oss/2024%2F07%2F26%2F-02c46aee9974e0cb789073d42c0abf9a--eca445.png)

## 什么是WebAssembly？

WebAssembly（WASM）是一种新的二进制格式，可以在现代Web浏览器中高效地运行。这种格式可以将C、C++、Rust等编译型语言编译为高效的字节码，然后在浏览器中执行，从而提升了计算性能。



## 斐波那契数列简介

斐波那契数列是一种经典的数列，其中每一个数都是前两个数的和。即：

- F(0) = 0
- F(1) = 1
- F(n) = F(n-1) + F(n-2)  (n ≥ 2)

计算斐波那契数列常常用来测试编程语言和计算平台的性能，因为它具有简单而计算量大的特性。

## 使用JavaScript计算斐波那契数列

在JavaScript中，我们可以通过递归或者迭代的方法来计算斐波那契数列。以下是一个使用递归方法的JavaScript代码示例：

```javascript
function _fibonacciJS(n) {
    if (n == 1 || n == 2) {
        return 1;
    }
    return _fibonacciJS(n - 1) + _fibonacciJS(n - 2);
}
```

## 使用C语言编译为WASM计算斐波那契数列
C语言是一种高效的编译型语言，编译为WASM后，其性能相较于JavaScript会有显著提升。以下是一个使用C语言计算斐波那契数列的示例代码：
```c
int fibonacci(int n)
{
    if (n == 1 || n == 2)
    {
        return 1;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}
```
然后，使用 [emcc](https://emscripten.org/docs/tools_reference/emcc.html) 编译器将其编译为Wasm：
```shell
emcc -O3 -o fibonacci.js -s EXPORTED_FUNCTIONS='["_fibonacci"]' fibonacci.c
```
## 在HTML网页中进行测试
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>fjb Wasm</title>
</head>

<body>
    <p>num: <input type="number" id="num"></p>
    <p>JS: <span id="JSresultDom"></span></p>
    <p>Wasm: <span id="WasmresultDom"></span></p>
    <script src="fibonacci.js"></script>
    <script>
        function _fibonacciJS(n) {
            if (n == 1 || n == 2) {
                return 1;
            }
            return _fibonacciJS(n - 1) + _fibonacciJS(n - 2);
        }
        num.onchange = () => {

            const jsStart = performance.now();
            const jsResult = _fibonacciJS(num.value);

            const jsEnd = performance.now();
            JSresultDom.textContent = ` (JS: ${(jsEnd - jsStart).toFixed(2)}ms)   jsResult: ${jsResult}`;


            const wasmStart = performance.now();
            const wasmResult = Module._fibonacci(num.value);
            const wasmEnd = performance.now();
            WasmresultDom.textContent = ` (Wasm: ${(wasmEnd - wasmStart).toFixed(2)}ms)   wasmResult: ${wasmResult}`;
        }
    </script>
</body>

</html>
```
性能对比：

![](https://ilikestudy.cn/oss/2024%2F07%2F24%2F20-0734f478e0ecdabf2d470a841208277d-853ba9.webp)

## 源码参考
- [fib-wasm](https://github.com/AquaHydro/code-examples/tree/main/fib-wasm)
