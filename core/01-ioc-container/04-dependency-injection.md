# Dependency Injection — Constructor-based vs Setter-based DI

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html

## 核心理解

Spring 官方**明确推荐构造器注入（constructor injection）**作为首选 DI 方式。核心理由有三：第一，构造器注入使得依赖在对象创建时就全部就绪，保证了**不可变性**——依赖一旦设定就不会再变；第二，构造器注入的依赖天然不可为 null，消除了 NPE 风险；第三，当一个类构造参数过多时，它是一个**代码坏味道**信号，提示该类职责过重需要重构——构造器注入把这种设计问题暴露得早、暴露得明显。

setter 注入虽然不推荐作为首选，但有其不可替代的场景：**循环依赖**是构造器注入的死穴，setter 注入可以解开；**JMX MBean 管理**需要在运行时动态 rewire 依赖，setter 提供了这种灵活性；**第三方类**没有 setter 时当然只能走构造器注入。最终原则是 pragmatic 的——"Use the DI style that makes the most sense for a particular class"。

容器的"预实例化单例"默认行为背后是一个实用设计决策：尽早暴露配置错误。IoC 容器在启动时就构造所有单例 bean 并注入其依赖，这意味着配置失误（如依赖类型不匹配）会在启动时立即抛出异常，而不是等到生产环境实际使用时才爆炸。这个行为之所以有意义，正是因为正常流程中依赖 bean 在被注入前必须完全初始化——如果容器不做预实例化，这些潜在的错误可能无限期潜伏。

## 关键点

### Spring 推荐构造器注入

> The Spring team generally advocates constructor injection, as it lets you implement application components as immutable objects and ensures that required dependencies are not `null`. Furthermore, constructor-injected components are always returned to the client (calling) code in a fully initialized state. As a side note, a large number of constructor arguments is a **bad code smell**, implying that the class likely has too many responsibilities and should be refactored to better address proper separation of concerns.

Spring 团队推荐构造器注入的三个原因：

1. **不可变对象**：依赖通过构造器在创建时一次性注入，之后不可改，这使得组件天然线程安全、状态简单
2. **依赖不为 null**：构造器强制传入所有依赖，编译器层面杜绝了 null
3. **完全初始化**：返回给调用方的对象总是就绪的，"半成品"对象不存在

更有意思的是第四层含义——**坏味道警示器**：当一个构造器参数太多，它不是"用什么 DI 方式"的问题，而是"这个类是不是该拆了"的问题。构造器注入把设计缺陷暴露得很扎眼，setter 注入反而会掩盖它（十几个 setter 看起来没那么刺眼）。

```java
// ✅ 推荐: 构造器注入 — 依赖不可变、非null、完全初始化
@Service
public class OrderService {

    private final PaymentGateway paymentGateway;
    private final InventoryService inventoryService;
    private final NotificationService notificationService;

    // 构造参数过多 (比如超过 4-5 个) → 考虑拆分类
    public OrderService(PaymentGateway paymentGateway,
                        InventoryService inventoryService,
                        NotificationService notificationService) {
        this.paymentGateway = paymentGateway;
        this.inventoryService = inventoryService;
        this.notificationService = notificationService;
    }
}
```

### setter 注入的特殊场景：可重配置性 & JMX

> One benefit of setter injection is that setter methods make objects of that class amenable to reconfiguration or re-injection later. Management through **JMX MBeans** is therefore a compelling use case for setter injection.

setter 注入的核心价值在于**运行时可变性**。当你需要在运行时动态替换依赖（而不是只在启动时配置好就固定不变）时，setter 是必须的。JMX MBean 是最典型场景——通过 JMX 管理控制台在运行时热修改某个 bean 的依赖配置。

```java
// JMX MBean — 需要在运行时动态修改配置，setter 注入是更好的选择
@Component
@ManagedResource(objectName = "com.example:type=ConfigManager")
public class DynamicConfigManager {

    private DataSource dataSource;
    private int timeoutSeconds = 30;

    @Autowired
    public DynamicConfigManager(DataSource dataSource) {
        this.dataSource = dataSource;  // 不变的依赖仍用构造器
    }

    @ManagedAttribute
    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    @ManagedAttribute
    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;  // 运行时可热修改的值用 setter
    }
}
```

