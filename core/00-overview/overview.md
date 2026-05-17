# Spring Framework Overview

> **来源:** https://docs.spring.io/spring-framework/reference/overview.html

## 核心理解

Spring 是一个用于创建 Java 企业应用的**一站式框架**，核心是一个 IoC 容器（配置模型 + 依赖注入机制），在此基础上按模块化方式提供消息、事务/持久化、Web 等不同架构层面的支持。Spring 6.0 起最低要求 Java 17，并采用 Jakarta EE 9+ 命名空间（`jakarta.*` 替代 `javax.*`）。

"Spring" 这个词在不同语境下含义不同：狭义指 Spring Framework 本身（一切的基础），广义指整个 Spring 家族（Spring Boot、Spring Security、Spring Data、Spring Cloud 等）。本文档聚焦于 Spring Framework 本身。

Spring 的设计哲学强调**选择权、兼容性和 API 质量**——延迟设计决策、拥抱不同视角、严格控制 breaking changes、精心打磨 API。这种长期主义思维让 Spring 能从 2003 年存活至今并持续演进。

## 关键点

### Spring 的定义与能力

> Spring makes it easy to create Java enterprise applications. It provides everything you need to embrace the Java language in an enterprise environment, with support for Groovy and Kotlin as alternative languages on the JVM, and with the flexibility to create many kinds of architectures depending on an application's needs.

Spring 不是一个只能做一件事的库，而是一个**构建企业应用的通用平台**。它最大的特点是"一切皆可选"——你可以只用依赖注入，也可以全套上 MVC + 数据访问 + 消息。除 Java 外还支持 Groovy 和 Kotlin。

```java
// Spring 对多种部署方式的支持是透明的前两个例子来自原文描述
// 传统 war 部署到应用服务器
// java -jar 独立运行，嵌入式服务器
// 批处理/集成任务，根本不需要服务器
```

### 模块体系

> The Spring Framework is divided into modules. Applications can choose which modules they need. At the heart are the modules of the core container, including a configuration model and a dependency injection mechanism. Beyond that, the Spring Framework provides foundational support for different application architectures, including messaging, transactional data and persistence, and web. It also includes the Servlet-based Spring MVC web framework and, in parallel, the Spring WebFlux reactive web framework.

模块化的好处是**按需取用**。核心容器（core container）是整个框架的心脏，其他模块都是可选的。Web 层给了两套方案：传统 Servlet 的 Spring MVC 和响应式的 Spring WebFlux，可以在同一项目中并存。

### Java Module System 兼容

> Spring Framework's jars allow for deployment to the module path (Java Module System). For use in module-enabled applications, the Spring Framework jars come with Automatic-Module-Name manifest entries which define stable language-level module names (spring.core, spring.context, etc.) independent from jar artifact names.

关键区别：artifact 名用连字符（`spring-core`），模块名用点号（`spring.core`）。这些 jar 也能正常在 classpath 下工作，不强制要求模块路径。

### 历史背景

> Spring came into being in 2003 as a response to the complexity of the early J2EE specifications. While some consider Java EE and its modern-day successor Jakarta EE to be in competition with Spring, they are in fact complementary.

Spring 诞生的动机是**对抗 EJB 时代的复杂性**。但它不是要取代 Java EE，而是有选择地集成以下规范：Servlet、WebSocket、Concurrency Utilities、JSON Binding、Bean Validation、JPA、JMS，以及事务协调的 JTA/JCA。

Spring 6.0 升级到 Jakarta EE 9+ 命名空间（`jakarta.*`），兼容 Tomcat 10.1、Jetty 11 和 Hibernate ORM 6.1。

### 设计哲学五原则

> Provide choice at every level. Accommodate diverse perspectives. Maintain strong backward compatibility. Care about API design. Set high standards for code quality.

1. **提供选择权**：例如可以通过配置切换持久化提供者，无需改代码
2. **拥抱多样性**：Spring 不武断（not opinionated），支持不同视角和需求
3. **保持向后兼容**：版本间 carefully managed，只做少量 breaking changes
4. **注重 API 设计**：大量时间投入 API 的直觉性和长期可维护性
5. **高代码质量标准**：javadoc 有意义且准确，包之间无循环依赖

