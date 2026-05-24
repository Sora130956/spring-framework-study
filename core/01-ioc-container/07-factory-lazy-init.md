# Lazy-initialized Beans

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-lazy-init.html

## 核心理解

Spring 容器默认采用**饥饿初始化（eager initialization）**策略：`ApplicationContext` 启动时会立即创建并配置所有 singleton bean。这是一种"fail-fast"设计理念——如果配置有错误或环境有问题，启动时就能发现，而不是等到几小时甚至几天后某个请求触发时才暴露。

`@Lazy`（或 XML 中的 `lazy-init="true"`）可以扭转这一行为：被标记为 lazy 的 bean 不会在启动时创建，而是在**第一次被请求时**才实例化。但有一个重要例外：**如果 lazy bean 是某个非 lazy singleton bean 的依赖项，它仍然会在启动时被创建**，因为容器必须满足 singleton 的依赖链。所以 lazy-init 不是绝对的——它受依赖关系约束。

## 关键点

### Java 配置方式：`@Lazy`

```java
@Bean
@Lazy
ExpensiveToCreateBean lazy() {
    return new ExpensiveToCreateBean();
}

@Bean
AnotherBean notLazy() {
    return new AnotherBean();
}
```

### XML 配置方式：`lazy-init="true"`

```xml
<bean id="lazy" class="com.something.ExpensiveToCreateBean" lazy-init="true"/>
<bean name="notLazy" class="com.something.AnotherBean"/>
```

上面的配置中，容器启动时 `lazy` bean 不会被创建，而 `notLazy` 会被立即创建。

### 例外：lazy bean 被非 lazy singleton 依赖时

> When a lazy-initialized bean is a dependency of a singleton bean that is not lazy-initialized, the ApplicationContext creates the lazy-initialized bean at startup, because it must satisfy the singleton's dependencies.

即使 bean 被标记为 `@Lazy`，如果它被另一个非 lazy 的 singleton bean 引用，它还是会**在启动时被创建**。`@Lazy` 的理想生效前提是：没有任何非 lazy bean 直接或间接依赖它。

### 容器级别控制：`default-lazy-init`

```xml
<beans default-lazy-init="true">
    <!-- 此文件中的所有 bean 默认都是 lazy 的 -->
</beans>
```

```java
@Configuration
@Lazy
public class LazyConfiguration {
    // 此类中所有 @Bean 方法默认都是 lazy 的
}
```

可以用**全局**和**局部**两个层级控制 lazy 行为，类似于 `default-autowire` 的模式。

## 句子解析

### 原文: "Generally, this pre-instantiation is desirable, because errors in the configuration or surrounding environment are discovered immediately, as opposed to hours or even days later."

- **翻译:** 通常来说，这种预实例化是可取的，因为配置或运行环境中的错误会立即被发现，而不是几小时甚至几天后才暴露。
- **解析:**
  - **pre-instantiation:** pre- 前缀表示"预先"，即启动时就创建实例（= eager initialization）。
  - **is desirable:** = is good / is wanted，"是可取的、值得做的"。注意是 `desirable`（值得想要的），不是 `desired`（被想要的）。
  - **as opposed to:** = rather than / instead of，"而不是"——一个常见的对比结构，强调两种方案的差异。
  - **hours or even days later:** "几小时甚至几天后"——Spring 用这个夸张说法来强调延迟发现的代价有多高，体现 fail-fast 哲学的价值。

### 原文: "A lazy-initialized bean tells the IoC container to create a bean instance when it is first requested, rather than at startup."

- **翻译:** 被标记为懒初始化的 bean 告知 IoC 容器：在它第一次被请求时再创建实例，而非启动时就创建。
- **解析:**
  - **tells ... to ...:** "告诉/指示……去做……"，拟人化的表达，实际含义是"配置了 lazy-init 属性的 bean 定义指示容器……"。
  - **when it is first requested:** "当它第一次被请求时"——`it` 指代 a lazy-initialized bean。
  - **rather than:** "而不是"，固定搭配，连接两个对立的时机（startup vs first request）。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| pre-instantiation | n. | 预实例化，启动时就创建实例 |
| eager initialization | n. | 饥饿初始化，启动时立即创建所有 singleton |
| lazy-initialized | adj. | 懒初始化的，首次请求时才创建 |
| desirable | adj. | 可取的、值得想要的 |
| as opposed to | phr. | 而不是（对比结构） |
| satisfy dependencies | phr. | 满足依赖（必须先创建被依赖的对象） |
| pre-instantiate | v. | 预实例化（动词形式） |
