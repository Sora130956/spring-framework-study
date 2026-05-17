# Introduction to the Spring IoC Container and Beans

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/introduction.html

## 核心理解

**IoC（控制反转）** 是一个原则，**DI（依赖注入）** 是 IoC 的具体实现方式。在 Spring 中，对象不再自己控制依赖的创建或查找，而是通过构造器参数、工厂方法参数或 setter 属性来**声明**它需要什么，由 IoC 容器在创建 bean 时**注入**这些依赖。这个过程和 bean 自己通过 `new` 或 Service Locator 模式获取依赖的做法正好相反，故名"反转"。

Spring 提供了两个层次的 IoC 容器：**`BeanFactory`** 提供最基本的配置框架和 DI 能力；**`ApplicationContext`** 是 `BeanFactory` 的完整超集，额外添加了 AOP 集成、国际化消息、事件发布、Web 应用上下文等企业级功能。实际开发中几乎只用 `ApplicationContext`。

在 Spring 的世界里，**bean 就是被 IoC 容器管理的对象**——由容器负责实例化、装配和管理其完整生命周期。除此之外，它和普通 Java 对象没有本质区别。bean 以及 bean 之间的依赖关系，都反映在容器的**配置元数据**中。

## 关键点

### IoC 与 DI：原则与实现

> Dependency injection (DI) is a specialized form of IoC, whereby objects define their dependencies (that is, the other objects they work with) only through constructor arguments, arguments to a factory method, or properties that are set on the object instance after it is constructed or returned from a factory method. The IoC container then injects those dependencies when it creates the bean.

DI 是 IoC 的**特化形式**（specialized form）。对象声明依赖的三种方式：

```java
// 1. 构造器注入
public class MyService {
    private final MyRepository repo;
    public MyService(MyRepository repo) {  // 通过构造器声明依赖
        this.repo = repo;
    }
}

// 2. setter 注入
public class MyService {
    private MyRepository repo;
    public void setRepo(MyRepository repo) {  // 通过属性声明依赖
        this.repo = repo;
    }
}

// 3. 工厂方法注入（通常配合 @Bean）
@Bean
public MyService myService(MyRepository repo) {  // 参数自动注入
    return new MyService(repo);
}
```

### 控制的正向与反向

> This process is fundamentally the inverse (hence the name, Inversion of Control) of the bean itself controlling the instantiation or location of its dependencies by using direct construction of classes or a mechanism such as the Service Locator pattern.

"反"在哪里？对比两种方式：

```java
// 传统的"正向控制"：对象自己找依赖
public class MyService {
    private final MyRepository repo;
    public MyService() {
        this.repo = new MyRepositoryImpl();  // 自己控制创建
        // 或者
        this.repo = ServiceLocator.find(MyRepository.class);  // 自己控制查找
    }
}

// IoC/DI："反向控制"：容器给你
public class MyService {
    private final MyRepository repo;
    public MyService(MyRepository repo) {  // 被动接收
        this.repo = repo;
    }
}
```

### BeanFactory vs ApplicationContext

> The BeanFactory provides the configuration framework and basic functionality, and the ApplicationContext adds more enterprise-specific functionality. The ApplicationContext is a complete superset of the BeanFactory.

`ApplicationContext` 在 `BeanFactory` 基础上增加了：

| 功能 | 说明 |
|------|------|
| AOP 集成 | 更便捷的切面集成 |
| 消息资源处理 | 国际化（i18n）支持 |
| 事件发布 | 应用层事件机制 |
| Web 应用上下文 | `WebApplicationContext` |

实际开发中 `ApplicationContext` 是唯一选择，`BeanFactory` 仅在对内存极端敏感的场景下有存在价值。

### Bean 的定义

> In Spring, the objects that form the backbone of your application and that are managed by the Spring IoC container are called beans. A bean is an object that is instantiated, assembled, and managed by a Spring IoC container. Otherwise, a bean is simply one of many objects in your application.

Bean 的**三个特征**：
1. **由容器实例化** — `new` 不是你的代码干的
2. **由容器装配** — 依赖注入由容器完成
3. **由容器管理** — 生命周期（包括 `@PostConstruct`、`@PreDestroy` 回调）由容器控制

