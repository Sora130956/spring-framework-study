# Basic Concepts: @Bean and @Configuration

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/basic-concepts.html

## 核心理解

Spring 的 Java 配置方式围绕两个核心注解展开：`@Configuration` 和 `@Bean`。`@Bean` 注解标记一个方法，表示该方法会创建、配置并初始化一个由 Spring IoC 容器管理的对象——它在 Java 配置中的地位等同于 XML 配置中的 `<bean/>` 元素。`@Configuration` 注解标记一个类，表明该类的主要职责是作为 Bean 定义的来源。

`@Configuration` 最关键的能力是**支持跨方法调用（inter-bean references）**：在同一个 `@Configuration` 类中，一个 `@Bean` 方法可以直接调用另一个 `@Bean` 方法来建立依赖关系。Spring 通过 CGLIB 代理来实现这一点——Spring 不会直接使用你写的 `AppConfig` 类，而是创建一个 CGLIB 子类代理，拦截所有 `@Bean` 方法的调用，确保即使 Java 代码里写的是直接方法调用，实际执行的也是"从容器中查找已有单例"的逻辑，从而保护了单例语义。

理解 **Full 模式**（默认，有 CGLIB 代理）和 **Lite 模式**（`@Component` 中的 `@Bean`，或 `@Configuration(proxyBeanMethods=false)`）的区别是掌握 Spring Java 配置的钥匙。Full 模式保证单例语义但有性能开销，Lite 模式更轻量但要求你通过方法参数注入依赖，不能直接调用其他 `@Bean` 方法。

## 关键点

### @Bean 与 @Configuration 的基本定义

> The `@Bean` annotation is used to indicate that a method instantiates, configures, and initializes a new object to be managed by the Spring IoC container. For those familiar with Spring's `<beans/>` XML configuration, the `@Bean` annotation plays the same role as the `<bean/>` element. You can use `@Bean`-annotated methods with any Spring `@Component`. However, they are most often used with `@Configuration` beans.

`@Bean` 注解的作用是告诉 Spring："这个方法返回的对象请帮我管理起来"。它和 XML 的 `<bean/>` 元素在语义上等价的。`@Bean` 可以用在任何 `@Component` 类中（不只是 `@Configuration`），但最佳实践是放在 `@Configuration` 类中。

```java
// 最简 @Configuration + @Bean 示例
@Configuration
public class AppConfig {

    @Bean
    public MyServiceImpl myService() {
        return new MyServiceImpl();
    }
}
```

```xml
<!-- 等价的 XML 配置 -->
<beans>
    <bean id="myService" class="com.acme.services.MyServiceImpl"/>
</beans>
```

> Annotating a class with `@Configuration` indicates that its primary purpose is as a source of bean definitions. Furthermore, `@Configuration` classes let inter-bean dependencies be defined by calling other `@Bean` methods in the same class.

`@Configuration` 的核心作用是两点：① 标记这个类是 Bean 定义的来源；② 允许类内部通过调用其他 `@Bean` 方法来声明 Bean 之间的依赖（inter-bean dependencies）。第二点是 `@Configuration` 区别于普通 `@Component` 的关键能力。

---

### Full 模式 vs Lite 模式（核心重点）

> In common scenarios, `@Bean` methods are to be declared within `@Configuration` classes, ensuring that full configuration class processing applies and that cross-method references therefore get redirected to the container's lifecycle management. This prevents the same `@Bean` method from accidentally being invoked through a regular Java method call, which helps to reduce subtle bugs that can be hard to track down.

在**默认模式（Full 模式）**下，`@Bean` 方法声明在 `@Configuration` 类中。Spring 会对这个配置类进行完整的处理——生成 CGLIB 代理子类。当 `jdbcTemplate()` 方法内部调用 `dataSource()` 时，这个调用会被代理拦截，重定向到容器的生命周期管理逻辑中：**先查容器里有没有，有就直接返回，没有才真正执行方法体并放入容器**。这样就保护了单例语义，避免了因普通 Java 方法调用而意外创建多个实例的隐蔽 bug。

> When `@Bean` methods are declared within classes that are not annotated with `@Configuration`, or when `@Configuration(proxyBeanMethods=false)` is declared, they are **referred to as** being processed in a "lite" mode. In such scenarios, `@Bean` methods are **effectively** a general-purpose factory method mechanism without special runtime processing (that is, without generating a CGLIB subclass for it). A custom Java call to such a method will not get intercepted by the container and therefore behaves just like a regular method call, creating a new instance every time rather than reusing an existing singleton (or scoped) instance for the given bean.

**Lite 模式**的触发条件是：① `@Bean` 方法在非 `@Configuration` 类中（比如 `@Component`），或 ② 显式声明了 `@Configuration(proxyBeanMethods=false)`。在这种模式下，Spring **不会**为这个类生成 CGLIB 子类代理。结果是：如果有人直接调用这个 `@Bean` 方法，那就是一次普通的 Java 方法调用——**每次都 new 一个新对象**，即使你本意是单例也会被破坏。

> **语言点:**
> - `are referred to as` → "被称为"（被动语态，`refer to A as B` = 把 A 称为 B）
> - `effectively` → 此处不取"有效地"，而取**"实际上/实质上"**（用于软化语气，表示虽非正式定义但实际效果如此）

```java
// ❌ Lite 模式示例：@Bean 在 @Component 中
@Component
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // 危险！这是普通 Java 调用，每次调用都 new 一个新 DataSource
        return new JdbcTemplate(dataSource());
    }
}
```

```java
// ✅ Full 模式（默认）：@Bean 在 @Configuration 中
@Configuration
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        return ds;
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // 安全！这是代理拦截后的调用，从容器返回已有单例
        return new JdbcTemplate(dataSource());
    }
}
```

