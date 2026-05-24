# Detailed Factory Property Configuration

> **来源:** https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-properties-detailed.html

## 核心理解

Spring 在 XML 配置中为 4 种集合类型提供了专门的元素：`<list/>`、`<set/>`、`<map/>`、`<props/>`。这些元素可以直接在 `<property/>` 或 `<constructor-arg/>` 中使用，Spring 容器会自动将 XML 元素转换为对应的 Java 集合对象（ArrayList、LinkedHashSet、LinkedHashMap 等），然后注入给 bean。

除了基本的集合注入，Spring 还支持两个高级特性：**集合合并（collection merging）** 和 **强类型集合（strongly-typed collection）**。合并机制允许子 bean 继承父 bean 的集合定义并进行覆盖；强类型集合则通过泛型约束确保集合中元素类型的一致性（例如只允许 `Integer` 类型）。这些特性在需要复用或约束 bean 配置时非常有用。

XML `<property/>` 元素不仅可以设置简单属性，还支持**复合/嵌套属性名（compound property names）** 的写法。例如 `something.fred.bob.sammy` 可以层层穿透对象的引用链，最终为最内层对象的属性注入值——前提是中间路径上的引用都不为 null。

## 关键点

### 集合类型元素：`<list/>`、`<set/>`、`<map/>`、`<props/>`

> The `<list/>`, `<set/>`, `<map/>`, and `<props/>` elements set the properties and arguments of the Java Collection types `List`, `Set`, `Map`, and `Properties`, respectively.

Spring XML 为每种集合类型提供了对应的配置元素。以官方示例为例：

```xml
<bean id="moreComplexObject" class="example.ComplexObject">
    <property name="adminEmails">
        <props>
            <prop key="administrator">administrator@example.org</prop>
            <prop key="support">support@example.org</prop>
            <prop key="development">development@example.org</prop>
        </props>
    </property>
    <property name="someList">
        <list>
            <value>a list element followed by a reference</value>
            <ref bean="myDataSource" />
        </list>
    </property>
    <property name="someMap">
        <map>
            <entry key="an entry" value="just some string"/>
            <entry key="a ref" value-ref="myDataSource"/>
        </map>
    </property>
    <property name="someSet">
        <set>
            <value>just some string</value>
            <ref bean="myDataSource" />
        </set>
    </property>
</bean>
```

List 中可以混放字符串和对象引用（如上面的 `someList` 既有 `<value>` 又有 `<ref>`），这在编译期不会报错，但实际使用时要小心——获取元素时只能用 `Object` 类型接收。如果希望所有元素是同一类型，应使用强类型集合（见下文）。

### 集合合并（Collection Merging）

> The Spring container also supports merging collections. An application developer can define a parent `<list/>`, `<map/>`, `<set/>` or `<props/>` element and have child `<list/>`, `<map/>`, `<set/>` or `<props/>` elements inherit and override values from the parent collection.

这是一种**类似于类继承**的机制：子 bean 的集合 = 父集合 + 子集合，遇到同名/同键元素时子覆盖父。

```xml
<beans>
    <bean id="parent" abstract="true" class="example.ComplexObject">
        <property name="adminEmails">
            <props>
                <prop key="administrator">administrator@example.com</prop>
                <prop key="support">support@example.com</prop>
            </props>
        </property>
    </bean>
    <bean id="child" parent="parent">
        <property name="adminEmails">
            <props merge="true">
                <prop key="sales">sales@example.com</prop>
                <prop key="support">support@example.co.uk</prop>
            </props>
        </property>
    </bean>
</beans>
```

`merge="true"` 是关键开关。上面的例子中，child 最终的 `adminEmails` 包含 3 个条目：
- `administrator=administrator@example.com`（继承自 parent）
- `support=support@example.co.uk`（child 覆盖了 parent 的值）
- `sales=sales@example.com`（child 新增）

注意：`<property name="adminEmails">` 不是定义一个内部类，而是引用 bean 中已有的 `adminEmails` **属性名**，Spring 会把合并后的 `Properties` 对象注入进去。`merge="true"` 只作用于集合类型，不同集合类型不可相互合并。

### 强类型集合（Strongly-typed Collection）

> 官方提供了一个非常好的例子：用 `@Autowired` 注入一个 `Map<String, Integer>`，key 是 bean 名称，value 是 bean 实例本身——但所有 value 都必须是 `Integer` 类型。

```java
public class SomeClass {

    @Autowired
    private Map<String, Integer> accounts;
}
```

```xml
<beans>
    <bean id="one" class="java.lang.Integer">
        <constructor-arg value="9"/>
    </bean>
    <bean id="two" class="java.lang.Integer">
        <constructor-arg value="10"/>
    </bean>
</beans>
```

