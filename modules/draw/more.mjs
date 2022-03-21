/// more ROOT classes

import { BIT, create, isBatchMode } from '../core.mjs';

import { rgb as d3_rgb } from '../d3.mjs';

import { getColor } from '../base/colors.mjs';

import { BasePainter } from '../base/BasePainter.mjs';

import { ObjectPainter } from '../base/ObjectPainter.mjs';

import { TAttMarkerHandler } from '../base/TAttMarkerHandler.mjs';

import { TAttLineHandler } from '../base/TAttLineHandler.mjs';

import { ensureTCanvas } from '../gpad/TCanvasPainter.mjs';

import { addMoveHandler } from '../gui/utils.mjs';


/** @summary Draw TText
  * @private */
function drawText() {
   let text = this.getObject(),
       pp = this.getPadPainter(),
       w = pp.getPadWidth(),
       h = pp.getPadHeight(),
       pos_x = text.fX, pos_y = text.fY,
       tcolor = this.getColor(text.fTextColor),
       use_frame = false,
       fact = 1., textsize = text.fTextSize || 0.05,
       main = this.getFramePainter();

   if (text.TestBit(BIT(14))) {
      // NDC coordinates
      this.isndc = true;
   } else if (main && !main.mode3d) {
      // frame coordiantes
      w = main.getFrameWidth();
      h = main.getFrameHeight();
      use_frame = "upper_layer";
   } else if (pp.getRootPad(true)) {
      // force pad coordiantes
   } else {
      // place in the middle
      this.isndc = true;
      pos_x = pos_y = 0.5;
      text.fTextAlign = 22;
      if (!tcolor) tcolor = 'black';
   }

   this.createG(use_frame);

   this.draw_g.attr("transform", null); // remove transofrm from interactive changes

   this.pos_x = this.axisToSvg("x", pos_x, this.isndc);
   this.pos_y = this.axisToSvg("y", pos_y, this.isndc);

   let arg = { align: text.fTextAlign, x: this.pos_x, y: this.pos_y, text: text.fTitle, color: tcolor, latex: 0 };

   if (text.fTextAngle) arg.rotate = -text.fTextAngle;

   if (text._typename == 'TLatex') { arg.latex = 1; fact = 0.9; } else
   if (text._typename == 'TMathText') { arg.latex = 2; fact = 0.8; }

   this.startTextDrawing(text.fTextFont, Math.round((textsize>1) ? textsize : textsize*Math.min(w,h)*fact));

   this.drawText(arg);

   return this.finishTextDrawing().then(() => {
      if (isBatchMode()) return this;

      this.pos_dx = this.pos_dy = 0;

      if (!this.moveDrag)
         this.moveDrag = function(dx,dy) {
            this.pos_dx += dx;
            this.pos_dy += dy;
            this.draw_g.attr("transform", `translate(${this.pos_dx},${this.pos_dy})`);
        }

      if (!this.moveEnd)
         this.moveEnd = function(not_changed) {
            if (not_changed) return;
            let text = this.getObject();
            text.fX = this.svgToAxis("x", this.pos_x + this.pos_dx, this.isndc),
            text.fY = this.svgToAxis("y", this.pos_y + this.pos_dy, this.isndc);
            this.submitCanvExec(`SetX(${text.fX});;SetY(${text.fY});;`);
         }

      addMoveHandler(this);

      return this;
   });
}

/** @summary Draw TLine
  * @private */
function drawTLine(dom, obj) {

   let painter = new ObjectPainter(dom, obj);

   painter.redraw = function() {
      const kLineNDC = BIT(14),
            line = this.getObject(),
            lineatt = new TAttLineHandler(line),
            isndc = line.TestBit(kLineNDC);

      // create svg:g container for line drawing
      this.createG();

      this.draw_g
          .append("svg:path")
          .attr("d", `M${this.axisToSvg("x", line.fX1, isndc)},${this.axisToSvg("y", line.fY1, isndc)}L${this.axisToSvg("x", line.fX2, isndc)},${this.axisToSvg("y", line.fY2, isndc)}`)
          .call(lineatt.func);

      return this;
   }

   return ensureTCanvas(painter, false).then(() => painter.redraw());
}

/** @summary Draw TPolyLine
  * @private */
