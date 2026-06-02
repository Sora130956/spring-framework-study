# Using the @Bean Annotation

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/bean-annotation.html

## 核心理解

`@Bean` 是方法级别的注解，在 Java 配置中充当 XML `<bean/>` 元素的直接等价物。它支持 `<bean/>` 的大多数属性——`name`、`initMethod`、`destroyMethod`、`autowire` 等——使开发者可以完全脱离 XML 来声明 Bean。

`@Bean` 方法可以声明在 `@Configuration` 类或 `@Component` 类中。当声明在 `@Configuration` 类中时，方法间的相互调用受到 CGLIB 代理保护（Full 模式）；在 `@Component` 类中则运行在 Lite 模式。`@Bean` 方法的返回值类型有讲究：如果返回接口类型，容器只知道接口类型，完整类型信息要等到单例 Bean 实例化之后才可用，这可能导致 `@Autowired` 按实现类注入时出现时序问题——因此**建议返回最具体的类型**。

`@Bean` 的生命周期管理能力非常完整：既支持 JSR-250 的 `@PostConstruct`/`@PreDestroy`，也支持 Spring 的 `InitializingBean`/`DisposableBean` 接口和 `*Aware` 系列，还能通过 `initMethod`/`destroyMethod` 指定任意方法。但需要注意 Spring 会**自动推断销毁回调**——如果 Bean 有名为 `close()` 或 `shutdown()` 的 public 方法，Spring 会将其注册为销毁回调。这对于 JNDI 获取的外部资源（如 DataSource）是**危险**的，因为它们的生命周期由应用服务器管理，Spring 不应插手。必须显式设置 `@Bean(destroyMethod = "")` 来关闭这个推断行为。

## 关键点

### 声明 Bean & 返回值类型选择

> By default, the bean name is the same as the method name.

```java
@Configuration
public class AppConfig {
    @Bean
    public TransferServiceImpl transferService() {
        return new TransferServiceImpl();
    }
}
```

等价于 `<bean id="transferService" class="com.acme.TransferServiceImpl"/>`。默认 Bean 名 = 方法名。

> You can also declare your @Bean method with an interface (or base class) return type...

```java
@Configuration
public class AppConfig {
    @Bean
    public TransferService transferService() {  // 返回接口类型
        return new TransferServiceImpl();
    }
}
```

返回接口类型 **TransferService** 而非实现类 **TransferServiceImpl**。这会影响 `@Autowired TransferServiceImpl` 的解析时机——完整类型信息要等到该单例 Bean 实例化之后才可用，非懒加载的单例按声明顺序实例化，所以可能出现**类型匹配结果依赖于实例化顺序**的问题。

> If you consistently refer to your types by a declared service interface, your @Bean return types may safely join that design decision. However, for components that implement several interfaces or for components potentially referred to by their implementation type, it is safer to declare the most specific return type possible.

**建议：如果一律按接口引用，返回接口没问题；但如果存在按实现类引用的可能，返回最具体的类型（实现类）更安全。**

---

### Bean 依赖（方法参数注入）

```java
@Configuration
public class AppConfig {
    @Bean
    public TransferService transferService(AccountRepository accountRepository) {
        return new TransferServiceImpl(accountRepository);
    }
}
```

`@Bean` 方法可以有任意数量的参数，Spring 会自动解析并注入——解析机制与构造器注入一致。这是 **Lite 模式下声明 inter-bean 依赖的正确方式**（而不是直接调用另一个 `@Bean` 方法）。

---

### 生命周期回调（重点）

#### 1. 标准生命周期支持

`@Bean` 方法创建的 Bean **完整支持**以下生命周期机制：

- **JSR-250：** `@PostConstruct` / `@PreDestroy`
- **Spring 接口：** `InitializingBean` / `DisposableBean` / `Lifecycle`
- **\*Aware 接口：** `BeanFactoryAware`、`BeanNameAware`、`MessageSourceAware`、`ApplicationContextAware` 等
- **`initMethod` / `destroyMethod`：** 指定任意方法作为初始化和销毁回调

