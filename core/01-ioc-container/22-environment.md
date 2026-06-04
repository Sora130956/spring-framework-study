# Environment Abstraction — Profile, PropertySource & @PropertySource

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/environment.html

## 核心理解

`Environment` 是 Spring 容器中集成的一个抽象层，管理两件事：**Profiles**（多环境 Bean 开关）和 **Properties**（属性来源的统一查询）。Profile 解决"不同环境注册不同 Bean"的问题——开发环境用嵌入式数据库、生产环境用连接池，通过一个 profile 字符串切换整套配置。PropertySource 解决"属性配置从哪里来"的问题——JVM 参数、系统环境变量、properties 文件、Servlet 配置等来源被抽象为一个有优先级顺序的属性源列表，Spring 从中逐级搜索。

这两个机制是你作为 freelancer 接项目时**一定会遇到的东西**——没有哪个 Spring Boot 项目不用 `application-dev.properties` / `application-prod.properties` 和 `spring.profiles.active`。理解底层的 `Environment` 抽象，能让你在多环境配置出问题时快速定位根因。

---

## 关键点

### Bean Definition Profiles

> Bean definition profiles provide a mechanism in the core container that allows for registration of different beans in different environments.

**核心动机：同一个 Bean（如 DataSource），在不同环境需要不同的创建方式。** 开发环境用嵌入式 H2，生产环境用 JNDI 连接池。

```java
// 开发环境：嵌入式数据库
@Bean
public DataSource dataSource() {
    return new EmbeddedDatabaseBuilder()
        .setType(EmbeddedDatabaseType.HSQL)
        .addScript("my-schema.sql")
        .addScript("my-test-data.sql")
        .build();
}

// 生产环境：JNDI 查找
@Bean(destroyMethod = "")  // JNDI DataSource 生命周期由服务器管理，禁止 Spring 销毁
public DataSource dataSource() throws Exception {
    Context ctx = new InitialContext();
    return (DataSource) ctx.lookup("java:comp/env/jdbc/datasource");
}
```

两个版本的方法名、逻辑完全不同，不能简单地用 if-else 切换——Profile 就是为解决这个问题而生的。

---

### Using @Profile

> The @Profile annotation lets you indicate that a component is eligible for registration when one or more specified profiles are active.

```java
@Configuration
@Profile("development")
public class StandaloneDataConfig {
    @Bean
    public DataSource dataSource() {
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.HSQL)
            .addScript("classpath:com/bank/config/sql/schema.sql")
            .addScript("classpath:com/bank/config/sql/test-data.sql")
            .build();
    }
}

@Configuration
@Profile("production")
public class JndiDataConfig {
    @Bean(destroyMethod = "")  // 禁止自动销毁回调
    public DataSource dataSource() throws Exception {
        Context ctx = new InitialContext();
        return (DataSource) ctx.lookup("java:comp/env/jdbc/datasource");
    }
}
```

#### Profile 表达式（Spring 5.1+）

| 语法 | 含义 |
|------|------|
| `@Profile("production")` | 简单 profile 名 |
| `@Profile("production & us-east")` | AND：两个都激活 |
| `@Profile("production \| eu-central")` | OR：任一激活即可 |
| `@Profile("!production")` | NOT：production **未**激活时注册 |
| `@Profile("production & (us-east \| eu-central)")` | 组合（不能用 `&` 和 `\|` 不加括号混用） |

```java
@Profile({"p1", "!p2"})   // p1 激活 或 p2 未激活 → 注册
```

#### @Profile 做元注解——自定义组合注解

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Profile("production")
public @interface Production { }
```

使用 `@Production` 等价于 `@Profile("production")`——可读性更好、可复用。

#### 类级别 vs 方法级别

**类级别：** `@Configuration` 类标记 `@Profile` → 整个配置类及其所有 `@Bean`、`@Import` 都被跳过。

**方法级别：** 同一个配置类内，用不同 profile 切换返回同名的 Bean：

```java
@Configuration
public class AppConfig {
    @Bean("dataSource")
    @Profile("development")
    public DataSource standaloneDataSource() {
        return new EmbeddedDatabaseBuilder()...build();
    }

    @Bean("dataSource")     // 同一个 Bean 名，不同 profile
    @Profile("production")
    public DataSource jndiDataSource() throws Exception {
        return (DataSource) new InitialContext().lookup("java:comp/env/jdbc/datasource");
    }
}
```

#### ⚠️ 重载方法 + @Profile 的陷阱

> In the case of overloaded @Bean methods of the same Java method name, a @Profile condition needs to be consistently declared on all overloaded methods. If the conditions are inconsistent, only the condition on the first declaration among the overloaded methods matters.

```java
// ❌ 错误：用重载 + 不同 @Profile 区分参数签名
@Bean
@Profile("dev")
public MyBean myBean(DataSource ds) { ... }

@Bean
@Profile("prod")           // 这个方法会被忽略！只有第一个 @Bean 的 @Profile 生效
public MyBean myBean(JndiDataSource ds) { ... }

