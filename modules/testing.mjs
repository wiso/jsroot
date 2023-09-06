import { isNodeJs, isBatchMode, setBatchMode } from './core.mjs';
import { select as d3_select } from './d3.mjs';
import { _loadJSDOM } from './base/BasePainter.mjs';
import { cleanup, getElementCanvPainter } from './base/ObjectPainter.mjs';
import { draw } from './draw.mjs';
import { closeMenu } from './gui/menu.mjs';


async function _test_timeout(args, portion = 1) {
   if (!args?.timeout)
      return true;

   return new Promise(resolve => {
      setTimeout(resolve, Math.round(portion * args.timeout));
   });
}

class EmulationMouseEvent {

   constructor(x = 0, y = 0) {
      this.$emul = true; // special flag mark emulated event
      this.button = 0;
      this.key = '';
      this.set(x, y);
   }

   set(x, y) {
      this.clientX = Math.round(x);
      this.clientY = Math.round(y);
   }

   setTouch(x1, y1, x2, y2) {
      this.$touch_arr = [[Math.round(x1), Math.round(y1)], [Math.round(x2), Math.round(y2)]];
   }

  preventDefault() {}
  stopPropagation() {}

} // class EmulationMouseEvent


/** @summary test zooming features
  * @private */
async function testZooming(node, args) {
   const fp = getElementCanvPainter(node)?.getFramePainter();

   if ((typeof fp?.zoom !== 'function') || (typeof fp?.zoomSingle !== 'function')) return;
   if (typeof fp.scale_xmin === 'undefined' || typeof fp.scale_ymax === 'undefined') return;

   const xmin = fp.scale_xmin, xmax = fp.scale_xmax, ymin = fp.scale_yxmin, ymax = fp.scale_ymax;

   return fp.zoom(xmin + 0.2*(xmax - xmin), xmin + 0.8*(xmax - xmin), ymin + 0.2*(ymax - ymin), ymin + 0.8*(ymax - ymin))
            .then(() => _test_timeout(args))
            .then(() => fp.unzoom())
            .then(() => _test_timeout(args))
            .then(() => fp.zoomSingle('x', xmin + 0.22*(xmax - xmin), xmin + 0.25*(xmax - xmin)))
            .then(() => _test_timeout(args))
            .then(() => fp.zoomSingle('y', ymin + 0.12*(ymax - ymin), ymin + 0.43*(ymax - ymin)))
            .then(() => _test_timeout(args))
            .then(() => fp.unzoom())
}

/** @summary test mouse zooming features
  * @private */
async function testMouseZooming(node, args) {
   const fp = getElementCanvPainter(node)?.getFramePainter();

   if (fp?.mode3d) return;
   if ((typeof fp?.startRectSel !== 'function') ||
       (typeof fp?.moveRectSel !== 'function') ||
       (typeof fp?.endRectSel !== 'function')) return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight(),
         evnt = new EmulationMouseEvent(),
         rect = fp.getFrameSvg().node().getBoundingClientRect();

   // region zooming

   for (let side = -1; side <= 1; side++) {
      evnt.set(rect.x + (side > 0 ? -25 : fw*0.1), rect.y + (side < 0 ? fh + 25 : fh*0.1));

      fp.startRectSel(evnt);

      await _test_timeout(args);

      for (let i = 2; i < 10; ++i) {
         evnt.set(rect.x + (side > 0 ? -5 : fw*0.1*i), rect.y + (side < 0 ? fh + 25 : fh*0.1*i));
         fp.moveRectSel(evnt);
         await _test_timeout(args, 0.2);
      }

      await fp.endRectSel(evnt);

      await _test_timeout(args);

      await fp.unzoom();
   }
}

/** @summary test touch zooming features
  * @private */
async function testTouchZooming(node, args) {
   const fp = getElementCanvPainter(node)?.getFramePainter();

   if (fp?.mode3d) return;
   if ((typeof fp?.startTouchZoom !== 'function') ||
       (typeof fp?.moveTouchZoom !== 'function') ||
       (typeof fp?.endTouchZoom !== 'function')) return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight(),
         evnt = new EmulationMouseEvent();

   evnt.setTouch(fw*0.4, fh*0.4, fw*0.6, fh*0.6);

   fp.startTouchZoom(evnt);

   await _test_timeout(args);

   for (let i = 2; i < 9; ++i) {
      evnt.setTouch(fw*0.05*(10 - i), fh*0.05*(10 - i), fw*0.05*(10 + i), fh*0.05*(10 + i));
      fp.moveTouchZoom(evnt);
      await _test_timeout(args, 0.2);
   }

   await fp.endTouchZoom(evnt);

   await _test_timeout(args);

   await fp.unzoom();
}