不是所有对象都是 bean。Bean 只是你应用中众多对象中被 IoC 容器管理的那个子集。

### 配置元数据

> Beans, and the dependencies among them, are reflected in the configuration metadata used by a container.

配置元数据告诉容器：有哪些 bean、它们的依赖关系是什么。三种表达方式：

```java
// 1. XML（传统方式，现已少用）
// <bean id="myService" class="com.example.MyService">
//     <constructor-arg ref="myRepository"/>
// </bean>

// 2. 注解（主流方式）
@Configuration
public class AppConfig {
    @Bean
    public MyService myService(MyRepository repo) {
        return new MyService(repo);
    }
}

// 3. 组件扫描 + 自动装配（最简洁）
@Component
public class MyService {
    @Autowired
    public MyService(MyRepository repo) { ... }
}
```

## 句子解析

### 原文: "Dependency injection (DI) is a specialized form of IoC, whereby objects define their dependencies only through constructor arguments, arguments to a factory method, or properties that are set on the object instance after it is constructed or returned from a factory method."

- **翻译:** 依赖注入是 IoC 的一种特化形式，在这种模式下，对象仅通过构造器参数、工厂方法参数、或在对象实例被构造出来或从工厂方法返回之后设置到实例上的属性来定义其依赖。
- **解析:** `whereby` 是关系副词，相当于 `by which`，引导定语从句解释 DI 的具体机制。"properties that are set on the object instance after it is constructed or returned from a factory method" 是一个长定语从句，`that` 引导的从句修饰 `properties`，内部包含 `after it is constructed or returned` 的时间状语。

### 原文: "This process is fundamentally the inverse of the bean itself controlling the instantiation or location of its dependencies by using direct construction of classes or a mechanism such as the Service Locator pattern."

- **翻译:** 这个过程从根本上来说，与 bean 自己通过直接构造类或使用 Service Locator 模式等机制来控制其依赖的实例化或查找的做法正好相反。
- **解析:** "the inverse of" 后面跟了一个很长的名词短语 `the bean itself controlling...`，整体是动名词复合结构做 `of` 的宾语。`controlling` 后接两个宾语 `instantiation`（实例化）和 `location`（查找），后面的 `by using` 修饰 `controlling`，表示"通过……方式来控制"。

### 原文: "In Spring, the objects that form the backbone of your application and that are managed by the Spring IoC container are called beans."

- **翻译:** 在 Spring 中，构成应用程序骨干并被 Spring IoC 容器管理的对象称为 bean。
- **解析:** 两个并列的 `that` 定语从句（`that form...` 和 `that are managed...`）同时修饰主语 `the objects`，用 `and` 连接。`backbone` 字面意思是"脊骨"，这里引申为"核心/骨干"。这个句型清晰给出了 bean 的双重定义：应用程序的核心对象 + 被 IoC 容器管理。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| Inversion of Control (IoC) | n. | 控制反转，将对象依赖的控制权从对象自身转移给容器的设计原则 |
| Dependency Injection (DI) | n. | 依赖注入，IoC 的具体实现方式，通过构造器/setter/工厂方法注入依赖 |
| Service Locator | n. | 服务定位器模式，对象通过中心注册表查找依赖，是 DI 的替代方案 |
| Bean | n. | Spring 中被 IoC 容器管理的对象，由容器负责实例化、装配和生命周期 |
| BeanFactory | n. | Spring IoC 容器的最基础接口，提供配置框架和基本的 DI 功能 |
| ApplicationContext | n. | BeanFactory 的子接口，增加 AOP、i18n、事件发布等企业级功能 |
| configuration metadata | n. | 配置元数据，描述 bean 定义及依赖关系的信息（XML/注解/Java Config） |
| superset | n. | 超集，ApplicationContext 是 BeanFactory 的完整超集，包含其全部功能 |
| instantiate | v. | 实例化，创建类的具体对象实例 |
| assemble | v. | 装配，将 bean 与它的依赖组合在一起 |
| publish-subscribe (event) | n. | 发布-订阅模式，ApplicationContext 提供的事件机制 |
| internationalization (i18n) | n. | 国际化，使应用支持多语言的能力 |
| factory method | n. | 工厂方法，返回对象实例的静态或实例方法，可作为 bean 定义的方式 |