```java
public class BeanOne {
    public void init() {
        // initialization logic
    }
}

public class BeanTwo {
    public void cleanup() {
        // destruction logic
    }
}

@Configuration
public class AppConfig {

    @Bean(initMethod = "init")
    public BeanOne beanOne() {
        return new BeanOne();
    }

    @Bean(destroyMethod = "cleanup")
    public BeanTwo beanTwo() {
        return new BeanTwo();
    }
}
```

#### 2. 自动销毁回调推断（auto-destroy inference）⭐

> By default, beans defined with Java configuration that have a public `close` or `shutdown` method are automatically enlisted with a destruction callback.

Spring 容器会**自动发现** Bean 中名为 `close()` 或 `shutdown()` 的 public 方法，并将其注册为销毁回调——不需要任何额外配置。关闭容器时，这些方法自动被调用。

> If you have a public `close` or `shutdown` method and you do not wish for it to be called when the container shuts down, you can add `@Bean(destroyMethod = "")` to your bean definition to disable the default (inferred) mode.

如果不想让 Spring 自动调用这些方法，设置 `@Bean(destroyMethod = "")` 即可关闭推断行为。

#### 3. JNDI 资源与 destroyMethod="" ⭐⭐⭐

> You may want to do that by default for a resource that you acquire with JNDI, as its lifecycle is managed outside the application. In particular, make sure to always do it for a DataSource, as it is known to be problematic on Jakarta EE application servers.

**为什么 JNDI 资源必须设置 `destroyMethod = ""`？**

JNDI（Java Naming and Directory Interface）是 Java 提供的一套 API，用于在应用服务器（如 Tomcat）中通过"名字"查找和访问资源，包括数据库连接池（`DataSource`）、消息队列连接工厂（`ConnectionFactory`）、邮件会话（`MailSession`）等。这些资源不是在 Spring 应用内部通过 `new` 创建，而是在 Tomcat 容器层面配置，通常写在 `conf/context.xml` 或应用的 `META-INF/context.xml` 中。Tomcat 启动时会创建这些资源实例并将它们绑定到 JNDI 名称空间（如 `java:comp/env/jdbc/myDB`）。

由于这类资源实例通常也实现了 `close()` 或 `shutdown()` 方法，且它们的生命周期由 Tomcat 容器管理（而非 Spring），如果 Spring 默认自动发现并注册这些方法为销毁回调，在 Spring 容器关闭时会**与 Tomcat 的关闭逻辑冲突**——可能导致双重关闭、报错或资源状态异常。因此，对于通过 JNDI 获取的 `DataSource` 等资源，必须在 `@Bean` 方法上显式设置 `destroyMethod = ""`，将资源的生命周期完全交给 Tomcat 管理。这是 Spring 官方文档特别强调的最佳实践。

```java
@Bean(destroyMethod = "")
public DataSource dataSource() throws NamingException {
    return (DataSource) jndiTemplate.lookup("MyDS");
}
```

#### 4. JndiTemplate vs JndiObjectFactoryBean

> Also, with @Bean methods, you typically use programmatic JNDI lookups, either by using Spring's `JndiTemplate` or `JndiLocatorDelegate` helpers or straight JNDI `InitialContext` usage but **not** the `JndiObjectFactoryBean` variant (which would force you to declare the return type as the `FactoryBean` type instead of the actual target type, making it harder to use for cross-reference calls in other @Bean methods that intend to refer to the provided resource here).

在 `@Bean` 方法中做 JNDI 查找时：
- ✅ **推荐：** `JndiTemplate`、`JndiLocatorDelegate`、或原生 `InitialContext`
- ❌ **不推荐：** `JndiObjectFactoryBean`——它返回 `FactoryBean` 类型而非实际资源类型，其他 `@Bean` 方法引用该资源时会变得复杂

#### 5. JNDI DataSource 完整示例（Tomcat）

