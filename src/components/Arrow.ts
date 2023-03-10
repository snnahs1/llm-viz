
/* Arrow Design:

This is a flat, rectangular, ribbon-like pathway with lines down the edges.

It has a defined width. The ribbon might have some motion animation when I write the shader for it.

The sides will have lines to border the transparent ribbon.

We define a start, end, width, and "normal". The normal is perpendicular to the direction of the arrow,
and the normal lies within all parts of the ribbon.

The ribbon can bend, subject to the normal. The ribbon always starts in-plane. We'll have to do some
curve generation to make the ribbon bend. (this probably requires a 3rd degree bezier curve)

The arrow head is fairly flat, and is a triangle. We define the depth of the arrow head, and the
width. Not sure if the width should be a constant, or proportional to the width/length of the arrow.

Arrows will also have padding between blocks.

Some special arrows bend at the start in the plane of the ribbon, where they diverge from a vertical arrow.

This should be able to be implemented just with lines & tris. Depth buf will be interesting.
*/

import { IBlkDef, IGptModelLayout } from "../GptModelLayout";
import { addLine } from "../render/lineRender";
import { IRenderState } from "../render/modelRender";
import { addPrimitiveRestart, addQuad, addVert } from "../render/triRender";
import { bezierCurveBuild } from "../utils/bezier";
import { Mat4f } from "../utils/matrix";
import { Vec3, Vec4 } from "../utils/vector";