function drawPolyLine() {

   // create svg:g container for polyline drawing
   this.createG();

   let polyline = this.getObject(),
       lineatt = new TAttLineHandler(polyline),
       fillatt = this.createAttFill(polyline),
       kPolyLineNDC = BIT(14),
       isndc = polyline.TestBit(kPolyLineNDC),
       cmd = "", func = this.getAxisToSvgFunc(isndc);

   for (let n = 0; n <= polyline.fLastPoint; ++n)
      cmd += ((n > 0) ? "L" : "M") + func.x(polyline.fX[n]) + "," + func.y(polyline.fY[n]);

   if (polyline._typename != "TPolyLine") fillatt.setSolidColor("none");

   if (!fillatt.empty()) cmd+="Z";

   this.draw_g
       .append("svg:path")
       .attr("d", cmd)
       .call(lineatt.func)
       .call(fillatt.func);
}

/** @summary Draw TEllipse
  * @private */
function drawEllipse() {

   let ellipse = this.getObject();

   this.createAttLine({ attr: ellipse });
   this.createAttFill({ attr: ellipse });

   // create svg:g container for ellipse drawing
   this.createG();

   let funcs = this.getAxisToSvgFunc(),
       x = funcs.x(ellipse.fX1),
       y = funcs.y(ellipse.fY1),
       rx = funcs.x(ellipse.fX1 + ellipse.fR1) - x,
       ry = y - funcs.y(ellipse.fY1 + ellipse.fR2),
       path = "", closed_ellipse = (ellipse.fPhimin == 0) && (ellipse.fPhimax == 360);

   // handle same as ellipse with equal radius
   if ((ellipse._typename == "TCrown") && (ellipse.fR1 <= 0))
      rx = funcs.x(ellipse.fX1 + ellipse.fR2) - x;

   if ((ellipse._typename == "TCrown") && (ellipse.fR1 > 0)) {
      let rx1 = rx, ry2 = ry,
          ry1 = y - funcs.y(ellipse.fY1 + ellipse.fR1),
          rx2 = funcs.x(ellipse.fX1 + ellipse.fR2) - x;

      if (closed_ellipse) {
         path = `M${-rx1},0A${rx1},${ry1},0,1,0,${rx1},0A${rx1},${ry1},0,1,0,${-rx1},0` +
                `M${-rx2},0A${rx2},${ry2},0,1,0,${rx2},0A${rx2},${ry2},0,1,0,${-rx2},0`;
      } else {
         let large_arc = (ellipse.fPhimax-ellipse.fPhimin>=180) ? 1 : 0,
             a1 = ellipse.fPhimin*Math.PI/180, a2 = ellipse.fPhimax*Math.PI/180,
             dx1 = Math.round(rx1*Math.cos(a1)), dy1 = Math.round(ry1*Math.sin(a1)),
             dx2 = Math.round(rx1*Math.cos(a2)), dy2 = Math.round(ry1*Math.sin(a2)),
             dx3 = Math.round(rx2*Math.cos(a1)), dy3 = Math.round(ry2*Math.sin(a1)),
             dx4 = Math.round(rx2*Math.cos(a2)), dy4 = Math.round(ry2*Math.sin(a2));

         path = `M${dx2},${dy2}A${rx1},${ry1},0,${large_arc},0,${dx1},${dy1}` +
                `L${dx3},${dy3}A${rx2},${ry2},0,${large_arc},1,${dx4},${dy4}Z`;
      }
   } else if (ellipse.fTheta == 0) {
      if (closed_ellipse) {
         path = `M${-rx},0A${rx},${ry},0,1,0,${rx},0A${rx},${ry},0,1,0,${-rx},0Z`;
      } else {
         let x1 = Math.round(rx * Math.cos(ellipse.fPhimin*Math.PI/180)),
             y1 = Math.round(ry * Math.sin(ellipse.fPhimin*Math.PI/180)),
             x2 = Math.round(rx * Math.cos(ellipse.fPhimax*Math.PI/180)),
             y2 = Math.round(ry * Math.sin(ellipse.fPhimax*Math.PI/180));
         path = `M0,0L${x1},${y1}A${rx},${ry},0,1,1,${x2},${y2}Z`;
      }
   } else {
     let ct = Math.cos(ellipse.fTheta*Math.PI/180),
         st = Math.sin(ellipse.fTheta*Math.PI/180),
         phi1 = ellipse.fPhimin*Math.PI/180,
         phi2 = ellipse.fPhimax*Math.PI/180,
         np = 200,
         dphi = (phi2-phi1) / (np - (closed_ellipse ? 0 : 1)),
         lastx = 0, lasty = 0;
     if (!closed_ellipse) path = "M0,0";
     for (let n = 0; n < np; ++n) {
         let angle = phi1 + n*dphi,
             dx = ellipse.fR1 * Math.cos(angle),
             dy = ellipse.fR2 * Math.sin(angle),
             px = funcs.x(ellipse.fX1 + dx*ct - dy*st) - x,
             py = funcs.y(ellipse.fY1 + dx*st + dy*ct) - y;
         if (!path)
            path = `M${px},${py}`;
         else if (lastx == px)
            path += `v${py-lasty}`;
         else if (lasty == py)
            path += `h${px-lastx}`;
         else
            path += `l${px-lastx},${py-lasty}`;
         lastx = px; lasty = py;
     }
     path += "Z";
   }

   this.draw_g
      .append("svg:path")
      .attr("transform",`translate(${x},${y})`)
      .attr("d", path)
      .call(this.lineatt.func).call(this.fillatt.func);
}

