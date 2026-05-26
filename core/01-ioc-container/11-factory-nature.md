# Customizing the Nature of a Bean

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/factory-nature.html

## 核心理解

Spring 提供了多层级的 Bean 生命周期干预机制。最基础的是**初始化回调**和**销毁回调**：初始化回调在所有依赖注入完成后调用，用于验证配置和准备数据结构；销毁回调在容器关闭时调用，用于释放资源。Spring 建议用 `@PostConstruct` / `@PreDestroy` 注解或 `init-method` / `destroy-method` 配置，而不是实现 `InitializingBean` / `DisposableBean` 接口——因为前者不耦合 Spring API。

往上一层是 **Lifecycle / SmartLifecycle** 接口，它们处理的是**运行时启动/停止**，不同于 init/destroy 的"出生/死亡"概念。`Lifecycle` 提供 `start()` / `stop()` / `isRunning()`，由容器在收到启动/停止信号时级联调用。`SmartLifecycle` 在此基础上增加了 `getPhase()`（控制启停顺序）、`isAutoStartup()`（容器 refresh 后自动启动）和 `stop(Runnable callback)`（支持异步停机 + 超时控制），适用于需要优雅启停的后台进程（如消息消费者、定时任务、连接池）。

还有一个实用特性：**destroy method inference**。Spring 会自动检测 `public close()` 或 `shutdown()` 方法作为销毁回调——Java 配置中 `@Bean` 的默认行为就是如此，自动匹配 `AutoCloseable` / `Closeable` 实现。

## 关键点

### 生命周期回调方式对比

Spring 提供三种方式控制 Bean 生命周期：

| 方式 | 初始化 | 销毁 | 耦合度 |
|------|--------|------|--------|
| Spring 接口 | `InitializingBean.afterPropertiesSet()` | `DisposableBean.destroy()` | 紧耦合 Spring |
| 自定义方法 | `init-method` / `@Bean(initMethod=)` | `destroy-method` / `@Bean(destroyMethod=)` | 无耦合 |
| JSR-250 注解 | `@PostConstruct` | `@PreDestroy` | 仅耦合标准注解 |

> As of Spring 2.5, you have three options for controlling bean lifecycle behavior... You can combine these mechanisms to control a given bean.

如果同一 Bean 配置了多种机制但**方法名不同**，执行顺序为：`@PostConstruct` → `InitializingBean` → 自定义 `init()`；销毁同理：`@PreDestroy` → `DisposableBean` → 自定义 `destroy()`。如果方法名相同，只执行一次。

### Destroy Method Inference（销毁方法自动推断）

> Spring also supports **inference of destroy methods**, detecting a public `close` or `shutdown` method. This is the default behavior for `@Bean` methods in Java configuration classes and automatically matches `java.lang.AutoCloseable` or `java.io.Closeable` implementations, not coupling the destruction logic to Spring either.

**重要：** 如果 Bean 实现了 `AutoCloseable` 或 `Closeable` 接口，Spring 会在销毁时**自动调用** `close()` 方法——无需任何额外配置。这是 Java 配置中 `@Bean` 的默认行为。

> You may assign the `destroy-method` attribute of a `<bean>` element a special `(inferred)` value, which instructs Spring to automatically detect a public `close` or `shutdown` method on the bean class for a specific bean definition.

在 XML 中，将 `destroy-method="(inferred)"` 即可启用同样的自动检测：
```xml
<bean id="dataSource" class="com.example.MyDataSource" destroy-method="(inferred)"/>
```

也可以在 `<beans>` 级别设置 `default-destroy-method="(inferred)"`，全局生效。

### Default Initialization and Destroy Methods（全局默认回调方法名）

> You can configure the Spring container to "look" for named initialization and destroy callback method names on every bean. This means that you, as an application developer, can write your application classes and use an initialization callback called `init()`, without having to configure an `init-method="init"` attribute with each bean definition.

**在 `<beans>` 级别统一约定方法名**，所有 Bean 自动匹配，无需逐个配置：

```xml
<beans default-init-method="init" default-destroy-method="destroy">
    <bean id="blogService" class="com.something.DefaultBlogService">
        <property name="blogDao" ref="blogDao"/>
    </bean>
</beans>
```

