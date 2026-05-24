# Container Overview

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/basics.html

## 核心理解

Spring IoC 容器由 `ApplicationContext` 接口代表，它的职责是**实例化、配置、装配** bean。容器本身不关心配置元数据以什么格式存在（注解、Java Config、XML、Groovy），二者完全解耦。在现代开发中，注解驱动配置和 Java-based 配置是主流选择。

配置元数据本质上是一组 **bean definition**，每一组对应应用中某个具体的对象。通常配置的是 service 层、repository/DAO 层、controller 层和基础设施对象（如 `EntityManagerFactory`、JMS 队列），**不配置**细粒度的领域对象（那是 repository 和业务逻辑的职责）。

最重要的一条实践原则：**应用代码不应调用 `getBean()`，也不应依赖 Spring API**。通过 Spring 与 Web 框架的集成（如 `@Autowired`），依赖注入对应用代码完全透明。

## 关键点

### ApplicationContext 的实现选择

> Several implementations of the ApplicationContext interface are part of core Spring. In stand-alone applications, it is common to create an instance of AnnotationConfigApplicationContext or ClassPathXmlApplicationContext.

不同场景有不同的实现：

```java
// 独立应用 — 注解配置（最常用）
ApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);

// 独立应用 — XML 配置（传统方式）
ApplicationContext ctx =
    new ClassPathXmlApplicationContext("services.xml", "daos.xml");

// Java + XML 混合（最灵活）
GenericApplicationContext ctx = new GenericApplicationContext();
new XmlBeanDefinitionReader(ctx).loadBeanDefinitions("services.xml");
new AnnotationConfigReader(ctx).register(AppConfig.class);  // 伪代码示例
ctx.refresh();
```

大多数场景（尤其是 Spring Boot）不需要手动创建容器——容器由框架隐式引导启动。

### 配置元数据的三种形式

> The Spring IoC container itself is totally decoupled from the format in which this configuration metadata is actually written.

```java
// 1. 注解驱动 — 在组件类上标注
@Component
public class PetStoreService {
    @Autowired
    private AccountDao accountDao;
}

// 2. Java-based — 独立的 @Configuration 类
@Configuration
public class AppConfig {
    @Bean
    public PetStoreService petStore(AccountDao accountDao, ItemDao itemDao) {
        return new PetStoreServiceImpl(accountDao, itemDao);
    }
}

// 3. XML（了解即可，现代项目已很少使用）
// <bean id="petStore" class="com.example.PetStoreServiceImpl">
//     <property name="accountDao" ref="accountDao"/>
// </bean>
```

### 哪些对象应该定义成 Bean？

> Typically, one does not configure fine-grained domain objects in the container, because it is usually the responsibility of repositories and business logic to create and load domain objects.

Bean 的**适用范围**：

| 应该是 Bean | 不应该是 Bean |
|-------------|---------------|
| Service 层对象 | 领域对象（如 `User`、`Order`） |
| Repository / DAO | DTO / VO |
| Controller / RestController | 值对象、枚举 |
| 基础设施（`DataSource`、`EntityManagerFactory`） | 临时计算结果 |

领域对象由 repository 或业务逻辑负责创建，生命周期很短，不需要交给容器管理。

### XML 组合配置

> It can be useful to have bean definitions span multiple XML files. Often, each individual XML configuration file represents a logical layer or module in your architecture.

按模块/层拆分 XML 配置是经典实践，有两种加载方式：

```xml
<!-- 方式一：直接在一个文件中 import -->
<beans>
    <import resource="services.xml"/>
    <import resource="resources/messageSource.xml"/>
    <bean id="bean1" class="..."/>
</beans>

<!-- 方式二：构造器传入多个文件路径 -->
<!-- new ClassPathXmlApplicationContext("services.xml", "daos.xml"); -->
```

关于 import 路径的重要规则：
- 路径相对于**当前正在 import 的文件**的位置
- 开头的 `/` 会被忽略（相对路径下不建议用）
- **不推荐**用 `../` 引用父目录的文件（产生外部依赖）
- 推荐用全限定资源路径：`file:C:/config/services.xml` 或 `classpath:/config/services.xml`
- 绝对路径可以用 `${...}` 占位符来间接指定

### 使用容器：getBean 的正确态度

> The ApplicationContext interface has a few other methods for retrieving beans, but, ideally, your application code should never use them. Indeed, your application code should have no calls to the getBean() method at all and thus have no dependency on Spring APIs at all.