export function drawAllArrows(state: IRenderState, layout: IGptModelLayout) {

    let pad = 2.0;
    let prevResid = layout.residual0;
    let residWidth = 6;
    let weightColor = Vec4.fromHexColor('#3333aa');
    let dataColor = Vec4.fromHexColor('#33aa33');

    drawVertArrow(layout.idxObj, layout.residual0);
    drawHorizArrow(layout.tokEmbedObj, layout.residual0);
    drawArrowBetween(layout.posEmbedObj, BlockPos.Left, layout.residual0, BlockPos.Right);

    for (let i = 0; i < 3; i++) { //layout.blocks.length; i++) {
        let block = layout.blocks[i];
        drawVertArrow(prevResid, block.attnResidual);
        drawArrowResidSplit(prevResid, block.ln1.lnResid);
        drawArrowResidSplit(prevResid, block.ln1.lnAgg, 2);
        drawVertArrow(block.ln1.lnAgg, block.ln1.lnResid, 2);

        for (let head of block.heads) {
            drawArrowBetween(block.ln1.lnResid, BlockPos.Left, head.qBlock, BlockPos.Right);
            drawArrowBetween(block.ln1.lnResid, BlockPos.Left, head.kBlock, BlockPos.Right);
            drawArrowBetween(block.ln1.lnResid, BlockPos.Left, head.vBlock, BlockPos.Right);

            drawHorizArrow(head.qBiasBlock, head.qWeightBlock);
            drawHorizArrow(head.kBiasBlock, head.kWeightBlock);
            drawHorizArrow(head.vBiasBlock, head.vWeightBlock);

            drawHorizArrow(head.qWeightBlock, head.qBlock);
            drawHorizArrow(head.kWeightBlock, head.kBlock);
            drawHorizArrow(head.vWeightBlock, head.vBlock);

            drawArrowBetween(head.qBlock, BlockPos.Bot, head.attnMtx, BlockPos.Top);
            drawArrowBetween(head.kBlock, BlockPos.Bot, head.attnMtx, BlockPos.Top);
            drawArrowBetween(head.vBlock, BlockPos.Bot, head.vOutBlock, BlockPos.Top);

            drawArrowBetween(head.attnMtx, BlockPos.Left, head.attnMtxAgg, BlockPos.Right);
            drawArrowBetween(head.attnMtxAgg, BlockPos.Left, head.attnMtxSm, BlockPos.Right);
            drawArrowBetween(head.attnMtxSm, BlockPos.Bot, head.vOutBlock, BlockPos.Left);

            drawArrowBetween(head.vOutBlock, BlockPos.Bot, block.attnOut, BlockPos.Top);
        }

        drawVertArrow(block.attnResidual, block.mlpResidual);
        drawHorizArrow(block.attnOut, block.attnResidual);

        drawHorizArrow(block.projBias, block.projWeight);
        drawHorizArrow(block.projWeight, block.attnOut);

        drawHorizArrow(block.ln1.lnMu, block.ln1.lnSigma);
        drawHorizArrow(block.ln1.lnSigma, block.ln1.lnResid);

        drawArrowResidSplit(block.attnResidual, block.ln2.lnAgg, 2);
        drawVertArrow(block.ln2.lnAgg, block.ln2.lnResid, 2);
        drawHorizArrow(block.ln2.lnMu, block.ln2.lnSigma);
        drawHorizArrow(block.ln2.lnSigma, block.ln2.lnResid);

        drawArrowResidSplit(block.attnResidual, block.ln2.lnResid);
        drawArrowBetween(block.ln2.lnResid, BlockPos.Bot, block.mlpFc, BlockPos.Right);

        drawVertArrow(block.mlpFcBias, block.mlpFcWeight);
        drawVertArrow(block.mlpFcWeight, block.mlpFc, 12);
        drawVertArrow(block.mlpFc, block.mlpAct, 12);
        drawHorizArrow(block.mlpProjBias, block.mlpProjWeight);
        drawHorizArrow(block.mlpProjWeight, block.mlpResult);
        drawHorizArrow(block.mlpResult, block.mlpResidual);
        drawArrowBetween(block.mlpAct, BlockPos.Right, block.mlpResult, BlockPos.Top);

        prevResid = block.mlpResidual;
    }

    drawArrowResidSplit(prevResid, layout.ln_f.lnAgg, 2);
    drawArrowBetween(prevResid, BlockPos.Bot, layout.ln_f.lnResid, BlockPos.Right);
    drawVertArrow(layout.ln_f.lnAgg, layout.ln_f.lnResid);
    drawHorizArrow(layout.ln_f.lnMu, layout.ln_f.lnSigma);
    drawHorizArrow(layout.ln_f.lnSigma, layout.ln_f.lnResid);

    drawArrowBetween(layout.ln_f.lnResid, BlockPos.Bot, layout.logits, BlockPos.Right);
    drawVertArrow(layout.lmHeadWeight, layout.logits);

    drawVertArrow(layout.logits, layout.logitsSoftmax);
    drawHorizArrow(layout.logits, layout.logitsAgg, 2);
    drawArrowBetween(layout.logitsAgg, BlockPos.Bot, layout.logitsSoftmax, BlockPos.Right, 2);

    function blkColor(src: IBlkDef) {
        return src.t === 'w' ? weightColor : dataColor;
    }

    function drawVertArrow(src: IBlkDef, dest: IBlkDef, width: number = 6) {
        drawArrowBetween(src, BlockPos.Bot, dest, BlockPos.Top, width);
    }

    function drawHorizArrow(src: IBlkDef, dest: IBlkDef, width: number = 6) {
        drawArrowBetween(src, BlockPos.Right, dest, BlockPos.Left, width);
    }

    function blockPos(block: IBlkDef, pos: BlockPos) {
        let z = block.z + block.dz / 2;
        switch (pos) {
            case BlockPos.Left: return new Vec3(block.x - pad, block.y + block.dy / 2, z);
            case BlockPos.Right: return new Vec3(block.x + block.dx + pad, block.y + block.dy / 2, z);
            case BlockPos.Top: return new Vec3(block.x + block.dx / 2, block.y - pad, z);
            case BlockPos.Bot: return new Vec3(block.x + block.dx / 2, block.y + block.dy + pad, z);
        }
    }

    function drawArrowResidSplit(src: IBlkDef, dest: IBlkDef, width: number = 6) {
        let start = blockPos(src, BlockPos.Bot);
        let end = blockPos(dest, BlockPos.Right);

        let opacity = Math.min(src.opacity, dest.opacity);
        if (opacity === 0) {
            return;
        }

        let normal = new Vec3(0, 0, 1);
        let color = blkColor(src).mul(opacity);

        let mid1 = new Vec3(start.x - residWidth / 2, end.y);
        drawArrow(state, mid1, end, width, normal, color, true);
    }

    function drawArrowBetween(src: IBlkDef, srcPos: BlockPos, dest: IBlkDef, destPos: BlockPos, width: number = 6) {
        let start = blockPos(src, srcPos);
        let end = blockPos(dest, destPos);

        let opacity = Math.min(src.opacity, dest.opacity);
        if (opacity === 0) {
            return;
        }

        let normal = new Vec3(0, 0, 1);
        let color = blkColor(src).mul(opacity);

        if (srcPos === BlockPos.Left && destPos === BlockPos.Right) {
            start.y = end.y;
        }

        if (srcPos === BlockPos.Right && destPos === BlockPos.Top) {
            // dogleg right => down
            let mid0 = new Vec3(end.x - width / 2, start.y, start.z);
            let mid1 = new Vec3(end.x, start.y + width / 2, end.z);

            drawArrow(state, start, mid0, width, normal, color, false);
            drawArrow(state, mid1, end, width, normal, color, true, CornerMode.Left);

        } else if (srcPos === BlockPos.Bot && destPos === BlockPos.Right) {
            // dogleg down => right
            let mid0 = new Vec3(start.x, end.y - width / 2, start.z);
            let mid1 = new Vec3(start.x - width / 2, end.y, end.z);

            drawArrow(state, start, mid0, width, normal, color, false);
            drawArrow(state, mid1, end, width, normal, color, true, CornerMode.Left);

        } else if (srcPos === BlockPos.Bot && destPos === BlockPos.Left) {
            // dogleg down => left
            let mid0 = new Vec3(start.x, end.y - width / 2, start.z);
            let mid1 = new Vec3(start.x + width / 2, end.y, end.z);

            drawArrow(state, start, mid0, width, normal, color, false);
            drawArrow(state, mid1, end, width, normal, color, true, CornerMode.Right);

        } else {

            drawArrow(state, start, end, width, normal, color, true);
        }
    }
}