JMX 的典型场景还包括：运行时切换数据源、调整线程池大小、修改缓存过期时间等。这些值需要在运行时 tweak，setter 是唯一选择。

### 第三方类的选择是被动的

> Use the DI style that makes the most sense for a particular class. Sometimes, when dealing with **third-party classes** for which you do not have the source, the choice is made for you. For example, if a third-party class does not expose any setter methods, then constructor injection may be the only available form of DI.

**技术层面**：第三方库的类没有源码，你改不了它。它只有构造器接收参数 → 你只能构造器注入；它只有 setter → 你只能 setter 注入；它两种都有 → 你可以选择。主动权在库作者手里。

**英语层面**："the choice is made for you" 是一个地道表达——"选择已经被替你做完了"，被动语态突出了一种「你无能为力」的无奈感。类似表达：`the decision is out of your hands`。

### 依赖解析不匹配可能延迟暴露

> Note that resolution mismatches among those dependencies may show up late — that is, on first creation of the affected bean.

`resolution mismatch` 指依赖类型不匹配、Bean 定义缺失等 DI 配置错误。如果在懒加载或 prototype scope 的场景下，这些错误不会在容器启动时暴露，而是等到 bean **首次被创建时**才抛出异常——可能几小时后、几天后，甚至上线后才出现。这非常危险。

为解决这个问题，`ApplicationContext` 默认**预实例化所有单例 bean**：

> This potentially delayed visibility of some configuration issues is why `ApplicationContext` implementations by default **pre-instantiate singleton beans**. At the cost of some upfront time and memory to create these beans before they are actually needed, you discover configuration issues in the `ApplicationContext` when it is created, not later.

这是 Spring 容器的一个**有意识的设计权衡**：用启动时的额外开销（时间和内存）换取配置问题的尽早暴露。不是 bug，是 feature。

### 循环依赖 —— 构造器注入的死穴

> If you use predominantly constructor injection, it is possible to create an unresolvable circular dependency scenario.
>
> For example: Class A requires an instance of class B through constructor injection, and class B requires an instance of class A through constructor injection. If you configure beans for classes A and B to be injected into each other, the Spring IoC container detects this circular reference at runtime, and throws a `BeanCurrentlyInCreationException`.
>
> One possible solution is to edit the source code of some classes to be configured by setters rather than constructors. Alternatively, avoid constructor injection and use setter injection only. In other words, **although it is not recommended, you can configure circular dependencies with setter injection**.

构造器注入无法解决"鸡生蛋蛋生鸡"的循环依赖问题。A 的构造器需要 B 的实例，B 的构造器需要 A 的实例 → 谁都创建不出来 → `BeanCurrentlyInCreationException`。

setter 注入的解决逻辑：Spring 可以先创建 A 的半成品（调用无参构造器），再把半成品 A 注入给 B，B 再注入回 A 的 setter。构造器注入做不到—因为在构造器阶段对象还没创建出来，无"半成品"可言。

> Unlike the typical case (with no circular dependencies), a circular dependency between bean A and bean B forces one of the beans to be injected into the other **prior to being fully initialized itself** (a classic chicken-and-egg scenario).

```java
// ❌ 构造器注入 → 循环依赖 → BeanCurrentlyInCreationException
@Component
public class ServiceA {
    private final ServiceB serviceB;
    public ServiceA(ServiceB serviceB) { this.serviceB = serviceB; }
}

@Component
public class ServiceB {
    private final ServiceA serviceA;
    public ServiceB(ServiceA serviceA) { this.serviceA = serviceA; }
}
```

