import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import ascii from "rollup-plugin-ascii";
import {terser} from "rollup-plugin-terser";
import * as meta from "../../package.json";
import ignore from "rollup-plugin-ignore";

const config = {
  input: "jsroot_hist.mjs",
  output: {
    dir: "bundle",
    format: "es",
    indent: false,
    extend: true,
    banner: `// ${meta.homepage} v${meta.version}`
  },
  plugins: [
    ignore(["fs", "xhr2", "canvas", "btoa", "atob", "zlib", "zstd-codec", "mathjax", "jsdom", "gl"]),
    nodeResolve(),
    json(),
    ascii()
  ],
  onwarn(message, warn) {
    if (message.code === "CIRCULAR_DEPENDENCY") return;
    warn(message);
  }
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      dir: "bundle.min"
    },
    plugins: [
      ...config.plugins,
      terser({
        output: {
          preamble: config.output.banner
        },
        mangle: {
          reserved: [
            "InternMap",
            "InternSet"
          ]
        }
      })
    ]
  }
];
