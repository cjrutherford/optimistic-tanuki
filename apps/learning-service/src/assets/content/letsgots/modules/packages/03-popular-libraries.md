# Popular TypeScript Libraries

The TypeScript ecosystem includes many well-typed libraries that enhance productivity.

## tRPC — End-to-End Type Safety

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  getUser: t.procedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    return await db.findUser(input.id); // typed
  }),
  createUser: t.procedure.input(z.object({ name: z.string(), email: z.string().email() })).mutation(async ({ input }) => {
    return await db.createUser(input);
  }),
});

// Client — fully typed!
const user = await trpc.getUser.query({ id: 'alice' });
```

## React Query / TanStack Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useUser(id: string) {
  return useQuery<User, Error>({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => createUser(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

## date-fns — Type-Safe Dates

```typescript
import { format, addDays, differenceInDays } from 'date-fns';

const formatted: string = format(new Date(), 'yyyy-MM-dd');
const future: Date = addDays(new Date(), 7);
const diff: number = differenceInDays(future, new Date());
```

## Summary

The TypeScript ecosystem is rich with well-typed libraries. Prioritize libraries with first-class TypeScript support for the best developer experience.