```java
// ❌ 反模式：手动拉取 bean
ApplicationContext ctx = ...;
PetStoreService service = ctx.getBean("petStore", PetStoreService.class);
service.doSomething();

// ✅ 正确做法：让容器注入
@Component
public class MyController {
    @Autowired
    private PetStoreService service;  // 不需要知道 Spring API 的存在
}
```

这是 Spring 的核心理念：你的代码不应感知到容器的存在。

### GenericApplicationContext + Reader 委托

> You can mix and match such reader delegates on the same ApplicationContext, reading bean definitions from diverse configuration sources.

这是最灵活的方式——一个 `ApplicationContext` 可以同时从 XML、注解、Groovy 多种来源读取 bean 定义：

```java
GenericApplicationContext ctx = new GenericApplicationContext();

// 从 XML 读取
new XmlBeanDefinitionReader(ctx).loadBeanDefinitions("services.xml");
// 从 Groovy 读取
new GroovyBeanDefinitionReader(ctx).loadBeanDefinitions("daos.groovy");

ctx.refresh();  // 不要忘了这步！
```

`refresh()` 是关键的触发点——在此之前只是加载定义，`refresh()` 才真正实例化和装配所有 bean。

## 句子解析

### 原文: "The container gets its instructions on the components to instantiate, configure, and assemble by reading configuration metadata. The configuration metadata can be represented as annotated component classes, configuration classes with factory methods, or external XML files or Groovy scripts."

- **翻译:** 容器通过读取配置元数据来获取关于要实例化、配置和装配哪些组件的指令。配置元数据可以表现为带注解的组件类、带工厂方法的配置类，或者外部的 XML 文件或 Groovy 脚本。
- **解析:** "gets its instructions on..." 中的 `on` 搭配 `instructions`，表示"关于……的指令"。"components to instantiate, configure, and assemble" 是不定式短语做后置定语修饰 `components`。"be represented as" 意为"以……形式表现"，`as` 后面跟了四种形式。"with factory methods" 是介词短语修饰 "configuration classes"。

### 原文: "Typically, one does not configure fine-grained domain objects in the container, because it is usually the responsibility of repositories and business logic to create and load domain objects."

- **翻译:** 通常，我们不会在容器中配置细粒度的领域对象，因为创建和加载领域对象一般是 repository 和业务逻辑的职责。
- **解析:** `one` 是泛指代词，相当于"人们/我们"。"fine-grained" 字面意思是"细粒度的"，在 DDD/Spring 语境中指 `User`、`Order`、`Product` 这类具体业务实体。"it is the responsibility of X to Y" 是一个很地道的表达：Y 这件事是 X 的职责。

### 原文: "Indeed, your application code should have no calls to the getBean() method at all and thus have no dependency on Spring APIs at all."

- **翻译:** 事实上，你的应用代码应该完全不调用 `getBean()` 方法，从而完全不依赖 Spring API。
- **解析:** `indeed` 在此强调并递进前文。"have no calls to..." 表示"没有对……的调用"。"and thus" 表示"因此"，表达因果关系。"at all" 用于否定句结尾加强语气，两个 `at all` 形成排比，强化了一个重要原则。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| configuration metadata | n. | 配置元数据，告诉容器要创建哪些 bean 以及它们之间如何装配的信息 |
| bean definition | n. | bean 定义，对应容器中一个 bean 实例的配置描述 |
| fine-grained | adj. | 细粒度的，指小的、具体的对象（如领域实体），相对的是 coarse-grained（粗粒度的） |
| domain object | n. | 领域对象，代表业务概念的实体类，如 Customer、Order |
| infrastructure object | n. | 基础设施对象，如 DataSource、EntityManagerFactory 等技术性组件 |
| bootstrap | v. | 引导启动，容器的初始化过程 |
| decoupled | adj. | 解耦的，容器与配置格式之间没有耦合 |
| delegate | n. | 委托，如 reader delegate 将读取任务委托给具体的 BeanDefinitionReader |
| leading slash | n. | 开头的斜杠，如 `/services.xml` 中的 `/`，在相对路径中会被忽略 |
| fully qualified | adj. | 全限定的，如全限定类名包含完整包路径 |
| placeholder | n. | 占位符，如 `${...}` 格式，在运行时被替换为实际值 |
| client component | n. | 消费端组件，指依赖其他 bean 的组件 |
| collaborating objects | n. | 协作对象，一个 bean 依赖的其他 bean |
