# Bean Scopes

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html

## 核心理解

Spring 的 Bean Scope（作用域）控制的是**一个 Bean Definition 能产生多少个对象实例**。把 Bean Definition 理解为"配方"（recipe），Scope 就是决定每次按配方做出来的是一份还是多份。Spring 支持 6 种 Scope：singleton（默认，每个容器一个实例）、prototype（每次获取新建一个）、以及 4 种 Web 专用 Scope（request、session、application、websocket）。

理解 Scope 的关键在于**依赖注入时生命周期不匹配的问题**。当你把一个短生命周期的 Bean（如 request-scoped）注入到长生命周期的 Bean（如 singleton）时，Spring 不能直接注入真实对象——因为 singleton 只初始化一次，注入的真实对象会"卡"在那个时间点。解决方案是注入一个 **AOP 代理**，代理在每次方法调用时从正确的 Scope 中取出真实对象并转发调用。这就是 `<aop:scoped-proxy/>` 的核心作用。

Prototype Scope 还有一个重要特点：**Spring 不管理 prototype Bean 的完整生命周期**。容器负责实例化、配置、组装，然后交给客户端，之后就不管了。尤其是销毁回调（destruction callbacks）不会被调用，客户端必须自己清理资源。

## 关键点

### Bean Definition 是"配方"

> When you create a bean definition, you create a recipe for creating actual instances of the class defined by that bean definition. The idea that a bean definition is a recipe is important, because it means that, **as with** a class, you can create many object instances from a single recipe.

**"as with"** = "和……一样"，用来做类比。这里的意思是：bean definition 就像 class 一样，一个配方可以创建多个对象实例。

> You can control not only the various dependencies and configuration values that are to be plugged into an object that is created from a particular bean definition but also control the scope of the objects created from a particular bean definition. This approach is powerful and flexible, because you can choose the scope of the objects you create through configuration instead of having to **bake in** the scope of an object at the Java class level.

Scope 是通过**配置**控制的，而不是在 Java 类中硬编码（bake in: 固化/写死进去）。这意味着同一个类可以根据需要配置不同的 Scope，非常灵活。

### 六大 Scope 概览

| Scope | 含义 |
|---|---|
| **singleton** | 默认。每个 IoC 容器中只创建一个实例 |
| **prototype** | 每次请求（注入或 getBean()）都创建新实例 |
| **request** | 每个 HTTP request 一个实例（仅 Web ApplicationContext 可用） |
| **session** | 每个 HTTP Session 一个实例（仅 Web 可用） |
| **application** | 每个 ServletContext 一个实例（仅 Web 可用） |
| **websocket** | 每个 WebSocket 会话一个实例（仅 Web 可用） |

### Singleton Scope — 跟 GoF 单例模式的区别

> This single instance is stored in a cache of such singleton beans, and all subsequent requests and references for that named bean return the cached object.

Spring 的 singleton 是用**缓存**实现的：第一次创建后存入缓存，后续请求直接返回缓存中的实例。

> Spring's concept of a singleton bean differs from the singleton pattern as defined in the **Gang of Four (GoF) patterns book**. The GoF singleton hard-codes the scope of an object such that one and only one instance of a particular class is created **per ClassLoader**. The scope of the Spring singleton is best described as being **per-container and per-bean**.

**Gang of Four (GoF)** = "四人帮"，指《Design Patterns: Elements of Reusable Object-Oriented Software》这本经典设计模式书的四位作者（Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides）。

GoF 单例 vs Spring singleton 的核心区别：

| | GoF Singleton | Spring Singleton |
|---|---|---|
| 范围 | 每个 ClassLoader 一个实例 | 每个容器、每个 bean definition 一个实例 |
| 实现方式 | 代码层面硬编码（private constructor + static 实例） | 容器通过缓存管理 |
| 灵活性 | 同一个类不能有多个"单例" | 同一个类可以在不同容器中各有一个实例 |

