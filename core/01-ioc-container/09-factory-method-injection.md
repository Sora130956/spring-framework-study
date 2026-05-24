# Factory Method Injection (Lookup Method Injection)

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-method-injection.html

## 核心理解

单例 Bean A 在容器启动时只实例化一次。如果 A 中通过常规 DI（如 `@Autowired`）注入原型 Bean B，注入动作只发生在 A 创建时，因此 A 持有的 B 实例永远只有那一个——后续每次调用 A 的方法，用的都是同一个 B，原型作用域名存实亡。

Spring 的解决方案是 **Lookup Method Injection**：容器通过 CGLIB 动态生成 A 的子类，重写 A 的特定方法（lookup method），让这个方法每次被调用时都去容器中重新获取一个新的 B 实例。这种方式让单例 Bean 在"需要的时候"而非"创建的时候"获取原型 Bean，同时避免了让业务代码直接依赖 Spring 容器 API（`ApplicationContext`）。

## 关键点

### 问题本质

> Suppose singleton bean A needs to use non-singleton (prototype) bean B, perhaps on each method invocation on A. The container creates the singleton bean A only once, and thus only gets one opportunity to set the properties. The container cannot provide bean A with a new instance of bean B every time one is needed.

单例 Bean A 容器启动时只实例化一次 → 注入机会也只有一次 → 原型 Bean B 实际上也被"单例化"了。根本原因是：**DI 发生在 Bean 创建时，而不是方法调用时。**

### 一种思路（但不推荐）：让 Bean 持有容器引用

> make bean A aware of the container

- **make ... aware of**: 让……知道/感知到……

可以让单例 Bean 直接持有 `ApplicationContext` 引用，每次需要时手动 `getBean()`。但这样业务代码就耦合了 Spring 容器 API，违背了 IoC 原则——"框架调用你"变成了"你调用框架"。

### XML Lookup Method

> If the method is abstract, the dynamically-generated subclass implements the method. Otherwise, the dynamically-generated subclass overrides the concrete method defined in the original class.

XML 配置方式通过 `<lookup-method>` 标签声明，容器在运行时用 CGLIB 动态生成目标 Bean 的子类：
- 如果 lookup 方法是 abstract 的 → 子类**实现**它
- 如果 lookup 方法是 concrete 的 → 子类**重写**它

### 注解 Lookup Method — `@Lookup`

> Alternatively, within the annotation-based component model, you can declare a lookup method through the `@Lookup` annotation.

注解方式更简洁：在抽象方法上加 `@Lookup`。容器会通过 CGLIB 生成子类来实现这个方法，返回值类型决定从容器中取哪个 Bean。

```java
@Component
public abstract class CommandManager {
    public Object process() {
        Command command = createCommand();  // 每次调用都拿到新的 prototype Command
        return command.execute();
    }

    @Lookup
    protected abstract Command createCommand();
}
```

### "resolved against the declared return type" 的理解

> you can rely on the target bean getting resolved against the declared return type of the lookup method

- **resolved against**: 根据……来解析/查找。这个表达在技术文档中很常见。
- **declared return type**: 方法声明中的返回值类型（不是实际运行时返回的对象类型）。

意思是：**容器会根据 lookup 方法的声明返回值类型去容器中查找匹配的 Bean。** 比如上面 `createCommand()` 声明返回 `Command`，Spring 就去容器里找类型为 `Command` 的 Bean 来注入。如果声明返回 `void` 或者返回类型不明确，容器就不知道该查什么了。

## 句子解析

### 原文: "Suppose singleton bean A needs to use non-singleton (prototype) bean B, perhaps on each method invocation on A."

- **翻译:** 假设一个单例 Bean A 需要使用非单例（原型）Bean B，可能是在 A 的每次方法调用时都需要。
- **解析:** `perhaps on each method invocation on A` 是一个简化的状语，完整形式类似 `perhaps on each method invocation that happens on A`。"on each method invocation" 比 "each time a method is called" 更正式、更书面化。

### 原文: "you can rely on the target bean getting resolved against the declared return type of the lookup method"

- **翻译:** 你可以根据 lookup 方法的声明返回值类型来让容器解析出目标 Bean。
- **解析:**
  - 主句: `you can rely on [noun phrase]`
  - 名词短语核心: `the target bean getting resolved against ...` → 目标 Bean 被根据……来解析
  - `resolved against`: 这里的 against 表示"参照、依据"——参照返回值类型来解析
  - `getting resolved` 是被动语态的动名词形式，表示"被解析"这件事
  - 整句的实际含义：你只需要声明正确的返回类型，不需要额外配置，Spring 自动按类型匹配

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| forego | v. | 放弃、摒弃（= forgo） |
| distinguish | v. | 区分、辨别 |
| resolve against | phrase | 根据……来解析/查找（技术文档常见搭配） |
| subclass | n./v. | 子类 / 生成子类 |
| override | v. | 重写（方法） |
| concrete method | n. | 具体方法（有实现体的方法，对应 abstract method） |
| declared return type | n. | 声明的返回值类型 |
