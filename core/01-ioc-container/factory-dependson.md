# Using `depends-on`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-dependson.html

## 核心理解

`depends-on` 是 Spring 中控制 bean **初始化顺序**和**销毁顺序**的显式声明机制。一般情况下，Spring 通过构造函数参数或 `<ref/>` 元素就能隐式推断 bean 之间的依赖关系，但有些场景下依赖关系不那么直接（比如一个 bean 的静态初始化块需要另一个 bean 先注册驱动），这时就需要用 `depends-on` 显式声明。

`depends-on` 同时控制两个方向：**初始化时**，被依赖的 bean 先创建，依赖方后创建；**销毁时**，依赖方先销毁，被依赖的 bean 后销毁。这保证了在整个生命周期中依赖关系始终有效——该在的 bean 一定在，不该消失的时候不会消失。

## 关键点

### 销毁顺序：依赖方先销毁

> Dependent beans that define a depends-on relationship with a given bean are destroyed first, prior to the given bean itself being destroyed. Thus, `depends-on` can also control shutdown order.

**中文理解:** 假设 bean B 声明了 `depends-on="beanA"`，那么 B 就是依赖方（dependent bean）。在容器关闭销毁 bean 时，B 会先被销毁，然后 A 才被销毁——与初始化顺序正好相反（初始化时 A 先创建，B 后创建）。

```xml
<bean id="beanOne" class="ExampleBean" depends-on="manager,accountDao">
    <property name="manager" ref="manager" />
</bean>
```

上例中 `beanOne` 依赖 `manager` 和 `accountDao`：初始化时 `manager` 和 `accountDao` 先创建；销毁时 `beanOne` 先销毁。

### `depends-on` 的使用场景

`depends-on` 主要用于**隐式依赖**的场景——即 bean A 没有直接持有 bean B 的引用，但逻辑上需要 B 先初始化。例如：
- 静态注册（如数据库驱动注册）
- 全局状态初始化（如缓存预热、定时任务触发）
- 外部资源的启动依赖

如果有直接的 bean 引用关系（通过 `<ref/>` 或构造器注入），Spring 会自动推断依赖顺序，不需要显式写 `depends-on`。

## 句子解析

### 原文: "Dependent beans that define a depends-on relationship with a given bean are destroyed first, prior to the given bean itself being destroyed."

- **翻译:** 与某个给定 bean 定义了 depends-on 关系的依赖方 bean 会先被销毁，在被依赖的 bean 自身被销毁之前。
- **解析:**
  - **主语识别:** 句子看似很长，但主干很清晰——`Dependent beans ... are destroyed first`。中间 `that define a depends-on relationship with a given bean` 整个是定语从句，修饰 `Dependent beans`。
  - **define ... with ...:** "与……定义……关系"，这里的搭配是 `define a relationship with someone`，即"与某对象建立/定义关系"。
  - **prior to:** = before，介词短语，"在……之前"。技术文档中 `prior to` 比 `before` 更正式，更常见于书面语。
  - **the given bean itself being destroyed:** 这里的 `itself` 起强调作用——就是"被依赖的那个 bean 自身"，强调对比"依赖方 vs 被依赖方"。`being destroyed` 是动名词短语作 `prior to` 的宾语。
  - **Thus** 引出结论：`depends-on` 不仅控制启动顺序（原文前半部分），**因此也可以**控制关闭顺序。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| depends-on | n. | Spring XML 属性，显式声明 bean 间的依赖关系 |
| prior to | prep. | 在……之前（比 before 更正式的书面表达） |
| dependent bean | n. | 依赖方 bean（声明 depends-on 的那个 bean） |
| thus | adv. | 因此、从而（引出逻辑结论） |
| shutdown order | n. | 关闭/销毁顺序，容器停止时 bean 的销毁次序 |
