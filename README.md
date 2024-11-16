# DenoKvClient - Wrapper for Deno KV

A simple client wrapper for the Deno KV (Key-Value) store, written in JavaScript. This library provides a convenient way to interact with the Deno KV service, with support for creating, reading, updating, and deleting data.

## Installation

To use the DenoKvClient, you need install a dependency in your project:

```
yarn add @deno/kv
```

I'm use this on my own [Deno KV](https://github.com/denoland/denokv) server.

## Usage

1. Import the `DenoKvClient` class:

```js
import { DenoKvClient } from "./DenoKvClient.js";
```

2. Initialize the client with the Deno KV service URL and an access token:

```js
// Define your schemas
export const User = z.object({
  id: z.optional(z.string().uuid()).describe("primary"),
  createdAt: z.optional(z.date()),
  name: z.string(),
  email: z.string().email(),
});

export const Order = z.object({
  id: z.optional(z.string().uuid()).describe("primary"),
  createdAt: z.optional(z.date()),
  name: z.string(),
  userId: z.string().uuid(),
});

// Define schemas with relationscd
const schema = createSchema().model({
  users: {
    schema: User,
    relations: {
      orders: ["orders", [Order], "id", "userId"],
    },
  },
  orders: {
    schema: Order,
    relations: {
      user: ["users", User, "userId", "id"],
    },
  },
});

const client = new DenoKvClient(schema);
await client.init("http://0.0.0.0:4512", "your_access_token_here");
```

3. Use the client to interact with the Deno KV store:

```js
// Create a new entry
const newUser = await client.users.create({
  data: {
    username: "ola",
    name: "Ola",
    age: 31,
  },
  select: {
    age: true,
    name: true,
  },
});
console.log(newUser);

// Find a unique entry
const user = await client.users.findUnique({
  where: {
    username: "ola",
  },
  select: {
    age: true,
    username: true,
    tags: true,
  },
});
console.log(user);

// Update an entry
const updatedUser = await client.users.update({
  where: {
    username: "ola",
  },
  data: {
    name: "Ola Updated",
    age: 32,
    tags: [
      { id: 1, tag: "hello" },
      { id: 2, tag: "world" },
      { id: 3, tag: "example" },
    ],
  },
  select: {
    name: true,
    age: true,
  },
});
console.log(updatedUser);

////////////// matchesWhere //////////////

// Find users with email starting with "john"
const usersStartingWithJohn = await client.users.findMany({
  where: {
    email: {
      startsWith: "john",
    },
  },
});
console.log("Users with email starting with 'john':", usersStartingWithJohn);

// Filtered users
const filteredUsers = await client.users.findMany({
  where: {
    name: {
      contains: "John", // name contains "John"
    },
    email: {
      endsWith: "@example.com", // email ends with "@example.com"
    },
  },
});
console.log("Filtered users:", filteredUsers);
```

## Features

- Namespace Support: The client uses a proxy to dynamically create namespaces (e.g., `client.users`, `client.bans`) for managing data.

- CRUD Operations: Supports creating, reading, updating, and deleting data in the Deno KV store.

- Selective Data Fetching: The `select` option allows you to specify which fields should be returned in the response.

- Error Handling: The client provides basic error handling and can be extended to handle more complex error scenarios.

## Contributing

If you find any issues or would like to contribute to the project, feel free to open a pull request or submit an issue on the GitHub repository.

## License

This project is licensed under the MIT License.