// ✅ 正确：用不同的方法名 + 相同的 @Bean name
@Bean("myBean")
@Profile("dev")
public MyBean devBean(DataSource ds) { ... }

@Bean("myBean")
@Profile("prod")
public MyBean prodBean(JndiDataSource ds) { ... }
```

---

### Activating a Profile

> You can also declaratively activate profiles through the spring.profiles.active property.

| 方式 | 示例 | 使用频率 |
|------|------|---------|
| **配置文件** | `spring.profiles.active=dev` 写到 application.properties | ⭐⭐⭐⭐⭐ |
| **环境变量** | `export SPRING_PROFILES_ACTIVE=prod` | ⭐⭐⭐⭐⭐ |
| **JVM 参数** | `-Dspring.profiles.active=test` | ⭐⭐⭐⭐ |
| **测试注解** | `@ActiveProfiles("test")`（Spring Test） | ⭐⭐⭐ |
| **代码硬编码** | `ctx.getEnvironment().setActiveProfiles("dev")` | ⭐ 几乎不用 |

```bash
# 同时激活多个 profile
export SPRING_PROFILES_ACTIVE=profile1,profile2

# JVM 参数方式
java -Dspring.profiles.active=profile1,profile2 -jar app.jar
```

```java
// 测试中
@SpringBootTest
@ActiveProfiles("test")
class MyServiceTest { }
```

---

### Default Profile

> The default profile represents the profile that is enabled if no profile is active. If any profile is enabled, the default profile does not apply.

```java
@Configuration
@Profile("default")
public class DefaultDataConfig {
    @Bean
    public DataSource dataSource() {
        return new EmbeddedDatabaseBuilder()
            .setType(EmbeddedDatabaseType.HSQL)
            .addScript("classpath:com/bank/config/sql/schema.sql")
            .build();
    }
}
```

**关键规则：** 默认 profile 只在**没有任何 profile 被激活**时才生效。一旦有任何一个 profile 激活（不管是不是 `default`），`default` profile 就不再适用。

```bash
# 修改默认 profile 的名称（默认是 "default"）
spring.profiles.default=base

# 或编程方式
ctx.getEnvironment().setDefaultProfiles("base");
```

---

### PropertySource Abstraction

> Spring's Environment abstraction provides search operations over a configurable hierarchy of property sources.

**Environment 通过在一组 `PropertySource` 中逐级搜索来确定属性是否存在。** `PropertySource` 是对任何键值对来源的抽象。

#### 两种默认 Environment

**StandardEnvironment（独立应用）：**

```java
ApplicationContext ctx = new GenericApplicationContext();
Environment env = ctx.getEnvironment();

// containsProperty 搜索全部已注册的 PropertySource
boolean hasProperty = env.containsProperty("my-property");
System.out.println("my-property exists? " + hasProperty);

// 获取属性值
String value = env.getProperty("my-property");
String valueWithDefault = env.getProperty("my-property", "default-value");

// 默认的两个 PropertySource 来源：
// 1. JVM system properties —— java -Dmy-property=xxx -jar app.jar
// 2. OS 环境变量 —— export MY_PROPERTY=xxx
```

**JVM 系统属性在哪定义？**
```bash
# 1. 命令行 -D 参数
java -Dmy-property=hello -jar app.jar

# 2. 代码中设置
System.setProperty("my-property", "hello");

# 3. IDE 的 VM options 配置（IntelliJ: Run → Edit Configurations → VM options）
-Dmy-property=hello
```

**OS 环境变量在哪定义？**
```bash
# Linux / macOS
export MY_PROPERTY=hello

# Windows PowerShell
$env:MY_PROPERTY = "hello"

# Windows CMD
set MY_PROPERTY=hello

# IDE 的 Environment Variables 配置（IntelliJ: Run → Edit Configurations → Environment variables）
MY_PROPERTY=hello
```

**StandardServletEnvironment（Web 应用）：**

```java
// Web 环境下自动使用 StandardServletEnvironment
// 它额外包含：ServletConfig、ServletContext、JNDI 属性源
```

#### PropertySource 优先级（从高到低）

> For a common StandardServletEnvironment, the full hierarchy is as follows, with the highest-precedence entries at the top:

| 优先级 | 属性源 | 在哪配置 | 配置示例 |
|--------|--------|---------|---------|
| 1（最高） | **ServletConfig** 参数 | `web.xml` 中 `<servlet>` 的 `<init-param>` | `<init-param><param-name>key</param-name><param-value>val</param-value></init-param>` |
| 2 | **ServletContext** 参数 | `web.xml` 中 `<context-param>` | `<context-param><param-name>key</param-name><param-value>val</param-value></context-param>` |
| 3 | **JNDI** 环境变量 | 应用服务器 JNDI 注册表 | Tomcat 的 `context.xml` 中 `<Environment name="key" value="val" type="java.lang.String"/>` |
| 4 | **JVM 系统属性** | `-D` 参数 / `System.setProperty()` | `-Dapp.env=prod` |
| 5（最低） | **OS 环境变量** | 操作系统 | `export APP_ENV=prod` |

> **注意：** 属性值不会合并——高优先级的完全覆盖低优先级的同名字段。

#### 添加自定义 PropertySource

```java
ConfigurableApplicationContext ctx = new GenericApplicationContext();
MutablePropertySources sources = ctx.getEnvironment().getPropertySources();

