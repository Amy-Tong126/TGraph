// 查找解析node_modules中第三方模块的插件
import { nodeResolve } from '@rollup/plugin-node-resolve';
// 第三方库是commonjs
import commonjs from "@rollup/plugin-commonjs";

export default {
    input: 'src/index.js',
    output: [
        { file: "dist/TGraph.js", format: 'umd' },
    ],
    plugins:[
        nodeResolve(),
        commonjs()
    ]
};