**Step 1 — Tomcat 中注册 JNDI 资源**（`META-INF/context.xml` 或 `conf/context.xml`）：

```xml
<!-- Tomcat conf/context.xml 或 META-INF/context.xml -->
<Context>
    <Resource name="jdbc/myDB"
              auth="Container"
              type="javax.sql.DataSource"
              maxTotal="20"
              maxIdle="10"
              maxWaitMillis="10000"
              driverClassName="com.mysql.cj.jdbc.Driver"
              url="jdbc:mysql://localhost:3306/mydb"
              username="root"
              password="secret"
              factory="org.apache.tomcat.dbcp.dbcp2.BasicDataSourceFactory"/>
</Context>
```

**Step 2 — web.xml 中声明资源引用**：

```xml
<web-app>
    <resource-ref>
        <res-ref-name>jdbc/myDB</res-ref-name>
        <res-type>javax.sql.DataSource</res-type>
        <res-auth>Container</res-auth>
    </resource-ref>
</web-app>
```

**Step 3 — Spring @Configuration 中通过 JndiTemplate 获取**：

```java
@Configuration
public class DataSourceConfig {

    // 方式一：使用 JndiTemplate（推荐）
    @Bean(destroyMethod = "")  // ← 关键！关闭 Spring 的自动销毁推断
    public DataSource dataSource() throws NamingException {
        JndiTemplate jndiTemplate = new JndiTemplate();
        return (DataSource) jndiTemplate.lookup("java:comp/env/jdbc/myDB");
    }

    // 方式二：使用 JndiLocatorDelegate（Spring 提供的便捷包装）
    @Bean(destroyMethod = "")
    public DataSource dataSource2() throws NamingException {
        JndiLocatorDelegate jndiDelegate = new JndiLocatorDelegate();
        return jndiDelegate.lookup("java:comp/env/jdbc/myDB", DataSource.class);
    }

    // 方式三：原生 JNDI InitialContext
    @Bean(destroyMethod = "")
    public DataSource dataSource3() throws NamingException {
        InitialContext ctx = new InitialContext();
        Context envCtx = (Context) ctx.lookup("java:comp/env");
        return (DataSource) envCtx.lookup("jdbc/myDB");
    }
}
```

> ⚠️ 三种方式的共同点：都必须加 `destroyMethod = ""`。因为 DataSource 通常有 `close()` 方法，Spring 会自动发现它，而 DataSource 的生命周期应由 Tomcat 管理。

---

#### 6. 直接 Java 编程式初始化

> When you work directly in Java, you can do anything you like with your objects and do not always need to rely on the container lifecycle.

有时候直接在 `@Bean` 方法里调用初始化逻辑更直观、更可控，不一定非得依赖容器的生命周期回调：

```java
@Configuration
public class AppConfig {

    @Bean
    public BeanOne beanOne() {
        BeanOne beanOne = new BeanOne();
        beanOne.init();           // 直接在方法里调用 init()
        return beanOne;
    }
}
```

这和使用 `@Bean(initMethod = "init")` 效果相同，但更直观——在 Java 代码里你想做什么都能做，不一定要把初始化逻辑交给容器回调。

---

### Bean 作用域（@Scope）

```java
@Configuration
public class MyConfiguration {

    @Bean
    @Scope("prototype")
    public Encryptor encryptor() {
        // ...
    }
}
```

`@Bean` 的默认作用域是 `singleton`，通过 `@Scope` 可以覆盖。支持所有标准作用域（`singleton`、`prototype`、`request`、`session` 等）。

> @Scope 还支持 `proxyMode` 属性，用于创建作用域代理（scoped proxy），例如在单例 Bean 中注入 session 作用域的 Bean 时，需要通过代理来保证每次获取的是当前 session 的正确实例。

---

### Bean 命名

```java
@Configuration
public class AppConfig {

    @Bean("myThing")   // 等价于 @Bean(name = "myThing")
    public Thing thing() {
        return new Thing();
    }
}
```