```java
// ✅ setter 注入可以解开循环依赖（不推荐，但能跑）
@Component
public class ServiceA {
    private ServiceB serviceB;
    @Autowired
    public void setServiceB(ServiceB serviceB) { this.serviceB = serviceB; }
}

@Component
public class ServiceB {
    private ServiceA serviceA;
    @Autowired
    public void setServiceA(ServiceA serviceA) { this.serviceA = serviceA; }
}
```

更好的办法是**重构消除循环依赖**——提取公共逻辑到第三个类，或引入接口打破直接耦合。

### 正常流程：依赖在注入前被完全初始化

> If no circular dependencies exist, when one or more collaborating beans are being injected into a dependent bean, **each collaborating bean is totally configured prior to being injected** into the dependent bean. This means that, if bean A has a dependency on bean B, the Spring IoC container completely configures bean B prior to invoking the setter method on bean A. In other words, the bean is instantiated (if it is not a pre-instantiated singleton), its dependencies are set, and the relevant lifecycle methods (such as a configured init method or the `InitializingBean` callback method) are invoked.

这是 Spring 容器的最基本保证：**被依赖的 bean 总是先于依赖方完全初始化**。B 在注入给 A 时，B 已经经历了完整的生命周期：实例化 → 依赖注入 → `@PostConstruct` / `InitializingBean.afterPropertiesSet()` 回调 → 就绪。这意味着 A 收到的 B 是完全可用的，不是一个"还在装配中的半成品"。

### Examples of Dependency Injection — 构造器 XML 配置

```xml
<!-- 构造器注入: constructor-arg -->
<bean id="simpleMovieLister" class="examples.SimpleMovieLister">
    <constructor-arg ref="movieFinder"/>
</bean>

<bean id="movieFinder" class="examples.MovieFinder"/>
```

```java
// 对应的 Java 类
public class SimpleMovieLister {
    private final MovieFinder movieFinder;

    public SimpleMovieLister(MovieFinder movieFinder) {
        this.movieFinder = movieFinder;
    }
}
```

### 构造器参数名解析的三种方式

Spring 决定哪个构造参数匹配哪个 `<constructor-arg>` 有三种策略：

```xml
<!-- 方式 1: 按顺序 — 隐式，参数顺序必须精确匹配 -->
<bean id="thingOne" class="x.y.ThingOne">
    <constructor-arg ref="beanOne"/>
    <constructor-arg ref="beanTwo"/>
    <constructor-arg value="something@somewhere.com"/>
</bean>

<!-- 方式 2: 按 type 匹配 — 构造器唯一时可用 -->
<bean id="exampleBean" class="examples.ExampleBean">
    <constructor-arg type="int" value="7500000"/>
    <constructor-arg type="java.lang.String" value="42"/>
</bean>

<!-- 方式 3: 按 index 显式指定 — 最精确 -->
<bean id="exampleBean" class="examples.ExampleBean">
    <constructor-arg index="0" value="7500000"/>
    <constructor-arg index="1" value="42"/>
</bean>

<!-- 方式 4: 按 name 指定 — 需要 debug 编译标志或 @ConstructorProperties -->
<bean id="exampleBean" class="examples.ExampleBean">
    <constructor-arg name="years" value="7500000"/>
    <constructor-arg name="ultimateAnswer" value="42"/>
</bean>
```

### 静态工厂方法的构造器注入

> Now consider a variant of this example, where, instead of using a constructor, Spring is told to call a **static factory method** to return an instance of the object:

```xml
<!-- 直接构造器: 自解释 -->
<bean id="clientService" class="examples.ClientService"/>

<!-- 静态工厂方法: factory-method 指定工厂方法 -->
<bean id="clientService" 
      class="examples.ClientService"
      factory-method="createInstance"/>
```

此时 class 属性不再指定"要创建的对象的类型"，而是指定**包含静态工厂方法的类的类型**。

```java
public class ClientService {
    private static ClientService clientService = new ClientService();

    private ClientService() {}

    public static ClientService createInstance() {
        return clientService;
    }
}
```

### 实例工厂方法的依赖注入

