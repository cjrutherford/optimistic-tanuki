export interface Challenge {
  id: string;
  lessonSlug: string;
  moduleId: string;
  title: string;
  description: string;
  starterCode: string;
  expectedOutput: string;
  testCode?: string;
  /**
   * Modules the exercise ships for the learner to import.
   *
   * A lesson about imports cannot be practised in one file. These are written
   * beside the submission and are read-only: the runner refuses a name that
   * would escape the run directory or replace main.ts.
   */
  supportingFiles?: Record<string, string>;
  hints: string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const challenges: Challenge[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  {
    id: 'basics-hello-world',
    lessonSlug: 'hello-world',
    moduleId: 'basics',
    title: 'Hello, TypeScript!',
    description: 'Print "Hello, TypeScript!" to the console.',
    starterCode: `// Your first TypeScript program
// Use console.log to print a greeting

`,
    expectedOutput: 'Hello, TypeScript!\n',
    hints: [
      'Use console.log()',
      'Make sure the string matches exactly: "Hello, TypeScript!"',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-type-annotations',
    lessonSlug: 'variables-types',
    moduleId: 'basics',
    title: 'Type Annotations',
    description:
      'Declare a string variable `name` with value "TypeScript", a number `version` with value 5, and a boolean `isAwesome` with value true. Print all three on separate lines.',
    starterCode: `// Declare typed variables
const name: string = 
const version: number = 
const isAwesome: boolean = 

console.log(name)
console.log(version)
console.log(isAwesome)
`,
    expectedOutput: 'TypeScript\n5\ntrue\n',
    hints: [
      'Assign "TypeScript" to name',
      'Assign 5 to version',
      'Assign true to isAwesome',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-interface',
    lessonSlug: 'variables-types',
    moduleId: 'basics',
    title: 'Define an Interface',
    description:
      'Define an interface `Person` with properties `name: string` and `age: number`. Create an object matching the interface and print "Alice is 30 years old".',
    starterCode: `interface Person {
  // Add properties here
}

const alice: Person = {
  // Fill in
}

console.log(\`\${alice.name} is \${alice.age} years old\`)
`,
    expectedOutput: 'Alice is 30 years old\n',
    testCode: `test('alice.name is "Alice"', function () {
  expect(alice.name).toBe('Alice');
});
test('alice.age is 30', function () {
  expect(alice.age).toBe(30);
});
test('alice satisfies the Person shape', function () {
  expect(typeof alice.name).toBe('string');
  expect(typeof alice.age).toBe('number');
});`,
    hints: [
      'Add name: string to the interface',
      'Add age: number to the interface',
      'Set name to "Alice" and age to 30',
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-functions',
    lessonSlug: 'functions',
    moduleId: 'basics',
    title: 'Typed Functions',
    description:
      'Write a function `add` that takes two numbers and returns their sum. Print add(3, 4).',
    starterCode: `function add(a: number, b: number): number {
  // Return the sum
}

console.log(add(3, 4))
`,
    expectedOutput: '7\n',
    testCode: `test('add(3, 4) returns 7', function () {
  expect(add(3, 4)).toBe(7);
});
test('add(0, 0) returns 0', function () {
  expect(add(0, 0)).toBe(0);
});
test('add(-1, 1) returns 0', function () {
  expect(add(-1, 1)).toBe(0);
});
test('add(10, 5) returns 15', function () {
  expect(add(10, 5)).toBe(15);
});`,
    hints: ['Use the return keyword', 'Return a + b'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-optional-params',
    lessonSlug: 'functions',
    moduleId: 'basics',
    title: 'Optional Parameters',
    description:
      'Write a function `greet(name: string, greeting?: string)` that prints the greeting (defaulting to "Hello") followed by the name. Call it with just "World" and also with "World" and "Hi".',
    starterCode: `function greet(name: string, greeting?: string): void {
  // Use greeting ?? "Hello"
}

greet("World")
greet("World", "Hi")
`,
    expectedOutput: 'Hello, World!\nHi, World!\n',
    hints: [
      'Use ?? to provide a default: greeting ?? "Hello"',
      'Print: `${g}, ${name}!`',
    ],
    points: 10,
    difficulty: 'easy',
  },
  // ── JavaScript to TypeScript ─────────────────────────────────────────────
  {
    id: 'js-to-ts-inference',
    lessonSlug: 'type-inference',
    moduleId: 'javascript-to-typescript',
    title: 'Type Inference',
    description:
      'TypeScript can infer types. Declare `message` without an explicit type annotation but assign "Inferred!" to it, then print it.',
    starterCode: `// Let TypeScript infer the type
const message = 

console.log(message)
`,
    expectedOutput: 'Inferred!\n',
    hints: ['Just assign "Inferred!" without writing : string'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'js-to-ts-union',
    lessonSlug: 'adding-types',
    moduleId: 'javascript-to-typescript',
    title: 'Union Types',
    description:
      'Write a function `formatId(id: string | number): string` that returns the id as a string prefixed with "#". Print formatId(42) and formatId("abc").',
    starterCode: `function formatId(id: string | number): string {
  // Return "#" + id.toString()
}

console.log(formatId(42))
console.log(formatId("abc"))
`,
    expectedOutput: '#42\n#abc\n',
    hints: ['Use String(id) or id.toString()', 'Prefix with "#"'],
    points: 10,
    difficulty: 'easy',
  },
  // ── Type System ──────────────────────────────────────────────────────────
  {
    id: 'type-system-generics',
    lessonSlug: 'generics',
    moduleId: 'type-system',
    title: 'Generic Identity Function',
    description:
      'Write a generic function `identity<T>(value: T): T` that returns its argument unchanged. Print identity("hello") and identity(42).',
    starterCode: `function identity<T>(value: T): T {
  // Return value
}

console.log(identity("hello"))
console.log(identity(42))
`,
    expectedOutput: 'hello\n42\n',
    testCode: `test('identity returns a string unchanged', function () {
  expect(identity('hello')).toBe('hello');
});
test('identity returns a number unchanged', function () {
  expect(identity(42)).toBe(42);
});
test('identity returns a boolean unchanged', function () {
  expect(identity(true)).toBe(true);
});
test('identity returns an object reference unchanged', function () {
  var obj = { x: 1 };
  expect(identity(obj)).toBe(obj);
});`,
    hints: ['Just return the value parameter'],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'type-system-interface-extend',
    lessonSlug: 'interfaces-vs-types',
    moduleId: 'type-system',
    title: 'Extending Interfaces',
    description:
      'Define `Animal` with `name: string`. Extend it into `Dog` with `breed: string`. Create a Dog and print "Buddy is a Labrador".',
    starterCode: `interface Animal {
  name: string
}

interface Dog extends Animal {
  // Add breed property
}

const dog: Dog = {
  name: "Buddy",
  breed: "Labrador"
}

console.log(\`\${dog.name} is a \${dog.breed}\`)
`,
    expectedOutput: 'Buddy is a Labrador\n',
    hints: ['Add breed: string to Dog interface'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'type-system-intersection',
    lessonSlug: 'union-intersection',
    moduleId: 'type-system',
    title: 'Intersection Types',
    description:
      'Create types `Serializable = { serialize(): string }` and `Loggable = { log(): void }`. Create an intersection type `SerializableAndLoggable` and implement an object that satisfies it. The serialize method should return "serialized" and log should print "logged". Call both methods.',
    starterCode: `type Serializable = { serialize(): string }
type Loggable = { log(): void }

// An intersection type has to satisfy both sides at once.
// Declare it, then build an object that satisfies it.
type SerializableAndLoggable =

const obj: SerializableAndLoggable = {

}

console.log(obj.serialize())
obj.log()
`,
    expectedOutput: 'serialized\nlogged\n',
    hints: [
      '& combines two object types, where | would let you pick either one',
      'The object must supply both methods, or it does not satisfy the intersection',
      "serialize returns the string 'serialized'; log prints 'logged'",
    ],
    points: 20,
    difficulty: 'medium',
  },
  // ── Advanced Types ───────────────────────────────────────────────────────
  {
    id: 'advanced-partial',
    lessonSlug: 'utility-types',
    moduleId: 'advanced-types',
    title: 'Partial Utility Type',
    description:
      'Use `Partial<T>` to create an optional update type. Define `User` with `name: string` and `age: number`. Write `updateUser(user: User, updates: Partial<User>): User` and print the result of updating the name to "Bob".',
    starterCode: `interface User {
  name: string
  age: number
}

function updateUser(user: User, updates: Partial<User>): User {
  return { ...user, ...updates }
}

const user: User = { name: "Alice", age: 30 }
const updated = updateUser(user, { name: "Bob" })
console.log(\`\${updated.name}, \${updated.age}\`)
`,
    expectedOutput: 'Bob, 30\n',
    hints: ['The spread operator merges the update'],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'advanced-readonly',
    lessonSlug: 'utility-types',
    moduleId: 'advanced-types',
    title: 'Readonly Type',
    description:
      'Create a `Readonly<Config>` where Config has `host: string` and `port: number`. Create a frozen config and print its values.',
    starterCode: `interface Config {
  host: string
  port: number
}

const config: Readonly<Config> = {
  host: "localhost",
  port: 3000
}

// config.host = "other" // This would be a TypeScript error!
console.log(\`\${config.host}:\${config.port}\`)
`,
    expectedOutput: 'localhost:3000\n',
    hints: ['Just run – Readonly prevents reassignment at compile time'],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'advanced-conditional',
    lessonSlug: 'conditional-types',
    moduleId: 'advanced-types',
    title: 'Conditional Types',
    description:
      'Create a conditional type `IsString<T>` that resolves to "yes" if T is string, "no" otherwise. Print the results for string and number.',
    starterCode: `// A conditional type picks a type based on a test, using the same
// ternary shape as a value-level conditional.
// IsString<T> should be "yes" when T is a string, and "no" otherwise.
type IsString<T> =

type A = IsString<string>   // should be "yes"
type B = IsString<number>   // should be "no"

const a: A = "yes"
const b: B = "no"
console.log(a)
console.log(b)`,
    expectedOutput: 'yes\nno\n',
    hints: [
      'The shape is T extends U ? X : Y',
      'Here the test is `T extends string`',
      'Both branches are string literal types, so write "yes" and "no" as types, not as values',
    ],
    points: 30,
    difficulty: 'hard',
  },
  // ── Async ────────────────────────────────────────────────────────────────
  {
    id: 'async-promise-basic',
    lessonSlug: 'promises',
    moduleId: 'async',
    title: 'Basic Promise',
    description:
      'Create a function `delay(ms: number): Promise<string>` that resolves with "Done!" after 0ms. Await it and print the result.',
    starterCode: `// delay should return a Promise that resolves with "Done!" after ms.
// Build the Promise yourself rather than returning an already-resolved one.
function delay(ms: number): Promise<string> {

}

async function main() {
  const result = await delay(0)
  console.log(result)
}

main()`,
    expectedOutput: 'Done!\n',
    hints: [
      'new Promise<string>((resolve) => { ... })',
      "Call resolve('Done!') inside a setTimeout of ms milliseconds",
      'The executor takes resolve as its first argument',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'async-await',
    lessonSlug: 'async-await',
    moduleId: 'async',
    title: 'Async/Await Error Handling',
    description:
      'Write an async function that calls a function which may throw. Use try/catch to handle the error and print "Caught: <message>".',
    starterCode: `function riskyOperation(): Promise<string> {
  return Promise.reject(new Error("Something went wrong"))
}

async function main() {
  // Await riskyOperation and log the result.
  // If it rejects, log "Caught: " followed by the error's message.
  // catch gives you unknown, so narrow it before reading .message.

}

main()`,
    expectedOutput: 'Caught: Something went wrong\n',
    hints: [
      'Wrap the await in try / catch',
      'catch (err) types err as unknown, so check err instanceof Error first',
      'Template literal: `Caught: ${err.message}`',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'async-parallel',
    lessonSlug: 'concurrent-patterns',
    moduleId: 'async',
    title: 'Promise.all',
    description:
      'Use Promise.all to run two async tasks in parallel. Each returns a number. Print their sum.',
    starterCode: `async function getA(): Promise<number> { return 3 }
async function getB(): Promise<number> { return 4 }

async function main() {
  const [a, b] = await Promise.all([getA(), getB()])
  console.log(a + b)
}

main()
`,
    expectedOutput: '7\n',
    hints: ['Promise.all resolves when all promises resolve'],
    points: 20,
    difficulty: 'medium',
  },
  // ── Modules ──────────────────────────────────────────────────────────────
  {
    id: 'modules-named-export',
    lessonSlug: 'es-modules',
    moduleId: 'modules',
    title: 'Simulating Named Exports',
    description:
      'TypeScript uses ES module syntax. Simulate a module by creating an object with named exports and destructuring it.',
    starterCode: `// Simulate a module's named exports
const mathUtils = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
}

const { add, multiply } = mathUtils
console.log(add(2, 3))
console.log(multiply(2, 3))
`,
    expectedOutput: '5\n6\n',
    hints: ['Destructure the object to get named functions'],
    points: 10,
    difficulty: 'easy',
  },
  // ── Testing ──────────────────────────────────────────────────────────────
  {
    id: 'testing-assertions',
    lessonSlug: 'vitest-basics',
    moduleId: 'testing',
    title: 'Assertions with expect()',
    description:
      'Use the built-in `expect()` and `test()` functions to test a `multiply` function. Write at least three test cases.',
    starterCode: `function multiply(a: number, b: number): number {
  // Implement multiplication
}
`,
    expectedOutput: '',
    testCode: `test('multiply(2, 3) returns 6', function () {
  expect(multiply(2, 3)).toBe(6);
});
test('multiply(0, 100) returns 0', function () {
  expect(multiply(0, 100)).toBe(0);
});
test('multiply(-2, 5) returns -10', function () {
  expect(multiply(-2, 5)).toBe(-10);
});
test('multiply(1, 42) returns 42', function () {
  expect(multiply(1, 42)).toBe(42);
});`,
    hints: ['Use the return keyword to return a * b'],
    points: 20,
    difficulty: 'medium',
  },
  // ── New spy challenge ─────────────────────────────────────────────────────
  {
    id: 'testing-spy',
    lessonSlug: 'type-safe-testing',
    moduleId: 'testing',
    title: 'Spy on Function Calls',
    description:
      'Create a `Logger` class with a `log(msg: string)` method. Use `spy()` to verify it calls `console.log` with the correct prefixed message.',
    starterCode: `function createLogger(prefix: string) {
  return {
    log(msg: string): void {
      // Call console.log with \`[\${prefix}] \${msg}\`
    }
  }
}
`,
    expectedOutput: '',
    testCode: `var logger = createLogger('INFO');
var _orig = console.log.bind(console);
var logSpy = spy(_orig);
console.log = logSpy;

logger.log('server started');
logger.log('ready');

test('log() calls console.log with the prefixed message', function () {
  expect(logSpy).toHaveBeenCalledWith('[INFO] server started');
});
test('log() prefixes every call', function () {
  expect(logSpy).toHaveBeenCalledWith('[INFO] ready');
});
test('log() was called exactly twice', function () {
  expect(logSpy).toHaveBeenCalledTimes(2);
});

console.log = _orig;`,
    hints: [
      'Inside log(), type: console.log(`[${prefix}] ${msg}`) — a template literal',
      'The spy wraps the real console.log and records all calls',
    ],
    points: 30,
    difficulty: 'hard',
  },
  // ── toThrow challenge ─────────────────────────────────────────────────────
  {
    id: 'testing-throw',
    lessonSlug: 'type-safe-testing',
    moduleId: 'testing',
    title: 'Testing Error Cases with toThrow()',
    description:
      'Write a `divide(a, b)` function that throws when `b` is 0. Use `expect().toThrow()` to verify the error path, and `expect().toBe()` for the happy path.',
    starterCode: `function divide(a: number, b: number): number {
  // Throw an Error with message "Division by zero" when b === 0
  // Otherwise return a / b
}
`,
    expectedOutput: '',
    testCode: `test('divide(10, 2) returns 5', function () {
  expect(divide(10, 2)).toBe(5);
});
test('divide(9, 3) returns 3', function () {
  expect(divide(9, 3)).toBe(3);
});
test('divide(x, 0) throws "Division by zero"', function () {
  expect(function () { divide(10, 0); }).toThrow('Division by zero');
});
test('divide(0, 5) returns 0', function () {
  expect(divide(0, 5)).toBe(0);
});`,
    hints: [
      'Use: if (b === 0) throw new Error("Division by zero")',
      'Then return a / b',
    ],
    points: 20,
    difficulty: 'medium',
  },
  // ── Frontend ─────────────────────────────────────────────────────────────
  {
    id: 'frontend-component-type',
    lessonSlug: 'react-typescript',
    moduleId: 'frontend',
    title: 'Typed Component Props',
    description:
      'Define a `ButtonProps` interface with `label: string` and optional `disabled?: boolean`. Write a function that renders the button as a string and print it.',
    starterCode: `// Describe the props: a required label, and an optional disabled flag.
interface ButtonProps {

}

// Return "<button>Label</button>", or "<button disabled>Label</button>"
// when disabled is true.
function renderButton(props: ButtonProps): string {

}

console.log(renderButton({ label: "Click me" }))
console.log(renderButton({ label: "Submit", disabled: true }))`,
    expectedOutput:
      '<button>Click me</button>\n<button disabled>Submit</button>\n',
    hints: [
      'An optional property is written `disabled?: boolean`',
      "Build the attribute separately: props.disabled ? ' disabled' : ''",
      'Return a template literal with the attribute and the label interpolated',
    ],
    points: 20,
    difficulty: 'medium',
  },
  // ── Angular ──────────────────────────────────────────────────────────────
  {
    id: 'angular-component-class',
    lessonSlug: 'angular-components',
    moduleId: 'angular',
    title: 'Angular Component Metadata',
    description:
      "Simulate Angular's @Component decorator pattern. Create a `componentMeta` function that accepts a config object with `selector`, `template`, and an optional `standalone` flag. Return a typed metadata object.",
    starterCode: `interface ComponentConfig {
  selector: string
  template: string
  standalone?: boolean
}

interface ComponentMeta {
  selector: string
  template: string
  standalone: boolean
}

function componentMeta(config: ComponentConfig): ComponentMeta {
  // Return a ComponentMeta with standalone defaulting to false
}

const meta = componentMeta({
  selector: 'app-button',
  template: '<button>Click me</button>',
  standalone: true,
})

console.log(meta.selector)
console.log(meta.standalone)
`,
    expectedOutput: 'app-button\ntrue\n',
    testCode: `test('selector is stored', function () {
  var m = componentMeta({ selector: 'app-foo', template: '<p></p>' });
  expect(m.selector).toBe('app-foo');
});
test('template is stored', function () {
  var m = componentMeta({ selector: 'app-foo', template: '<p>Hello</p>' });
  expect(m.template).toBe('<p>Hello</p>');
});
test('standalone defaults to false', function () {
  var m = componentMeta({ selector: 'app-foo', template: '' });
  expect(m.standalone).toBe(false);
});
test('standalone can be set to true', function () {
  var m = componentMeta({ selector: 'app-foo', template: '', standalone: true });
  expect(m.standalone).toBe(true);
});`,
    hints: [
      'Use the spread operator or explicit assignment',
      'standalone ?? false gives the default',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'angular-service-di',
    lessonSlug: 'angular-services-di',
    moduleId: 'angular',
    title: 'Injectable Service Pattern',
    description:
      'Create a `UserService` class with `add(user: User)` and `getAll(): User[]`. Then build an `InjectionContainer` with `register` and `get<T>` methods that store singleton instances by name.',
    starterCode: `interface User {
  id: number
  name: string
}

class UserService {
  private users: User[] = []

  add(user: User): void {
    // push user into this.users
  }

  getAll(): User[] {
    // return a copy of this.users
  }
}

class InjectionContainer {
  private instances = new Map<string, unknown>()

  register<T>(name: string, instance: T): void {
    this.instances.set(name, instance)
  }

  get<T>(name: string): T {
    const instance = this.instances.get(name)
    if (!instance) throw new Error(\`No provider for \${name}\`)
    return instance as T
  }
}

const container = new InjectionContainer()
container.register('UserService', new UserService())

const svc = container.get<UserService>('UserService')
svc.add({ id: 1, name: 'Alice' })
svc.add({ id: 2, name: 'Bob' })
console.log(svc.getAll().length)
console.log(svc.getAll()[0].name)
`,
    expectedOutput: '2\nAlice\n',
    testCode: `var svc2 = new UserService();
test('add() stores users', function () {
  svc2.add({ id: 1, name: 'Alice' });
  expect(svc2.getAll().length).toBe(1);
});
test('getAll() returns all stored users', function () {
  svc2.add({ id: 2, name: 'Bob' });
  expect(svc2.getAll().length).toBe(2);
});
test('getAll() returns a copy (mutation safety)', function () {
  var copy = svc2.getAll();
  copy.push({ id: 99, name: 'Hacker' });
  expect(svc2.getAll().length).toBe(2);
});
test('InjectionContainer resolves registered service', function () {
  var c = new InjectionContainer();
  var us = new UserService();
  c.register('UserService', us);
  expect(c.get('UserService')).toBe(us);
});
test('InjectionContainer throws for unknown token', function () {
  var c = new InjectionContainer();
  expect(function () { c.get('MissingService'); }).toThrow('No provider for MissingService');
});`,
    hints: [
      'Use this.users.push(user) in add()',
      'Return [...this.users] in getAll() to return a defensive copy',
    ],
    points: 30,
    difficulty: 'hard',
  },
  {
    id: 'angular-reactive-form',
    lessonSlug: 'angular-forms-routing',
    moduleId: 'angular',
    title: 'Reactive Form Validation',
    description:
      'Simulate Angular Reactive Forms. Create a `FormControl<T>` class with `value`, a `valid` getter (true when all validators return null), and an `errors` getter (array of non-null error strings).',
    starterCode: `type ValidatorFn<T> = (value: T) => string | null

class FormControl<T> {
  validators: ValidatorFn<T>[]

  constructor(public value: T, validators: ValidatorFn<T>[] = []) {
    this.validators = validators
  }

  get valid(): boolean {
    // Return true if every validator returns null
  }

  get errors(): string[] {
    // Return array of non-null validator results
  }
}

const required = (v: unknown) => (v === '' || v == null) ? 'required' : null
const minLength = (min: number) => (v: string) => v.length >= min ? null : \`minLength:\${min}\`
const isEmail   = (v: string) => /^[^@]+@[^@]+\\.[^@]+$/.test(v) ? null : 'email'

const emailCtrl = new FormControl('', [required, isEmail])
console.log(emailCtrl.valid)

emailCtrl.value = 'bad'
console.log(emailCtrl.valid)

emailCtrl.value = 'alice@example.com'
console.log(emailCtrl.valid)
`,
    expectedOutput: 'false\nfalse\ntrue\n',
    testCode: `const req  = (v) => (v === '' || v == null) ? 'required' : null;
const min5 = (v) => v.length >= 5 ? null : 'minLength:5';
const email = (v) => /^[^@]+@[^@]+\\.[^@]+$/.test(v) ? null : 'email';

test('valid is false when value fails required', function () {
  var c = new FormControl('', [req]);
  expect(c.valid).toBe(false);
});
test('valid is true when all validators pass', function () {
  var c = new FormControl('hello', [req, min5]);
  expect(c.valid).toBe(true);
});
test('valid is false when any validator fails', function () {
  var c = new FormControl('hi', [req, min5]);
  expect(c.valid).toBe(false);
});
test('errors returns array of failed messages', function () {
  var c = new FormControl('', [req, email]);
  expect(c.errors).toContain('required');
});
test('errors is empty when all pass', function () {
  var c = new FormControl('alice@example.com', [req, email]);
  expect(c.errors.length).toBe(0);
});`,
    hints: [
      'valid: return this.validators.every(v => v(this.value) === null)',
      'errors: return this.validators.map(v => v(this.value)).filter(e => e !== null) as string[]',
    ],
    points: 30,
    difficulty: 'hard',
  },
  // ── Backend ──────────────────────────────────────────────────────────────
  {
    id: 'backend-type-guard',
    lessonSlug: 'nodejs-typescript',
    moduleId: 'backend',
    title: 'Type Guards',
    description:
      'Write a type guard `isString(value: unknown): value is string` and use it to safely process a value that could be anything.',
    starterCode: `// Write a type guard. The return type is not boolean: it is
// \`value is string\`, which is what tells the compiler to narrow.
function isString(value: unknown): value is string {

}

function processInput(input: unknown): string {
  if (isString(input)) {
    // Inside this branch input is a string, so this compiles.
    return input.toUpperCase()
  }
  return String(input)
}

console.log(processInput("hello"))
console.log(processInput(42))`,
    expectedOutput: 'HELLO\n42\n',
    testCode: `test('isString returns true for strings', function () {
  expect(isString('hello')).toBe(true);
});
test('isString returns false for numbers', function () {
  expect(isString(42)).toBe(false);
});
test('isString returns false for null', function () {
  expect(isString(null)).toBe(false);
});
test('processInput uppercases strings', function () {
  expect(processInput('hello')).toBe('HELLO');
});
test('processInput converts numbers to string', function () {
  expect(processInput(42)).toBe('42');
});`,
    hints: [
      'The body is a single typeof check',
      "return typeof value === 'string'",
      'The `value is string` return type is the whole point: without it the compiler will not let you call toUpperCase',
    ],
    points: 20,
    difficulty: 'medium',
  },
  // ── Packages ─────────────────────────────────────────────────────────────
  {
    id: 'packages-runtime-validation',
    lessonSlug: 'zod-validation',
    moduleId: 'packages',
    title: 'Runtime Type Checking',
    description:
      'Without Zod, implement a simple runtime validator. Validate that an object has `name: string` and `age: number` and print "Valid: Alice, 25".',
    starterCode: `interface Person {
  name: string
  age: number
}

// Data arriving from outside your program is unknown, not Person.
// Check it at runtime, then return it as a Person. Throw
// new Error('Invalid person data') if it does not match.
function validatePerson(data: unknown): Person {

}

const raw = { name: "Alice", age: 25 }
const person = validatePerson(raw)
console.log(\`Valid: \${person.name}, \${person.age}\`)`,
    expectedOutput: 'Valid: Alice, 25\n',
    hints: [
      "Check typeof data === 'object' and data !== null first, because typeof null is 'object'",
      "Use the `in` operator to check for the keys: 'name' in data",
      'Cast through Record<string, unknown> to read the fields before you know the shape',
      'Return `data as Person` only after every check has passed',
    ],
    points: 25,
    difficulty: 'medium',
  },
  // ── Polish ───────────────────────────────────────────────────────────────
  {
    id: 'polish-strict-null',
    lessonSlug: 'strict-mode',
    moduleId: 'polish',
    title: 'Nullish Coalescing & Optional Chaining',
    description:
      'Use optional chaining and nullish coalescing to safely access nested data.',
    starterCode: `interface Config {
  db?: {
    host?: string
    port?: number
  }
}

const config: Config = {}

// Read host and port. Both the db object and its fields may be missing,
// so reach through them safely and fall back to "localhost" and 5432.
const host =
const port =

console.log(\`\${host}:\${port}\`)`,
    expectedOutput: 'localhost:5432\n',
    hints: [
      '?. stops and gives undefined instead of throwing when something is missing',
      '?? supplies the fallback, and unlike || it does not replace 0 or an empty string',
      "config.db?.host ?? 'localhost'",
    ],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'polish-mapped-type',
    lessonSlug: 'tsconfig-deep-dive',
    moduleId: 'polish',
    title: 'Mapped Types',
    description:
      'Create a mapped type `Nullable<T>` that makes all properties of T nullable. Apply it to a User type and print a nullable user.',
    starterCode: `// Write a mapped type. Nullable<T> should have every key of T, with
// each value allowed to be its original type or null.
type Nullable<T> =

interface User {
  name: string
  age: number
}

const nullableUser: Nullable<User> = {
  name: null,
  age: 25
}

console.log(nullableUser.name)
console.log(nullableUser.age)`,
    expectedOutput: 'null\n25\n',
    hints: [
      'The shape is { [K in keyof T]: ... }',
      "keyof T gives the union of T's keys; K takes each one in turn",
      'T[K] is the original value type, so the result is T[K] | null',
    ],
    points: 30,
    difficulty: 'hard',
  },
  {
    id: 'advanced-template-literal',
    lessonSlug: 'mapped-types',
    moduleId: 'advanced-types',
    title: 'Template Literal Types',
    description:
      'Use template literal types to create event names. Define `EventName<T extends string>` as `on${Capitalize<T>}`. Create a type for "click" and "hover" and demonstrate their values.',
    starterCode: `type EventName<T extends string> = \`on\${Capitalize<T>}\`

type ClickEvent = EventName<"click">   // "onClick"
type HoverEvent = EventName<"hover">   // "onHover"

const click: ClickEvent = "onClick"
const hover: HoverEvent = "onHover"

console.log(click)
console.log(hover)
`,
    expectedOutput: 'onClick\nonHover\n',
    hints: ['Template literal types combine string literals with types'],
    points: 30,
    difficulty: 'hard',
  },
  {
    id: 'type-system-generic-constraint',
    lessonSlug: 'generics',
    moduleId: 'type-system',
    title: 'Generic Constraints',
    description:
      'Write a generic function `getLength<T extends { length: number }>(arg: T): number` that returns the length of anything with a length property. Test it with a string and an array.',
    starterCode: `// getLength should accept anything with a length, and reject anything
// without one. Constrain T rather than widening it to any.
function getLength<T>(arg: T): number {
  return arg.length
}

console.log(getLength("hello"))
console.log(getLength([1, 2, 3, 4]))`,
    expectedOutput: '5\n4\n',
    hints: [
      '`extends` on a type parameter constrains it: <T extends ...>',
      'Constrain to a shape, not a named type: { length: number }',
      'Strings and arrays both satisfy it, and getLength(42) then fails to compile, which is the point',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'basics-array-types',
    lessonSlug: 'variables-types',
    moduleId: 'basics',
    title: 'Array Types',
    description:
      'Declare a typed array of numbers `scores: number[]`, push 95, 87, and 72 to it, then print the sum.',
    starterCode: `const scores: number[] = []
scores.push(95)
scores.push(87)
scores.push(72)

const sum = scores.reduce((acc, n) => acc + n, 0)
console.log(sum)
`,
    expectedOutput: '254\n',
    hints: ['Use Array.reduce to sum the values'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'basics-enum',
    lessonSlug: 'variables-types',
    moduleId: 'basics',
    title: 'Enums',
    description:
      'Define an enum `Direction` with values Up, Down, Left, Right. Print the string value of Direction.Up.',
    starterCode: `enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT"
}

console.log(Direction.Up)
`,
    expectedOutput: 'UP\n',
    hints: ['String enums store their string values'],
    points: 10,
    difficulty: 'easy',
  },
  {
    id: 'async-type-narrowing',
    lessonSlug: 'async-await',
    moduleId: 'async',
    title: 'Typed Async Results',
    description:
      'Create a Result type `{ ok: true; value: T } | { ok: false; error: string }` and write an async function that returns it. Handle both cases.',
    starterCode: `type Result<T> = { ok: true; value: T } | { ok: false; error: string }

async function fetchData(succeed: boolean): Promise<Result<number>> {
  if (succeed) return { ok: true, value: 42 }
  return { ok: false, error: "Network error" }
}

async function main() {
  const r1 = await fetchData(true)
  const r2 = await fetchData(false)

  if (r1.ok) console.log("Value:", r1.value)
  if (!r2.ok) console.log("Error:", r2.error)
}

main()
`,
    expectedOutput: 'Value: 42\nError: Network error\n',
    hints: ['Discriminated unions make exhaustive checks easy'],
    points: 30,
    difficulty: 'hard',
  },
  {
    id: 'js-to-ts-migrating',
    lessonSlug: 'migration-patterns',
    moduleId: 'javascript-to-typescript',
    title: 'Migrating JS to TS',
    description:
      'Take this JavaScript-style function and add proper TypeScript types. The function formats a currency value.',
    starterCode: `// This came from JavaScript with no types. Add them.
// amount is a number, currency is a string that defaults to "USD",
// and the function returns a string.
function formatCurrency(amount, currency) {
  return \`\${currency} \${amount.toFixed(2)}\`
}

console.log(formatCurrency(19.99))
console.log(formatCurrency(5.5, "EUR"))`,
    expectedOutput: 'USD 19.99\nEUR 5.50\n',
    hints: [
      'Annotate a parameter as `name: type`',
      "A default value goes in the signature: currency: string = 'USD'",
      'The return type goes after the parameter list: ): string {',
    ],
    points: 10,
    difficulty: 'easy',
  },

  // ── Lessons that had no exercise at all ──────────────────────────────────
  {
    id: 'basics-control-flow',
    lessonSlug: 'control-flow',
    moduleId: 'basics',
    title: 'Exhaustive Switch',
    description:
      'Handle every variant of a union in a switch, and make the compiler prove you did by assigning the leftover to never.',
    starterCode: `type Status = 'idle' | 'loading' | 'done'

function label(status: Status): string {
  switch (status) {
    // Return "waiting" for idle, "working" for loading,
    // and "finished" for done.

    default: {
      // If a new Status is added later and not handled above, this
      // assignment stops compiling, which is the point of writing it.
      const unreachable: never = status
      return unreachable
    }
  }
}

console.log(label('idle'))
console.log(label('loading'))
console.log(label('done'))`,
    expectedOutput: 'waiting\nworking\nfinished\n',
    testCode: `test('idle is waiting', function () {
  expect(label('idle')).toBe('waiting');
});
test('loading is working', function () {
  expect(label('loading')).toBe('working');
});
test('done is finished', function () {
  expect(label('done')).toBe('finished');
});`,
    hints: [
      "case 'idle': return 'waiting'",
      'Each case narrows status to that one literal type',
      'Once every case is handled, status in the default branch has type never',
      'That is why the never assignment compiles only when the switch is exhaustive',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'testing-mocking',
    lessonSlug: 'mocking',
    moduleId: 'testing',
    title: 'A Typed Spy',
    description:
      'Write a spy that records the calls made to it and keeps the signature of the function it stands in for.',
    starterCode: `type Logger = (message: string) => void

// createSpy should return a function usable anywhere a Logger is, plus a
// calls array holding every argument it was given. Returning an
// intersection lets it be both at once.
function createSpy(): Logger & { calls: string[] } {

}

const spy = createSpy()

function greet(name: string, log: Logger) {
  log('greeting ' + name)
}

greet('Ada', spy)
greet('Grace', spy)

console.log(spy.calls.length)
console.log(spy.calls[0])`,
    expectedOutput: '2\ngreeting Ada\n',
    testCode: `test('the spy records every call', function () {
  var s = createSpy();
  s('one');
  s('two');
  expect(s.calls.length).toBe(2);
});
test('it records the arguments in order', function () {
  var s = createSpy();
  s('first');
  expect(s.calls[0]).toBe('first');
});
test('a fresh spy starts empty', function () {
  expect(createSpy().calls.length).toBe(0);
});`,
    hints: [
      'Declare the array first: const calls: string[] = []',
      'Then a function that pushes into it: const fn = (message: string) => { calls.push(message) }',
      'Object.assign(fn, { calls }) returns the intersection type you need',
      'Assigning fn.calls directly will not type-check, because the declared function type has no calls',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'frontend-hooks-typing',
    lessonSlug: 'hooks-typing',
    moduleId: 'frontend-react',
    title: 'Type a State Hook',
    description:
      "Model useState's signature. The setter must accept either a new value or a function from the old value to the new one.",
    starterCode: `// useState returns a pair: the current value, and a setter.
// The setter takes either the next value directly, or a function that
// receives the previous value and returns the next one. Model both.
type Setter<T> =

function useState<T>(initial: T): [T, Setter<T>] {
  let value = initial
  const set: Setter<T> = (next) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
  }
  // Reading through a function keeps this honest outside React.
  return [value, set] as [T, Setter<T>]
}

const [count, setCount] = useState(0)
setCount(5)
setCount((previous) => previous + 1)

console.log(typeof count)
console.log(typeof setCount)`,
    expectedOutput: 'number\nfunction\n',
    testCode: `test('the initial value comes back', function () {
  var pair = useState(7);
  expect(pair[0]).toBe(7);
});
test('the setter is a function', function () {
  var pair = useState('x');
  expect(typeof pair[1]).toBe('function');
});
test('it works for other types too', function () {
  var pair = useState(true);
  expect(pair[0]).toBe(true);
});`,
    hints: [
      'A union of the two shapes: (next: T) => void combined with the updater form',
      'Write it as: type Setter<T> = (next: T | ((prev: T) => T)) => void',
      'The union goes on the parameter, not on the whole function type',
      'That is why the body needs the typeof check before calling next',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'frontend-component-patterns',
    lessonSlug: 'component-patterns',
    moduleId: 'frontend-react',
    title: 'Props That Cannot Be Wrong',
    description:
      'Use a discriminated union so illegal prop combinations fail to compile rather than being checked at runtime.',
    starterCode: `// A button is either a link, which needs an href, or a submit button,
// which needs an onClick. Neither should accept the other's prop.
//
// A single interface with both optional cannot express that: it allows
// passing both, or neither. A discriminated union can. Give each member
// a literal 'kind' so TypeScript can tell them apart.
type ButtonProps =

function render(props: ButtonProps): string {
  // Switching on the discriminant narrows props to one member, so
  // props.href is only reachable in the branch that has it.
  switch (props.kind) {
    case 'link':
      return 'link:' + props.href
    case 'submit':
      return 'submit:' + props.label
  }
}

console.log(render({ kind: 'link', href: '/home' }))
console.log(render({ kind: 'submit', label: 'Save' }))`,
    expectedOutput: 'link:/home\nsubmit:Save\n',
    testCode: `test('a link renders its href', function () {
  expect(render({ kind: 'link', href: '/a' })).toBe('link:/a');
});
test('a submit renders its label', function () {
  expect(render({ kind: 'submit', label: 'Go' })).toBe('submit:Go');
});
test('the same string means different things per kind', function () {
  expect(render({ kind: 'link', href: '/x' })).toBe('link:/x');
  expect(render({ kind: 'submit', label: '/x' })).toBe('submit:/x');
});`,
    hints: [
      "Each member is an object type with a literal kind: { kind: 'link'; href: string }",
      'Join them with |, the same union syntax as any other',
      "The other member is { kind: 'submit'; label: string }",
      'Because kind is a literal type rather than string, switching on it narrows the union',
    ],
    points: 25,
    difficulty: 'medium',
  },

  // ── Lessons that need more than one file ────────────────────────────────
  {
    id: 'basics-modules-imports',
    lessonSlug: 'modules-imports',
    moduleId: 'basics',
    title: 'Import What You Need',
    description:
      'Import from a module that already exists, using a named import, a renamed import, and a type-only import.',
    starterCode: `// geometry.ts sits next to this file. It exports:
//   interface Point       a shape with x and y
//   const origin          a Point at 0, 0
//   function distance     the distance between two Points
//   function area         the area of a circle, which you do not need here
//
// Import only what you use: distance, origin, and the Point type.
// Rename distance to gap on the way in, so the call below works.
// Bring Point in as a type-only import, because it is a type and
// erasing it keeps it out of the emitted JavaScript.


const here: Point = { x: 3, y: 4 };

console.log(gap(origin, here));
console.log(here.x + here.y);
`,
    supportingFiles: {
      'geometry.ts': `export interface Point {
  x: number;
  y: number;
}

export const origin: Point = { x: 0, y: 0 };

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function area(radius: number): number {
  return Math.PI * radius * radius;
}
`,
    },
    expectedOutput: '5\n7\n',
    hints: [
      "A named import lists what you want: import { distance } from './geometry.ts'",
      'Rename with as: { distance as gap }',
      'A type-only import is written import { type Point }, or import type { Point }',
      'Node needs the .ts extension in the specifier here',
    ],
    points: 20,
    difficulty: 'medium',
  },
  {
    id: 'modules-declaration-files',
    lessonSlug: 'declaration-files',
    moduleId: 'modules-packages',
    title: 'Type an Untyped Module',
    description:
      'A JavaScript module has no types of its own. Describe its shape so the compiler can check calls against it.',
    starterCode: `// legacy.ts is plain JavaScript behaviour with no useful types: every
// export is typed as any, so nothing about the calls below is checked.
//
// Declare the shape it should have, and use it to type the imports.
// This is the same job a .d.ts file does for a package that ships
// without types.

import { formatName, VERSION } from './legacy.ts';

// Describe the module's surface here. formatName takes a first and last
// name and returns a string; VERSION is a string.
interface LegacyModule {

}

// Then check the imports against it rather than trusting them.
const legacy: LegacyModule = { formatName, VERSION };

console.log(legacy.formatName('Ada', 'Lovelace'));
console.log(legacy.VERSION);
`,
    supportingFiles: {
      'legacy.ts': `// Deliberately untyped: this stands in for a JavaScript package that
// ships no declarations of its own.
export const formatName = (first: any, last: any): any =>
  String(first) + ' ' + String(last);

export const VERSION: any = '1.4.0';
`,
    },
    expectedOutput: 'Ada Lovelace\n1.4.0\n',
    hints: [
      'A function property is written formatName: (first: string, last: string) => string',
      'VERSION is just VERSION: string',
      'Assigning the imports to a typed object is what forces the check',
      'If the signature is wrong, that assignment stops compiling, which is the point',
    ],
    points: 25,
    difficulty: 'medium',
  },
  {
    id: 'modules-resolution',
    lessonSlug: 'module-resolution',
    moduleId: 'modules-packages',
    title: 'Default, Named, and Namespace',
    description:
      'One module, three ways in. Use each correctly, and see why a default export is not a name you can rely on.',
    starterCode: `// counter.ts exports one default and two named values.
//
// Bring in all three:
//   the default export, which you may call anything, so call it tally
//   the named export step
//   everything at once, as a namespace called counter
//
// A default export carries no name across the boundary, which is why
// the importer chooses one. Named exports do carry theirs, so they must
// match or be renamed explicitly.


console.log(tally(3));
console.log(step);
console.log(counter.label);
`,
    supportingFiles: {
      'counter.ts': `export const step = 2;
export const label = 'counter';

export default function increment(value: number): number {
  return value + step;
}
`,
    },
    expectedOutput: '5\n2\ncounter\n',
    hints: [
      "A default import takes no braces: import tally from './counter.ts'",
      'Named imports take braces and must match the exported name',
      'Both can be combined: import tally, { step } from ...',
      "A namespace import is import * as counter from './counter.ts'",
    ],
    points: 25,
    difficulty: 'medium',
  },
];

export const TOTAL_POINTS = challenges.reduce((sum, c) => sum + c.points, 0);
