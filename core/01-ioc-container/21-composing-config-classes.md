# Composing Java-based Configurations — @Import, Cross-Config Dependencies, @Profile & XML Hybrid

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/composing-configuration-classes.html

## 核心理解

这页讲的是如何把多个 `@Configuration` 类**组合**成一个完整的 Spring 容器配置。核心问题：当 Bean 定义分散在多个配置类中时，它们之间如何互相引用、如何控制加载顺序、如何按条件开关。

最重要的三个精读 section：`@Import`（把分散的配置类聚合到一个入口）、跨配置类的依赖注入（参数注入 vs `@Autowired` 的取舍）、`@Profile`/`@Conditional`（按环境条件开关 Bean）。后两个可读 section——`@Lazy`/`@DependsOn` 启动顺序控制和 Java+XML 混合配置——属于"知道有这个能力，遇到再查"的级别。

---

## 关键点

### Using the @Import Annotation

> Much as the `<import/>` element is used within Spring XML files to aid in modularizing configurations, the @Import annotation allows for loading @Bean definitions from another configuration class.

`@Import` 的作用：把多个配置类聚合到一个入口，启动容器时只需指定一个"总配置类"。

```java
@Configuration
public class ConfigA {
    @Bean
    public A a() { return new A(); }
}

@Configuration
@Import(ConfigA.class)
public class ConfigB {
    @Bean
    public B b() { return new B(); }
}

// 启动时只需指定 ConfigB，A 和 B 两个 Bean 都会注册
ApplicationContext ctx = new AnnotationConfigApplicationContext(ConfigB.class);
A a = ctx.getBean(A.class);  // ✅ ConfigA 中定义的 Bean 也可见
B b = ctx.getBean(B.class);  // ✅
```

> As of Spring Framework 4.2, @Import also supports references to regular component classes, analogous to the `AnnotationConfigApplicationContext.register` method. This is particularly useful if you want to avoid component scanning, by using a few configuration classes as entry points to explicitly define all your components.

Spring 4.2 起 `@Import` 也能导入普通 `@Component` 类——不依赖 component scanning，显式声明所有组件入口。

---

### Injecting Dependencies on Imported @Bean Definitions

> When using @Configuration classes, the Java compiler places constraints on the configuration model, in that references to other beans must be valid Java syntax.

**方式一：参数注入（推荐）**——`@Bean` 方法的参数由 Spring 自动解析。

```java
@Configuration
public class ServiceConfig {
    @Bean
    public TransferService transferService(AccountRepository accountRepository) {
        return new TransferServiceImpl(accountRepository);
    }
}

@Configuration
public class RepositoryConfig {
    @Bean
    public AccountRepository accountRepository(DataSource dataSource) {
        return new JdbcAccountRepository(dataSource);
    }
}

@Configuration
@Import({ServiceConfig.class, RepositoryConfig.class})
public class SystemTestConfig {
    @Bean
    public DataSource dataSource() {
        return new DriverManagerDataSource(...);
    }
}
```

Spring 会自动跨配置类解析依赖：`transferService` → `accountRepository` → `dataSource`。

**方式二：`@Autowired` 注入（不推荐用于配置类内部依赖）**

```java
@Configuration
public class ServiceConfig {
    @Autowired
    private AccountRepository accountRepository;

    @Bean
    public TransferService transferService() {
        return new TransferServiceImpl(accountRepository);
    }
}
```

> Make sure that the dependencies you inject that way are of the simplest kind only. @Configuration classes are processed quite early during the initialization of the context, and forcing a dependency to be injected this way may lead to unexpected early initialization.

**为什么文档警告不要在 `@Configuration` 里用 `@Autowired`？** `@Configuration` 类在容器启动早期就被处理，如果用它注入一个尚未初始化的 Bean，可能导致循环依赖或提前初始化问题。参数注入更安全——Spring 知道该 Bean 方法是"被调用时才需要这些参数"，不会强制提前创建。

#### 为什么要在配置类里 Autowire 另一个配置类？

> determining exactly where the autowired bean definitions are declared is still somewhat ambiguous. For example, as a developer looking at ServiceConfig, how do you know exactly where the @Autowired AccountRepository bean is declared?

```java
@Configuration
public class ServiceConfig {
    @Autowired
    private RepositoryConfig repositoryConfig;  // 注入配置类本身

    @Bean
    public TransferService transferService() {
        // 通过配置类调用 @Bean 方法——代码里能直接跳转到定义处
        return new TransferServiceImpl(repositoryConfig.accountRepository());
    }
}
```

**好处：** IDE 中从 `repositoryConfig.accountRepository()` 可以一键跳转到 `AccountRepository` 的 `@Bean` 定义处，依赖关系显式可见。

**代价：** `ServiceConfig` 现在和具体的 `RepositoryConfig` **紧耦合**了。

#### 用接口化解耦

