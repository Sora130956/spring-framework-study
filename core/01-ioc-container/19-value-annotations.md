# Using `@Value`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/value-annotations.html

## 核心理解

`@Value` 用于注入外部化配置属性（externalized properties），最常见的是 `${...}` 占位符表达式。配合 `@PropertySource` 指定属性文件，Spring 会在运行时将占位符替换为实际值。

Spring 对 `${}` 占位符的解析有两个级别：默认的**宽容模式（lenient）**——解析失败时原样保留占位符字符串而不会报错；以及**严格模式**——声明 `PropertySourcesPlaceholderConfigurer` Bean 后，任何未解析的 `${}` 都会导致启动失败。

`@Value` 还支持 SpEL 表达式（`#{}`），可以动态计算值、构造复杂数据结构（如 Map）。内置的类型转换支持自动将字符串转为 Integer、String[] 等，也可以通过自定义 `ConversionService` 扩展。

## 关键点

### 基本用法 — 注入外部化属性

> @Value is typically used to inject externalized properties.

`@Value` 的典型用法是注入 `.properties` 文件中的配置值：

```java
@Component
public class MovieRecommender {
    private final String catalog;

    public MovieRecommender(@Value("${catalog.name}") String catalog) {
        this.catalog = catalog;
    }
}

@Configuration
@PropertySource("classpath:application.properties")
public class AppConfig { }
```

```properties
# application.properties
catalog.name=MovieCatalog
```

在这个例子中，`catalog` 参数会被注入为 `"MovieCatalog"`。

### 默认解析行为 — 宽容模式 vs 严格模式

> A default lenient embedded value resolver is provided by Spring. It will try to resolve the property value and if it cannot be resolved, the property name (for example ${catalog.name}) will be injected as the value.

Spring 默认提供的 value resolver 是**宽容的（lenient）**：
- 尝试解析 `${catalog.name}`
- 如果找不到对应属性，**不会报错**，而是把 `${catalog.name}` 这个字符串原样注入

如果需要**严格模式**（未解析的占位符应导致启动失败），需显式声明 `PropertySourcesPlaceholderConfigurer`：

```java
@Configuration
public class AppConfig {

    @Bean
    public static PropertySourcesPlaceholderConfigurer propertyPlaceholderConfigurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }
}
```

> Using the above configuration ensures Spring initialization failure if any ${} placeholder could not be resolved.

⚠️ 使用 JavaConfig 配置时，`@Bean` 方法**必须是 `static`**。

还可以通过 `setPlaceholderPrefix()`、`setPlaceholderSuffix()`、`setValueSeparator()`、`setEscapeCharacter()` 自定义占位符语法。默认转义字符可通过 JVM 系统属性 `spring.placeholder.escapeCharacter.default` 全局修改或禁用。

### Spring Boot 中的自动配置

> Spring Boot configures by default a PropertySourcesPlaceholderConfigurer bean that will get properties from application.properties and application.yml files.

**Spring Boot 默认已经配置了 `PropertySourcesPlaceholderConfigurer`**，会自动从 `application.properties` 和 `application.yml` 读取属性。因此在 Spring Boot 工程中，直接用 `@Value` 即可，无需额外写配置类来声明属性文件位置。

### 默认值

> It is possible to provide a default value as following.

使用 `:` 分隔符为 `${}` 占位符提供默认值：

```java
@Value("${catalog.name:defaultCatalog}")
private String catalog;
// 如果 catalog.name 不存在，则使用 "defaultCatalog"
```

### 内置类型转换

> Built-in converter support provided by Spring allows simple type conversion (to Integer or int for example) to be automatically handled. Multiple comma-separated values can be automatically converted to String array without extra effort.

Spring 内置的类型转换支持：
- 自动将字符串转为 `Integer`、`int` 等基本类型
- 逗号分隔的值自动转为 `String[]` 数组

如需自定义类型转换，可提供自己的 `ConversionService` Bean：

```java
@Configuration
public class AppConfig {

    @Bean
    public ConversionService conversionService() {
        DefaultFormattingConversionService conversionService =
            new DefaultFormattingConversionService();
        conversionService.addConverter(new MyCustomConverter());
        return conversionService;
    }
}
```

### SpEL 表达式

> When @Value contains a SpEL expression the value will be dynamically computed at runtime.

使用 `#{}` 语法在 `@Value` 中嵌入 SpEL 表达式，值会在运行时动态计算：

```java
@Value("#{systemProperties['user.catalog'] + 'Catalog'}")
private String catalog;
```

> SpEL also enables the use of more complex data structures.

SpEL 还可以直接构造复杂数据结构：

```java
@Value("#{{'Thriller': 100, 'Comedy': 300}}")
private Map<String, Integer> countOfMoviesPerCatalog;
```

## 句子解析

### 原文: "A default lenient embedded value resolver is provided by Spring. It will try to resolve the property value and if it cannot be resolved, the property name (for example ${catalog.name}) will be injected as the value."

- **翻译:** Spring 提供了一个默认的宽容嵌入式值解析器。它会尝试解析属性值，如果无法解析，属性名（例如 `${catalog.name}`）将作为值被注入。
- **解析:** `lenient` = 宽容的/不严格的（与 strict 相对）。`embedded value resolver` = 嵌入式值解析器。整句描述了 Spring 的"宽容"策略 —— 找不到时不会报错，而是原样保留占位符字符串。

### 原文: "Using the above configuration ensures Spring initialization failure if any ${} placeholder could not be resolved."

- **翻译:** 使用上述配置可确保在任何 `${}` 占位符无法解析时，Spring 初始化失败。
- **解析:** `ensures` = 确保（后接宾语从句时用陈述语气）。`initialization failure` = 初始化失败。`could not be resolved` 是被动语态的过去式，表示"无法被解析"。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| externalized | adj. | 外部化的 |
| placeholder | n. | 占位符 |
| lenient | adj. | 宽容的，不严格的 |
| strict | adj. | 严格的 |
| resolve | v. | 解析 |
| converter | n. | 转换器 |
| comma-separated | adj. | 逗号分隔的 |
| default value | n. | 默认值 |
| SpEL | abbr. | Spring Expression Language |
| dynamically | adv. | 动态地 |