```xml
<!-- 默认就是 singleton，显式写出来是冗余的 -->
<bean id="accountService" class="com.something.DefaultAccountService"/>
<!-- 等价于 -->
<bean id="accountService" class="com.something.DefaultAccountService" scope="singleton"/>
```

Java 配置中 `@Bean` 默认也是 singleton，无需额外声明。

### Prototype Scope — 每次获取新建实例

> The non-singleton prototype scope of bean deployment results in the creation of a new bean instance every time a request for that specific bean is made. That is, the bean is injected into another bean or you request it through a `getBean()` method call on the container.

每次注入或调用 `getBean()` 都会创建新的 prototype 实例。

> **As a rule, you should use the prototype scope for all stateful beans and the singleton scope for stateless beans.**

**重要原则：有状态的 Bean 用 prototype，无状态的 Bean 用 singleton。** 因为 singleton 是共享的，如果带有状态（如用户数据），会产生数据串扰；prototype 每次给一个新实例，互不影响。

```xml
<bean id="accountService" class="com.something.DefaultAccountService" scope="prototype"/>
```

Java 配置：
```java
@Bean
@Scope("prototype")
public DefaultAccountService accountService() {
    return new DefaultAccountService();
}
```

> (A data access object (DAO) is not typically configured as a prototype, because a typical DAO does not hold any conversational state. It was easier for us to reuse the core of the singleton diagram.)

**"It was easier for us to reuse the core of the singleton diagram"** = "我们图省事，直接复用了 singleton 那幅图的核心部分"。作者在解释为什么 prototype 的图示和 singleton 的差不多——DAO 一般不配 prototype（因为它没有会话状态），所以原型图直接基于单例图改的。

> Spring does not manage the complete lifecycle of a prototype bean. The container instantiates, configures, and otherwise **assembles** a prototype object and hands it to the client, with no further record of that prototype instance.

**"assembles"** = 组装，这里指 Spring 容器完成实例化、配置、依赖注入这一整套"装配"流程。

> Thus, although initialization lifecycle callback methods are called on all objects **regardless of scope**, in the case of prototypes, configured destruction lifecycle callbacks are not called.

**重要：prototype Bean 的销毁回调不会被调用。** 容器不管 prototype Bean 的善后工作。

**"regardless of scope"** = "不管是什么 scope"，所有 scope 的 Bean 都会调用初始化回调，但 prototype 不会调用销毁回调。

> The client code must clean up prototype-scoped objects and release expensive resources that the prototype beans hold.

**重要：客户端必须自己清理 prototype Bean 持有的资源**（如数据库连接、文件句柄等）。可以尝试用自定义的 bean post-processor 来持有需要清理的 Bean 引用。

> In some respects, the Spring container's role in regard to a prototype-scoped bean is a replacement for the Java `new` operator. All lifecycle management past that point must be handled by the client.

**重要总结：Spring 对 prototype Bean 的角色 ≈ Java 的 `new` 操作符。** 创建并装配好之后，所有后续生命周期管理都是客户端的事。

### Singleton Bean 依赖 Prototype Bean 的问题

> When you use singleton-scoped beans with dependencies on prototype beans, be aware that dependencies are resolved at instantiation time. Thus, if you dependency-inject a prototype-scoped bean into a singleton-scoped bean, a new prototype bean is instantiated and then dependency-injected into the singleton bean. The prototype instance is the sole instance that is ever supplied to the singleton-scoped bean.

Singleton Bean 只在初始化时注入一次依赖。如果它依赖一个 prototype Bean，那个 prototype Bean 也只会被创建一次——之后 singleton 一直持有同一个 prototype 实例，失去了 prototype 的"每次新建"的语义。解决方案：**Method Injection**（参见上一节 lookup method injection）。

### Web 环境初始化配置

四种 Web Scope（request、session、application、websocket）需要 web-aware 的 ApplicationContext。

