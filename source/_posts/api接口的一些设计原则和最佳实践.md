---
title: api接口的一些设计原则和最佳实践
date: 2024-07-21 08:30:59
categories: '技术'
tags: '接口'
cover: https://ilikestudy.cn/oss/2024%2F07%2F21%2F-71ca5085b8f4317e07b01da0aeaa7da2--aaee8f.webp
---


### 1. **单一职责原则（Single Responsibility Principle, SRP）**

- 每个模块或函数应该只负责一件事情。新增接口的职责就是接收新数据并插入数据库，而不是处理自动生成的字段。

### 2. **最小惊讶原则（Principle of Least Astonishment, POLA）**

- 系统应该按照用户或开发者预期的方式工作。自动生成的字段不应该由客户端提供，因为这会违反常规做法，容易导致混淆和错误。

### 3. **安全性原则**

- 不让客户端传递自动生成的字段可以避免潜在的安全问题，例如数据伪造和篡改。确保数据的真实性和完整性。

### 4. **简化设计（KISS - Keep It Simple, Stupid）**

- 保持设计简单，避免不必要的复杂性。只处理需要的字段，减少代码中的冗余和潜在错误。

### 5. **封装（Encapsulation）**

- 封装数据库操作细节，客户端不需要关心数据库是如何生成id和创建时间的，只需要得到结果。这也是一种信息隐藏的方式。



### 实践中的体现

在实际开发中，遵循这些原则可以提高代码的可维护性、安全性和可读性。例如：

- **数据库自动生成字段**：让数据库来生成id、创建时间等字段，可以保证数据的一致性和唯一性，避免手动处理带来的错误。
- **API设计**：在API设计中，明确哪些字段是客户端需要提供的，哪些是由服务器生成的，保证接口的清晰性和可靠性。

> Talk is cheap. Show me the code.                
>
> ​                                                                                                -Linux 创始人 Linus Torvalds

####  从请求体上下文`ctx.user`中只取该接口控制器`AuthController`需要的字段数据，其中创建上下文的中间件`verifyAuth`可以应用在不同的路由/业务接口中。

![image-20240721081744300](https://ilikestudy.cn/oss/image-20240721081744300.png)

![image-20240721081613510](https://ilikestudy.cn/oss/image-20240721081613510.png)

![image-20240721075318479](https://ilikestudy.cn/oss/image-20240721075318479.png)

#### cos的上传需要返回https链接，符合高版本chrome浏览器的安全策略以及最佳做法



![image-20240721082223721](https://ilikestudy.cn/oss/image-20240721082223721.png)



![image-20240721082517590](https://ilikestudy.cn/oss/image-20240721082517590.png)

### 扩展阅读

[代码整洁之道 中文完整版-带书签.pdf](https://github.com/ShawnLeee/the-book/blob/master/clean%20code-%E4%BB%A3%E7%A0%81%E6%95%B4%E6%B4%81%E4%B9%8B%E9%81%93%20%E4%B8%AD%E6%96%87%E5%AE%8C%E6%95%B4%E7%89%88-%E5%B8%A6%E4%B9%A6%E7%AD%BE.pdf) 

[九年总结：优秀程序设计的18大原则](https://cloud.tencent.com/developer/news/366899)