import * as d3 from 'd3';
import { getRelationshipInfo } from '../../../../api/relationShipGraph';
import { getSessionStorage, setSessionStorage } from '../../../../utils/sessionStorage';

async function getRelationship(data) {
    const l = getSessionStorage("l");
    if (!l[`${data.source}-${data.target}`]) {
        const res = await getRelationshipInfo(data);
        setSessionStorage("l", { ...l, [`${data.source}-${data.target}`]: res })
        return res
    }
    return l[`${data.source}-${data.target}`]
}

export default class GraphTooltip {
    tooltipX = null;
    tooltipY = null;
    tooltipW = 380;
    tooltipH = 208;
    tooltip = null;
    timer = null;

    init({ height, width, wrapper }){
        const graph = d3.select(wrapper)
        graph.select("svg").remove();
        const tooltip = graph.append("svg")
            .attr("style", `position:absolute;top:0;left:0;width:${this.tooltipW};height:${this.tooltipH}`)
            .attr("viewBox", `0 0 ${this.tooltipW} ${this.tooltipH}`)
            .attr("visibility", "hidden")
            
        tooltip.append("g")
            .attr("class", "g-tooltip")
            .attr("viewBox", `0 0 ${this.tooltipW} ${this.tooltipH}`)

        tooltip.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", this.tooltipW)
            .attr("height", this.tooltipH)
            .attr("fill", "#fff")
            .attr("rx", 8)
            .attr("stroke", "#aaa")
            .attr("stroke-width", 0.5)

        
        tooltip.on("mouseenter", ()=>{
            this.stayTooltip()
        }).on("mouseleave", () => {
            this.delayHideTooltip()
        })

        this.tooltip = tooltip;
    }

    // 编辑相关
    addText(content, y) {
        // y是文字的基线位置
        this.tooltip.append("text").text(content)
            .attr("style", "text-anchor: start")
            .attr("font-size", 13)
            .attr("x", 15).attr("y", y + 25)
    }

    addA(content, x, y, url) {
        this.tooltip.append("a")
            .attr("xlink:href", url)
            .attr("target", "_blank")
            .append("text")
            .text(content)
            .attr("style", "text-anchor: start")
            .attr("font-size", 14)
            .attr("fill", "#1248E9")
            .attr("x", x + 15).attr("y", y + 25)
    }

    stayTooltip(){
        this.timer && clearTimeout(this.timer);
        this.tooltip.attr("visibility", "visible")
    }

    delayHideTooltip() {
        this.timer && clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.tooltip.attr("visibility", "hidden")
            this.timer && clearTimeout(this.timer);
        }, 400);
    }

    showTooltip = async ({node,link,x,y})=>{
        this.timer && clearTimeout(this.timer);
        this.tooltip.attr("visibility", "visible")
        // 移动
        this.tooltip.transition()
            .duration(200)
            .ease(d3.easeLinear)
            .attr("transform", `translate(${x + 5},${y + 5})`)
            .attr("opacity", 0.9)
        // 添加信息
        const n = 24;
        if (node) {
            // 删除
            this.tooltip.selectAll("text").remove();
            this.addText(`用户名：${node.name || ""}`, 0);
            this.addText("用户ID：" + node.userId, n);
            if (node.userId === "topNode") {
                this.tooltip.select("rect").attr("height", this.tooltipH-6*n);
                return;
            }
            this.addText("粉丝数：" + node.fansCount, 2 * n);
            this.addText("昨日新增粉丝总数：" + node.newFansCount, 3 * n);
            this.addText("一度粉丝数：" + node.firstFansCount, 4 * n);
            this.addText("昨日新增一度粉丝：" + node.firstNewFansCount, 5 * n);
            this.addText("分享次数：" + node.shareCount, 6 * n);
            this.addA("查看网络详情",0, 7 * n, "www.baidu.com");
            this.addA("查看粉丝列表", 100, 7 * n, "www.baidu.com");
            this.tooltip.select("rect").attr("height", this.tooltipH);
        }else if(link){
            const res = await getRelationship({ source: link.source.userId, target: link.target.userId,hallId:link.hallId })
            // 删除
            this.tooltip.selectAll("text").remove();
            this.addText(`分享用户ID：${link.source.userId || ""}`, 0);
            this.addText(`粉丝用户ID：${link.target.userId || ""}`, n);
            this.addText(`分享时间：${res.shareTime || ""}`, n * 2);
            this.addText(`打开时间：${res.openTime || ""}`, n * 3);
            this.addText(`打开内容ID：${res.contentId || ""}`, n * 4);
            this.tooltip.select("rect").attr("height", 140);
        }
    }
}