```java
@Configuration
public interface RepositoryConfig {           // 接口，只声明契约
    @Bean
    AccountRepository accountRepository();
}

@Configuration
public class DefaultRepositoryConfig implements RepositoryConfig {
    @Bean
    public AccountRepository accountRepository() {
        return new JdbcAccountRepository(...);
    }
}

@Configuration
public class ServiceConfig {
    @Autowired
    private RepositoryConfig repositoryConfig;  // 依赖接口，不是具体实现

    @Bean
    public TransferService transferService() {
        return new TransferServiceImpl(repositoryConfig.accountRepository());
    }
}

@Configuration
@Import({ServiceConfig.class, DefaultRepositoryConfig.class})
public class SystemTestConfig {
    @Bean
    public DataSource dataSource() { ... }
}
```

现在 `ServiceConfig` 只依赖 `RepositoryConfig` 接口，具体实现（`DefaultRepositoryConfig`）可以随意替换。IDE 仍然能通过接口类型层级找到所有实现。

---

### Influencing the Startup of @Bean-defined Singletons

> If you want to influence the startup creation order of certain singleton beans, consider declaring some of them as @Lazy for creation on first access instead of on startup. @DependsOn forces certain other beans to be initialized first.

```java
@Configuration
public class AppConfig {
    @Bean
    @Lazy                    // 不随容器启动创建，首次访问时才创建
    public HeavyResourceBean heavyResource() {
        return new HeavyResourceBean();
    }

    @Bean
    @DependsOn("dataSource") // 强制在 dataSource 之后创建
    public JdbcTemplate jdbcTemplate() {
        return new JdbcTemplate(dataSource());
    }
}
```

- **`@Lazy`**：延迟初始化，加速启动。适合启动时不需要的、重的 Bean。
- **`@DependsOn`**：显式声明初始化顺序，在直接依赖关系无法表达时使用（比如 Bean A 不注入 Bean B，但要求 B 先初始化）。

---

### Conditionally Include @Configuration Classes or @Bean Methods

> It is often useful to conditionally enable or disable a complete @Configuration class or even individual @Bean methods, based on some arbitrary system state.

条件化开关的本质：让特定 Bean **完全不参与容器注册**——Spring 在启动时直接跳过它们，就像它们不存在一样。

#### @Profile — 按环境激活

```java
@Configuration
@Profile("production")
public class ProductionConfig {
    @Bean
    public DataSource dataSource() {
        // 生产环境的连接池配置
        return new HikariDataSource(...);
    }
}

@Configuration
@Profile("dev")
public class DevConfig {
    @Bean
    public DataSource dataSource() {
        // 开发环境的嵌入式数据库
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.H2)
            .build();
    }
}
```

**启动时指定 profile：**
```bash
# application.properties
spring.profiles.active=dev

# 或 JVM 参数
-Dspring.profiles.active=production

# 或环境变量
export SPRING_PROFILES_ACTIVE=production
```

#### @Conditional — 更灵活的编程式条件

`@Profile` 底层就是用 `@Conditional` 实现的。下面是一个自定义 `@Conditional` 的例子：

```java
// 自定义条件：只在某个系统属性存在时才注册 Bean
public class OnSystemPropertyCondition implements Condition {
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return context.getEnvironment().containsProperty("myapp.feature-x.enabled");
    }
}

@Configuration
public class AppConfig {
    @Bean
    @Conditional(OnSystemPropertyCondition.class)
    public FeatureXService featureXService() {
        return new FeatureXService();
    }
}
```

#### Spring Boot 中的常用条件注解

Spring Boot 在 `@Conditional` 基础上提供了大量开箱即用的条件注解：

| 注解 | 条件逻辑 | 典型场景 |
|------|---------|---------|
| `@ConditionalOnProperty` | 配置项存在且为特定值 | `@ConditionalOnProperty("feature.cache.enabled")` |
| `@ConditionalOnClass` | classpath 中存在某个类 | `@ConditionalOnClass(RedisTemplate.class)` → 有 Redis 才加载 |
| `@ConditionalOnMissingBean` | 容器中没有某个 Bean | 提供默认实现，允许用户覆盖 |
| `@ConditionalOnBean` | 容器中存在某个 Bean | 只在某 Bean 已注册时才创建关联 Bean |
| `@ConditionalOnExpression` | SpEL 表达式为 true | `@ConditionalOnExpression("${app.mode} == 'cloud'")` |

```java
@Configuration
public class CacheConfig {
    @Bean
    @ConditionalOnClass(RedisTemplate.class)      // classpath 有 Redis 客户端
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
    public CacheManager redisCacheManager() {
        return new RedisCacheManager(...);
    }

    @Bean
    @ConditionalOnMissingBean(CacheManager.class)  // 用户没有自定义 CacheManager 时
    public CacheManager defaultCacheManager() {
        return new ConcurrentMapCacheManager();     // 提供默认的简单实现
    }
}
```

---

### Combining Java and XML Configuration

