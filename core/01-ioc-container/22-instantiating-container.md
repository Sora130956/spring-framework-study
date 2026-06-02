# Instantiating the Spring Container by Using AnnotationConfigApplicationContext

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/java/instantiating-container.html

## 核心理解

`AnnotationConfigApplicationContext` 是 Spring 3.0 引入的 `ApplicationContext` 实现，用于**以 Java 类（而非 XML 文件）作为输入来初始化 Spring 容器**。它的核心能力是接受三种类型的类作为配置输入：`@Configuration` 类、普通 `@Component` 类、以及 JSR-330 注解类。理解这三者的区别很重要——`@Configuration` 类会连带其所有 `@Bean` 方法一起被注册为 Bean 定义，而 `@Component`/JSR-330 类则依赖类内部的 `@Autowired`/`@Inject` 等 DI 元数据来声明依赖关系。

实例化容器有三种典型方式：① **构造器直接传入**配置类（最简单）；② **无参构造 + `register()` 方法**逐批注册（适合编程式构建）；③ **`scan()` 方法**扫描整个包路径（与 `@ComponentScan` 注解等价）。无论哪种方式，**最终都必须调用 `refresh()`** 才会真正触发容器的初始化和 Bean 的创建。`refresh()` 是容器生命周期的分水岭——调用前只是注册了配置信息，调用后才执行实际的 Bean 实例化、依赖注入等流程。注意 `refresh()` 只能调用一次，重复调用会抛出异常。

## 关键点

### AnnotationConfigApplicationContext 的三种输入类型

> This versatile ApplicationContext implementation is capable of accepting not only `@Configuration` classes as input but also plain `@Component` classes and classes annotated with JSR-330 metadata.

`AnnotationConfigApplicationContext` 可以接受三种类型的类作为输入：① `@Configuration` 类、② 普通 `@Component` 类、③ JSR-330（如 `@Named`）注解类。这种灵活性使得同一个容器实现可以混合使用不同风格的 Bean 声明方式。

> When `@Configuration` classes are provided as input, the `@Configuration` class itself is registered as a bean definition and all declared `@Bean` methods within the class are also registered as bean definitions.

当传入 `@Configuration` 类时，Spring 做两件事：① 将该 `@Configuration` 类**自身**注册为一个 Bean 定义（`@Configuration` 元注解了 `@Component`，它本身也是一个 Bean）；② 将该类中所有 `@Bean` 方法也注册为 Bean 定义。换句话说，一个 `@Configuration` 类 = 一个配置 Bean + 若干个由 `@Bean` 方法定义的业务 Bean。

> When `@Component` and JSR-330 classes are provided, they are registered as bean definitions, and it is assumed that DI metadata such as `@Autowired` or `@Inject` are used within those classes where necessary.

当传入 `@Component` 或 JSR-330 类时，它们被注册为 Bean 定义，但 Spring **假设**这些类内部已经通过 `@Autowired` 或 `@Inject` 等注解声明了依赖注入元数据。与 `@Configuration` 不同，普通 `@Component` 类没有 `@Bean` 方法的自动注册能力——它只是一个普通的 Bean，它的依赖通过字段/方法上的 DI 注解来表达。

---

### 方式一：构造器直接传入（Simple Construction）

```java
// 传入 @Configuration 类
public static void main(String[] args) {
    ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
    MyService myService = ctx.getBean(MyService.class);
    myService.doStuff();
}
```

`AnnotationConfigApplicationContext` 不仅限于 `@Configuration` 类，也可以直接传入 `@Component` 或 JSR-330 类：

```java
// 传入多个 @Component 类（这些类内部使用 @Autowired 声明依赖）
public static void main(String[] args) {
    ApplicationContext ctx = new AnnotationConfigApplicationContext(
        MyServiceImpl.class, Dependency1.class, Dependency2.class);
    MyService myService = ctx.getBean(MyService.class);
    myService.doStuff();
}
```

> 两种写法的区别：传入 `@Configuration` → 容器通过 `@Bean` 方法发现 Bean；传入 `@Component` → 容器直接将类本身注册为 Bean，依赖靠 `@Autowired` 解决。

---

### 方式二：无参构造 + register() 编程式注册

> You can instantiate an AnnotationConfigApplicationContext by using a no-arg constructor and then configure it by using the `register()` method. This approach is particularly useful when programmatically building an AnnotationConfigApplicationContext.

```java
public static void main(String[] args) {
    AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
    ctx.register(AppConfig.class, OtherConfig.class);   // 第一批注册
    ctx.register(AdditionalConfig.class);                // 第二批注册
    ctx.refresh();                                       // ← 触发容器初始化
    MyService myService = ctx.getBean(MyService.class);
    myService.doStuff();
}
```

这种方式的优势是**分批次、有条件地注册配置类**，适合在运行时根据条件动态决定加载哪些配置的场景。

#### `refresh()` 方法说明

`ctx.refresh()` 是 Spring 容器初始化的核心入口。调用前，`register()` 只是在内部记录了一份配置类清单，**并没有真正创建任何 Bean**。调用 `refresh()` 后，Spring 才开始执行：

1. 解析所有已注册的配置类
2. 处理 `@Bean` 方法、`@ComponentScan` 等注解
3. 实例化所有单例 Bean
4. 执行依赖注入
5. 调用生命周期回调（`@PostConstruct` 等）

> ⚠️ **`refresh()` 可以调用多次吗？** 不建议，通常只会调用一次。第二次调用会抛异常，因为容器已完成初始化，内部状态不再处于"可刷新"阶段。如果需要重新加载，应创建新的 `ApplicationContext` 实例。