Spring 会创建一个 `Map<String, Integer>`，其中 key 为 `"one"` 和 `"two"`，value 为对应的 `Integer` 对象 `9` 和 `10`。这是通过泛型推断实现的——Spring 读取 `@Autowired` 字段的泛型信息，只收集匹配类型的 bean。如果某个 value 不是 `Integer` 类型，注入时会报错。

### 空参数视为空字符串

> Spring treats empty arguments for properties and the like as empty `String`s.

**翻译:** Spring 将属性之类的空参数当作空字符串来处理。

**解析:**
- **主句:** Spring treats empty arguments ... as empty Strings.（主语 + 谓语 treat + 宾语 + 宾补 as）
- **"treats ... as ...":** 将……视为/当作……（固定搭配 `treat A as B`）
- **"and the like":** 等等、诸如此类（= and similar things，用于扩展范围而非精确列举）
- 实际含义：如果你在 XML 中写 `<property name="xxx" value="" />`，Spring 注入的是 `""`（空字符串），而不是 `null`。

### 构造函数参数的下标回退（Index Fallback）

> For the rare cases where the constructor argument names are not available (usually if the bytecode was compiled without the `-parameters` flag), you can fall back to the argument indexes.

当构造函数参数名不可用时（通常因为字节码编译时没有加 `-parameters` 参数），可以用索引下标来回退：

```xml
<constructor-arg index="0" value="7500000"/>
<constructor-arg index="1" value="42"/>
```

`index="0"` 表示第一个构造函数参数，`index="1"` 表示第二个。这种方式几乎没有可读性——看 XML 完全不知道参数的含义是什么。Spring 官方也推荐优先使用名称标注（name notation），即在编译时加上 `-parameters` 标志，这样就能用：

```xml
<constructor-arg name="years" value="7500000"/>
<constructor-arg name="ultimateAnswer" value="42"/>
```

> **回答你的问题：** 是的，推荐在编译字节码时加上 `-parameters` 参数，这样构造函数参数名才会被保留到字节码中，Spring 就可以通过反射获取参数名，从而用 `name` 而非 `index` 来标识参数。

### 复合/嵌套属性名（Compound Property Names）

> You can use compound or nested property names when you set bean properties, as long as all components of the path except the final property name are not null.

```xml
<bean id="something" class="things.ThingOne">
    <property name="fred.bob.sammy" value="123" />
</bean>
```

这里 `something` 有一个 `fred` 属性（类型为 `ThingTwo`），`fred` 有一个 `bob` 属性（类型为 `ThingThree`），`bob` 有一个 `sammy` 属性。Spring 会逐层解析：先调用 `something.getFred()`，再调用 `fred.getBob()`，最后调用 `bob.setSammy(123)`。**是的，你的理解正确——最终将 `123` 注入给了 `sammy`。**

注意：路径中间的所有属性（`fred`、`bob`）在注入时必须已经存在且不为 null，否则会抛出 `NullValueInNestedPathException`。

## 句子解析

### 原文: "Spring treats empty arguments for properties and the like as empty Strings."

- **翻译:** Spring 将属性之类的空参数当作空字符串来处理。
- **解析:**
  - **treat A as B:** 将 A 视为 B，这是一个非常常见的学术/技术表达。类似用法："Java treats arrays as objects."
  - **and the like:** = and similar things，"诸如此类、等等"。在技术文档中常用，表示不限于精确列举的项目，也包含类似的情况。这里指"属性参数以及类似的参数"。
  - 整句结构：主语 `Spring` + 谓语 `treats` + 宾语 `empty arguments...` + 宾补 `as empty Strings`。

### 原文: "You can use compound or nested property names when you set bean properties, as long as all components of the path except the final property name are not null."

- **翻译:** 你可以在设置 bean 属性时使用复合或嵌套的属性名，前提是路径中除了最终属性名之外的所有组件都不为 null。
- **解析:**
  - **compound / nested property names:** 复合/嵌套属性名，指用 `.` 连接的属性路径。
  - **as long as:** = only if，表示条件，"只要……就……"，也可以理解为"前提是"。
  - **except the final property name:** 除了最终的属性名——这个细节很关键，因为最终属性名就是要被 set 的，当然可以是 null（或者说先为 null 再被赋值）。

## 术语表

| 英文 | 词性 | 释义 |
|------|------|------|
| merge | v./n. | 合并（集合上下文中指子集合继承并覆盖父集合） |
| fall back to | phr. | 回退到、转而使用（备选方案） |
| compound | adj. | 复合的（compound property name = 用 `.` 连接的属性名） |
| nested | adj. | 嵌套的 |
| and the like | phr. | 诸如此类、等等（= and similar things） |
| treat A as B | phr. | 将 A 视为/当作 B |
| XSD schema | n. | XML Schema Definition，XML 的 schema 规范，用于定义 XML 文档的结构和约束规则 |
| as long as | conj. | 只要（条件状语从句引导词） |
