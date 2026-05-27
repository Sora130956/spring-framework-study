# Annotation-based Container Configuration

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config.html

## 核心理解

Spring 基于注解的配置本质上是通过 **BeanPostProcessor + 注解** 的组合实现的。注解本身只是"标记"，真正干活的是各种 BeanPostProcessor——它们在 Bean 初始化前后扫描注解，执行对应的逻辑（如 `AutowiredAnnotationBeanPostProcessor` 处理 `@Autowired`、`CommonAnnotationBeanPostProcessor` 处理 `@PostConstruct` / `@PreDestroy`）。

因此，要让注解生效，必须确保对应的 BeanPostProcessor 已经注册到容器中。在 `AnnotationConfigApplicationContext` 中，这些后置处理器已经**隐式注册**好了；在传统的 XML 配置项目中，需要加入 `<context:annotation-config/>` 来手动激活它们。

一个重要的配合关系是：**注解注入先于外部配置注入**（bean properties），所以混合使用 XML 和注解时，XML 中配置的属性值会**覆盖**注解注入的值。

## 关键点

### 基于注解的 Bean 配置是怎么工作的

> Spring uses **BeanPostProcessors** in conjunction with **annotations** to make the core IOC container aware of specific annotations.

注解只是标记，真正做事的是 BeanPostProcessor。工作流程：

1. 注册处理特定注解的 BeanPostProcessor（如 `AutowiredAnnotationBeanPostProcessor`）
2. 容器创建 Bean 实例后，BeanPostProcessor 遍历每个 Bean
3. 发现 `@Autowired` 注解 → 自动注入依赖
4. 发现 `@PostConstruct` 注解 → 在初始化后调用该方法

```java
// 注解只是标记
@Autowired
private UserDao userDao;

// 真正干活的是 AutowiredAnnotationBeanPostProcessor
// 它扫描到 @Autowired 后，从容器中查找 UserDao 并注入
```

### XML 配置覆盖注解注入

> **Annotation injection is performed before external property injection.** Thus, external configuration (for example, XML-specified bean properties) effectively overrides the annotations for properties when wired through mixed approaches.

**注入顺序（先注解、后 XML）：**
```
1. @Autowired / @Value 注解注入
2. <property> XML 属性注入（覆盖第 1 步的结果）
```

这意味着混合使用注解和 XML 时，XML 的 `<property>` 配置具有最高优先级。这个顺序是刻意设计的——外部配置（XML）可以覆盖注解中的默认值。

```xml
<!-- 如果同时存在 @Autowired 和 XML property -->
<bean id="userService" class="com.example.UserService">
    <property name="userDao" ref="customUserDao"/> <!-- 这个会覆盖 @Autowired 注入的值 -->
</bean>
```

### AnnotationConfigApplicationContext 已隐式注册

> Technically, you can register the post-processors as individual bean definitions, but they are **implicitly registered** in an `AnnotationConfigApplicationContext` already.

如果使用 `AnnotationConfigApplicationContext`（基于 Java 配置），Spring 已经自动注册了所有必要的 BeanPostProcessor，无需手动配置。

### `<context:annotation-config/>` — 在 XML 项目中启用注解支持

> In an XML-based Spring setup, you may include the following configuration tag to enable mixing and matching with annotation-based configuration:

```xml
<context:annotation-config/>
```

这一个标签会隐式注册以下 5 个后置处理器：

| PostProcessor | 作用 |
|---|---|
| `ConfigurationClassPostProcessor` | 处理 `@Configuration` 类 |
| `AutowiredAnnotationBeanPostProcessor` | 处理 `@Autowired`、`@Value` |
| `CommonAnnotationBeanPostProcessor` | 处理 `@PostConstruct`、`@PreDestroy`、`@Resource` |
| `PersistenceAnnotationBeanPostProcessor` | 处理 `@PersistenceUnit`、`@PersistenceContext` |
| `EventListenerMethodProcessor` | 处理 `@EventListener` |

**传统 XML 项目的典型升级路径：** 项目一开始全用 XML 配置，后来想逐步引入注解（`@Autowired` 注入、`@PostConstruct` 初始化等），只需在 `applicationContext.xml` 中加一行 `<context:annotation-config/>`，就可以让注解和 XML 混合使用。

### `<context:annotation-config/>` 的作用域仅限于同一个 ApplicationContext

> `<context:annotation-config/>` only looks for annotations on beans in the **same application context** in which it is defined. This means that, if you put `<context:annotation-config/>` in a `WebApplicationContext` for a `DispatcherServlet`, it only checks for `@Autowired` beans in your controllers, and not your services.

**关键限制：`<context:annotation-config/>` 只在声明的那个 ApplicationContext 中生效，不能跨父子容器。**

在传统的 Spring MVC Web 应用中，通常存在**两个** ApplicationContext：

```
ServletContainer（Tomcat）
  └── ServletContext
        ├── Root WebApplicationContext（父容器）
        |     ← ContextLoaderListener 创建
        |     ← 读取 applicationContext.xml
        |     ← 管理：Service、DAO、DataSource、事务等
        |
        └── DispatcherServlet WebApplicationContext（子容器）
              ← DispatcherServlet 创建
              ← 读取 xxx-servlet.xml
              ← 管理：Controller、ViewResolver、Interceptor 等
```

如果在 `xxx-servlet.xml` 中加了 `<context:annotation-config/>`，它**只在子容器生效**——Controller 中的 `@Autowired` 可以正常注入，**但 Service 中的 `@Autowired` 不会被处理**（因为 Service 在父容器）。

**解决方法：在父容器的 `applicationContext.xml` 中也加上 `<context:annotation-config/>`，这样两个容器各自处理自己管理范围内的 Bean。**

### 与 `<context:component-scan/>` 的关系

`<context:component-scan/>` 除了包扫描（`@Component`、`@Service` 等）之外，也**隐式包含了** `<context:annotation-config/>` 的功能。所以如果已经用了 `<context:component-scan/>`，就不需要再显式声明 `<context:annotation-config/>`。

## 句子解析

### 原文: "Annotation injection is performed before external property injection. Thus, external configuration (for example, XML-specified bean properties) effectively overrides the annotations for properties when wired through mixed approaches."

- **翻译:** 注解注入在外部的属性注入之前执行。因此，当通过混合方式装配时，外部配置（例如 XML 中指定的 bean 属性）会实际覆盖注解对属性的设置。
- **解析:** "is performed before" = 在……之前执行。"effectively" 在这里表示"实际上/事实上"，说明即使注解设了值，XML 的值最终会胜出。"wired through mixed approaches" 修饰整个场景——混合使用注解和 XML 时。

### 原文: "`<context:annotation-config/>` only looks for annotations on beans in the same application context in which it is defined."

- **翻译:** `<context:annotation-config/>` 只会在**定义它的那个** ApplicationContext 内查找 Bean 上的注解。
- **解析:** "in which it is defined" 是定语从句修饰 "the same application context"，强调作用域的局限性。"only looks for annotations on beans in" 结构清晰地点出了"只在本容器内生效"的限制。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| in conjunction with | prep. phrase | 与……结合/配合 |
| fine-grained | adj. | 细粒度的（更精细的控制） |
| implicit | adj. | 隐式的，自动的 |
| mix and match | v. phrase | 混合搭配（注解和 XML 混用） |
| effectively | adv. | 实际上，事实上 |
| override | v. | 覆盖，重写（XML 覆盖注解的值） |
| root | adj. | 根（父容器：Root WebApplicationContext） |
| hierarchy | n. | 层级结构（父子容器的层级关系） |