export enum BlockPos {
    Left,
    Right,
    Top,
    Bot,
}

export enum CornerMode {
    None,
    Left,
    Right,
}

export function drawArrow(state: IRenderState, start: Vec3, end: Vec3, width: number, normal: Vec3, color: Vec4, drawHead: boolean = true, drawCorner: CornerMode = CornerMode.None) {

    let dir = end.sub(start);
    dir.z = 0.0;
    dir = dir.normalize();

    let len = end.sub(start).len();
    let headExtra = 3.0;
    let headDepth = drawHead ? Math.min(len * 0.7, headExtra * 1.0) : 0;
    let mtx = new Mat4f();

    let side = Vec3.cross(dir, normal).mul(-1).normalize();
    normal = Vec3.cross(side, dir).normalize();

    mtx[0] = side.x;
    mtx[1] = side.y;
    mtx[2] = side.z;
    mtx[4] = dir.x;
    mtx[5] = dir.y;
    mtx[6] = dir.z;
    mtx[8] = normal.x;
    mtx[9] = normal.y;
    mtx[10] = normal.z;
    // mtx[14] = start.z;

    start = mtx.mulVec3Proj(start);
    end = mtx.mulVec3Proj(end);

    let borderColor = color.mul(0.8);
    let ribbonColor = color.mul(0.3);

    let opts: IArrowOpts = {
        width,
        borderColor,
        ribbonColor,
        headDepth,
        headExtra,
        lineThick: 1.2,
        mtx,
    };

    // matrix is constructed such that the ribbons are always in the x-y plane, and going from -y to +y
    // The ribbon will be curved if it is not in the x-y plane, but the start and end remain tangent to the plane

    function drawBezierRibbon() {
        let dist = Math.max(headDepth, Math.abs(start.y - end.y - headDepth) / 2);
        let p0 = new Vec3(start.x, start.y               , start.z);
        let p1 = new Vec3(start.x, start.y + dist        , start.z);
        let p2 = new Vec3(end.x, end.y - headDepth - dist, end.z);
        let p3 = new Vec3(end.x, end.y - headDepth       , end.z);
        let steps = bezierCurveBuild(p0, p1, p2, p3, 0.1);
        let nPts = steps.length / 3;
        for (let i = 0; i < nPts - 1; i++) {
            let p0 = new Vec3(steps[i*3+0], steps[i*3+1], steps[i*3+2]);
            let p1 = new Vec3(steps[i*3+3], steps[i*3+4], steps[i*3+5]);
            drawArrowSeg(state, p0, p1, normal, opts);
        }
    }

    if (Math.abs(start.z - end.z) > 0.01) {
        drawBezierRibbon();

    } else {
        drawArrowSeg(state, start, end.sub(new Vec3(0, headDepth)), normal, opts);
    }

    if (drawCorner !== CornerMode.None) {
        drawArrowCorner(state, start.sub(new Vec3(0, width/2)), drawCorner, opts);
    }
    if (drawHead) {
        drawArrowHead(state, end.sub(new Vec3(0, headDepth)), end, opts);
    }
}

