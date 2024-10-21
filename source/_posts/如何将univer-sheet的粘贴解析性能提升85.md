---
title: 如何将 univer-sheet 的粘贴解析性能提升 85%
date: 2024-07-11 21:05:59
categories: '技术'
tags: '性能优化'
cover: https://ilikestudy.cn/oss/2024%2F07%2F11%2F-70d89a15795f5c1ce77822529c0fd259--81c8e1.webp
---
> **注:** 本文基于 [univer-sheet](https://github.com/dream-num/univer) 源码，对其复制粘贴解析逻辑进行核心优化解读。

## 效果图：

- **变更前:**
  
  ![](https://ilikestudy.cn/oss/2024%2F07%2F11%2F-bcfe20cc2b851df896bc62c5c98a63b4--236cb6.webp)

- **变更后:**

  ![](https://ilikestudy.cn/oss/2024%2F07%2F11%2F-d1eb6c86878a076da8d0256fa2106115--4e8ed1.webp)

由上图可以看到在提交变更之前，粘贴解析长任务耗时 27.5 秒并且内存没有得到回收，出现了内存泄漏问题。在变更之后，耗时仅需要 2.68 秒，对应的内存也得到释放。

> **注:** 内存泄漏问题也可以通过堆快照定位。

PR 请求可以 [点此查看](https://github.com/dream-num/univer/pull/2631)。

## 耗时原因分析:

![](https://ilikestudy.cn/oss/2024%2F07%2F11%2F-f3fb909ef8b68491b23d88017135f919--bc1c2a.webp)

通过开发者工具结合源码分析，我们能发现 `windows.getComputedStyle().getPropertyValue` 出现了大量耗时的情况。

### 为什么 `getComputedStyle()` 和 `getPropertyValue()` 方法会大量耗时造成页面卡死？

- **强制重排（reflow）**: `getComputedStyle()` 方法会导致浏览器计算元素的所有样式，这可能需要重新计算整个文档的布局。这是因为浏览器需要确保样式是最新的，并且在一些情况下可能会重新布局页面。这种重排操作是非常耗时的，特别是当页面上有大量的元素时。

- **同步操作**: `getComputedStyle()` 方法是同步的，这意味着浏览器必须在返回结果之前完成所有的计算。这会阻塞主线程，导致页面的其他操作变慢或卡顿。

- **布局树的生成**: 浏览器需要生成和更新布局树（layout tree），以便计算每个元素的最终样式。这些操作通常非常复杂，涉及大量的计算和内存操作。

- **复杂的 CSS 规则**: 如果页面中有大量复杂的 CSS 规则，或者样式表层级嵌套较深，浏览器计算每个元素的最终样式时会更加复杂和耗时。

## 解决方案

DOM 树是树结构，我们可以采用广度优先遍历的方式，将上层样式传递到下层节点模拟计算样式，来避免使用 `getComputedStyle`。节点样式是通过样式选择器的优先级，来确定最终的样式。了解这两个基础逻辑后，我们就可以开始编码了。

### 解析 style 标签，将标签的样式存储在 Map 中

```typescript
const style = this._dom.querySelector('style');
if (style) {
    const shadowHost = document.createElement('div');
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    document.body.appendChild(shadowHost);
    shadowRoot.appendChild(style);
    for (const rule of style.sheet!.cssRules) {
        const cssRule = rule as CSSStyleRule;
        const selectorText = cssRule.selectorText;
        const style = cssRule.style;
        this._styleMap.set(selectorText, style);
    }
    style.remove();
    shadowHost.remove();
}
```

> **注:** style 标签只有挂载到 DOM 上，才会实现 [`CSSStyleSheet`](https://developer.mozilla.org/zh-CN/docs/Web/API/CSSStyleSheet) 接口。而使用 [shadow DOM](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_components/Using_shadow_DOM) 的目的是为了样式隔离，避免造成全局样式污染。

### 获取样式函数

```typescript
private _getStyle(node: HTMLElement, styleStr: string) {
    const recordStyle: Record<string, string> = turnToStyleObject(styleStr);
    const style = node.style;
    // retrieve multiple sources for a node and compile them into a cohesive new style string. eg.`background`、`background-color`
    ···
    ···
    // style represents inline styles with the highest priority, followed by selectorText which corresponds to stylesheet rules, and recordStyle pertains to inherited styles with the lowest priority.
        value =
            style.getPropertyValue(key) ||
            this._getStyleBySelectorText(`#${node.id}`, key) ||
            value ||
            this._getStyleBySelectorText(node.nodeName.toLowerCase(), key) ||
            recordStyle[key] ||
            '';
        value && (newStyleStr += `${key}:${value};`);
    }
    return newStyleStr;
}
```

> 详细函数实现请翻阅 `packages/sheets-ui/src/services/clipboard/html-to-usm/converter.ts`。函数实现时需要注意在各类 html 中，例如 `background`、`background-color` 在表格中均可代表背景颜色，应该补充边界处理。

## 内存泄漏问题

参考 StackOverflow 上的 [这篇帖子](https://stackoverflow.com/questions/56451731/dom-parser-chrome-extension-memory-leak)。

```diff
export default function parseToDom(rawHtml: string) {
-	const parser = new DOMParser();
- 	const html = `<x-univer id="univer-root">${rawHtml}</x-univer>`;
- 	const doc = parser.parseFromString(html, 'text/html');

- 	return doc.querySelector('#univer-root');
+ 	const template = document.createElement('body');
+ 	template.innerHTML = rawHtml;
+	return template;
}
```

在解决内存泄漏时，剔除了 DOMParser API 的使用，并去除了将 html 字符串挂载到 DOM 上的行为。在粘贴行为结束后的调用dispose函数回收解析过程中使用的 Map 和临时变量。经过这样处理，不仅解决了内存泄漏的问题，还节约了挂载构建 DOM 树的时间。

## 参考阅读

- [Univer 架构](https://univer.ai/zh-CN/guides/sheet/architecture/univer)
- [Chromium 渲染流水线——字节码到像素的一生](https://zhuanlan.zhihu.com/p/574069391)