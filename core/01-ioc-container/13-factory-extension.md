# Container Extension Points

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/factory-extension.html

## 核心理解

Spring 提供了三个层次的容器扩展点，区别在于**操作的对象不同**：

1. **BeanPostProcessor** — 操作 **Bean 实例**（对象），在 Bean 初始化前后插入自定义逻辑。用于检查回调接口、包装代理等。典型实现：`AutowiredAnnotationBeanPostProcessor`（处理 `@Autowired`）。

2. **BeanFactoryPostProcessor** — 操作 **Bean Definition 元数据**（配置），在容器实例化 Bean **之前**读取和修改配置。用于占位符替换、配置覆盖等。典型实现：`PropertySourcesPlaceholderConfigurer`（`${...}` 替换）、`PropertyOverrideConfigurer`（外部属性文件覆盖 Bean 属性值）。

3. **FactoryBean** — 操作 **实例化逻辑**，用自定义代码替代容器默认的反射构造。`getObject()` 只替代实例化步骤，后续的依赖注入、初始化回调、AOP 代理、销毁回调仍由容器管理。

关于 Callback：以上所有扩展机制本质上都是**回调模式**——你写方法并注册给 Spring，Spring 在合适的时机主动调用你。"Don't call us, we'll call you"。

## 关键点

### BeanPostProcessor — 操作 Bean 实例

> The `BeanPostProcessor` interface defines **callback** methods that you can implement to provide your own instantiation logic, dependency resolution logic, and so forth.

两个回调方法：
- `postProcessBeforeInitialization(Object bean, String beanName)` — 在 `InitializingBean.afterPropertiesSet()` 和 `init-method` **之前**调用
- `postProcessAfterInitialization(Object bean, String beanName)` — 在初始化回调**之后**调用

> A bean post-processor typically checks for **callback interfaces**, or it may wrap a bean with a proxy.

**核心工作模式：** BeanPostProcessor 遍历每个 Bean，检查它是否实现了某个回调接口，如果是，就调用相应的方法。例如检查 Bean 是否实现 `ApplicationContextAware`，如果是就调用 `setApplicationContext()`。

### BeanPostProcessor 注册的注意事项

> Note that, when declaring a BeanPostProcessor by using an `@Bean` factory method on a configuration class, the return type of the factory method should be the implementation class itself or at least the `org.springframework.beans.factory.config.BeanPostProcessor` interface, clearly indicating the post-processor nature of that bean. **Otherwise, the ApplicationContext cannot autodetect it by type before fully creating it.**

**关键点：** 容器必须能通过返回类型**自动识别**这是一个 BeanPostProcessor。如果返回类型是 `Object` 或不够明确的接口，容器在早期就无法检测到它，导致它无法被正确注册为 post-processor。

> Furthermore, when registering a BeanPostProcessor via an `@Bean` factory method, **declare the method as static** and ideally with **no dependencies**. Doing so avoids eager initialization of the configuration class and other beans, which would make them ineligible for full post-processing (such as auto-proxying).

使用 **`static @Bean` 方法** + **无依赖** 的原因：BeanPostProcessor 需要在容器生命周期的**早期**被实例化。如果不用 `static`，配置类本身要先被实例化，导致配置类及其依赖的 Bean 被提前创建（饿汉初始化），可能引发循环依赖或导致这些提前创建的 Bean 无法享受完整的后置处理（如 AOP 代理）。

```java
@Configuration
public class AppConfig {
    @Bean
    public static InstantiationTracingBeanPostProcessor instantiationTracingBeanPostProcessor() {
        return new InstantiationTracingBeanPostProcessor();  // static + 明确返回类型
    }
}
```

### BeanPostProcessor 与 AOP 代理的互斥关系

> Because AOP auto-proxying is implemented as a BeanPostProcessor itself, **neither BeanPostProcessor instances nor the beans they directly reference are eligible for auto-proxying** and, thus, do not have aspects woven into them.

**对。** BeanPostProcessor 本身和它们直接引用的 Bean 都**不能被自动代理**（如 `@Transactional`、`@Async` 等切面不会织入）。因为 AOP 自动代理本身就是一个 BeanPostProcessor，它在容器启动早期按顺序应用——BeanPostProcessor Bean 早于普通 Bean 被实例化，它们处理完注册后才会应用到后续的普通 Bean，所以 BeanPostProcessor 本身处于代理链"之外"。

> To minimize the number of beans affected, register a BeanPostProcessor with a static @Bean method that has **no dependencies**.

**最佳实践：** BeanPostProcessor 应该是 `static @Bean` + 无依赖的，这样才能最小化被排除在 AOP 代理之外的 Bean 数量。

### AutowiredAnnotationBeanPostProcessor 举例

> An example is Spring's `AutowiredAnnotationBeanPostProcessor` — a BeanPostProcessor implementation that ships with the Spring distribution and **autowires annotated fields, setter methods, and arbitrary config methods**.

