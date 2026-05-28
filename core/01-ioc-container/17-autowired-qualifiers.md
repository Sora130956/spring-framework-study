# Fine-tuning Annotation-based Autowiring with Qualifiers

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html

## 核心理解

当 `@Primary` 或 `@Fallback` 不够精细时（比如有多个同类型 Bean 且无法简单地用"选一个最优"来解决），Spring 提供了 `@Qualifier` 注解来进一步缩小候选范围。

`@Qualifier` 的核心语义是：**在类型匹配的候选集合中，按限定符值进行筛选（narrowing）**。它不是指向某个唯一 bean id 的引用，而是描述 Bean 特征的标签。好的 qualifier 值（如 `main`、`EMEA`、`persistent`）与 bean id 无关，更多表达该组件的特性。

与 `@Resource`（JSR-250）的对比是理解 `@Qualifier` 的关键：`@Resource` 是纯按名称查找，完全不关心类型；而 `@Autowired` 是先按类型筛选候选者，再用 qualifier 在候选者中进一步缩小范围。

Spring 还支持自定义 qualifier 注解（用 `@Qualifier` 元注解标注的自定义注解），可以定义多个属性来精确匹配（如 `@MovieQualifier(genre="Action", format=Format.DVD)`），所有属性必须同时匹配才视为候选。

## 关键点

### 基本用法 — 在字段、构造器参数、方法参数上使用 `@Qualifier`

`@Qualifier` 可以标注在字段、单个构造器参数或方法参数上，用 qualifier 值来缩小类型匹配范围：

```java
// 字段注入
public class MovieRecommender {
    @Autowired
    @Qualifier("main")
    private MovieCatalog movieCatalog;
}

// 构造器/方法参数注入
public class MovieRecommender {
    @Autowired
    public void prepare(@Qualifier("main") MovieCatalog movieCatalog,
                        CustomerPreferenceDao customerPreferenceDao) {
        // ...
    }
}
```

### Bean Name 作为默认 Qualifier（Fallback Match）

> For a fallback match, the bean name is considered a default qualifier value. Thus, you can define the bean with an id of main instead of the nested qualifier element, leading to the same matching result. However, although you can use this convention to refer to specific beans by name, @Autowired is fundamentally about type-driven injection with optional semantic qualifiers. This means that qualifier values, even with the bean name fallback, always have narrowing semantics within the set of type matches. They do not semantically express a reference to a unique bean id. Good qualifier values are main or EMEA or persistent, expressing characteristics of a specific component that are independent from the bean id.

关键理解：**Qualifier 是用来缩小候选范围的过滤条件，不是指向特定 bean id 的指针。**

- Bean 的 id 可以作为默认的 qualifier 值（fallback match），所以 `@Qualifier("main")` 能匹配到 `id="main"` 的 Bean
- 但这只是"碰巧能用"，`@Autowired` 的本质是**类型驱动注入 + 可选的语义限定符**
- 好的 qualifier 值（如 `main`、`EMEA`、`persistent`）是描述**组件特征**的，与 bean id 无关（bean id 可能在匿名 Bean 定义时自动生成）

### Qualifier 与类型化集合

> Qualifiers also apply to typed collections, as discussed earlier — for example, to Set<MovieCatalog>. In this case, all matching beans, according to the declared qualifiers, are injected as a collection. This implies that qualifiers do not have to be unique. Rather, they constitute filtering criteria. For example, you can define multiple MovieCatalog beans with the same qualifier value "action", all of which are injected into a Set<MovieCatalog> annotated with @Qualifier("action").

Qualifier 不要求唯一。多个 Bean 可以有相同的 qualifier 值，它们**构成（constitute）过滤条件**：

```java
@Autowired
@Qualifier("action")
private Set<MovieCatalog> actionCatalogs;  // 所有 qualifier="action" 的 Bean 都会被注入
```

### 无 `@Qualifier` 时的 Bean Name 匹配（Spring 6.1+/6.2）

即使注入点没有 `@Qualifier` 注解，当存在多个同类型候选 Bean 且没有 `@Primary`/`@Fallback` 等解析指示器时，Spring 会将**注入点名称（字段名或参数名）**与目标 Bean 名称匹配，选择同名候选者。

- 自 Spring 6.1 起，需要 `-parameters` 编译标志来保留参数名
- 自 Spring 6.2 起，参数名匹配时容器会走快速短路解析，跳过完整的类型匹配算法

### `@Autowired` vs `@Resource` — 关键差异

> As an alternative for injection by name, consider the JSR-250 @Resource annotation which is semantically defined to identify a specific target component by its unique name, with the declared type being irrelevant for the matching process.

> @Autowired has rather different semantics: after selecting candidate beans by type, the specified String qualifier value is considered within those type-selected candidates only.

