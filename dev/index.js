import { z } from "zod";
import { DenoKvClient, createSchema } from "./deno3.js";
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
  id: "23aeed36-ed9a-42fb-8f12-a4766e974d33",
  name: "John Doe",
  email: "john@example.com",
};

const order = {
  id: "1dfddb17-caa0-4b31-92c7-57fd65c7fa87",
  name: "Order #1",
  userId: "23aeed36-ed9a-42fb-8f12-a4766e974d33",
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
    //     id: uuidv4(),
    //     createdAt: new Date(),
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

    await client.close();
  } catch (error) {
    console.error("Error:", error);
  }
})();
