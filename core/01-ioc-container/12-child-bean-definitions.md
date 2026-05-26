# Bean Definition Inheritance

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/child-bean-definitions.html

## 核心理解

Bean Definition 继承是一种**配置模板机制**。父 Bean Definition 就像一个模板，定义了公共的配置（属性值、构造参数等），子 Bean Definition 通过 `parent` 属性继承这些配置，同时可以覆盖或追加。本质上是一种减少重复配置的方式，类似于类的继承。

父 Bean Definition 通常标记为 `abstract="true"`，表示它只是一个模板，不能被实例化。如果父 Bean 没有指定 `class`，则**必须**标记 `abstract="true"`。ApplicationContext 在预实例化 singleton 时会跳过 abstract Bean Definition。

在继承关系中，不同类型配置的优先级不同：**scope、init-method、destroy-method、static factory method、constructor arguments、property values、method overrides** 这些，子定义可以覆盖父定义；而 **depends-on、autowire mode、dependency check、singleton、lazy-init** 这五项，**永远以子定义为准**，父定义中的对应配置会被完全忽略。

## 关键点

### 子 Bean 覆盖父 Bean 的规则

子 Bean 从父 Bean **继承**以下内容（可被子 Bean 覆盖）：
- scope
- constructor argument values
- property values
- method overrides
- initialization method（init-method）
- destroy method（destroy-method）
- static factory method settings

> The remaining settings are always taken from the child definition: **depends on, autowire mode, dependency check, singleton, and lazy init.**

**正确。** 以下设置**始终以子 Bean 的配置为准**，父 Bean 中的对应配置被忽略（即使子 Bean 没有显式设置，也使用子 Bean 的默认值，而不是父 Bean 的值）：

| 配置项 | 说明 |
|---|---|
| `depends-on` | 依赖的 Bean |
| `autowire mode` | 自动装配模式（no / byName / byType / constructor） |
| `dependency check` | 依赖检查（已废弃，但规则不变） |
| `singleton` | 是否单例（Spring 1.x 遗留属性，现代用 scope） |
| `lazy-init` | 是否延迟初始化 |

```xml
<!-- 父 Bean：纯模板 -->
<bean id="baseDao" abstract="true">
    <property name="dataSource" ref="dataSource"/>
    <property name="maxRetries" value="3"/>
</bean>

<!-- 子 Bean：继承 dataSource 和 maxRetries，追加自己的配置 -->
<bean id="userDao" class="com.example.UserDao" parent="baseDao">
    <property name="tableName" value="users"/>
</bean>
```

### 父 Bean class 属性可省略

```xml
<!-- 不指定 class，仅作为属性模板 -->
<bean id="baseTemplate" abstract="true">
    <property name="name" value="parent"/>
    <property name="age" value="1"/>
</bean>

<!-- 子 Bean 必须指定 class -->
<bean id="child" class="org.springframework.beans.DerivedTestBean" parent="baseTemplate" init-method="initialize">
    <property name="name" value="override"/>
    <!-- age 继承自父模板，值为 1 -->
</bean>
```

父 Bean 如果没有指定 `class`，**必须**显式标记 `abstract="true"`，否则容器会报错。

### 子 Bean 可以指定不同的 class

> A child bean definition uses the bean class from the parent definition if none is specified but can also override it. In the latter case, the child bean class must be compatible with the parent (that is, it must accept the parent's property values).

子 Bean 可以覆盖父 Bean 的 `class`，但前提是子类的类型**兼容**父类——即父 Bean 中定义的 property values 必须对子类有对应的 setter。

### abstract 的父 Bean 不可实例化

> ApplicationContext pre-instantiates all singletons by default. Therefore, it is important (at least for singleton beans) that if you have a (parent) bean definition which you intend to use only as a template, and this definition specifies a class, you must make sure to set the abstract attribute to true.

即使父 Bean 指定了 `class`，只要标记 `abstract="true"`，容器就不会实例化它。引用 it 或 `getBean()` 都会报错。容器的 `preInstantiateSingletons()` 也会跳过 abstract 定义。

## 句子解析

### 原文: "A child bean definition inherits configuration data from a parent definition. The child definition can override some values or add others as needed."

- **翻译:** 子 Bean 定义从父定义继承配置数据。子定义可以根据需要覆盖某些值或追加其他值。
- **解析:** 简洁的并列句。注意 "as needed" = "根据需要进行"，是 "as it is needed" 的省略形式。"or add others" 中的 others 指 other values。

### 原文: "The remaining settings are always taken from the child definition: depends on, autowire mode, dependency check, singleton, and lazy init."

- **翻译:** 其余设置始终以子定义为准：depends-on、自动装配模式、依赖检查、singleton 和 lazy-init。
- **解析:** "are always taken from" = "始终从……取"，强调优先级不可协商。"the remaining settings" 指前面列出的可覆盖项之外的所有配置项。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| templating | n. | 模板化（bean definition inheritance 本质上是一种模板机制） |
| override | v. | 覆盖（子 Bean 覆盖父 Bean 的配置值） |
| compatible | adj. | 兼容的（子类必须兼容父类的属性） |
| pre-instantiate | v. | 预实例化（容器启动时提前创建 singleton） |
| remaining | adj. | 剩余的，其余的 |
| abstract | adj. | 抽象的（标记为 abstract 的 bean 不可实例化） |
| declaratively | adv. | 声明式地（通过 XML 配置而非编程方式） |