它能处理以下三种注入点：
```java
@Component
public class MyService {
    // 1. annotated fields — 带注解的字段
    @Autowired
    private UserDao userDao;

    // 2. setter methods — setter 方法
    @Autowired
    public void setOrderDao(OrderDao orderDao) {
        this.orderDao = orderDao;
    }

    // 3. arbitrary config methods — 任意配置方法（名字不限 setXxx）
    @Autowired
    public void configure(DataSource dataSource, @Value("${timeout}") int timeout) {
        this.dataSource = dataSource;
        this.timeout = timeout;
    }
}
```

### BeanFactoryPostProcessor — 操作 Bean Definition 元数据

> `BeanFactoryPostProcessor` operates on the **bean configuration metadata**. That is, the Spring IoC container lets a `BeanFactoryPostProcessor` read the configuration metadata and potentially change it **before the container instantiates any beans** other than `BeanFactoryPostProcessor` instances.

**与 BeanPostProcessor 的核心区别：**
| | BeanPostProcessor | BeanFactoryPostProcessor |
|---|---|---|
| 操作对象 | Bean 实例（已经创建的对象） | Bean 配置元数据（BeanDefinition） |
| 操作阶段 | Bean 初始化前后 | 任何普通 Bean 实例化**之前** |
| 典型用途 | 代理包装、回调接口检查 | `${...}` 占位符替换、属性覆盖 |

> When registering a BeanFactoryPostProcessor via an `@Bean` factory method in a `@Configuration` class, **declare the method as static** to avoid lifecycle conflicts with annotation processing (such as @Autowired, @Value, and @PostConstruct) in the configuration class.

同样需要用 `static @Bean` 方法，原因跟 BeanPostProcessor 一致——避免提前实例化配置类。

> As with BeanPostProcessors, you typically do not want to configure BeanFactoryPostProcessors for **lazy initialization**. If no other bean references a Bean(Factory)PostProcessor, that post-processor will not get instantiated at all. Thus, marking it for lazy initialization will be **ignored**, and the Bean(Factory)PostProcessor will be instantiated **eagerly** even if you set the `default-lazy-init` attribute to `true` on the declaration of your `<beans/>` element.

**懒加载对 Bean(Factory)PostProcessor 无效**——容器会忽略其 `lazy-init` 设置，始终在启动时立即实例化它们。确保它们被容器检测到并注册。

### PropertySourcesPlaceholderConfigurer — 占位符替换

```xml
<bean class="org.springframework.context.support.PropertySourcesPlaceholderConfigurer">
    <property name="locations" value="classpath:com/something/jdbc.properties"/>
</bean>

<bean id="dataSource" class="org.apache.commons.dbcp.BasicDataSource" destroy-method="close">
    <property name="driverClassName" value="${jdbc.driverClassName}"/>
    <property name="url" value="${jdbc.url}"/>
    <property name="username" value="${jdbc.username}"/>
    <property name="password" value="${jdbc.password}"/>
</bean>
```

`locations`：指定外部 properties 文件的位置。
`properties`：除了从文件加载，还可以直接在 Bean 定义中硬编码属性值：

```xml
<bean class="org.springframework.beans.factory.config.PropertySourcesPlaceholderConfigurer">
    <property name="locations">
        <value>classpath:com/something/strategy.properties</value>
    </property>
    <property name="properties">
        <value>custom.strategy.class=com.something.DefaultStrategy</value>
    </property>
</bean>
<bean id="serviceStrategy" class="${custom.strategy.class}"/>
```

> The PropertySourcesPlaceholderConfigurer not only looks for properties in the Properties file you specify. By default, if it cannot find a property in the specified properties files, it checks against **Spring Environment properties** and regular **Java System properties**.

查找优先级：指定的 properties 文件 → Spring Environment → Java System properties。

> If you need to **modularize** the source of properties used for the replacement, you should not create multiple properties placeholders. Rather, you should create your own `PropertySourcesPlaceholderConfigurer` bean that gathers the properties to use.

不要创建多个 PropertySourcesPlaceholderConfigurer。应该用一个 Configurer，通过 `locations` 和 `properties` 属性集中管理所有属性来源。

简洁版配置：
```xml
<context:property-placeholder location="classpath:com/something/jdbc.properties"/>
```

### PropertyOverrideConfigurer — 外部文件覆盖 Bean 属性

```properties
# override.properties
dataSource.driverClassName=com.mysql.jdbc.Driver
dataSource.url=jdbc:mysql:mydb
tom.fred.bob.sammy=123
```

> Compound property names are also supported, as long as every component of the path except the final property being overridden is already non-null (**presumably** initialized by the constructors).

**"presumably"** = 据推测，想必。复合属性的处理：`tom.fred.bob.sammy=123` 对应 `tom.getFred().getBob().setSammy("123")`。在属性赋值阶段，`tom`、`fred`、`bob` 这些中间对象必须已经由构造函数初始化好了——因为 BeanFactoryPostProcessor 只是**修改 BeanDefinition 中的元数据**，并不是真的去调用 getter。

而 `resembles` = 类似于（PropertyOverrideConfigurer 和 PropertySourcesPlaceholderConfigurer 类似但不完全相同）。

