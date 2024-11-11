import DenoKvClient from "./DenoKvClient.js";
import "dotenv/config";

(async () => {
  const client = new DenoKvClient();
  await client.init("http://0.0.0.0:4512", process.env.TOKEN);

  // (async () => {
  //   const newUser = await client.users.create({
  //     data: {
  //       username: "ola",
  //       name: "Ola",
  //       age: 31,
  //     },
  //     select: {
  //       age: true,
  //       name: true,
  //     },
  //   });
  //   console.log(newUser);
  // })();

  // (async () => {
  //   const newUser = await client.bans.create({
  //     data: {
  //       username: "ala",
  //       name: "Ala",
  //       age: 32,
  //     },
  //     select: {
  //       age: true,
  //       name: true,
  //     },
  //   });
  //   console.log(newUser);
  // })();

  (async () => {
    const test = await client.users.findUnique({
      where: {
        username: "ola",
      },
      // select: {
      //   age: true,
      //   username: true,
      //   tags: true,
      // },
    });
    console.log(test);
  })();

  (async () => {
    const test = await client.bans.findUnique({
      where: {
        username: "ala",
      },
      select: {
        age: true,
        username: true,
        tags: true,
      },
    });
    console.log(test);
  })();

  // (async () => {
  //   const updatedUser = await client.users.update({
  //     where: {
  //       username: "ola",
  //     },
  //     data: {
  //       name: "Ola Updated",
  //       age: 32,
  //       tags: [
  //         { id: 1, tag: "hello" },
  //         { id: 2, tag: "world" },
  //         { id: 3, tag: "example" },
  //       ],
  //     },
  //     select: {
  //       name: true,
  //       age: true,
  //     },
  //   });
  //   console.log(updatedUser);
  // })();

  // (async () => {
  //   const updatedUser = await client.bans.update({
  //     where: {
  //       username: "ala",
  //     },
  //     data: {
  //       name: "Ala Updated",
  //       age: 31,
  //       tags: [
  //         { id: 1, tag: "hello" },
  //         { id: 2, tag: "world" },
  //         { id: 3, tag: "example" },
  //       ],
  //     },
  //     select: {
  //       name: true,
  //       age: true,
  //     },
  //   });
  //   console.log(updatedUser);
  // })();
})();