/** @summary Draw TPie
  * @private */
function drawPie() {
   let pie = this.getObject();

   // create svg:g container for ellipse drawing
   this.createG();

   let xc = this.axisToSvg("x", pie.fX),
       yc = this.axisToSvg("y", pie.fY),
       rx = this.axisToSvg("x", pie.fX + pie.fRadius) - xc,
       ry = this.axisToSvg("y", pie.fY + pie.fRadius) - yc;

   this.draw_g.attr("transform",`translate(${xc},${yc})`);

   // Draw the slices
   let nb = pie.fPieSlices.length, total = 0,
       af = (pie.fAngularOffset*Math.PI)/180,
       x1 = Math.round(rx*Math.cos(af)), y1 = Math.round(ry*Math.sin(af));

   for (let n = 0; n < nb; n++)
      total += pie.fPieSlices[n].fValue;

   for (let n = 0; n < nb; n++) {
      let slice = pie.fPieSlices[n],
          lineatt = new TAttLineHandler({attr: slice}),
          fillatt = this.createAttFill(slice);

      af += slice.fValue/total*2*Math.PI;
      let x2 = Math.round(rx*Math.cos(af)), y2 = Math.round(ry*Math.sin(af));

      this.draw_g
          .append("svg:path")
          .attr("d", `M0,0L${x1},${y1}A${rx},${ry},0,0,0,${x2},${y2}z`)
          .call(lineatt.func)
          .call(fillatt.func);
      x1 = x2; y1 = y2;
   }
}

/** @summary Draw TBox
  * @private */
function drawBox() {

   let box = this.getObject(),
       opt = this.getDrawOpt(),
       draw_line = (opt.toUpperCase().indexOf("L")>=0),
       lineatt = this.createAttLine(box),
       fillatt = this.createAttFill(box);

   // create svg:g container for box drawing
   this.createG();

   let x1 = this.axisToSvg("x", box.fX1),
       x2 = this.axisToSvg("x", box.fX2),
       y1 = this.axisToSvg("y", box.fY1),
       y2 = this.axisToSvg("y", box.fY2),
       xx = Math.min(x1,x2), yy = Math.min(y1,y2),
       ww = Math.abs(x2-x1), hh = Math.abs(y1-y2);

   // if box filled, contour line drawn only with "L" draw option:
   if (!fillatt.empty() && !draw_line) lineatt.color = "none";

   this.draw_g
       .append("svg:path")
       .attr("d", `M${xx},${yy}h${ww}v${hh}h${-ww}z`)
       .call(lineatt.func)
       .call(fillatt.func);

   if (box.fBorderMode && box.fBorderSize && fillatt.hasColor()) {
      let pww = box.fBorderSize, phh = box.fBorderSize,
          side1 = `M${xx},${yy}h${ww}l${-pww},${phh}h${2*pww-ww}v${hh-2*phh}l${-pww},${phh}z`,
          side2 = `M${xx+ww},${yy+hh}v${-hh}l${-pww},${phh}v${hh-2*phh}h${2*pww-ww}l${-pww},${phh}z`;

      if (box.fBorderMode < 0) { let s = side1; side1 = side2; side2 = s; }

      this.draw_g.append("svg:path")
                 .attr("d", side1)
                 .call(fillatt.func)
                 .style("fill", d3_rgb(fillatt.color).brighter(0.5).formatHex());

      this.draw_g.append("svg:path")
          .attr("d", side2)
          .call(fillatt.func)
          .style("fill", d3_rgb(fillatt.color).darker(0.5).formatHex());
   }
}