如果某个 Bean 的方法名不符合约定，仍然可以在 `<bean>` 上单独用 `init-method` / `destroy-method` 覆盖。

### 初始化回调用时机 — 在 AOP 代理创建之前

> The Spring container guarantees that a configured initialization callback is called immediately after a bean is supplied with all dependencies. Thus, the initialization callback is called on the **raw bean reference**, which means that AOP interceptors and so forth are **not yet applied** to the bean. A target bean is fully created first and then an AOP proxy (for example) with its interceptor chain is applied.

**精确时机：** 依赖注入完成 → 初始化回调（在原始 Bean 上） → AOP 代理创建

这意味着初始化方法在原始对象上执行，不会被 AOP 拦截器影响。这是刻意的设计——如果 init 方法也被代理拦截，当代码直接与原始 Bean 交互时（**bypassing**——绕过代理），行为会不一致。

### Lifecycle vs SmartLifecycle — start/stop 与 init/destroy 的区别

> Note that the regular `org.springframework.context.Lifecycle` interface is a plain contract for explicit **start and stop notifications** and does **not** imply auto-startup at context refresh time.

> Also, please note that **stop notifications are not guaranteed to come before destruction**. On regular shutdown, all Lifecycle beans first receive a stop notification before the general destruction callbacks are being propagated. However, on hot refresh during a context's lifetime or on stopped refresh attempts, only destroy methods are called.

**start/stop 和 init/destroy 是不同层面的东西：**

| | init / destroy | start / stop |
|---|---|---|
| 含义 | Bean 的"出生"与"死亡" | Bean 的"启动运行"与"暂停运行" |
| 调用时机 | 容器创建 Bean 时 / 容器关闭时 | 容器收到 start/stop 信号时 |
| 典型场景 | 验证配置、建立连接、释放资源 | 启动/停止后台线程、消息消费 |
| 是否保证 stop 在 destroy 前 | — | 正常关闭时保证，热刷新/启动失败时**不保证** |

简单说：init 是"造出来并装配好"，start 是"开始干活"；stop 是"暂停干活"，destroy 是"销毁掉"。一个 Bean 可以被 start/stop 多次，但 init/destroy 只各执行一次。

### SmartLifecycle — phase 控制启停顺序

> When starting, the objects with the lowest phase start first. When stopping, the reverse order is followed.

`SmartLifecycle` 继承 `Phased` 接口，通过 `getPhase()` 返回的整数值控制多个组件之间的启停顺序。phase 越小越先启动、越后停止：

```java
public interface SmartLifecycle extends Lifecycle, Phased {
    boolean isAutoStartup();        // refresh 后是否自动 start
    void stop(Runnable callback);   // 异步停机，完成后调用 callback.run()
}
```

> When considering the phase value, it is also important to know that the **default phase for any "normal" Lifecycle object that does not implement SmartLifecycle is 0**. Therefore, any **negative** phase value indicates that an object should start **before** those standard components (and stop **after** them). The **reverse** is true for any **positive** phase value.

**phase 规则总结：**
- `Integer.MIN_VALUE` → 最先启动，最后停止（基础设施，如连接池）
- 负数 → 比普通组件早启动、晚停止
- `0`（默认） → 普通 `Lifecycle` 组件的默认值
- 正数 → 比普通组件晚启动、早停止
- `Integer.MAX_VALUE` → 最后启动，最先停止（依赖其他组件运行的应用层组件）

**"spectrum"** = 范围、频谱，这里指 phase 值的整个连续范围（从 MIN_VALUE 到 MAX_VALUE）。

### SmartLifecycle.stop(callback) — 异步停机机制

> The `stop` method defined by `SmartLifecycle` accepts a callback. Any implementation must invoke that callback's `run()` method after that implementation's shutdown process is complete. That enables asynchronous shutdown where necessary, since the default implementation of the `LifecycleProcessor` interface, `DefaultLifecycleProcessor`, waits up to its timeout value for the group of objects within each phase to invoke that callback. The default per-phase timeout is **30 seconds**.

**异步停机流程：**
1. 容器关闭时，`DefaultLifecycleProcessor` 按 phase **从大到小**分组
2. 同一 phase 的 Bean **并发**调用 `stop(callback)`
3. 每个 Bean 在 `stop()` 中创建线程异步执行清理，完成后调用 `callback.run()`
4. `DefaultLifecycleProcessor` 等待同组所有 Bean 的 callback，默认超时 30 秒
5. 超时后直接进入下一 phase