> If you access scoped beans within Spring Web MVC, in effect, within a request that is processed by the Spring **DispatcherServlet**, no special setup is necessary. DispatcherServlet already exposes all relevant state.

**为什么不需要额外配置？** DispatcherServlet 是 Spring MVC 的核心入口，它本身就负责处理 HTTP 请求。在处理请求的过程中，DispatcherServlet 已经自动把 HTTP request 对象绑定到了当前线程，所以 request/session 等 Web Scope 可以直接用。

**举个例子：** 一个 Spring MVC Controller 注入了一个 request-scoped Bean：
```java
@RestController
public class OrderController {
    @Autowired
    private ShoppingCart cart; // request-scoped
    // 每次 HTTP 请求自动拿到不同的 cart 实例
}
```
不需要任何额外配置，因为 DispatcherServlet 已经帮你准备好了。

> If you use a **Servlet web container**, with requests processed outside of Spring's DispatcherServlet (for example, when using JSF), you need to register the `org.springframework.web.context.request.RequestContextListener`.

**Servlet web container** 就是运行 Servlet 的容器，如 **Tomcat、Jetty、Undertow、GlassFish、WebLogic** 等。Spring Web MVC 是运行在这些容器之上的框架，但如果你绕过了 DispatcherServlet（比如直接用 JSF、Struts，或者写原生 Servlet），就需要手动注册 `RequestContextListener`。

```
浏览器请求 → Tomcat (Servlet Container) → DispatcherServlet → Controller
                                                 ↑ 这里自动绑定了 request 到线程
                                                 
浏览器请求 → Tomcat (Servlet Container) → JSF → Managed Bean
                                            ↑ 没有 DispatcherServlet，需要手动加 Listener
```

> **DispatcherServlet, RequestContextListener, and RequestContextFilter** all do exactly the same thing, namely **bind the HTTP request object to the Thread** that is servicing that request. This makes beans that are request- and session-scoped available further down the call chain.

**核心解释：这三者做的事情完全一样——把 HTTP request 对象绑定到当前处理请求的线程上。** 为什么这样就能让 request/session-scoped Bean 可用？因为 Spring 的 Web Scope 实现是通过 `ThreadLocal` 从当前线程获取 request 对象，再从 request 中获取/session 的范围内的 Bean 实例。

如果这三者都没有配置，当前线程就拿不到 HTTP request，Web Scope 的 Bean 就无法工作。