> In cases where XML is convenient or necessary, you have a choice: either instantiate the container in an "XML-centric" way by using, for example, ClassPathXmlApplicationContext, or instantiate it in a "Java-centric" way by using AnnotationConfigApplicationContext and the @ImportResource annotation to import XML as needed.

两种混合策略：**XML 为主引入 Java Config** 或 **Java Config 为主引入 XML**。

#### 策略一：XML-centric — 在 XML 中注册 @Configuration 类

**方式 A：注册为普通 `<bean/>`**

```xml
<!-- system-test-config.xml -->
<beans>
    <context:annotation-config/>
    <context:property-placeholder location="classpath:/com/acme/jdbc.properties"/>

    <bean class="com.acme.AppConfig"/>   <!-- @Configuration 类注册为普通 bean -->

    <bean class="org.springframework.jdbc.datasource.DriverManagerDataSource">
        <property name="url" value="${jdbc.url}"/>
        <property name="username" value="${jdbc.username}"/>
        <property name="password" value="${jdbc.password}"/>
    </bean>
</beans>
```

```properties
# jdbc.properties
jdbc.url=jdbc:hsqldb:hsql://localhost/xdb
jdbc.username=sa
jdbc.password=
```

```java
// 用 XML 启动
ApplicationContext ctx = new ClassPathXmlApplicationContext("classpath:/com/acme/system-test-config.xml");
```

**方式 B：用 `<context:component-scan/>` 自动扫描**

```xml
<beans>
    <!-- component-scan 隐含启用了 annotation-config -->
    <context:component-scan base-package="com.acme"/>
    <context:property-placeholder location="classpath:/com/acme/jdbc.properties"/>

    <bean class="org.springframework.jdbc.datasource.DriverManagerDataSource">
        <property name="url" value="${jdbc.url}"/>
        <property name="username" value="${jdbc.username}"/>
        <property name="password" value="${jdbc.password}"/>
    </bean>
</beans>
```

因为 `@Configuration` 被 `@Component` 元注解标记，所以 `<context:component-scan>` 能自动发现并注册它。

#### 策略二：Java-centric — @ImportResource 引入少量 XML

```java
@Configuration
@ImportResource("classpath:/com/acme/properties-config.xml")
public class AppConfig {
    @Value("${jdbc.url}")       // 引用 properties-config.xml 加载的 properties 中的值
    private String url;
    @Value("${jdbc.username}")
    private String username;
    @Value("${jdbc.password}")
    private String password;

    @Bean
    public DataSource dataSource() {
        return new DriverManagerDataSource(url, username, password);
    }
}
```

```xml
<!-- properties-config.xml —— 只做一件事：加载 properties 文件 -->
<beans>
    <context:property-placeholder location="classpath:/com/acme/jdbc.properties"/>
</beans>
```

**连接关系：** `@Value("${jdbc.username}")` → 通过 `@ImportResource("properties-config.xml")` → XML 中 `<context:property-placeholder>` → 加载 `jdbc.properties` → 注入 `${jdbc.username}` 的值 `sa`。

```java
// 用 Java Config 启动（XML 是辅助）
ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
```

---

## 句子解析

### 原文: "This tight coupling can be somewhat mitigated by using interface-based or abstract class-based @Configuration classes."

- **翻译:** 这种紧耦合可以通过使用基于接口或基于抽象类的 @Configuration 类来在一定程度上缓解。
- **解析:** `mitigated` = "缓解、减轻"（不是"消除"）。`somewhat` 修饰 `mitigated`，表示"部分缓解但不完全"。`interface-based or abstract class-based` 是两个并列的复合形容词修饰 `@Configuration classes`。

### 原文: "@Configuration classes are processed quite early during the initialization of the context, and forcing a dependency to be injected this way may lead to unexpected early initialization."

- **翻译:** @Configuration 类在上下文初始化过程中处理得相当早，以这种方式强制注入依赖可能导致意外的提前初始化。
- **解析:** `are processed quite early` 是被动语态。"forcing a dependency to be injected" 是动名词短语作主语。`may lead to` = "可能导致"。

---

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| modularize | v. | 模块化；将整体拆分为独立模块 |
| tradeoff | n. | 权衡、取舍；用一方面的代价换取另一方面的好处 |
| mitigate | v. | 缓解、减轻（不是消除） |
| tightly/loosely coupled | adj. | 紧耦合的 / 松耦合的 |
| arbitrary | adj. | 任意的、随意的；`arbitrary system state` = 任意系统状态 |
| ad-hoc | adj./adv. | 临时的、按需的；`in an ad-hoc fashion` = 以按需的方式 |
| centric | adj. | 以...为中心的；`XML-centric` = 以 XML 为中心的 |
| bootstrap | n./v. | 启动、引导；`bootstrap the container` = 启动容器 |
| enlisting | n. | 注册、登记；`enlisted with a destruction callback` = 注册了销毁回调 |