对比：
- 旧 `Lifecycle.stop()` → 同步串行，一个一个等
- 新 `SmartLifecycle.stop(callback)` → 同组并发、异步、可超时

```java
public class MySmartLifecycleBean implements SmartLifecycle {
    private volatile boolean running = false;

    @Override
    public void stop(Runnable callback) {
        // 异步执行清理，完成后通知容器
        new Thread(() -> {
            // 清理逻辑...
            this.running = false;
            callback.run();  // 必须调用！通知容器该 Bean 停机完成
        }).start();
    }

    @Override
    public boolean isAutoStartup() { return true; }
    @Override
    public int getPhase() { return 0; }
    @Override
    public void start() { this.running = true; }
    @Override
    public void stop() { stop(() -> {}); }
    @Override
    public boolean isRunning() { return running; }
}
```

自定义超时时间：
```xml
<bean id="lifecycleProcessor" class="org.springframework.context.support.DefaultLifecycleProcessor">
    <property name="timeoutPerShutdownPhase" value="10000"/> <!-- 10 秒 -->
</bean>
```

### SmartLifecycle — 自动启动与容器 refresh 的配合

> When the context is refreshed (after all objects have been instantiated and initialized), that callback is invoked. At that point, the default lifecycle processor checks the boolean value returned by each SmartLifecycle object's `isAutoStartup()` method. If `true`, that object is started at that point rather than waiting for an explicit invocation of the context's or its own `start()` method.

**完整流程：**

```
容器 refresh()
  → 所有 Bean 实例化 + 依赖注入
  → 所有 Bean 初始化回调（@PostConstruct / init-method）
  → onRefresh() 被调用
    → 遍历所有 SmartLifecycle Bean
    → isAutoStartup() == true → 自动调用 start()（按 phase 从小到大）
  → 容器就绪

容器 close()
  → 按 phase 从大到小分组
  → 同组并发调用 stop(callback)
  → 等所有 callback.run() 或超时
  → 所有 Bean 的 destroy 回调（@PreDestroy / destroy-method）
```

`isAutoStartup()` 返回 `false` 的 Bean 不会被自动启动，需要手动调用 `context.start()` 或直接调用 Bean 的 `start()`。

### 非 Web 环境中注册 JVM Shutdown Hook

> If you use Spring's IoC container in a non-web application environment (for example, in a rich client desktop environment), register a shutdown hook with the JVM. Doing so ensures a graceful shutdown and calls the relevant destroy methods on your singleton beans so that all resources are released.

Web 应用中 Spring 已经自动处理了优雅关闭，但非 Web 环境（桌面应用、命令行工具等）需要手动注册：

```java
ConfigurableApplicationContext ctx = new ClassPathXmlApplicationContext("beans.xml");
ctx.registerShutdownHook();  // 注册 JVM shutdown hook
// 应用运行...
// JVM 退出前自动调用 ctx.close()，触发所有 destroy 回调
```

### Thread Safety and Visibility（线程安全与可见性）

> The Spring core container publishes created singleton instances in a thread-safe manner, guarding access through a singleton lock and guaranteeing visibility in other threads.

> Regular configuration fields do not have to be marked as `volatile` as long as they are only mutated during the initialization phase, providing visibility guarantees similar to `final` even for setter-based configuration state that is mutable during that initial phase.

Spring **只保证 Bean 发布那一刻的线程安全**：容器通过单例锁确保所有初始化完成后，Bean 的状态对所有线程可见。这意味着初始化期间赋值的配置字段不需要 `volatile`。

但如果初始化完成、Bean 发布之后，字段被修改（运行时状态变更），就必须自己处理线程安全：
- 简单字段 → `volatile`
- 复杂状态 → 并发容器（`ConcurrentHashMap` 等）或显式加锁

```java
@Component
public class MyBean implements SmartLifecycle {
    private String configValue;          // 初始化阶段设值，不需要 volatile
    private volatile boolean running;    // 运行时会变，需要 volatile

    @PostConstruct
    public void init() {
        this.configValue = "only set during init";  // 安全，Spring 保证可见性
    }

    @Override
    public void start() {
        this.running = true;  // 运行时修改，用了 volatile 才安全
    }
}
```