三种配置方式：
```xml
<!-- 方式1: Listener（适合非 Spring MVC 的 Web 应用） -->
<listener>
    <listener-class>org.springframework.web.context.request.RequestContextListener</listener-class>
</listener>

<!-- 方式2: Filter（Listener 有问题时的备选方案） -->
<filter>
    <filter-name>requestContextFilter</filter-name>
    <filter-class>org.springframework.web.filter.RequestContextFilter</filter-class>
</filter>
<filter-mapping>
    <filter-name>requestContextFilter</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

### Request Scope

> The Spring container creates a new instance of the LoginAction bean by using the loginAction bean definition **for each and every HTTP request**.

**重要结论：每个 HTTP 请求都会创建一个全新的 request-scoped Bean 实例。** 请求处理完成后，该实例被丢弃。

```java
@RequestScope
@Component
public class LoginAction {
    // 每个 HTTP 请求一个实例
}
```

### Session Scope

> **As with** request-scoped beans, you can change the internal state of the instance that is created as much as you want, knowing that other HTTP Session instances that are also using instances created from the same userPreferences bean definition do not see these changes in state, because they are particular to an individual HTTP Session.

"as with" = "跟……一样"（表类比）。Session Scope 里，每个 HTTP Session 有自己的 Bean 实例，不同 Session 之间的 Bean 状态完全隔离。

```java
@SessionScope
@Component
public class UserPreferences {
    // 每个 HTTP Session 一个实例
}
```

### Application Scope — 与 Singleton 的区别

> It is a singleton per **ServletContext**, not per Spring **ApplicationContext** (for which there may be several in any given web application)

**重要区别：** Application Scope 的 Bean 在整个 ServletContext 层面是唯一的，而 Singleton Bean 只在单个 ApplicationContext 内唯一。一个 Web 应用可以有多个 ApplicationContext（如父子容器），但只有一个 ServletContext。

**实例说明：** 一个 Spring MVC 应用通常有两个 ApplicationContext：
- **Root WebApplicationContext**（由 ContextLoaderListener 创建，包含 Service、DAO 等）
- **DispatcherServlet WebApplicationContext**（包含 Controller、ViewResolver 等）

```
ServletContext（整个 Web 应用只有一个）
├── Root ApplicationContext → 包含 singleton bean: userService
└── DispatcherServlet ApplicationContext → 包含 singleton bean: userController
```

如果 `userService` 是 singleton scope，在 Root 容器中只有一份。但如果两个容器中都定义了同名的 singleton Bean，它们各自有一个实例。

而 application-scoped Bean 直接绑定到 ServletContext，跨所有 ApplicationContext 只有一份。而且它作为 `ServletContext` 属性暴露出来，可以被非 Spring 的代码访问。

```java
@ApplicationScope
@Component
public class AppPreferences {
    // 整个 Web 应用只有一份，跨所有 ApplicationContext
}
```

### Scoped Beans 作为依赖 — AOP 代理

> The Spring IoC container manages not only the instantiation of your objects (beans), but also the **wiring up** of collaborators (or dependencies). If you want to inject (for example) an HTTP request-scoped bean into another bean of a longer-lived scope, you may choose to inject an AOP proxy in place of the scoped bean. That is, you need to inject a proxy object that exposes the same public interface as the scoped object but that can also retrieve the real target object from the relevant scope (such as an HTTP request) and delegate method calls onto the real object.

**核心概念：** 把一个短生命周期的 Bean 注入到长生命周期的 Bean 中时，Spring 不注入真实对象，而是注入一个**代理对象**。代理对象和真实对象有相同的接口，但每次方法调用时，代理会从当前 Scope（如 HTTP request）中取出**真实的实例**，然后把调用转发过去。

> When declaring `<aop:scoped-proxy/>` against a bean of scope prototype, **every method call on the shared proxy leads to the creation of a new target instance** to which the call is then being forwarded.

**Prototype + Scoped Proxy 的例子：**
```xml
<bean id="prototypeBean" class="com.example.PrototypeBean" scope="prototype">
    <aop:scoped-proxy/>
</bean>
<bean id="singletonBean" class="com.example.SingletonBean">
    <property name="prototypeBean" ref="prototypeBean"/>
</bean>
```
Singleton Bean 持有的是代理对象。每次调用 `prototypeBean.someMethod()` 时，代理会创建一个**全新的** PrototypeBean 实例，然后在该实例上执行方法。

### `<aop:scoped-proxy/>` 为什么需要？

> **Why do definitions of beans scoped at the request, session and custom-scope levels require the `<aop:scoped-proxy/>` element in common scenarios?**

**重要结论：** 核心原因是**生命周期不匹配**。Singleton Bean 只初始化一次，它的依赖也只在初始化时注入一次。如果直接把一个 session-scoped Bean 注入到 singleton Bean 中，那个 session-scoped 实例就永远"固定"在注入那一刻了。

> This is not the behavior you want when injecting a shorter-lived scoped bean into a longer-lived scoped bean... Rather, you need a single userManager object, and, for the lifetime of an HTTP Session, you need a userPreferences object that is specific to the HTTP Session.

**设计分析：**
1. `userManager` 是 singleton → 整个应用只有一个
2. `userPreferences` 是 session-scoped → 每个用户 Session 有自己的偏好设置
3. 如果直接注入，`userManager` 始终操作的是**第一个用户的** `userPreferences`
4. 用代理后，`userManager` 每次调用 `userPreferences.xxx()` 时，代理自动从当前 Session 取出对应用户的偏好设置

**完整配置：**
```xml
<bean id="userPreferences" class="com.something.UserPreferences" scope="session">
    <aop:scoped-proxy/>