interface IArrowOpts {
    width: number;
    headExtra: number;
    headDepth: number;
    borderColor: Vec4;
    ribbonColor: Vec4;
    lineThick: number;
    mtx: Mat4f;
}

export function drawArrowSeg(state: IRenderState, start: Vec3, end: Vec3, side: Vec3, opts: IArrowOpts) {

    // assume the arrow is in the xy plane, and the normal is in the x direction
    // so just a quad from start to end - headDepth

    let tl = new Vec3(start.x - opts.width/2, start.y, start.z);
    let br = new Vec3(end.x + opts.width/2, end.y, end.z);

    addQuad(state.triRender, tl, br, opts.ribbonColor, opts.mtx);

    let n = undefined;
    let thick = opts.lineThick;
    addLine(state.lineRender, thick, opts.borderColor, new Vec3(tl.x, tl.y, tl.z), new Vec3(tl.x, br.y, br.z), n, opts.mtx);
    addLine(state.lineRender, thick, opts.borderColor, new Vec3(br.x, tl.y, tl.z), new Vec3(br.x, br.y, br.z), n, opts.mtx);
}

export function drawArrowHead(state: IRenderState, a: Vec3, b: Vec3, opts: IArrowOpts) {
    let tl = new Vec3(a.x - opts.width/2, a.y, a.z);
    let br = new Vec3(b.x + opts.width/2, b.y, b.z);
    let n = new Vec3(0, 0, 1);
    let headExtra = 3.0;
    let left = new Vec3(tl.x - headExtra, a.y, a.z);
    let right = new Vec3(br.x + headExtra, a.y, a.z);
    let tip = new Vec3(tl.x + opts.width / 2, b.y, b.z);

    addVert(state.triRender, left, opts.ribbonColor, n, opts.mtx);
    addVert(state.triRender, tip, opts.ribbonColor, n, opts.mtx);
    addVert(state.triRender, right, opts.ribbonColor, n, opts.mtx);
    addPrimitiveRestart(state.triRender);

    let thick = opts.lineThick;
    n = undefined!;
    addLine(state.lineRender, thick, opts.borderColor, new Vec3(tl.x, a.y, a.z), left, n, opts.mtx);
    addLine(state.lineRender, thick, opts.borderColor, tip, left, n, opts.mtx);
    addLine(state.lineRender, thick, opts.borderColor, tip, right, n, opts.mtx);
    addLine(state.lineRender, thick, opts.borderColor, new Vec3(br.x, a.y, a.z), right, n, opts.mtx);
}

export function drawArrowCorner(state: IRenderState, center: Vec3, mode: CornerMode, opts: IArrowOpts) {

    // coming from the left (-x), and going downwards (+y)
    let mul = mode === CornerMode.Left ? 1 : -1;

    let pivot = new Vec3(center.x + opts.width / 2 * mul, center.y + opts.width / 2, center.z);
    let ribbonN = new Vec3(0, 0, 1);

    let count = 8;
    let prevP: Vec3 | null = null;

    for (let i = 0; i < count; i++) {
        let theta = i / (count - 1) * Math.PI / 2;
        let c = opts.width * Math.cos(theta) * mul;
        let s = opts.width * Math.sin(theta);
        let p = new Vec3(pivot.x - c, pivot.y - s, center.z);

        addVert(state.triRender, p, opts.ribbonColor, ribbonN, opts.mtx);
        addVert(state.triRender, pivot, opts.ribbonColor, ribbonN, opts.mtx);

        if (prevP) {
            addLine(state.lineRender, opts.lineThick, opts.borderColor, prevP, p, undefined, opts.mtx);
        }
        prevP = p;
    }

    addPrimitiveRestart(state.triRender);
}