---

### 方式三：scan() 组件扫描

> To enable component scanning, you can annotate your `@Configuration` class as follows:

```java
@Configuration
@ComponentScan(basePackages = "com.acme")  // 启用组件扫描，扫描 com.acme 包
public class AppConfig {
    // ...
}
```

等价的 XML 配置：

```xml
<beans>
    <context:component-scan base-package="com.acme"/>
</beans>
```

`@ComponentScan` 会让 Spring 在指定包路径下扫描所有 `@Component` 注解的类（包括 `@Service`、`@Repository`、`@Controller`），并将其注册为容器中的 Bean 定义。

也可以不使用 `@ComponentScan` 注解，而是通过 `scan()` 方法达到同样效果：

```java
public static void main(String[] args) {
    AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
    ctx.scan("com.acme");   // 等价于 @ComponentScan(basePackages = "com.acme")
    ctx.refresh();
    MyService myService = ctx.getBean(MyService.class);
}
```

> `scan()` 和 `register()` 可以组合使用——先用 `scan()` 扫描包路径，再用 `register()` 补充注册不在扫描范围内的个别配置类。

#### @Configuration 与组件扫描的关系

> Remember that `@Configuration` classes are meta-annotated with `@Component`, so they are candidates for component-scanning. In the preceding example, assuming that `AppConfig` is declared within the `com.acme` package (or any package underneath), it is picked up during the call to `scan()`. Upon `refresh()`, all its `@Bean` methods are processed and registered as bean definitions within the container.

`@Configuration` 注解本身被 `@Component` 元注解标记，因此**`@Configuration` 类也是组件扫描的候选对象**。当 `scan("com.acme")` 执行时，只要 `AppConfig` 在 `com.acme` 包或其子包下，它就会被发现并注册。

> ⚠️ **如果 `@Configuration` 类不在被扫描的包下，它就不会被 `scan()` 发现**，里面的 `@Bean` 方法也就不会被注册。这种情况下需要通过 `register()` 手动注册、使用 `@Import` 显式导入、或在构造器中直接指定该类来让它生效。**所以一般来说，`@Configuration` 类也应该放在被扫描的包路径下。**

---

### Web 应用中的 AnnotationConfigWebApplicationContext（简要）

Spring 为 Web 环境提供了 `AnnotationConfigWebApplicationContext`，它是 `AnnotationConfigApplicationContext` 的 Web 变体。在 `web.xml` 中通过 `contextClass` 参数指定使用它来代替默认的 `XmlWebApplicationContext`，然后用 `contextConfigLocation` 指定 `@Configuration` 类的全限定名或待扫描的包路径。

> 💡 在 Spring Boot 中，这一切都由自动配置处理，几乎不需要手动接触 `AnnotationConfigWebApplicationContext`。仅在维护遗留的 XML 配置 Web 项目时可能遇到。

## 句子解析

### 原文: "This versatile ApplicationContext implementation is capable of accepting not only @Configuration classes as input but also plain @Component classes and classes annotated with JSR-330 metadata."

- **翻译:** 这个多功能的 ApplicationContext 实现不仅能接受 @Configuration 类作为输入，还能接受普通的 @Component 类以及带有 JSR-330 元数据注解的类。
- **解析:**
  - `versatile` = 多功能的/多用途的，修饰 `implementation`，强调其灵活性
  - `is capable of` = "有能力做……"，比 `can` 更正式
  - `not only ... but also ...` 并列结构："不仅能……还能……"
  - `plain` 在此意为"普通的/平凡的"（不是"平坦的"），修饰 `@Component classes`，与"特殊的" `@Configuration` 类形成对比

### 原文: "When @Component and JSR-330 classes are provided, they are registered as bean definitions, and it is assumed that DI metadata such as @Autowired or @Inject are used within those classes where necessary."

- **翻译:** 当提供 @Component 和 JSR-330 类时，它们被注册为 Bean 定义，并且假定诸如 @Autowired 或 @Inject 这样的 DI 元数据在这些类中被按需使用。
- **解析:**
  - `it is assumed that...` — 形式主语 `it` 引导主语从句，"假定……/默认认为……"
  - `such as` 列举例子，说明 DI 元数据的具体形式
  - `where necessary` = `where it is necessary` 的省略，修饰"使用"的场合

### 原文: "This approach is particularly useful when programmatically building an AnnotationConfigApplicationContext."

- **翻译:** 当以编程方式构建 AnnotationConfigApplicationContext 时，这种方式尤其有用。
- **解析:**
  - `particularly` = "尤其/特别"，程度副词，比 `very` 更精确
  - `programmatically` = "以编程方式"（通过代码动态操作，而非声明式配置）
  - `building` 与 `instantiating` 近义，但 `build` 强调"逐步构建"的过程感

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| versatile | adj. | 多功能的；通用的（强调可在多种场景下使用） |
| instantiate | v. | 实例化（创建某个类的具体对象） |
| programmatically | adv. | 以编程方式（通过代码动态操作，区别于声明式配置） |
| meta-annotated | adj. | 被元注解标记的（一个注解被另一个注解标注，如 @Configuration 被 @Component 标注） |
| candidate | n. | 候选者（组件扫描中，符合条件的类即为"候选"） |
| qualified | adj. | 全限定（fully-qualified，指包含完整包路径的类名） |
| variant | n. | 变体；变种（同一事物的不同版本，如 Web 环境下的容器实现变体） |
| bootstrap | v./n. | 启动；引导（指初始化 ApplicationContext 的过程） |
| servlet listener | n. | Servlet 监听器（在 Web 容器启动时执行初始化逻辑的组件） |