### Shutdown 阶段的特殊情况

> It is strongly recommended that the internal state in any such bean also allows for an immediate destroy callback **without a preceding stop** since this may happen during an extraordinary shutdown after a cancelled bootstrap or in case of a **stop timeout** caused by another bean.

正常关闭：`stop(callback)` → `destroy()`
异常情况可能直接：`destroy()` 而没有 `stop()`（启动失败、其他 Bean 超时导致）

所以 `destroy()` 方法的实现不能假设 `stop()` 一定已经调用过。

### ApplicationContextAware 和 BeanNameAware

实现 `ApplicationContextAware` 可以让 Bean 拿到创建它的 `ApplicationContext` 的引用，比如用来编程式地获取其他 Bean。实现 `BeanNameAware` 可以让 Bean 知道自己在容器中的名字。**但一般不推荐使用，因为耦合 Spring API，违背 IoC 原则。** 大部分场景下用 `@Autowired` 注入 `ApplicationContext` 就够。

> if the field, constructor, or method **in question** carries the `@Autowired` annotation.

**"in question"** = "正在讨论中的"、"提到的"。这里指"带有 `@Autowired` 注解的那个字段/构造器/方法"。

## 句子解析

### 原文: "If the target bean and the proxy are defined separately, your code can even interact with the raw target bean, bypassing the proxy."

- **翻译:** 如果目标 Bean 和代理是分开定义的，你的代码甚至可以直接与原始目标 Bean 交互，绕过代理。
- **解析:** "bypassing the proxy" 是现在分词作结果状语。"bypass" 本义为"绕过/旁路"，在编程语境中非常常用——绕过程序中的某个中间层。

### 原文: "At the other end of the spectrum, a phase value of Integer.MAX_VALUE would indicate that the object should be started last and stopped first"

- **翻译:** 在这个范围（spectrum 光谱/频谱/范围）的另一端，phase 值为 Integer.MAX_VALUE 意味着该对象应该最后启动、最先停止。
- **解析:** "spectrum" 本义为光谱，引申为"范围、幅度"。作者用 spectrum 这种物理词汇形象化地描述 phase 从 MIN_VALUE 到 MAX_VALUE 的连续范围。"at the other end of the spectrum" 是常用表达，即"另一端/另一极端"。

### 原文: "Thus, the initialization callback is called on the raw bean reference, which means that AOP interceptors and so forth are not yet applied to the bean."

- **翻译:** 因此，初始化回调是在原始的 Bean 引用上被调用的，这意味着此时 AOP 拦截器等等还没有应用到该 Bean。
- **解析:** "raw bean reference" 强调这是"未加工的/原始的"Bean，还没被代理包裹。"and so forth" = "等等/诸如此类"，正式写作中常用的列举收尾表达。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| inference | n. | 推断，推断（destroy method 自动检测） |
| inferred | adj. | 被推断的（`destroy-method="(inferred)"` 中的值） |
| AutoCloseable | n. | Java 标准接口，代表可自动关闭的资源 |
| Closeable | n. | Java IO 接口，代表可关闭的 IO 资源 |
| bypass | v. | 绕过，避开（绕过代理直接访问原始对象） |
| raw bean | n. | 原始 Bean（未经过 AOP 代理包装的） |
| convention | n. | 约定，规范（全局统一的方法命名约定） |
| cascade | v. | 级联，逐层传递（stop 信号传递到所有 Lifecycle Bean） |
| spectrum | n. | 范围，幅度（phase 从最小值到最大值的连续范围） |
| as of | prep. phrase | 从……开始（As of Spring 2.5 = 从 Spring 2.5 开始） |
| in question | adj. phrase | 正在讨论中的，所涉及的 |
| shutdown hook | n. | JVM 关闭钩子，JVM 退出前执行的回调 |
| guard | v. | 保护，守卫（guarding access through a singleton lock） |
| volatile | n./adj. | Java 关键字，保证字段跨线程可见性 |
| bootstrap | n. | 启动过程（cancelled bootstrap = 启动被取消） |
| time-bound | adj. | 有时间限制的（time-bound stop step） |
| sole | adj. | 唯一的（the sole instance = 唯一实例） |