/** @summary Draw TMarker
  * @private */
function drawMarker() {
   let marker = this.getObject(),
       att = new TAttMarkerHandler(marker),
       kMarkerNDC = BIT(14),
       isndc = marker.TestBit(kMarkerNDC);

   // create svg:g container for box drawing
   this.createG();

   let x = this.axisToSvg("x", marker.fX, isndc),
       y = this.axisToSvg("y", marker.fY, isndc),
       path = att.create(x,y);

   if (path)
      this.draw_g.append("svg:path")
          .attr("d", path)
          .call(att.func);
}

/** @summary Draw TPolyMarker
  * @private */
function drawPolyMarker() {

   // create svg:g container for box drawing
   this.createG();

   let poly = this.getObject(),
       att = new TAttMarkerHandler(poly),
       path = "",
       func = this.getAxisToSvgFunc();

   for (let n = 0; n < poly.fN; ++n)
      path += att.create(func.x(poly.fX[n]), func.y(poly.fY[n]));

   if (path)
      this.draw_g.append("svg:path")
          .attr("d", path)
          .call(att.func);
}


/** @summary Draw direct TVirtualX commands into SVG
  * @private */

class TWebPaintingPainter extends ObjectPainter {

   updateObject(obj) {
      if (!this.matchObjectType(obj)) return false;
      this.assignObject(obj);
      return true;
   }

   redraw() {

      const obj = this.getObject(), func = this.getAxisToSvgFunc();

      if (!obj || !obj.fOper || !func) return;

      let indx = 0, attr = {}, lastpath = null, lastkind = "none", d = "",
          oper, npoints, n, arr = obj.fOper.split(";");

      const check_attributes = kind => {
         if (kind == lastkind) return;

         if (lastpath) {
            lastpath.attr("d", d); // flush previous
            d = ""; lastpath = null; lastkind = "none";
         }

         if (!kind) return;

         lastkind = kind;
         lastpath = this.draw_g.append("svg:path");
         switch (kind) {
            case "f": lastpath.call(this.fillatt.func); break;
            case "l": lastpath.call(this.lineatt.func).style('fill', 'none'); break;
            case "m": lastpath.call(this.markeratt.func); break;
         }
      }, read_attr = (str, names) => {
         let lastp = 0, obj = { _typename: "any" };
         for (let k = 0; k < names.length; ++k) {
            let p = str.indexOf(":", lastp+1);
            obj[names[k]] = parseInt(str.slice(lastp+1, (p > lastp) ? p : undefined));
            lastp = p;
         }
         return obj;
      }, process = k => {
         while (++k < arr.length) {
            oper = arr[k][0];
            switch (oper) {
               case "z":
                  this.createAttLine({ attr: read_attr(arr[k], ["fLineColor", "fLineStyle", "fLineWidth"]), force: true });
                  check_attributes();
                  continue;
               case "y":
                  this.createAttFill({ attr: read_attr(arr[k], ["fFillColor", "fFillStyle"]), force: true });
                  check_attributes();
                  continue;
               case "x":
                  this.createAttMarker({ attr: read_attr(arr[k], ["fMarkerColor", "fMarkerStyle", "fMarkerSize"]), force: true });
                  check_attributes();
                  continue;
               case "o":
                  attr = read_attr(arr[k], ["fTextColor", "fTextFont", "fTextSize", "fTextAlign", "fTextAngle"]);
                  if (attr.fTextSize < 0) attr.fTextSize *= -0.001;
                  check_attributes();
                  continue;
               case "r":
               case "b": {

                  check_attributes((oper == "b") ? "f" : "l");

                  let x1 = func.x(obj.fBuf[indx++]),
                      y1 = func.y(obj.fBuf[indx++]),
                      x2 = func.x(obj.fBuf[indx++]),
                      y2 = func.y(obj.fBuf[indx++]);

                  d += `M${x1},${y1}h${x2-x1}v${y2-y1}h${x1-x2}z`;

                  continue;
               }
               case "l":
               case "f": {

                  check_attributes(oper);

                  npoints = parseInt(arr[k].slice(1));

                  for (n = 0; n < npoints; ++n)
                     d += ((n > 0) ? "L" : "M") +
                           func.x(obj.fBuf[indx++]) + "," + func.y(obj.fBuf[indx++]);

                  if (oper == "f") d+="Z";

                  continue;
               }

               case "m": {

                  check_attributes(oper);

                  npoints = parseInt(arr[k].slice(1));

                  this.markeratt.resetPos();
                  for (n = 0; n < npoints; ++n)
                     d += this.markeratt.create(func.x(obj.fBuf[indx++]), func.y(obj.fBuf[indx++]));

                  continue;
               }

               case "h":
               case "t": {
                  if (attr.fTextSize) {

                     check_attributes();

                     let height = (attr.fTextSize > 1) ? attr.fTextSize : this.getPadPainter().getPadHeight() * attr.fTextSize,
                         angle = attr.fTextAngle,
                         txt = arr[k].slice(1),
                         group = this.draw_g.append("svg:g");

                     if (angle >= 360) angle -= Math.floor(angle/360) * 360;

                     this.startTextDrawing(attr.fTextFont, height, group);

                     if (oper == "h") {
                        let res = "";
                        for (n = 0; n < txt.length; n += 2)
                           res += String.fromCharCode(parseInt(txt.slice(n,n+2), 16));
                        txt = res;
                     }

                     // todo - correct support of angle
                     this.drawText({ align: attr.fTextAlign,
                                     x: func.x(obj.fBuf[indx++]),
                                     y: func.y(obj.fBuf[indx++]),
                                     rotate: -angle,
                                     text: txt,
                                     color: getColor(attr.fTextColor),
                                     latex: 0, draw_g: group });

                     return this.finishTextDrawing(group).then(() => process(k));
                  }
                  continue;
               }

               default:
                  console.log('unsupported operation ' + oper);
            }
         };

         return Promise.resolve(true);
      }

      this.createG();

      return process(-1).then(() => { check_attributes(); return this; });
   }

