import * as d3 from 'd3';
import { Tooltip, TickQueue } from './components/index.js';

export default class Graph {
    wrapper = null; // id字符串
    height = 0;
    width = 0;
    // 动态新宽高,用于处理全屏逻辑
    screenHeight = 0;
    screenWidth = 0;

    transform = d3.zoomIdentity;
    ctx = null;
    nodes = [];
    links = [];
    // tooltip
    tooltip = null;
    // shadow
    shadowCtx = null;
    colorPool = null;
    // 背景色
    bgColor = "#fff";
    lineColor = "#bbb";
    // 事件
    eventMap = new Map();
    
    autoFitLock = false; // 自适应锁，手动缩放则禁止自动适应

    queue = new TickQueue();
    layoutEnd = false;

    init({height,width,wrapper,nodes,links}){
        this.height = this.screenHeight = height;
        this.width = this.screenWidth = width;
        this.wrapper = wrapper;
        d3.select(wrapper).attr("style","position:relative");
        // 初始化canvas 和 shadowcanvas
        this.$initCanvas();
        // 布局+绘制
        this.$data({ nodes, links });
        // 缩放
        this.$zoom();
        // tooltip
        // this.$handleTooltip();
        // 全屏或者改变窗口尺寸
        this.$handleResize();
    }
    update(d){
        return this.$data(d);
    }
    // 事件绑定
    on(eventType, callback) {
        const d3Canvas = d3.select("#shadow-canvas");
        this.eventMap.set(eventType, callback);
        d3Canvas.on(eventType, (event) => {
            const { layerX, layerY } = event;
            const { type, target } = this.$findTarget(layerX, layerY);
            if (type === 'node') {
                callback(target)
            }
        })
    }
    // 初始化canvas 和 shadowcanvas
    $initCanvas(){
        const { ctx } = this.$drawCanvas("real-canvas");
        this.ctx = ctx;

        const { dom:shadowDom, ctx:shadowCtx } = this.$drawCanvas("shadow-canvas");
        this.shadowCtx = shadowCtx;
        shadowDom.style = "opacity:0.01";
    }
    // 绘制canvas
    $drawCanvas(id = "real-canvas") {
        const { width, height, wrapper } = this;
        d3.select(`#${id}`).remove();
        d3.select(wrapper).append("canvas")
            .attr("id", id)
            .attr("height", height)
            .attr("width", width)
            .attr("style", `position:absolute;left:0;top:0;`);
        const dom = document.getElementById(id);
        const ctx = dom.getContext("2d", { alpha: true });
        return { dom, ctx };
    }
    // 布局+绘制
    $data({ nodes, links }) {
        this.nodes = nodes;
        this.links = links;
        this.colorPool = new ColorPool({ nodes, links });
        // 布局
        // d3力导布局 + tick
        this.simulation = d3.forceSimulation(nodes).alpha(1)
            .alphaDecay(0.15)
            .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => 30).iterations(10))
            .force("charge", d3.forceManyBody()) // 多体布局：全局引力或斥力，第一个参数是这个布局的名字，删除时可以用到
            .force("collide", d3.forceCollide().radius((node) => node.symbolSize))
            .force("x", d3.forceX(this.width / 2)) // x,y 位置布局
            .force("y", d3.forceY(this.height / 2))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .on("tick", () => {
                Promise.resolve().then(this.queue.flush);
                console.log(nodes)
                this.queue.add(() => {
                    this.layoutEnd && this.$handleFitView();
                    this.$renderByTransform();
                })
            })
            .on("end",()=>{
                this.layoutEnd = true;
            })
    }
    $handleFitView(){
        if (this.autoFitLock) {
            return
        }
        // 取最左边，最右边，最上边，最下边的node, 得到当前布局范围，再根据比例缩放
        const minY = this.simulation.find(0, -9999).y;
        const maxY = this.simulation.find(0, 9999).y;
        const layoutHeight = maxY - minY + 50;
        const n = (this.height / layoutHeight ).toFixed(2);
        this.transform.k = n;
        this.transform.x = - this.width * (n - 1) / 2 ;
        this.transform.y = - this.height * (n - 1) / 2 ;
    }
    // 绘制
    $renderByTransform = () => {
        const ctx = this.ctx;
        this.$clear(ctx);
        ctx.save();
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.k, this.transform.k);
        // links
        this.layoutEnd && this.links.forEach((l) => {
            ctx.beginPath();
            ctx.lineWidth = Math.max(0.15/this.transform.k,0.15);
            // 箭头
            const dx = l.target.x - l.source.x;
            const dy = l.target.y - l.source.y;
            const dz = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
            const tr = l.target.symbolSize;
            const tx = (dz - tr) * dx / dz + l.source.x;
            const ty = (dz - tr) * dy / dz + l.source.y;
            const sr = l.source.symbolSize;
            const sx = sr * dx / dz + l.source.x;
            const sy = sr * dy / dz + l.source.y;
            const b = Math.atan(dx / dy);
            const a = 16 * (Math.PI / 180);
            const line = 2;// 箭头长度
            const [x1, y1] = [tx - line * Math.sin(b - a), ty - line * Math.cos(b - a)];
            const [x2, y2] = [tx - line * Math.sin(b + a), ty - line * Math.cos(b + a)];
            const [x3, y3] = [tx + line * Math.sin(b - a), ty + line * Math.cos(b - a)];
            const [x4, y4] = [tx + line * Math.sin(b + a), ty + line * Math.cos(b + a)];
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            if (dy > 0) {
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
            } else {
                ctx.lineTo(x3, y3);
                ctx.lineTo(x4, y4);
            }
            ctx.lineTo(tx, ty);
            ctx.fillStyle = this.lineColor;
            ctx.strokeStyle = this.lineColor;
            ctx.fill();
            ctx.stroke();
        });
        // nodes
        this.nodes.forEach((n) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.symbolSize, 0, Math.PI * 2, true); // 绘制
            ctx.fillStyle = n.style.fill;
            ctx.fill();
            if (n.name && this.layoutEnd) {
                ctx.fillStyle = "#000";
                ctx.font = `2px serif`;
                ctx.fillText(n.name, n.x + (+n.symbolSize * 1.1), n.y + (+n.symbolSize / 6));
            }
            if (n.label && this.layoutEnd) {
                ctx.font = `${+n.symbolSize}px serif`;
                ctx.fillStyle = "#fff";
                ctx.fillText(n.label, n.x - (+n.symbolSize / 4) * (n.label + "").length, n.y + (+n.symbolSize / 3));
            }
        });
        ctx.restore();
        this.layoutEnd && this.$renderShadowByTransform();
    }
    // 绘制shadow
    $renderShadowByTransform() {
        const ctx = this.shadowCtx;
        this.$clear(ctx);
        ctx.save();
        ctx.translate(this.transform.x, this.transform.y);
        ctx.scale(this.transform.k, this.transform.k);
        // links
        this.links.forEach((l) => {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
            ctx.strokeStyle = `rgba(${this.colorPool.pool.get(`link-${l.index}`)})`;
            ctx.stroke();
        });
        // nodes
        this.nodes.forEach((n) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.symbolSize, 0, Math.PI * 2, true); // 绘制
            ctx.fillStyle = `rgba(${this.colorPool.pool.get(`node-${n.index}`)})`;
            ctx.fill();
        });
        ctx.restore();
    }
    // 清楚画布
    $clear(ctx) {
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
    }
    // 缩放
    $zoom() {
        const d3Canvas = d3.select("#shadow-canvas");
        d3Canvas.call(d3.zoom()
            .scaleExtent([0.5, 20]) // 缩放限制
            .on("zoom", (event) => {// 缩放函数
                this.transform = event.transform;
                window.requestAnimationFrame(()=>{
                    this.autoFitLock = true;
                    this.$renderByTransform();
                })
            }))
    }
    // tooltip
    $handleTooltip(){
        const { width, height, wrapper } = this;
        const tooltip = new Tooltip();
        tooltip.init({ height, width, wrapper })

        const d3Canvas = d3.select("#shadow-canvas");
        const handleMousemove = (event) => {
            const { layerX, layerY } = event;
            const { type, target } = this.$findTarget(layerX, layerY);
            if (type === "link") {
                tooltip.showTooltip({ link: target, x: layerX, y: layerY })
            } else if (type === 'node') {
                tooltip.showTooltip({ node: target, x: layerX, y: layerY })
            } else {
                tooltip.delayHideTooltip()
            }
        };
        // d3Canvas.on("mousemove", _.throttle(handleMousemove, 200, { leading: true, trailing: false}))
    }
    $findTarget(x, y) {
        const rgba = this.shadowCtx.getImageData(x, y, 1, 1).data;
        const { type, index } = this.colorPool.rgbaToTarget(rgba);
        return type === 'node' ? { type, target: this.nodes[index] } : { type, target: this.links[index] };
    }
    $handleResize(){
        window.addEventListener('resize', () => {
            // 改canvas height width
            const wrapper = document.querySelector(this.wrapper).parentElement;
            const h = wrapper.offsetHeight || 500;
            const w = wrapper.offsetWidth || 0;
            // ctx 二维渲染上下文
            d3.select("#real-canvas")
                .attr("height", h)
                .attr("width", w)
            // shadow-canvas
            d3.select("#shadow-canvas")
                .attr("height", h)
                .attr("width", w)
            // 重新修正x,y, 不处理缩放倍数
            this.transform.x = this.transform.x + (w - this.screenWidth) / 2;
            this.transform.y = this.transform.y + (h - this.screenHeight) / 2;
            this.screenHeight = h ;
            this.screenWidth = w;
            this.$renderByTransform();
        })
    }
}

// 边的index 和 颜色对应
class ColorPool {
    pool = new Map();
    constructor({nodes,links}){
        links.forEach((item,index)=>{
            const color = this.createColor();
            this.pool.set(`link-${index}`, color );
            this.pool.set(color, `link-${index}`);
        })
        nodes.forEach((item, index) => {
            const color = this.createColor();
            this.pool.set(`node-${index}`, color);
            this.pool.set(color, `node-${index}`);
        })
    }

    createColor() {
        let color = this.createOnceColor();
        while (this.pool.has(color)) {
            color = this.createOnceColor();
        }
        return color;
    }

    createOnceColor() {
        return Array(3).fill(0).map(() => Math.ceil(Math.random() * 255)).concat(255).join(",")
    }

    rgbaToTarget(rgba) {
        if (rgba.join(',') !=='255,255,255,255') {
            const t = this.pool.get(rgba.join(","));
            if (t) {
                const [type, index] = t.split("-");
                return { type, index };
            }
        }
        return {};
    }
}