> **Specified override values are always literal values. They are not translated into bean references.** This convention also applies when the original value in the XML bean definition specifies a bean reference.

**重要：** override 的值永远是字面量字符串，不会被翻译成 Bean 引用。即使原始 Bean 定义中某个属性值是 `<ref bean="..."/>`，用 PropertyOverrideConfigurer 覆盖它时，你写的值也只会被当成普通字符串，而不会解析为另一个 Bean 的引用。

```xml
<context:property-override location="classpath:override.properties"/>
```

这也等价于配置了一个 `PropertyOverrideConfigurer`，只需指定配置文件位置。

### FactoryBean — 自定义实例化逻辑

`FactoryBean<T>` 三个方法：
- `T getObject()` — 返回工厂生产的对象
- `boolean isSingleton()` — 返回 true 表示产物是单例（默认 true）
- `Class<?> getObjectType()` — 返回产物类型

> The `FactoryBean` concept and interface are used in a number of places within the Spring Framework. More than **50 implementations** of the `FactoryBean` interface ship with Spring itself.

`FactoryBean` 只替代容器的"反射调用构造函数"这一步骤，产物 Bean 的依赖注入、初始化回调、AOP 代理、销毁回调仍由 Spring 容器管理。

**as opposed to** = 与……相反，而不是（此处指用 Java 代码写复杂初始化逻辑，**而不是**写冗长的 XML 配置）。**verbose** = 冗长的，啰嗦的。

### getBean() 中 & 前缀获取 FactoryBean 本身

> When you need to ask a container for an actual FactoryBean instance itself instead of the bean it produces, prefix the bean's id with the ampersand symbol (`&`) when calling the `getBean()` method of the `ApplicationContext`. So, for a given `FactoryBean` with an id of `myBean`, invoking `getBean("myBean")` on the container returns the **product** of the `FactoryBean`, whereas invoking `getBean("&myBean")` returns the **FactoryBean instance** itself.

```java
// 获取 FactoryBean 生产的对象
MyService service = ctx.getBean("myBean", MyService.class);

// 获取 FactoryBean 实例本身（注意 & 前缀）
FactoryBean<MyService> factory = (FactoryBean<MyService>) ctx.getBean("&myBean");
```

## 句子解析

### 原文: "If you have complex initialization code that is better expressed in Java as opposed to a (potentially) verbose amount of XML, you can create your own FactoryBean."

- **翻译:** 如果你的初始化代码很复杂，用 Java 表达比用（可能）冗长的 XML 更好，你可以创建自己的 FactoryBean。
- **解析:** "as opposed to" = 与……相比/而不是，表对比。"verbose amount of XML" 中的 verbose 修饰 amount，强调 XML 配置量的庞大和啰嗦。"potentially" 放在括号里是软化语气，表示"在某些场景下可能"。

### 原文: "Compound property names are also supported, as long as every component of the path except the final property being overridden is already non-null (presumably initialized by the constructors)."

- **翻译:** 复合属性名也是支持的，只要路径中除被覆盖的最终属性之外的每个组件都已经非空（据推测是由构造函数初始化的）。
- **解析:** "compound" = 复合的。"as long as" = 只要（引导条件从句）。"presumably" 是副词修饰过去分词 "initialized"，表示一种合理的推测而非确定事实——作者推测中间对象应该在构造函数阶段已经被创建好了。

### 原文: "An application developer does not need to subclass ApplicationContext implementation classes. Instead, the Spring IoC container can be extended by plugging in implementations of special integration interfaces."

- **翻译:** 应用开发者不需要去继承 ApplicationContext 的实现类。相反，Spring IoC 容器是通过插入特定集成接口的实现来扩展的。
- **解析:** "plugging in" 是 plug 的动名词，呼应 extension point 的主题——扩展不是通过继承，而是通过实现接口并"插"入容器。这是 Spring 设计哲学的核心：组合优于继承。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| callback | n. | 回调 — 你写方法 + 注册给框架 + 框架在合适时机调用你 |
| post-processor | n. | 后置处理器（BeanPostProcessor / BeanFactoryPostProcessor） |
| autodetect | v. | 自动检测，自动识别 |
| eligible | adj. | 有资格的，符合条件的 |
| auto-proxying | n. | 自动代理（AOP 通过 BeanPostProcessor 实现） |
| eager initialization | n. | 饿汉初始化（提前、立即实例化，与 lazy init 相对） |
| metadata | n. | 元数据（BeanDefinition 中的配置信息） |
| placeholder | n. | 占位符（`${...}` 形式的可替换值） |
| override | v. | 覆盖（外部属性文件覆盖 XML 中定义的属性值） |
| compound | adj. | 复合的（点号分隔的多级属性路径） |
| presumably | adv. | 据推测，想必 |
| resemble | v. | 类似，像 |
| as opposed to | prep. phrase | 与……相反，而不是 |
| verbose | adj. | 冗长的，啰嗦的 |
| ampersand | n. | & 符号 |
| modularize | v. | 模块化（将属性来源拆分管理） |
| literal value | n. | 字面量值（不会被翻译成 Bean 引用） |
| means | n. | 方法，手段 |