// addFirst = 最高优先级
sources.addFirst(new MyPropertySource());

// addLast = 最低优先级
// sources.addLast(new MyPropertySource());

// addBefore / addAfter = 插入到特定位置
```

自定义 `PropertySource` 示例：

```java
public class MyPropertySource extends PropertySource<String> {
    private Map<String, Object> properties = new HashMap<>();

    public MyPropertySource() {
        super("myPropertySource");  // 属性源名称
        properties.put("app.secret", "encrypted-value-123");
        properties.put("app.timeout", "30");
    }

    @Override
    public Object getProperty(String name) {
        return properties.get(name);
    }
}
```

---

### Using @PropertySource

> The @PropertySource annotation provides a convenient and declarative mechanism for adding a PropertySource to Spring's Environment.

```java
@Configuration
@PropertySource("classpath:/com/myco/app.properties")
public class AppConfig {
    @Autowired
    Environment env;

    @Bean
    public TestBean testBean() {
        TestBean testBean = new TestBean();
        testBean.setName(env.getProperty("testbean.name"));  // 从 app.properties 中读取
        return testBean;
    }
}
```

```properties
# app.properties
testbean.name=myTestBean
```

#### @PropertySource 中嵌套占位符

```java
@Configuration
@PropertySource("classpath:/com/${my.placeholder:default/path}/app.properties")
public class AppConfig { ... }
```

- `my.placeholder` 从已注册的 PropertySource 中解析（如 JVM 系统属性、环境变量）
- 如果未找到，使用默认值 `default/path`
- 如果没有默认值且未找到 → `IllegalArgumentException`

#### 重复使用 @PropertySource

```java
@Configuration
@PropertySource("classpath:db.properties")
@PropertySource("classpath:app.properties")
@PropertySource("classpath:security.properties")
public class AppConfig { ... }
```

#### 占位符解析的全局性

> Because the Environment abstraction is integrated throughout the container, it is easy to route resolution of placeholders through it.

**你的理解正确：** Spring 中所有 `${}` 占位符（XML、注解、配置值等）都通过 `Environment` 统一解析，不只是 JVM 系统属性和环境变量。

```xml
<!-- 1. XML import 中使用占位符 -->
<beans>
    <import resource="com/bank/service/${customer}-config.xml"/>
</beans>
<!-- customer=prod → 加载 com/bank/service/prod-config.xml -->
```

```java
// 2. @PropertySource 路径中的占位符
@PropertySource("classpath:/${env}/database.properties")  // env=dev → classpath:/dev/database.properties

// 3. @ComponentScan 中的占位符
@ComponentScan("${app.scan.packages}")  // app.scan.packages=com.example.service

// 4. application.properties 中也可以用占位符
// app.name=MyApp
// app.description=${app.name} is a Spring Boot Application
```

```java
// 5. 代码中通过 Environment 解析
@Autowired
Environment env;

public void printConfig() {
    String dbUrl = env.resolvePlaceholders("jdbc:${db.host}:${db.port}/${db.name}");
    // db.host=localhost, db.port=5432, db.name=mydb → jdbc:localhost:5432/mydb
}
```

---

## 句子解析

### 原文: "Bean definition profiles provide a mechanism in the core container that allows for registration of different beans in different environments."

- **翻译:** Bean 定义 profile 在核心容器中提供了一种机制，允许在不同环境中注册不同的 Bean。
- **解析:** `provide a mechanism` = "提供一种机制"。`allows for`（不是 `allows to`）后面接名词短语 `registration of...`。

### 原文: "If any profile is enabled, the default profile does not apply."

- **翻译:** 如果任意 profile 被启用，默认 profile 就不再适用。
- **解析:** `does not apply` = "不适用、不生效"。简洁但信息量大——整个默认 profile 被完全跳过，不是"合并"或"覆盖"。

---

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| eligible | adj. | 符合条件的、有资格的；`eligible for registration` = 有资格被注册 |
| bypassed | adj. | 被绕过的、被跳过的 |
| hierarchical | adj. | 分层的、有层级的；`hierarchical search` = 逐级搜索 |
| precedence | n. | 优先级、优先权 |
| overridden | adj. | 被覆盖的（不是合并） |
| declarative | adj. | 声明式的（通过注解/配置声明，而非代码） |
| counterpart | n. | 对应物、对应部分；`XML counterpart` = XML 版本的对应实现 |
| proposition | n. | 命题、主张、提议；`either-or proposition` = 二选一命题 |
| negate | v. | 否定、取反；`negate a profile` = 取反一个 profile |
| concise | adj. | 简洁的、简明的 |
