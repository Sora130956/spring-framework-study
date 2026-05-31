# Using `@PostConstruct` and `@PreDestroy`

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/postconstruct-and-predestroy-annotations.html

## 核心理解

`@PostConstruct` 和 `@PreDestroy` 是 JSR-250 定义的生命周期注解（`jakarta.annotation.PostConstruct` / `jakarta.annotation.PreDestroy`），Spring 2.5 起支持。它们是 Spring 自身生命周期回调接口（`InitializingBean` / `DisposableBean`）和显式声明的回调方法之外的另一种选择。

只要 `CommonAnnotationBeanPostProcessor` 在 Spring ApplicationContext 中注册（`<context:annotation-config/>` 或 component scanning 下自动注册），标注了这两个注解的方法就会在与 Spring 生命周期接口方法相同的时机被调用：`@PostConstruct` 在初始化后调用，`@PreDestroy` 在销毁前调用。

注意：该注解从 JDK 9 起从 `javax.annotation` 迁移到了 `jakarta.annotation`（Jakarta EE 9+），需要添加 `jakarta.annotation-api` 依赖。

## 关键点

### 基本用法

> Provided that the CommonAnnotationBeanPostProcessor is registered within the Spring ApplicationContext, a method carrying one of these annotations is invoked at the same point in the lifecycle as the corresponding Spring lifecycle interface method or explicitly declared callback method.

```java
public class CachingMovieLister {

    @PostConstruct
    public void populateMovieCache() {
        // 初始化时预填充缓存
    }

    @PreDestroy
    public void clearMovieCache() {
        // 销毁时清空缓存
    }
}
```

### 版本历史与依赖

| JDK / Jakarta EE 版本 | 包位置 |
|---|---|
| JDK 6 ~ 8 | `javax.annotation`（JDK 自带） |
| JDK 9 ~ 10 | `javax.annotation`（已从核心模块分离） |
| JDK 11+ | `javax.annotation` 被移除 |
| Jakarta EE 9+ | `jakarta.annotation`（需额外引入 `jakarta.annotation-api`） |

## 句子解析

### 原文: "Provided that the CommonAnnotationBeanPostProcessor is registered within the Spring ApplicationContext, a method carrying one of these annotations is invoked at the same point in the lifecycle as the corresponding Spring lifecycle interface method or explicitly declared callback method."

- **翻译:** 只要 `CommonAnnotationBeanPostProcessor` 已在 Spring ApplicationContext 中注册，携带这些注解之一的方法就会在与相应 Spring 生命周期接口方法或显式声明的回调方法相同的生命周期节点被调用。
- **解析:** `Provided that` = 只要/如果（条件连词，比 `if` 更正式，强调必要前提）。`carrying one of these annotations` 是现在分词作后置定语，修饰 `a method`，意为"带有这些注解之一的"。`at the same point ... as ...` = 在与……相同的节点。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| provided that | conj. | 只要，如果（比 if 更正式，强调前提条件） |
| lifecycle | n. | 生命周期 |
| callback | n. | 回调 |
| initialize | v. | 初始化 |
| destroy | v. | 销毁 |
| explicitly | adv. | 显式地 |
| corresponding | adj. | 相应的，对应的 |
| pre-populate | v. | 预填充 |
| artifact | n. | 构件，制品（Maven 依赖的 jar 包） |