</bean>
<bean id="userManager" class="com.something.UserManager">
    <property name="userPreferences" ref="userPreferences"/>
</bean>
```

相当于你注入了 `UserPreferences` 的代理对象而不是 UserPreferences 本身，代理对象在每次方法调用时，偷偷从当前 Session 中取出真正的 UserPreferences 对象来转发调用。

### CGLIB 代理 vs JDK 接口代理

> **CGLIB proxies do not intercept private methods. Attempting to call a private method on such a proxy will not delegate to the actual scoped target object.**

**重要：CGLIB 代理不能拦截 private 方法。** 因为 CGLIB 是通过生成子类来实现代理的，private 方法对子类不可见。如果你在 CGLIB 代理上调用 private 方法，它会直接在代理对象上执行，**不会**转发到真实的 Scoped Bean。

```xml
<!-- 默认是 CGLIB 代理 (proxy-target-class="true")，不要求实现接口 -->
<bean id="userPreferences" class="com.something.DefaultUserPreferences" scope="session">
    <aop:scoped-proxy/>
</bean>

<!-- JDK 接口代理: 要求 Bean 实现至少一个接口，且注入方必须通过接口引用 -->
<bean id="userPreferences" class="com.stuff.DefaultUserPreferences" scope="session">
    <aop:scoped-proxy proxy-target-class="false"/>
</bean>
<bean id="userManager" class="com.stuff.UserManager">
    <!-- ref 指向的是 UserPreferences 接口，不是实现类 -->
    <property name="userPreferences" ref="userPreferences"/>
</bean>
```

JDK 接口代理的两个前提：
1. Scoped Bean 的类必须实现至少一个接口
2. 所有注入该 Bean 的地方必须通过**接口**引用，不能通过具体类引用

### ObjectFactory / ObjectProvider / JSR-330 Provider 替代方案

> Also, scoped proxies are not the only way to access beans from shorter scopes in a lifecycle-safe fashion. You may also declare your injection point as `ObjectFactory<MyTargetBean>`, allowing for a `getObject()` call to retrieve the current instance on demand every time it is needed — without **holding on to** the instance or storing it separately.

**"holding on to"** = 持有不放、紧抓不放（固定搭配：hold on to sth）。

除了 `<aop:scoped-proxy/>`，还有三种替代方案：
```java
// 方案1: ObjectFactory
@Autowired
private ObjectFactory<MyTargetBean> beanFactory;
// 每次调用 getObject() 从当前 scope 获取最新实例

// 方案2: ObjectProvider (扩展版，多了 getIfAvailable, getIfUnique)
@Autowired
private ObjectProvider<MyTargetBean> beanProvider;

// 方案3: JSR-330 Provider
@Autowired
private Provider<MyTargetBean> beanProvider;
// 每次调用 get() 获取最新实例
```

### Custom Scopes — 自定义 Scope

通过实现 `org.springframework.beans.factory.config.Scope` 接口可以创建自定义 Scope：

```java
public interface Scope {
    Object get(String name, ObjectFactory<?> objectFactory);
    Object remove(String name);
    void registerDestructionCallback(String name, Runnable callback);
    String getConversationId();
}
```

两种注册方式：

**编程式注册：**
```java
Scope threadScope = new SimpleThreadScope();
beanFactory.registerScope("thread", threadScope);
```

**声明式注册（CustomScopeConfigurer）：**
```xml
<bean class="org.springframework.beans.factory.config.CustomScopeConfigurer">
    <property name="scopes">
        <map>
            <entry key="thread">
                <bean class="org.springframework.context.support.SimpleThreadScope"/>
            </entry>
        </map>
    </property>