| | `@Autowired` + `@Qualifier` | `@Resource` (JSR-250) |
|---|---|---|
| 匹配机制 | 先按类型筛选，再按 qualifier 在候选者中缩小范围 | 纯按名称查找，**完全不关心声明的类型** |
| 类型不匹配时 | 候选集合中找不到匹配的 qualifier 值时抛异常 | 容器启动时抛 `BeanNotOfRequiredTypeException` |
| 支持注入点 | 字段、构造器、多参数方法 | 仅字段和单参数 setter 方法 |
| 适用场景 | 类型驱动注入 + 语义限定 | 按名称注入特定组件、集合/Map/数组类型的 Bean |

### `@Resource` 的适用场景

> For beans that are themselves defined as a collection, Map, or array type, @Resource is a fine solution, referring to the specific collection or array bean by unique name.

当 Bean 本身的类型就是集合/Map/数组时，`@Resource` 是好的选择，因为它按名称直接引用该集合 Bean。不过 `@Autowired` 也能处理集合类型，只要元素类型信息在 `@Bean` 返回类型签名或集合继承层级中保留。

### `@Autowired` 的注入点限制

> @Autowired applies to fields, constructors, and multi-argument methods, allowing for narrowing through qualifier annotations at the parameter level. In contrast, @Resource is supported only for fields and bean property setter methods with a single argument. As a consequence, you should stick with qualifiers if your injection target is a constructor or a multi-argument method.

如果注入目标是构造器或多参数方法，**必须用 `@Qualifier`**，因为 `@Resource` 不支持这些场景。

### 自定义 Qualifier 注解

可以创建带有 `@Qualifier` 元注解的自定义注解，使 qualifier 更具语义：

```java
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface Genre {
    String value();
}
```

```java
@Autowired
@Genre("Action")
private MovieCatalog actionCatalog;
```

甚至可以定义多属性的 qualifier 注解，所有属性必须同时匹配：

```java
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface MovieQualifier {
    String genre();
    Format format();
}

// 使用
@Autowired
@MovieQualifier(format=Format.VHS, genre="Action")
private MovieCatalog actionVhsCatalog;
```

XML 中通过 `<qualifier type="..." />` 或 `<meta key="..." value="..." />`（fallback）配置。

## 句子解析

### 原文: "They do not semantically express a reference to a unique bean id. Good qualifier values are main or EMEA or persistent, expressing characteristics of a specific component that are independent from the bean id."

- **翻译:** 它们在语义上并不表示对唯一 bean id 的引用。好的 qualifier 值如 `main`、`EMEA` 或 `persistent`，表达的是特定组件的特征，与 bean id 无关。
- **解析:** `semantically express` = 在语义上表达。`independent from` 修饰 `characteristics`，表示这些特征独立于 bean id。`which may be auto-generated...` 是插入解释为什么需要考虑独立于 bean id —— 后续原文解释了匿名 Bean 定义的 bean id 可能是自动生成的。

### 原文: "This implies that qualifiers do not have to be unique. Rather, they constitute filtering criteria."

- **翻译:** 这意味着 qualifier 不必唯一。相反，它们构成的是过滤条件。
- **解析:** `imply` = 暗示/意味着。`constitute` = 构成/组成（正式用语）。`filtering criteria` = 过滤条件（criterion 的复数形式）。整句强调 qualifier 的职责是"筛选"而非"标识"。

### 原文: "As a consequence, you should stick with qualifiers if your injection target is a constructor or a multi-argument method."

- **翻译:** 因此，如果你的注入目标是构造器或多参数方法，就应该坚持使用 qualifier。
- **解析:** `as a consequence` = 因此（正式，相当于 as a result）。`stick with` = 坚持/继续使用。`injection target` = 注入目标。这句话是对比 `@Resource` 的局限后给出的实践建议。

### 原文: "@Resource is semantically defined to identify a specific target component by its unique name, with the declared type being irrelevant for the matching process."

- **翻译:** `@Resource` 在语义上被定义为通过唯一名称来标识特定的目标组件，声明的类型在匹配过程中是无关的。
- **解析:** `is semantically defined to` = 在语义上被定义为……。`with the declared type being irrelevant` 是独立主格结构（with + 名词 + 现在分词），表示伴随情况。`irrelevant` = 无关的/不重要的，强调类型对 `@Resource` 的匹配逻辑没有影响。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| qualifier | n. | 限定符，限定器 |
| narrowing | n./adj. | 缩小范围（的） |
| fallback | n./adj. | 回退，后备（方案） |
| convention | n. | 约定，惯例 |
| fundamentally | adv. | 根本上，本质上 |
| constitute | v. | 构成，组成 |
| criterion (pl. criteria) | n. | 标准，条件 |
| irrelevant | adj. | 不相关的，无关的 |
| stick with | phr. | 坚持，继续使用 |
| consequence | n. | 结果，后果 |
| as a consequence | phr. | 因此 |
| resolve / resolution | v./n. | 解析 |
| bypass | v. | 绕过，跳过 |
| override | v. | 覆盖，重写 |