### 入门建议

> If you are just getting started with Spring, you may want to begin using the Spring Framework by creating a Spring Boot-based application. Spring Boot provides a quick (and opinionated) way to create a production-ready Spring-based application.

官方推荐新人从 [Spring Boot](https://start.spring.io) 入手，因为它基于 Spring Framework 但更**快速、约定优于配置**（convention over configuration）。同时也推荐了解 Spring portfolio 中的其他项目。

## 句子解析

### 原文: "Spring makes it easy to create Java enterprise applications. It provides everything you need to embrace the Java language in an enterprise environment, with support for Groovy and Kotlin as alternative languages on the JVM, and with the flexibility to create many kinds of architectures depending on an application's needs."

- **翻译:** Spring 让创建 Java 企业应用变得简单。它提供了在企業环境中充分使用 Java 语言所需的一切，同时支持 Groovy 和 Kotlin 作为 JVM 上的替代语言，并且具备根据应用需求创建多种架构的灵活性。
- **解析:** 核心句型是 "Spring makes it easy to..."，这是一个很常见的句式，`it` 是形式宾语，真正的宾语是 `to create Java enterprise applications`。"embrace" 在这里不是"拥抱"，而是"充分接纳并使用"的意思。"with the flexibility to..." 是介词短语做伴随状语，修饰前面整个主句。

### 原文: "Spring came into being in 2003 as a response to the complexity of the early J2EE specifications. While some consider Java EE and its modern-day successor Jakarta EE to be in competition with Spring, they are in fact complementary."

- **翻译:** Spring 于 2003 年诞生，是对早期 J2EE 规范复杂性的一种回应。虽然有些人认为 Java EE 及其现代继任者 Jakarta EE 与 Spring 是竞争关系，但它们实际上是互补的。
- **解析:** "came into being" 是比 "was created" 更正式的书面表达。"as a response to" 表示"作为对……的回应"。"consider X to be Y" 是固定搭配，文中用了被动 "some consider X to be in competition with Spring"，这里的 "successor"（继任者）是阅读中常见的高阶词汇。

### 原文: "Spring lets you defer design decisions as late as possible. For example, you can switch persistence providers through configuration without changing your code."

- **翻译:** Spring 让你尽可能推迟设计决策。例如，你可以通过配置切换持久化提供者，而无需更改代码。
- **解析:** "defer" 意为"推迟、延迟"，比 "delay" 更正式，常见于技术文档。"as late as possible" 是常见的程度表达。"without changing your code" 是介词短语，强调配置驱动的好处——对代码零侵入。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| enterprise application | n. | 企业级应用，指大型组织内部使用的复杂软件系统 |
| dependency injection | n. | 依赖注入，将对象依赖关系交给容器管理的设计模式 |
| core container | n. | 核心容器，Spring IoC 容器的主体部分，管理 bean 的创建与装配 |
| module path | n. | 模块路径，Java 9+ 模块系统（JPMS）中的概念，区别于传统 classpath |
| backward compatibility | n. | 向后兼容性，新版本保持对旧版本的兼容 |
| persistence provider | n. | 持久化提供者，实现 JPA 规范的具体框架（如 Hibernate） |
| opinionated | adj. | 有主见的、约定性的，指框架对做事方式有自己的预设 |
| convention over configuration | n. | 约定优于配置，减少显式配置的设计理念 |
| breaking change | n. | 破坏性变更，不兼容旧版本的 API 或行为修改 |
| Jakarta EE | n. | Jakarta 企业版，Java EE 的继任者，由 Eclipse 基金会管理 |
| Servlet container | n. | Servlet 容器，管理 Servlet 生命周期的运行时（如 Tomcat） |
| reactive | adj. | 响应式的，基于异步非阻塞的编程模型 |
| artifact | n. | 制品，Maven/Gradle 中模块的构建产物（jar 文件） |
| manifest entry | n. | 清单条目，jar 包 META-INF/MANIFEST.MF 文件中的键值对配置 |
