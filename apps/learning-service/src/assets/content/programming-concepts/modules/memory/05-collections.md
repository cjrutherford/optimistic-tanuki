# Collections Are Memory Shapes

"Just use a map" is advice that skips a decision. A map, an array, and a
linked list all store the same information (a bunch of values) but they
lay it out in memory completely differently, and that layout is where every
collection's performance characteristics actually come from. Picking a
collection is picking a memory shape, whether or not the language makes you
say so.

---

## Three Shapes

**Contiguous.** Every element sits directly next to the one before it, in
one block. This is a C array, a `std::vector`, a Go array or slice's backing
store, a Rust `Vec`.

```
[ e0 | e1 | e2 | e3 | e4 ]
```

Reading element `i` is one address calculation (`base + i * size`) with no
pointer to follow. This is what makes contiguous collections fast to scan
and cache-friendly: the CPU pulls a chunk of nearby memory into cache once,
and elements 1 through 7 are already there when you reach for them.

**Hashed.** Elements are scattered across a backing array at positions a
hash function computes from the key, with some scheme for handling two keys
that land on the same slot. This is a Go map, a Rust `HashMap`, a Python
dict, a JavaScript `Map` or object.

```
hash("alice") -> slot 4
hash("bob")   -> slot 1
hash("carol") -> slot 4  (collision with "alice" — handled internally)
```

Lookup by key is roughly constant time regardless of how many entries exist,
which is the whole appeal. It costs something to get there: computing the
hash, handling collisions, and, critically, no useful order. Iterating a
hashed collection visits entries in whatever order the internal slots
happen to fall in, not insertion order, and that order can even change
between runs.

**Linked.** Each element is a separate allocation holding a pointer to the
next one (and sometimes the previous one). Nothing about a linked list is
contiguous; two neighboring elements can live anywhere in memory.

```
[e0] -> [e1] -> [e2] -> [e3]
 (four separate allocations, four separate places in memory)
```

Inserting or removing in the middle is cheap once you're already there (you
just rewire two pointers) but _finding_ the middle costs a full walk from
the front, because there's no address arithmetic that jumps to element `i`
the way there is for a contiguous block.

---

## The Cost Nobody Mentions

"Just use a map" trades away two things that a contiguous collection gives
you for free: order, and cache-friendly scanning. Both costs are easy to
miss because a hashed collection still _works_ when you iterate it: it just
does two things worse than you might expect.

```go
m := map[string]int{"a": 1, "b": 2, "c": 3}
for k, v := range m {
    fmt.Println(k, v)   // order is unspecified, and changes between runs
}
```

`letsgogo/modules/quirks/02-slices-arrays-maps.md` notes this directly: map
iteration order is randomized on purpose, precisely so code doesn't grow an
accidental dependency on an order the map was never promising. If you need
insertion order preserved, a map alone does not give it to you in Go, Rust's
`HashMap`, or most languages' default hash table: you keep a separate
ordered structure, or reach for a type that explicitly promises order (a
`BTreeMap` in Rust, an `OrderedDict`-like structure elsewhere).

The cache cost is quieter and shows up as "this is slower than it looks."
Scanning every entry of a hashed collection or walking a linked list touches
memory scattered across the heap, and each jump to a new location can be a
cache miss: a stall while the CPU fetches from main memory instead of
cache. Scanning a contiguous `Vec` or slice of the same size touches memory
the CPU already pulled in. For a small collection this rarely matters. For a
hot loop over a large one, the difference between "contiguous" and
"scattered" can dominate the runtime, independent of the algorithm's
complexity on paper.

---

## Matching Shape to Access Pattern

The question worth asking before reaching for a collection type is not "how
do I store these" but "how will I get them back out":

1. **Scanning everything, in order, often** — contiguous. A `Vec`, a slice,
   an array. `letsgorust/modules/collections/01-vectors.md` covers Rust's
   `Vec<T>`, which is this shape: growable, contiguous, indexable in
   constant time.
2. **Looking things up by a key, order doesn't matter** — hashed. A Go map,
   a Rust `HashMap`. `letsgorust/modules/collections/02-hashmaps.md` covers
   `HashMap<K, V>`'s O(1) average lookup, and the same average-case caveat
   applies everywhere a hash table does: worst case, with enough collisions,
   is worse.
3. **Frequent insertion or removal in the middle, rarely indexing by
   position** — linked, or a structure built to amortize that cost. This
   pattern is genuinely rare in application code; most "I need fast
   inserts" problems are better served by a contiguous collection with
   `push`/`pop` at one end, which is amortized constant time without
   linked-list's per-element allocation overhead.

Note what's missing from that list: "default." Every mainstream language
has a collection type its standard idioms reach for first (a slice in Go, a
`Vec` in Rust, a `list` in Python) and that default is usually the
contiguous shape, because contiguous is the shape that's fast for the most
common access pattern, reading things back roughly in the order you put
them in. Reaching past the default for a map is the right call when the
access pattern is genuinely "look up by key" — and the wrong call, with a
real and measurable cost, when it's picked out of habit for data that was
always going to be scanned in order.

---

## Shape Survives the Rename

The three shapes in this lesson are not specific to any one language's
standard library, and recognizing the shape underneath a new name is most
of the work of learning a second language's collections. A Python `list`,
a Java `ArrayList`, a C `int[]`, and a Rust `Vec<T>` are the same
contiguous shape wearing four names. A Python `dict`, a Java `HashMap`, a
Go `map`, and a Rust `HashMap` are the same hashed shape. The methods
attached to each (`.push()` versus `.append()` versus `.append(...)`) vary
by language; the memory layout, and therefore the performance
characteristics, do not. When a new language's documentation describes a
collection you haven't met by name, ask which of the three shapes it's
built on before reading further: the shape tells you most of what you need
to know about when to reach for it.

---

## Best Practices

1. Ask how you'll read the data back before choosing how to store it
2. Do not assume a hashed collection preserves insertion order: check
   whether your language's default map type promises it, because most
   don't
3. Prefer a contiguous collection for anything you mostly scan; reach for
   hashed storage specifically for lookup-by-key
4. Remember that "amortized constant time" (growable arrays appending) and
   "constant time" (hash lookup) are both averages, not guarantees on every
   single call
