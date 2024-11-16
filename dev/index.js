import { z } from "zod";
import { DenoKvClient, createSchema } from "./deno3.js"; //deno3.js
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";

// Define your schemas
export const User = z.object({
  id: z.string().uuid().describe("primary"),
  createdAt: z.date(),
  name: z.string(),
  email: z.string().email(),
});

export const Order = z.object({
  id: z.string().uuid().describe("primary"),
  createdAt: z.date(),
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

// Initialize client
const client = new DenoKvClient(schema);
await client.init("http://0.0.0.0:4512", process.env.TOKEN);

const user = {
  id: "f790a760-0489-4e22-86ca-f2bc519f7a23",
  name: "John Doe",
  email: "john@example.com",
};

const order = {
  id: "21f543aa-6028-448d-a065-8b12e9127424",
  name: "Order #1",
  userId: "f790a760-0489-4e22-86ca-f2bc519f7a23",
};

(async () => {
  // // "fake" query
  // const count = await client.orders.count({
  //   where: { id: user.id },
  // });
  // console.log("Count:", count);

  // const data = await client.users.findUnique({
  //   where: { id: user.id },
  //   include: {
  //     orders: true,
  //   },
  // });
  // console.log("User with orders:", data);

  // Find order with its user
  const orderWithUser = await client.orders.findUnique({
    where: { id: "21f543aa-6028-448d-a065-8b12e9127424" },
    include: {
      user: true,
    },
  });
  console.log("Order with user:", orderWithUser);

  // Find order with its user
  const test = await client.users.findMany({
    where: { name: "John Doe" },
    include: {
      orders: true,
    },
    take: 2,
    skip: 1,
    // select: {
    //   id: true,
    //   name: true,
    // },
  });
  console.log("test:", test);
})();

// (async () => {
//   // Find user with their orders
//   const count = await client.users.count({
//     where: { id: user.id },
//   });
//   console.log("Count:", count);

//   const orderWithUser = await client.orders.findUnique({
//     where: { id: order.id },
//     include: {
//       user: true,
//     },
//   });
//   console.log("orderWithUser:", orderWithUser);
// })();

// Example usage
(async () => {
  //   const t = await client.users.count({
  //     where: {
  //       id: user.id,
  //     },
  //   });

  //   console.log(t);

  try {
    // // Create a user
    // const user = await client.users.create({
    //   data: {
    //     id: uuidv4(),
    //     createdAt: new Date(),
    //     name: "John Doe",
    //     email: "john@example.com",
    //   },
    // });
    // console.log("Created user:", user);
    // // Create an order for the user
    // const order = await client.orders.create({
    //   data: {
    //     id: uuidv4(),
    //     createdAt: new Date(),
    //     name: "Order #1",
    //     userId: user.id,
    //   },
    // });
    // console.log("Created order:", order);
    // // Find user with their orders
    // const tmp = await client.users.count({
    //   where: { id: user.id },
    // });
    // console.log("User with orders:", tmp);
    // // Find order with its user
    // const orderWithUser = await client.orders.findUnique({
    //   where: { id: order.id },
    //   include: {
    //     user: true,
    //   },
    // });
    // console.log("Order with user:", orderWithUser);
    // // Find user with their orders
    // const userWithOrders = await client.users.findUnique({
    //   where: { id: user.id },
    //   include: {
    //     orders: true,
    //   },
    // });
    // console.log("User with orders:", userWithOrders);
    // // Update user
    // const updatedUser = await client.users.update({
    //   where: { id: user.id },
    //   data: {
    //     name: "John Smith",
    //   },
    // });
    // console.log("Updated user:", updatedUser);
    // // Delete order
    // const deletedOrder = await client.orders.delete({
    //   where: { id: order.id },
    // });
    // console.log("Deleted order:", deletedOrder);
    // // Delete user
    // const deletedUser = await client.users.delete({
    //   where: { id: user.id },
    // });
    // console.log("Deleted user:", deletedUser);
    // await client.close();
  } catch (error) {
    console.error("Error:", error);
  }
})();