除了静态工厂，Spring 也支持实例工厂方法——你需要先有一个工厂 bean 实例，再调用它的方法创建目标对象：

```xml
<!-- 先定义工厂 bean -->
<bean id="serviceLocator" class="examples.DefaultServiceLocator"/>

<!-- 通过工厂 bean 的实例方法创建目标对象 -->
<bean id="clientService"
      factory-bean="serviceLocator"
      factory-method="createClientServiceInstance"/>
```

```java
public class DefaultServiceLocator {
    private static ClientService clientService = new ClientService();
    public ClientService createClientServiceInstance() {
        return clientService;
    }
}
```

### 静态工厂方法返回类型不必与工厂类一致

> The type of the class being returned by the factory method does **not** have to be of the same type as the class that contains the static factory method.

这是一个非常灵活的设计——工厂类和产品类可以是完全不同的类型。这基本就是 GoF 工厂方法模式 + IoC 容器管理的结合体。工厂类负责复杂的创建逻辑（读取配置、从注册中心查找、按条件返回不同实现），而容器只需声明调用哪个工厂方法。

```java
// 工厂类: DefaultServiceLocator
// 产品类: ClientService
// 两者完全不同，类型无关
public class DefaultServiceLocator {
    // 这里可以做复杂逻辑: 读配置、判断环境、选择策略等
    public static ClientService createInstance() {
        // 比如: if (prod) return new ProdClientService(); else return new DevClientService();
        return new ClientServiceImpl();
    }
}
```

## 句子解析

### 原文: "the choice is made for you"

- **翻译:** 这个选择（指选哪种 DI 方式）已经替你做好了。
- **解析:** 被动语态 `is made` + 介词 `for` 表示 "替…" 的受益关系。这个表达传达出一种被动接受的语气——不是你能决定的。类似用法：`The decision has already been made for us.` / `Dinner's on the company — it's paid for.`

### 原文: "a classic chicken-and-egg scenario"

- **翻译:** 经典的先有鸡还是先有蛋的困境。
- **解析:** `chicken-and-egg` 是英语中的固定成语，指两个事物互为前提、无法确定先后的矛盾局面。这个表达在技术文档中很常见，用来描述循环依赖。其他常见的类似表达：`catch-22`（两难困境，来自小说《第22条军规》）。

### 原文: "This potentially delayed visibility of some configuration issues is why ApplicationContext implementations by default pre-instantiate singleton beans"

- **翻译:** 正是这种（配置问题）可能延迟暴露的特性，解释了为什么 ApplicationContext 实现默认预实例化单例 bean。
- **解析:** 句子主干：`This ... is why ...`（这就是为什么…）。`This` 指代上一句提到的 "resolution mismatches may show up late"。"delayed visibility" 这个短语很值得记忆——`visibility` 在技术语境中常表示"问题被看到/被发现"，`delayed visibility` = 问题延迟暴露。`pre-instantiate` 是 `instantiate`（实例化）+ `pre-`（预先），意为在需要之前就创建实例。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| constructor injection | n. | 构造器注入 |
| setter injection | n. | setter方法注入 |
| immutable objects | n. | 不可变对象 |
| bad code smell | n. | 代码坏味道（Martin Fowler 提出，指代码中存在深层设计问题的征兆） |
| reconfiguration | n. | 重新配置，运行时修改 |
| JMX MBeans | n. | Java Management Extensions Managed Beans，运行时管理接口 |
| resolution mismatch | n. | 解析不匹配（DI 依赖配置错误） |
| pre-instantiate | v. | 预实例化，提前创建 |
| circular dependency | n. | 循环依赖 |
| chicken-and-egg | adj. | 先有鸡还是先有蛋的（困境） |
| factory method | n. | 工厂方法（GoF 设计模式） |
| collaborating beans | n. | 协作 bean，互相依赖的 bean |
| fully initialized | adj. | 完全初始化的 |
| lifecycle methods | n. | 生命周期回调方法 |
| upfront | adv. | 预先地，前期地（通常指 "upfront cost" — 前期代价） |
