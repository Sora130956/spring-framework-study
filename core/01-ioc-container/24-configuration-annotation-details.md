# Using the @Configuration Annotation & How Java-based Configuration Works Internally

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/configuration-annotation.html

## 核心理解

`configuration-annotation.html` 这一页的核心内容是**两个递进的知识层**：

第一层是**如何使用 `@Configuration` 表达 Bean 间依赖**（inter-bean dependencies）：在同一个 `@Configuration` 类中，一个 `@Bean` 方法直接调用另一个 `@Bean` 方法，就能建立依赖关系——不需要 `@Autowired` 字段注入，也不需要 `@Bean` 方法参数。这是一种**最直观、最接近 Java 自然语法的依赖声明方式**。但这条规则有一个硬约束：**只有 `@Configuration` 类的 `@Bean` 方法才能这样跨调用**，`@Component` 类的 `@Bean` 方法不能——因为只有 `@Configuration` 类会被 CGLIB 代理。

第二层是**这个机制的底层原理**（how it works internally）：Spring 启动时用 CGLIB 为每个 `@Configuration` 类生成一个子类代理。当 `beanOne()` 调用 `beanTwo()` 时，表面上是普通 Java 方法调用，实际执行的是代理拦截——先查容器里有没有 `beanTwo`，有就直接返回，没有才执行方法体并缓存。这就是单例语义得以保护的根源。CGLIB 已整合在 `spring-core` JAR 中，不需要额外依赖，但由此也产生了一个限制：`@Configuration` 类**不能是 final**。关于构造器，`@Configuration` 类没有任何特殊限制——你可以用 `@Autowired`、也可以不用、可以有多个构造器（遵循普通 Java 类的 Spring 注入规则）。

> 💬 **面试重点:** "为什么 `@Configuration` 类不能是 final？" → 因为 Spring 需要 CGLIB 子类化来拦截 `@Bean` 方法调用，final 类无法被继承。"为什么 `@Component` 里面的 `@Bean` 方法不能互相调用？" → 因为 `@Component` 不被 CGLIB 代理，跨调用就是普通 Java 方法调用，每次都会 new 新对象。

## 关键点

### Inter-bean Dependencies: 用方法调用表达依赖

> Calls to `@Bean` methods on `@Configuration` classes can also be used to define inter-bean dependencies. When beans have dependencies on one another, expressing that dependency is as simple as having one bean method call another, as the following example shows:

在 `@Configuration` 类中，一个 `@Bean` 方法直接调用另一个 `@Bean` 方法就能表达依赖。这是 Spring Java 配置中最优雅的特性之一——你不需要标注 `@Autowired`，也不需要写构造器或 Setter 注入，写出来的代码就像普通 Java 工厂方法一样自然。

```java
@Configuration
public class AppConfig {

    @Bean
    public BeanOne beanOne() {
        // 直接调用 beanTwo() 表达依赖
        return new BeanOne(beanTwo());
    }

    @Bean
    public BeanTwo beanTwo() {
        return new BeanTwo();
    }
}
```

这里有三个 bean：`beanOne`（refers to `beanTwo`）、`beanTwo`（由 `beanOne()` 引用一次，实际方法体只执行一次），以及 `clientDao`（被两次引用、方法体也只执行一次）。这正是 CGLIB 代理发挥作用的结果——无论被调用多少次，只要 scope 是 singleton，方法体只真正执行一次。

> **理解要点：** `beanOne()` 里写的 `beanTwo()` 表面上是一次普通方法调用，但在 CGLIB 代理下，它实际执行的是"去 IoC 容器里查 `beanTwo`，有就返回，没有才创建"。这是 Full 模式的核心行为。

---

### 只有 @Configuration 才能跨调用——@Component 不行 ⚠️

> This method of declaring inter-bean dependencies works only when the `@Bean` method is declared within a `@Configuration` class. You cannot declare inter-bean dependencies by using plain `@Component` classes.

这是最容易踩坑的点。如果你的 `@Bean` 方法在 `@Component`（或 `@Service`、`@Repository`）里面，你写的 `dataSource()` 调用就是**真的每次执行方法体**——每次都会 new 一个新对象。这在 21-java-config-basic-concepts.md 的 Full 模式 vs Lite 模式对比中已经详细讨论过。

```java
// ❌ 错误示范：@Component 中的 @Bean 跨调用
@Component
public class FactoryComponent {

    @Bean
    public DataSource dataSource() { return new HikariDataSource(); }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        // 危险！这是纯 Java 调用，每次 new 新 DataSource！
        return new JdbcTemplate(dataSource());
    }
}

// ✅ 正确做法：Lite 模式用参数注入
@Component
public class FactoryComponent {

    @Bean
    public DataSource dataSource() { return new HikariDataSource(); }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {  // 参数注入
        return new JdbcTemplate(dataSource);
    }
}
```

---

### 内部机制：CGLIB 子类代理（精简总结）

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/configuration-annotation.html#beans-java-method-injection
>
> In Spring, beans are defined with a singleton scope by default. To ensure that multiple calls to a `@Bean` method within a `@Configuration` class return the same instance, Spring uses CGLIB to subclass configuration classes at startup.

内部工作原理已在 [21-java-config-basic-concepts.md](../21-java-config-basic-concepts.md) 中详细展开，这里做精简回顾：

1. Spring 扫描到 `@Configuration` 类后，**不直接使用原始类**，而是用 CGLIB 运行时生成一个子类代理
2. 代理拦截所有 `@Bean` 方法的调用：先查容器 → 有就返回已有实例 → 没有才执行方法体并存入容器
3. 这就是为什么同一个 `@Bean` 方法被调用多次（如 `clientDao()` 被 `clientService1()` 和 `clientService2()` 各调用一次），实际方法体只执行一次