```
Full 模式执行流程图:

1. Spring 启动，扫描到 @Configuration 类 AppConfig
       │
       ▼
2. Spring 不为 AppConfig 本身创建普通 Bean，而是创建它的 CGLIB 代理子类
       │
       ▼
3. 调用 dataSource() 创建 DataSource Bean（第一次调用，实际执行方法体）
       │
       ▼
4. 调用 jdbcTemplate() 时，内部调用 dataSource()
       │
       ├── 这不是普通 Java 调用
       ├── 是代理对象的方法调用
       └── 代理拦截后，直接从容器返回已有的 DataSource 单例
       │
       ▼
5. 不会重复执行 dataSource() 方法体
```

> As a consequence, `@Bean` methods on classes without runtime proxying are not meant to declare inter-bean dependencies at all. Instead, they are expected to operate on their containing component's fields and, optionally, on arguments that a factory method may declare in order to receive autowired collaborators. Such a `@Bean` method therefore never needs to invoke other `@Bean` methods; every such call can be expressed through a factory method argument instead. The positive side-effect here is that no CGLIB subclassing has to be applied at runtime, reducing the overhead and the footprint.

**Lite 模式的正确用法：不要在 Lite 模式下跨方法调用 `@Bean` 方法，而是通过方法参数注入依赖。** Lite 模式下的 `@Bean` 方法应该操作所在组件的字段，或者通过方法参数来接收需要自动装配的协作者。这样做的好处是完全不需要 CGLIB 代理，减少了运行时开销和内存占用。

```java
// ✅ Lite 模式的正确写法：通过方法参数注入依赖
@Component
public class AppConfig {

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource();
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {  // ← 参数注入！
        return new JdbcTemplate(dataSource);
    }
}
```

> **面试要点：** Full 模式（`@Configuration` 默认） vs Lite 模式（`@Component` + `@Bean` 或 `proxyBeanMethods=false`）的核心区别：
> 1. Full 模式有 CGLIB 代理 → 拦截 `@Bean` 调用 → 保证单例语义
> 2. Lite 模式无代理 → `@Bean` 调用是普通 Java 调用 → 每次 new 新对象
> 3. Lite 模式应通过方法参数注入依赖，而非直接调用其他 `@Bean` 方法
> 4. Lite 模式优势：无 CGLIB 开销，启动更快，内存更小

## 句子解析

### 原文: "In common scenarios, @Bean methods are to be declared within @Configuration classes, ensuring that full configuration class processing applies and that cross-method references therefore get redirected to the container's lifecycle management."

- **翻译:** 在常见场景中，`@Bean` 方法应当声明在 `@Configuration` 类中，这确保完整的配置类处理生效，因此跨方法引用会被重定向到容器的生命周期管理中。
- **解析:** 
  - 主句: `@Bean methods are to be declared` — `be to do` 表示"应当/被期望做某事"，比 `should` 更正式
  - `ensuring that...` 是现在分词作结果状语，引出两个并列的 `that` 宾语从句
  - `therefore` 表示因果关系："因为 full processing 生效 → 所以跨方法引用被重定向"
  - `get redirected to` — `get + 过去分词` 是被动语态的口语化表达

### 原文: "This prevents the same @Bean method from accidentally being invoked through a regular Java method call, which helps to reduce subtle bugs that can be hard to track down."

- **翻译:** 这能防止同一个 `@Bean` 方法被意外地通过常规 Java 方法调用来执行，从而有助于减少那些难以追踪的隐蔽 bug。
- **解析:**
  - `prevents ... from accidentally being invoked` — `prevent A from doing` 固定搭配，"防止 A 做某事"；`accidentally` 修饰整个动作
  - `which` 引导非限制性定语从句，指代前面一整句话（即"代理拦截"这件事）
  - `subtle` 在此意为"细微的、不易察觉的"（不是"精妙的"），修饰 `bugs`
  - `that can be hard to track down` — 定语从句修饰 `bugs`，`track down` = 追踪/定位

### 原文: "In such scenarios, @Bean methods are effectively a general-purpose factory method mechanism without special runtime processing (that is, without generating a CGLIB subclass for it)."

- **翻译:** 在这种场景下，`@Bean` 方法实质上就是一个通用的工厂方法机制，没有特殊的运行时处理（即不会为它生成 CGLIB 子类）。
- **解析:**
  - `effectively` 此处取"实质上"而非"有效地"——用于修正或限定前面的说法，让读者更准确地理解实际情况
  - 破折号内的 `that is` = "也就是说/即"，引出更通俗的解释
  - `for it` 中的 `it` 指代包含 `@Bean` 方法的那个类

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| artifact | n. | 工件；产物（此处指 Spring 配置中的核心构造单元，如 @Configuration 类和 @Bean 方法） |
| inter-bean dependency | n. | Bean 之间的依赖关系（一个 Bean 依赖另一个 Bean） |
| redirect | v. | 重定向（将方法调用从原来的目标转向另一个目标） |
| lifecycle management | n. | 生命周期管理（Spring 容器对 Bean 的创建、初始化、销毁全过程的管控） |
| intercept | v. | 拦截（在方法调用到达目标之前将其截获并执行额外逻辑） |
| subtle | adj. | 微妙的；不易察觉的（常修饰 bug/error，指难以发现的缺陷） |
| CGLIB | n. | Code Generation Library，一个运行时字节码生成库，Spring 用它来创建配置类的代理子类 |
| singleton | n./adj. | 单例（在整个容器中只有一个实例的 Bean 作用域） |
| overhead | n. | 开销；额外负担（指系统为执行某项功能而付出的额外资源） |
| footprint | n. | 占用空间（此处指内存占用） |
