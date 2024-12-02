import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default [
  {
    input: "DenoKvClient.js",
    output: [
      // {
      //   file: "dist/cjs/index.js",
      //   format: "cjs",
      // },
      {
        file: "dist/esm/index.js",
        format: "esm",
      },
    ],
    plugins: [resolve(), commonjs()],
    external: ["@deno/kv", "zod"],
  },
];
