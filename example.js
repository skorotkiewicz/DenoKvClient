import { z } from "zod";
import { DenoKvClient, createSchema } from "./DenoKvClient.js";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";

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

// Initialize client
const client = new DenoKvClient(schema);
await client.init("http://0.0.0.0:4512", process.env.TOKEN);

const user = {
  name: "John Doe",
  email: "john@example.com",
  id: "e0158261-337f-4320-8176-08aaf66c805a",
};

const order = {
  name: "Order #1",
  userId: "e0158261-337f-4320-8176-08aaf66c805a",
  id: "984556ef-7fac-4add-8611-bc181ae95007",
};

// Example usage
(async () => {
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
    //     // id: uuidv4(),
    //     // createdAt: new Date(),
    //     name: "Order #1",
    //     userId: user.id,
    //   },
    // });
    // console.log("Created order:", order);

    // // Find order with its user
    // const orderWithUser = await client.orders.findUnique({
    //   where: { id: order.id },
    //   include: {
    //     user: true,
    //   },
    //   // select: {
    //   //   name: true,
    //   // },
    // });
    // console.log("Order with user:", orderWithUser);

    // // Find user with their orders
    // const userWithOrders = await client.users.findUnique({
    //   where: { id: user.id },
    //   include: {
    //     orders: true,
    //   },
    //   // select: {
    //   //   name: true,
    //   // },
    // });
    // console.log("User with orders:", userWithOrders);

    // // Upsert user
    // const upsertedUser = await client.users.upsert({
    //   where: { id: user.id },
    //   create: {
    //     name: "John Doe",
    //     email: "john@example.com",
    //     createdAt: new Date(),
    //   },
    //   update: {
    //     name: "John Smith",
    //   },
    // });
    // console.log("Upserted user:", upsertedUser);

    // // Update user
    // const updatedUser = await client.users.update({
    //   where: { id: user.id },
    //   data: {
    //     name: "John Smith",
    //   },
    // });
    // console.log("Updated user:", updatedUser);

    // const count = await client.users.count({
    //   where: {
    //     name: user.name,
    //   },
    // });

    // console.log("Users count:", count);

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

    //////////////////////////////////////////
    ////////////// matchesWhere //////////////
    //////////////////////////////////////////

    // // Find users with email starting with "john"
    // const usersStartingWithJohn = await client.users.findMany({
    //   where: {
    //     email: {
    //       startsWith: "john",
    //     },
    //   },
    //   skip: 2,
    //   take: 2,
    // });
    // console.log(
    //   "Users with email starting with 'john':",
    //   usersStartingWithJohn
    // );

    // // Filtered users
    // const filteredUsers = await client.users.findMany({
    //   where: {
    //     name: {
    //       contains: "John", // name contains "John"
    //     },
    //     email: {
    //       endsWith: "@example.com", // email ends with "@example.com"
    //     },
    //   },
    // });
    // console.log("Filtered users:", filteredUsers);

    // // Using other comparison operators
    // const ordersByAmount = await client.orders.findMany({
    //   where: {
    //     amount: {
    //       gt: 100, // amount greater than 100
    //       lte: 500, // and less than or equal to 500
    //     },
    //     name: {
    //       contains: "Order", // name contains "Order"
    //     },
    //   },
    // });
    // console.log("Orders by amount:", ordersByAmount);

    // // Using the operator in
    // const specificUsers = await client.users.findMany({
    //   where: {
    //     id: {
    //       in: ["id1", "id2", "id3"], // id is in the arrays
    //     },
    //   },
    // });
    // console.log("Specific users:", specificUsers);

    // // Using deleteMany with conditions
    // const deleteResult = await client.users.deleteMany({
    //   where: {
    //     email: {
    //       endsWith: "@test.com", // delete all emails ending in “@test.com”
    //     },
    //     name: {
    //       startsWith: "Test", // and beginning with “Test”
    //     },
    //   },
    // });
    // console.log("Deleted test users:", deleteResult);

    await client.close();
  } catch (error) {
    console.error("Error:", error);
  }
})();