   static draw(dom, obj) {
      let painter = new TWebPaintingPainter(dom, obj);
      painter.addToPadPrimitives();
      return painter.redraw();
   }

}

/** @summary Draw JS image
  * @private */
function drawJSImage(dom, obj, opt) {
   let painter = new BasePainter(dom),
       main = painter.selectDom(),
       img = main.append("img").attr("src", obj.fName).attr("title", obj.fTitle || obj.fName);

   if (opt && opt.indexOf("scale") >= 0) {
      img.style("width","100%").style("height","100%");
   } else if (opt && opt.indexOf("center") >= 0) {
      main.style("position", "relative");
      img.attr("style", "margin: 0; position: absolute;  top: 50%; left: 50%; transform: translate(-50%, -50%);");
   }

   painter.setTopPainter();

   return painter;
}


/**
 * @summary Painter class for TRatioPlot
 *
 * @private
 */

class TRatioPlotPainter extends ObjectPainter {

   /** @summary Set grids range */
   setGridsRange(xmin, xmax) {
      let ratio = this.getObject(),
          pp = this.getPadPainter();
      if (xmin === xmax) {
         let low_p = pp.findPainterFor(ratio.fLowerPad, "lower_pad", "TPad"),
             low_fp = low_p ? low_p.getFramePainter() : null;
         if (!low_fp || !low_fp.x_handle) return;
         xmin = low_fp.x_handle.full_min;
         xmax = low_fp.x_handle.full_max;
      }

      ratio.fGridlines.forEach(line => {
         line.fX1 = xmin;
         line.fX2 = xmax;
      });
   }