```
clientService1() → clientDao() → [容器检查] → 没有 → 执行 clientDao() 方法体 → 放入容器
clientService2() → clientDao() → [容器检查] → 有! → 直接返回已有实例（方法体不再执行）
```

---

### CGLIB 已内置于 spring-core JAR

> It is not necessary to add CGLIB to your classpath because CGLIB classes are repackaged under the `org.springframework.cglib` package and included directly within the `spring-core` JAR.

这是 Spring 的一个工程决策：CGLIB 的类被**重新打包**（repackaged）到了 `org.springframework.cglib` 包下，直接内嵌在 `spring-core` JAR 中。这样做的好处是**避免依赖冲突**——你不会因为自己项目中引入的 CGLIB 版本与 Spring 期望的不一致而出问题。Spring 使用的是它"私有"的 CGLIB 副本。

> **注意：** 这个 repackaging 意味着你引入的独立 CGLIB jar（如 `cglib:cglib`）不会被 Spring 使用——Spring 用的是自己内部版本的 CGLIB。

---

### 限制1：@Configuration 类不能是 final ⚠️

> Because CGLIB dynamically adds features at startup, configuration classes must not be final.

这是 CGLIB 的工作方式决定的：CGLIB 通过**创建子类**来代理，而 `final` 类无法被继承。Spring 容器在启动时会检查这一点——如果你把 `@Configuration` 类声明为 `final`，容器会直接报错。

```java
// ❌ 错误
@Configuration
public final class AppConfig {  // final 不允许
    @Bean
    public MyService myService() { return new MyServiceImpl(); }
}

// ✅ 正确
@Configuration
public class AppConfig {  // 非 final
    @Bean
    public MyService myService() { return new MyServiceImpl(); }
}
```

> **注意：** `@Bean` 方法本身可以安全地声明为 `final`——CGLIB 拦截的是**方法调用**而非方法声明，但在配置类中通常没必要加 `final`。

---

### 限制2：构造器规则（无特殊限制）

> However, any constructors are allowed on configuration classes, including the use of `@Autowired` or a single non-default constructor declaration for default injection.

`@Configuration` 类在构造器方面**没有任何特殊限制**——普通 Java 类的构造器注入规则完全适用。用户总结的规则如下：

| 情况 | Spring 行为 |
|------|-------------|
| 只有一个有参构造器，无 `@Autowired` | Spring 默认用这个构造器注入（`@Autowired` 可省略） |
| 多个有参构造器 + 无参构造器，无 `@Autowired` | Spring 默认用**无参构造器** |
| 多个有参构造器，无无参构造器，无 `@Autowired` | Spring **无法自动选择**，必须用 `@Autowired` 显式指定 |
| 至少一个构造器标注了 `@Autowired(required=true)` | Spring **强制使用该构造器**，其他构造器被完全忽略 |

```java
@Configuration
public class AppConfig {

    private final DataSource dataSource;

    // ✅ 只有一个有参构造器 → Spring 默认用它注入
    public AppConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Bean
    public JdbcTemplate jdbcTemplate() {
        return new JdbcTemplate(dataSource);
    }
}
```

```java
@Configuration
public class AppConfig {

    private DataSource dataSource;

    // Spring 会用这个无参构造器（dataSource 不会被注入）
    public AppConfig() {}

    public AppConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    // ⚠️ 需要用 @Autowired 指明用哪个构造器
}
```

## 句子解析

### 原文: "This method of declaring inter-bean dependencies works only when the @Bean method is declared within a @Configuration class."

- **翻译:** 这种声明 Bean 间依赖的方法只有在 `@Bean` 方法声明在 `@Configuration` 类中时才有效。
- **解析:**
  - `This method of declaring inter-bean dependencies` — 长名词短语作主语，核心是 `method`，后面全是修饰
  - `works only when...` — 状语句式，"只在...条件下才有效"
  - 整句是一个**条件限制声明**，口语中可简化成 "This only works with @Configuration"

### 原文: "It is not necessary to add CGLIB to your classpath because CGLIB classes are repackaged under the org.springframework.cglib package and included directly within the spring-core JAR."

- **翻译:** 你不需要把 CGLIB 添加到 classpath 中，因为 CGLIB 的类已被重新打包到 `org.springframework.cglib` 包下，并直接内置在 `spring-core` JAR 中。
- **解析:**
  - `It is not necessary to...` — 形式主语 It 引导的不定式主语从句（真正主语是 `to add CGLIB to your classpath`）
  - `repackaged` — re- 前缀表"重新/再"，package → repackage = "重新打包"
  - `directly within` — within = inside，强调"直接就在...里面"而非外部引用

### 原文: "configuration classes must not be final."

- **翻译:** 配置类不能是 final 的。
- **解析:**
  - 简洁有力的禁令句式。`must not` = "绝对不能"（比 `cannot` 更强硬），在技术文档中用于表达硬性约束
  - 只有 6 个词，却因为 `must not` 的强制语气而清晰传达了不可商量的限制

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| inter-bean dependency | n. | Bean 之间的依赖关系（一个 Bean 依赖另一个 Bean 的实例） |
| CGLIB | n. | Code Generation Library，运行时字节码生成库，通过子类化实现代理 |
| repackage | v. | 重新打包（将第三方库的类修改包名后嵌入自己的 JAR，避免版本冲突） |
| subclass | v./n. | 子类化（通过继承创建子类） / 子类 |
| intercept | v. | 拦截（在方法调用到达目标之前将其截获并执行容器逻辑） |
| singleton scope | n. | 单例作用域（整个容器中只存在一个实例） |
| constrain | v. | 约束、限制 |