/** @summary test mouse wheel zooming features
  * @private */
async function testMouseWheel(node, args) {
   const fp = getElementCanvPainter(node)?.getFramePainter();

   if (fp?.mode3d) return;
   if (typeof fp?.mouseWheel !== 'function') return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight(),
         evnt = new EmulationMouseEvent(),
         rect = fp.getFrameSvg().node().getBoundingClientRect();

   evnt.set(rect.x + fw*0.4, rect.y + fh*0.4);

   // zoom inside
   for (let i = 0; i < 7; ++i) {
      evnt.wheelDelta = 1;
      fp.mouseWheel(evnt);
      await _test_timeout(args, 0.2);
   }

   // zoom outside
   for (let i = 0; i < 7; ++i) {
      evnt.wheelDelta = -1;
      fp.mouseWheel(evnt);
      await _test_timeout(args, 0.2);
   }

   await _test_timeout(args);

   await fp.unzoom();
}


async function testFrameClick(node) {
   const fp = getElementCanvPainter(node)?.getFramePainter();
   if (fp?.mode3d || typeof fp?.processFrameClick !== 'function') return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight();

   for (let i = 1; i < 15; i++) {
      for (let j = 1; j < 15; j++) {
         const pnt = { x: Math.round(i/15*fw), y: Math.round(j/15*fh) };
         fp.processFrameClick(pnt);
      }
   }
}

async function testFrameMouseDoubleClick(node) {
   const fp = getElementCanvPainter(node)?.getFramePainter();
   if (fp?.mode3d || typeof fp?.mouseDoubleClick !== 'function') return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight(),
         evnt = new EmulationMouseEvent(),
         rect = fp.getFrameSvg().node().getBoundingClientRect();

   for (let i = -2; i < 14; i++) {
      for (let j = -2; j < 14; j++) {
         evnt.set(rect.x + i/10*fw, rect.y + j/10*fh);
         await fp.mouseDoubleClick(evnt);
      }
   }
}

async function testFrameContextMenu(node, args) {
   const fp = getElementCanvPainter(node)?.getFramePainter();
   if (fp?.mode3d || typeof fp?.showContextMenu !== 'function') return;

   const fw = fp.getFrameWidth(), fh = fp.getFrameHeight(),
         evnt = new EmulationMouseEvent(),
         rect = fp.getFrameSvg().node().getBoundingClientRect();

   for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 10; j++) {
         evnt.set(rect.x + i/10*fw, rect.y + j/10*fh);
         await fp.showContextMenu('', evnt);
         await _test_timeout(args, 0.03);
         closeMenu();
      }
   }

   evnt.set(rect.x + 20, rect.y + fh + 20);
   await fp.showContextMenu('x', evnt);
   await _test_timeout(args, 0.1);
   closeMenu();

   evnt.set(rect.x - 20, rect.y + 20);
   await fp.showContextMenu('y', evnt);
   await _test_timeout(args, 0.1);
   closeMenu();
}




async function _testing(dom, args) {
   await testFrameClick(dom);
   await testFrameMouseDoubleClick(dom);

   await testZooming(dom, args);
   await testMouseZooming(dom, args);
   await testMouseWheel(dom, args);
   await testFrameContextMenu(dom, args);
   await testTouchZooming(dom, args);

   await testFrameClick(dom);
   await testFrameMouseDoubleClick(dom);
}


/** @summary test interactive features of JSROOT drawings
  * @desc used in https://github.com/linev/jsroot-test
  * @private */
async function testInteractivity(args) {
   if (args.dom)
      return _testing(args.dom, args);

   async function build(main) {
      main.attr('width', args.width).attr('height', args.height)
          .style('width', args.width + 'px').style('height', args.height + 'px');

      setBatchMode(false);

      return main;
   }

   const flag = isBatchMode(),
         pr = isNodeJs()
          ? _loadJSDOM().then(handle => build(handle.body.append('div')))
          : build(d3_select('body').append('div'));
   return pr.then(main => {
      main.attr('width', args.width).attr('height', args.height)
          .style('width', args.width + 'px').style('height', args.height + 'px');

      setBatchMode(false);

      return draw(main.node(), args.object, args.option || '')
             .then(() => _testing(main.node(), args))
             .then(() => {
                cleanup(main.node());
                main.remove();
                setBatchMode(flag);
                return true;
              });
   });
}

export { testInteractivity };