   /** @summary Redraw TRatioPlot */
   redraw() {
      let ratio = this.getObject(),
          pp = this.getPadPainter();

      let top_p = pp.findPainterFor(ratio.fTopPad, "top_pad", "TPad");
      if (top_p) top_p.disablePadDrawing();

      let up_p = pp.findPainterFor(ratio.fUpperPad, "upper_pad", "TPad"),
          up_main = up_p ? up_p.getMainPainter() : null,
          up_fp = up_p ? up_p.getFramePainter() : null,
          low_p = pp.findPainterFor(ratio.fLowerPad, "lower_pad", "TPad"),
          low_main = low_p ? low_p.getMainPainter() : null,
          low_fp = low_p ? low_p.getFramePainter() : null,
          lbl_size = 20, promise_up = Promise.resolve(true);

      if (up_p && up_main && up_fp && low_fp && !up_p._ratio_configured) {
         up_p._ratio_configured = true;
         up_main.options.Axis = 0; // draw both axes

         lbl_size = up_main.getHisto().fYaxis.fLabelSize;
         if (lbl_size < 1) lbl_size = Math.round(lbl_size*Math.min(up_p.getPadWidth(), up_p.getPadHeight()));

         let h = up_main.getHisto();
         h.fXaxis.fLabelSize = 0; // do not draw X axis labels
         h.fXaxis.fTitle = ""; // do not draw X axis title
         h.fYaxis.fLabelSize = lbl_size;
         h.fYaxis.fTitleSize = lbl_size;

         up_p.getRootPad().fTicky = 1;

         promise_up = up_p.redrawPad().then(() => {
            up_fp.o_zoom = up_fp.zoom;
            up_fp._ratio_low_fp = low_fp;
            up_fp._ratio_painter = this;

            up_fp.zoom = function(xmin,xmax,ymin,ymax,zmin,zmax) {
               this._ratio_painter.setGridsRange(xmin, xmax);
               this._ratio_low_fp.o_zoom(xmin,xmax);
               return this.o_zoom(xmin,xmax,ymin,ymax,zmin,zmax);
            }

            up_fp.o_sizeChanged = up_fp.sizeChanged;
            up_fp.sizeChanged = function() {
               this.o_sizeChanged();
               this._ratio_low_fp.fX1NDC = this.fX1NDC;
               this._ratio_low_fp.fX2NDC = this.fX2NDC;
               this._ratio_low_fp.o_sizeChanged();
            }
            return true;
         });
      }

      return promise_up.then(() => {

         if (!low_p || !low_main || !low_fp || !up_fp || low_p._ratio_configured)
            return this;

         low_p._ratio_configured = true;
         low_main.options.Axis = 0; // draw both axes
         let h = low_main.getHisto();
         h.fXaxis.fTitle = "x";
         h.fXaxis.fLabelSize = lbl_size;
         h.fXaxis.fTitleSize = lbl_size;
         h.fYaxis.fLabelSize = lbl_size;
         h.fYaxis.fTitleSize = lbl_size;
         low_p.getRootPad().fTicky = 1;

         low_p.forEachPainterInPad(objp => {
            if (typeof objp.testEditable == 'function')
               objp.testEditable(false);
         });

         let arr = [], currpad;

         if ((ratio.fGridlinePositions.length > 0) && (ratio.fGridlines.length < ratio.fGridlinePositions.length)) {
            ratio.fGridlinePositions.forEach(gridy => {
               let found = false;
               ratio.fGridlines.forEach(line => {
                  if ((line.fY1 == line.fY2) && (Math.abs(line.fY1 - gridy) < 1e-6)) found = true;
               });
               if (!found) {
                  let line = create("TLine");
                  line.fX1 = up_fp.scale_xmin;
                  line.fX2 = up_fp.scale_xmax;
                  line.fY1 = line.fY2 = gridy;
                  line.fLineStyle = 2;
                  ratio.fGridlines.push(line);
                  if (currpad === undefined) currpad = this.selectCurrentPad(ratio.fLowerPad.fName);
                  arr.push(drawTLine(this.getDom(), line));
               }
            });
         }

         return Promise.all(arr).then(() => low_fp.zoom(up_fp.scale_xmin,  up_fp.scale_xmax)).then(() => {

            low_fp.o_zoom = low_fp.zoom;
            low_fp._ratio_up_fp = up_fp;
            low_fp._ratio_painter = this;

            low_fp.zoom = function(xmin,xmax,ymin,ymax,zmin,zmax) {
               this._ratio_painter.setGridsRange(xmin, xmax);
               this._ratio_up_fp.o_zoom(xmin,xmax);
               return this.o_zoom(xmin,xmax,ymin,ymax,zmin,zmax);
            }

            low_fp.o_sizeChanged = low_fp.sizeChanged;
            low_fp.sizeChanged = function() {
               this.o_sizeChanged();
               this._ratio_up_fp.fX1NDC = this.fX1NDC;
               this._ratio_up_fp.fX2NDC = this.fX2NDC;
               this._ratio_up_fp.o_sizeChanged();
            }
            return this;
         });
      });
   }

   /** @summary Draw TRatioPlot */
   static draw(dom, ratio, opt) {
      let painter = new TRatioPlotPainter(dom, ratio, opt);

      return ensureTCanvas(painter, false).then(() => painter.redraw());
   }

} // class TRatioPlotPainter


export { TRatioPlotPainter, TWebPaintingPainter,
         drawText, drawTLine, drawPolyLine, drawEllipse, drawPie, drawBox,
         drawMarker, drawPolyMarker, drawJSImage };