默认 Bean 名 = 方法名（如 `thing`），通过 `name` 属性可以覆盖（如 `myThing`）。也可以通过配置 `ConfigurationBeanNameGenerator` 来全局修改默认命名策略。

---

### Bean 别名

```java
@Configuration
public class AppConfig {

    @Bean({"dataSource", "subsystemA-dataSource", "subsystemB-dataSource"})
    public DataSource dataSource() {
        // instantiate, configure and return DataSource bean...
    }
}
```

`@Bean` 的 `name` 属性接受 `String[]`，可以为同一个 Bean 设置多个名字。第一个值通常是主要名称，其余为别名。

---

### Bean 描述（@Description）

`@Description` 注解可为 Bean 添加文本描述，主要用于 JMX 监控等场景。实用指数低，了解即可：

```java
@Bean
@Description("Provides a basic example of a bean")
public Thing thing() {
    return new Thing();
}
```

## 句子解析

### 原文: "By default, beans defined with Java configuration that have a public close or shutdown method are automatically enlisted with a destruction callback."

- **翻译:** 默认情况下，用 Java 配置定义的 Bean 如果有一个 public 的 `close` 或 `shutdown` 方法，这些方法会被**自动登记**为销毁回调。
- **解析:**
  - `beans ... that have a public close or shutdown method` — `that` 定语从句修饰 `beans`
  - `are enlisted with` — `enlist` 本意"征募/使入伍"，这里指"登记/注册"，比 `registered` 更形象
  - 整句描述的是 Spring 的**自动推断（inferred）销毁行为**

### 原文: "In particular, make sure to always do it for a DataSource, as it is known to be problematic on Jakarta EE application servers."

- **翻译:** 特别是，对于 DataSource 一定要这样做，因为在 Jakarta EE 应用服务器上不这样做是已知的问题源。
- **解析:**
  - `In particular` — 插入语，强调后面的建议尤为重要
  - `make sure to always do it` — `make sure to do` = "确保做某事"
  - `as it is known to be problematic` — `as` = "因为"；`it is known to be` = "众所周知/已知"
  - `problematic` ≠ "有问题的"，更准确是"会引发问题的/容易出问题的"

### 原文: "Also, with @Bean methods, you typically use programmatic JNDI lookups, either by using Spring's JndiTemplate or JndiLocatorDelegate helpers or straight JNDI InitialContext usage but not the JndiObjectFactoryBean variant."

- **翻译:** 另外，在 `@Bean` 方法中，通常使用编程式 JNDI 查找——要么用 Spring 的 `JndiTemplate` 或 `JndiLocatorDelegate` 辅助工具，要么直接使用 JNDI `InitialContext`——但不要用 `JndiObjectFactoryBean` 这个变体。
- **解析:**
  - `either by ... or ... but not ...` — 多层选择结构："要么 A 要么 B，但不要 C"
  - `straight` 在此是副词 = "直接地"（= directly）
  - `variant` = "变体/变种"，这里指"另一种可选方案"，带贬义（不推荐的方案）

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| analog | n. | 等价物；类似物（`@Bean` is a direct analog of `<bean/>`） |
| enlist | v. | 登记；征募（此处指 Spring 自动将方法注册为销毁回调） |
| inferred | adj. | 推断的；推论的（Spring 的"推断销毁模式"——自动发现 close/shutdown 方法） |
| arbitrary | adj. | 任意的；随意的（指可以指定任意方法名作为 init/destroy 回调） |
| variant | n. | 变体；变种（此处指 JndiObjectFactoryBean 这个不推荐的替代方案） |
| scoped proxy | n. | 作用域代理（为短生命周期 Bean 创建的代理，使长生命周期 Bean 能安全引用它） |
| alias | n./v. | 别名（一个 Bean 的多个名字） |
| JNDI | abbr. | Java Naming and Directory Interface，Java 命名与目录接口（应用服务器资源查找的标准 API） |
| programmatic | adj. | 编程式的（通过写代码直接操作，而非声明式配置） |