</bean>
<bean id="thing2" class="x.y.Thing2" scope="thread">
    <property name="name" value="Rick"/>
    <aop:scoped-proxy/>
</bean>
```

声明式的优势：不需要写 Java 代码就能注册自定义 Scope，配置文件一条龙搞定。

## 句子解析

### 原文: "When you create a bean definition, you create a recipe for creating actual instances of the class defined by that bean definition."

- **翻译:** 当你创建一个 bean definition 时，你实际上是创建了一份"配方"，用来创建该 bean definition 所定义的那个类的真实实例。
- **解析:** 这句话的核心是把 bean definition 比喻为 recipe（配方）。主语 "you create a recipe" 后跟 "for creating..." 表示用途。这种 "recipe" 的比喻贯穿全文来帮助理解 Scope 概念。

### 原文: "each HTTP request has its own instance of a bean created **off the back of** a single bean definition."

- **翻译:** 每个 HTTP 请求都有自己的 Bean 实例，这些实例都基于同一份 bean definition 创建。
- **解析:** "off the back of" = "基于/凭借"（英式英语常用短语）。强调多个实例可以来自同一个定义/配方。主句是 "each HTTP request has its own instance"，"created off the back of..." 是过去分词短语作后置定语修饰 instance。

### 原文: "Spring does not manage the complete lifecycle of a prototype bean. The container instantiates, configures, and otherwise assembles a prototype object and hands it to the client, with no further record of that prototype instance."

- **翻译:** Spring 不管理 prototype bean 的完整生命周期。容器做的是：实例化、配置、以及组装 prototype 对象，然后将其交给客户端，之后就不再保留该 prototype 实例的任何记录了。
- **解析:** 三个并列动词 "instantiates, configures, assembles" 描述了容器的全部职责范围。"with no further record" 是介词短语作伴随状语，强调"交出去就不管了"。

### 原文: "The GoF singleton hard-codes the scope of an object such that one and only one instance of a particular class is created per ClassLoader. The scope of the Spring singleton is best described as being per-container and per-bean."

- **翻译:** GoF 的单例模式将对象的作用域硬编码，使得每个 ClassLoader 只创建某个类的唯一实例。而 Spring 的 singleton 最好描述为"针对每个容器、针对每个 bean definition"的单例。
- **解析:** "hard-codes" = 硬编码，指在代码层面通过 private constructor + static field 强制唯一性。"per-container and per-bean" 的结构清晰简洁，"per-" 前缀用法值得学习：per-container = 每个容器，per-bean = 每个 bean definition。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| recipe | n. | 配方，此处比喻 bean definition |
| as with | prep. phrase | 与……一样，如同 |
| off the back of | prep. phrase | 基于……，凭借…… |
| bake in | v. phrase | 固化进去，写死在代码里 |
| Gang of Four (GoF) | n. | "四人帮"，《设计模式》一书的四位作者 |
| per-container | adj. | 每个容器（一个） |
| per-bean | adj. | 每个 bean definition（一个） |
| assemble | v. | 组装（指依赖注入、配置等装配过程） |
| regardless of | prep. phrase | 不管，无论 |
| conversational state | n. | 会话状态（DAO 通常不持有） |
| destruction callback | n. | 销毁回调（prototype 不会被调用） |
| wiring up | n. | 装配，指依赖注入的连接过程 |
| delegate | v. | 委托，将方法调用转发给真实对象 |
| hold on to | v. phrase | 紧抓不放，持有 |
| ServletContext | n. | 整个 Web 应用共享的上下文对象 |
| per ServletContext | prep. phrase | 每个 Web 应用一个 |
| CGLIB | n. | 代码生成库，通过继承生成代理类 |
| intercept | v. | 拦截（private 方法不可被代理拦截） |
| programmatic | adj. | 编程式的（通过代码注册） |
| declaratively | adv. | 声明式地（通过配置注册） |
