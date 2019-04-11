class Blob {
  constructor(anchor)
  {
    this.points = [];

    this.shapeGroup = document.createElementNS(svgNamespace, 'svg');
    this.shapePath = document.createElementNS(svgNamespace, 'path');
    this.position = {
      x: 0,
      y: 0
    };
    this.anchor = anchor || {
      x: 0,
      y: 0
    };

    this.select();
  }

  drawPath()
  {
    const pathParts = [];
    let pointIndex = 0;

    // Move to first point
    let startPoint;
    let lastPoint = this.points[this.points.length - 1].position;
    let firstPoint = this.points[0].position;

    if (this.points[this.points.length - 1].anchored) {
      startPoint = lastPoint;
    } else {
      startPoint = {
        x: (lastPoint.x + firstPoint.x) / 2,
        y: (lastPoint.y + firstPoint.y) / 2
      };
    }

    pathParts.push(`M${startPoint.x}, ${startPoint.y}`);

    // Create continuous bezier curve parts
    while (pointIndex < this.points.length - 1) {
      const currentPoint = this.points[pointIndex].position;
      const nextPoint = this.points[pointIndex + 1].position;

      if (this.points[pointIndex].anchored) {
        pathParts.push(`L${currentPoint.x}, ${currentPoint.y}`);
      } else {
        const controlPoint = {
          x: (currentPoint.x + nextPoint.x) / 2,
          y: (currentPoint.y + nextPoint.y) / 2
        };

        pathParts.push(`Q${currentPoint.x}, ${currentPoint.y}`);
        pathParts.push(`${controlPoint.x}, ${controlPoint.y}`);
      }

      pointIndex++;
    }

    // Add last curve
    const currentPoint = this.points[this.points.length - 1].position;
    if (this.points[pointIndex].anchored) {
      pathParts.push(`L${currentPoint.x}, ${currentPoint.y}`);
    } else {
      const endPoint = {
        x: (currentPoint.x + firstPoint.x) / 2,
        y: (currentPoint.y + firstPoint.y) / 2
      };

      pathParts.push(`Q${currentPoint.x}, ${currentPoint.y}`);
      pathParts.push(`${endPoint.x}, ${endPoint.y}`);
    }

    utils.setProperties(this.shapePath, {
      d: pathParts.join(' ')
    });
  }

  appendPath()
  {
    this.shapeGroup.appendChild(this.shapePath);
    utils.setProperties(this.shapeGroup, {
      x: this.anchor.x,
      y: this.anchor.y
    });
    window.canvas.insertAdjacentElement('afterbegin', this.shapeGroup);
  }

  remove()
  {
    utils.setProperties(this.shapePath, {
      d: ''
    });
  }

  delete()
  {
    this.shapePath.remove();
    blobDesigner.shapes.forEach((shape, index) => {
      if (shape.points.length < 3) {
        blobDesigner.shapes.splice(index, 1);
      }
    });
  }

  deselect()
  {
    blobDesigner.currentShape = null;
    this.shapePath.classList.remove('current-shape');
    this.shapePath.classList.remove('assoc-shape');

    this.points.forEach(point => {
      point.body.classList.remove('assoc-point');
    });

    if (this.points.length < 3) {
      this.remove();
      this.delete();
    }
  }

  select()
  {
    blobDesigner.currentShape && blobDesigner.currentShape !== this && blobDesigner.currentShape.deselect();
    this.shapePath.classList.add('current-shape');
    blobDesigner.currentShape = this;
    blobDesigner.currentPoint && blobDesigner.currentPoint.deselect();

    this.points.forEach(point => {
      point.body.classList.add('assoc-point');
    });
  }

  createPoint(position, index = null)
  {
    const point = new Point({
      position,
      hidden: false
    });

    if (index === this.points.length - 1) {
      this.points.push(point);
    } else {
      this.points.splice(index + 1, 0, point);
    }

    return point;
  }
}

class Point {
  constructor(props)
  {
    this.position = props.position;
    this.anchored = false;
    this.anchor = {
      x: this.position.x,
      y: this.position.y
    };
    this.velocity = {
      x: 0,
      y: 0
    };
    this.randomSeeds = [
      Math.random() * 1000,
      15 + Math.random() * 5,
      15 + Math.random() * 5,
      Math.random() * .5 + .5,
      Math.random() * .5 + .5
    ];

    this.x = props.position.x;
    this.y = props.position.y;
    this.hidden = props.hidden || false;
    this.body = document.createElementNS(svgNamespace, 'circle');

    blobDesigner.currentShape.shapeGroup.appendChild(this.body);

    utils.setProperties(this.body, {
      r: 3
    });
    this.draw();
  }

  deselect()
  {
    blobDesigner.currentPoint = null;
    this.body.classList.remove('current-point');

    const nextPoint = blobDesigner.blobCanvas.canvas.querySelector('.next-point');
    nextPoint && nextPoint.classList.remove('next-point');

    blobDesigner.buttons['anchor'].element.classList.add('is-hidden');
    blobDesigner.buttons['release'].element.classList.add('is-hidden');
  }

  select()
  {
    blobDesigner.currentPoint && blobDesigner.currentPoint.deselect();
    this.body.classList.add('current-point');
    blobDesigner.currentPoint = this;
    blobDesigner.currentShape.shapePath.classList.remove('current-shape');
    blobDesigner.currentShape.shapePath.classList.add('assoc-shape');

    if (this.anchored) {
      blobDesigner.buttons['anchor'].element.classList.add('is-hidden');
      blobDesigner.buttons['release'].element.classList.remove('is-hidden');
    } else {
      blobDesigner.buttons['anchor'].element.classList.remove('is-hidden');
      blobDesigner.buttons['release'].element.classList.add('is-hidden');
    }

    // Highlight next point
    if (blobDesigner.currentShape.points.length > 1) {
      let index = blobDesigner.currentShape.points.indexOf(this);

      const nextPoint = blobDesigner.blobCanvas.canvas.querySelector('.next-point');
      nextPoint && nextPoint.classList.remove('next-point');

      if (index == blobDesigner.currentShape.points.length - 1) {
        index = -1;
      }

      blobDesigner.currentShape.points[index + 1].body.classList.add('next-point');
    }
  }

  delete()
  {
    this.body.remove();
  }

  draw()
  {
    if (!this.hidden) {
      utils.setProperties(this.body, {
        cx: this.x,
        cy: this.y
      });
    }
  }
}

class BlobCanvas
{
  constructor(mouseRadius = 300)
  {
    this.time = 0;
    this.blobs = [];
    this.mouseRadiusHalf = mouseRadius * .5;
    this.mouseVelocity = {
      x: null,
      y: null
    };
    this.mousePosition = {
      x: null,
      y: null
    };

    this.canvas = document.createElementNS(svgNamespace, 'svg');
    this.animationFrameBound = this.animationFrame.bind(this);

    utils.setProperties(this.canvas, {
      xmlns: svgNamespace,
      width: window.innerWidth,
      height: window.innerHeight
    });

    document.body.appendChild(this.canvas);
    window.canvas = this.canvas;

    this.mouseMoveHandlerBound = this.mouseMoveHandler.bind(this);
  }

  mouseMoveHandler(event)
  {
    if (this.mousePosition.x) {
      this.mouseVelocity.x = event.clientX - this.mousePosition.x;
      this.mouseVelocity.y = event.clientY - this.mousePosition.y;
    }

    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  startAnimation()
  {
    this.animationFrameBound();

    // Start mousemove listener
    window.addEventListener('mousemove', this.mouseMoveHandlerBound);
  }

  animationFrame()
  {
    !blobDesigner.paused && window.requestAnimationFrame(this.animationFrameBound);

    if (blobDesigner.paused) {
      window.removeEventListener('mousemove', this.mouseMoveHandlerBound);
    }

    const mouseRect = {
      top: this.mousePosition.y - this.mouseRadiusHalf,
      right: this.mousePosition.x + this.mouseRadiusHalf,
      bottom: this.mousePosition.y + this.mouseRadiusHalf,
      left: this.mousePosition.x - this.mouseRadiusHalf
    };

    for (let blobIndex = 0; blobIndex < this.blobs.length; blobIndex++) {
      const blob = this.blobs[blobIndex];

      if (blob.points.length < 3) {
        continue;
      }

      blob.points.forEach(point => {
        if (point.anchored) {
          return;
        }

        const currentFrame = point.randomSeeds[0] + this.time;

        point.velocity.x += point.randomSeeds[3] * Math.cos(currentFrame / point.randomSeeds[1]) * .2;
        point.velocity.y -= point.randomSeeds[4] * Math.sin(currentFrame / point.randomSeeds[2]) * .2;

        // Check bluntly if the point is in distance to be affected by the mouse radius
        if (point.position.x > mouseRect.left && point.position.x < mouseRect.right && point.position.y > mouseRect.top && point.position.y < mouseRect.bottom) {
          const deltaX = point.position.x - this.mousePosition.x;
          const deltaY = point.position.y - this.mousePosition.y;
          const strength = Math.max(0, this.mouseRadiusHalf - Math.hypot(deltaX, deltaY)) * .02;
          const mouseAngle = Math.atan2(deltaY, deltaX);

          point.velocity.x += Math.cos(mouseAngle) * strength;
          point.velocity.y += Math.sin(mouseAngle) * strength
        }

        point.velocity.x += (point.anchor.x - point.position.x) * .01;
        point.velocity.y += (point.anchor.y - point.position.y) * .01;

        point.position.x += point.velocity.x;
        point.position.y += point.velocity.y;

        point.velocity.x *= .95;
        point.velocity.y *= .95;

        point.x = point.position.x;
        point.y = point.position.y;
      });

      blob.drawPath();
    }

    this.time++;
  }
}

class BlobUtils
{
  setProperties(element, obj)
  {
    for (let prop in obj) {
      element.setAttribute(prop, obj[prop]);
    }
  }
}

class BlobDesigner
{
  constructor()
  {
    this.paused = true;
    this.modalOverlayExport = false;
    this.shapes = [];

    this.mouseVelocity = {
      x: null,
      y: null
    };

    this.mousePosition = {
      x: null,
      y: null
    };

    this.currentShape = null;
    this.currentPoint = null;
    this.currentlyHolding = null;

    this.blobCanvas = new BlobCanvas();
    this.blobCanvas.canvas.classList.add('is-paused');
    this.toolbar = document.querySelector('.toolbar');
    this.exportModal = document.querySelector('.export-modal');
    this.exportModalContent = document.querySelector('.export-modal__content');
    this.importModal = document.querySelector('.import-modal');
    this.importModalContent = document.querySelector('.import-modal__content');

    this.initMouseEvents();
    this.initKeyboardEvents();
    this.initWindowEvents();

    // Buttons
    this.buttons = {
      play: {
        element: document.querySelector('.button__play'),
        callback: this.playPauseHandler
      },
      pause: {
        element: document.querySelector('.button__pause'),
        callback: this.playPauseHandler
      },
      anchor: {
        element: document.querySelector('.button__anchor'),
        callback: this.anchorReleaseHandler
      },
      release: {
        element: document.querySelector('.button__release'),
        callback: this.anchorReleaseHandler
      },
      new_shape: {
        element: document.querySelector('.button__new_shape'),
        callback: this.newShapeHandler
      },
      import: {
        element: document.querySelector('.button__import'),
        callback: this.importHandler
      },
      import_close: {
        element: document.querySelector('.button__import_close'),
        callback: this.importHandler
      },
      export: {
        element: document.querySelector('.button__export'),
        callback: this.exportHandler
      },
      export_close: {
        element: document.querySelector('.button__export_close'),
        callback: this.exportHandler
      }
    };

    Object.keys(this.buttons).forEach(index => {
      const button = this.buttons[index];
      if (button.callback) {
        button.element.addEventListener('click', (button.callback).bind(this));
      }
    });
  }

  initFirstShape()
  {
    this.currentShape = new Blob();
    this.shapes.push(this.currentShape);
  }

  initMouseEvents()
  {
    this.blobCanvas.canvas.addEventListener('mousedown', this.mouseDownHandler.bind(this));
    this.blobCanvas.canvas.addEventListener('mouseup', this.mouseUpHandler.bind(this));
    this.blobCanvas.canvas.addEventListener('mousemove', this.mouseMoveHandler.bind(this));
  }

  initKeyboardEvents()
  {
    window.addEventListener('keydown', this.keyDownHandler.bind(this));
  }

  initWindowEvents()
  {
    window.addEventListener('resize', this.resizeHandler.bind(this));
  }

  resizeHandler(event)
  {
    utils.setProperties(this.blobCanvas.canvas, {
      width: window.innerWidth,
      height: window.innerHeight
    });

    blobDesigner.shapes.forEach(shape => {
      if (shape.points[0]) {
        const shapeRect = shape.points[0].body.getBoundingClientRect();
        shape.position.x = shapeRect.x;
        shape.position.y = shapeRect.y;
      }
    });
  }

  mouseDownHandler(event)
  {
    if (this.paused) {
      if (event.metaKey && this.currentShape) {
        let pointPos;

        pointPos = {
          x: 0,
          y: 0
        };

        const prevPos = this.currentShape.position;

        const deltaPos = {
          x: prevPos.x - event.clientX,
          y: prevPos.y - event.clientY
        };

        if (this.currentShape.points.length === 0) {
          this.currentShape.position.x = event.clientX;
          this.currentShape.position.y = event.clientY;

          this.currentShape.anchor.x = `${parseFloat(((event.clientX / window.innerWidth) * 100).toFixed(2))}%`;
          this.currentShape.anchor.y = `${parseFloat(((event.clientY / window.innerHeight) * 100).toFixed(2))}%`;
        }

        utils.setProperties(this.currentShape.shapeGroup, {
          x: this.currentShape.anchor.x,
          y: this.currentShape.anchor.y
        });

        if (this.currentShape.points.length == 0) {
          this.currentShape.appendPath();
        }

        pointPos = {
          x: event.clientX - this.currentShape.position.x,
          y: event.clientY - this.currentShape.position.y
        };

        const newPoint = this.currentShape.createPoint(
          {
            x: pointPos.x,
            y: pointPos.y
          },
          this.currentShape.points.indexOf(this.currentPoint)
        );

        if (this.currentShape.points.length) {
          this.currentShape.drawPath();
          this.currentShape.select();
          newPoint.select();
        }

        return;
      }

      let foundShape, foundPoint;

      // Select point
      if (event.target.nodeName === 'circle') {
        this.shapes.forEach(shape => {
          if (!foundPoint) {
            shape.points.forEach(point => {
              if (!foundPoint) {
                if (point.body === event.target) {
                  foundPoint = point;
                }
              }

              if (foundPoint) {
                shape.select();
              }
            });
          }
        });

        foundPoint && foundPoint.select();

        this.currentlyHolding = foundPoint;
        foundPoint.body.classList.add('is-held');
        this.blobCanvas.canvas.classList.add('is-dragging');

        return;
      }

      // Select shape
      if (event.target.nodeName === 'path') {

        this.shapes.forEach(shape => {
          if (!foundShape) {
            if (shape.shapePath === event.target) {
              foundShape = shape;
            }
          }
        });

        foundPoint && foundPoint.select();
        foundShape && foundShape.select();

        this.currentlyHolding = foundShape;
        foundShape.shapePath.classList.add('is-held');
        this.blobCanvas.canvas.classList.add('is-dragging');

        return;
      }

      this.currentPoint && this.currentPoint.deselect();
      this.currentShape && this.currentShape.deselect();

      event.preventDefault();
    }
  }

  mouseUpHandler(event)
  {
    this.currentPoint && this.currentPoint.body.classList.remove('is-held');
    this.currentShape && this.currentShape.shapePath.classList.remove('is-held');
    this.blobCanvas.canvas.classList.remove('is-dragging');
    this.currentlyHolding = null;
  }

  mouseMoveHandler(event)
  {
    this.mouseVelocity.x = event.clientX - this.mousePosition.x;
    this.mouseVelocity.y = event.clientY - this.mousePosition.y;

    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;

    if (event.buttons === 1 && this.currentlyHolding) {
      if (this.currentlyHolding.constructor === Blob) {
        this.currentlyHolding.position.x += this.mouseVelocity.x;
        this.currentlyHolding.position.y += this.mouseVelocity.y;
        this.currentlyHolding.anchor.x = `${parseFloat(((this.currentlyHolding.position.x / window.innerWidth) * 100).toFixed(2))}%`;
        this.currentlyHolding.anchor.y = `${parseFloat(((this.currentlyHolding.position.y / window.innerHeight) * 100).toFixed(2))}%`;

        utils.setProperties(this.currentlyHolding.shapeGroup, {
          x: this.currentlyHolding.anchor.x,
          y: this.currentlyHolding.anchor.y
        });

        // this.currentlyHolding.points.forEach(point => {
        //   point.x = point.anchor.x += this.mouseVelocity.x;
        //   point.y = point.anchor.y += this.mouseVelocity.y;
        //   point.draw();
        // });
      } else {
        this.currentlyHolding.x = this.currentlyHolding.position.x = this.currentlyHolding.anchor.x += this.mouseVelocity.x;
        this.currentlyHolding.y = this.currentlyHolding.position.y = this.currentlyHolding.anchor.y += this.mouseVelocity.y;
        this.currentPoint.draw();
      }

      this.currentShape.drawPath();
    }
  }

  keyDownHandler(event)
  {
    if (!this.modalOverlayExport && !this.modalOverlayImport) {
      // N
      if (event.keyCode === 78) {
        this.newShapeHandler();
        event.preventDefault();
      }

      // A
      if (event.keyCode === 65) {
        this.anchorReleaseHandler();
        event.preventDefault();
      }

      // Delete
      if (event.keyCode === 46) {
        this.deleteHandler();
        event.preventDefault();
      }
    }

    // Space
    if (event.keyCode === 32) {
      this.playPauseHandler();
      event.preventDefault();
    }

    // I
    if (event.keyCode === 73) {
      this.importHandler();
      event.preventDefault();
    }

    // E
    if (event.keyCode === 69) {
      this.exportHandler();
      event.preventDefault();
    }

    // Escape
    if (event.keyCode === 27) {
      if (this.modalOverlayImport) {
        this.importHandler();
      }

      if (this.modalOverlayExport) {
        this.exportHandler();
      }
    }
  }

  playPauseHandler(event)
  {
    this.paused = !this.paused;
    this.blobCanvas.canvas.classList.toggle('is-paused');
    this.blobCanvas.canvas.classList.toggle('is-playing');

    if (!this.paused) {
      this.blobCanvas.blobs = this.shapes;
      this.blobCanvas.startAnimation();

      this.buttons['play'].element.classList.add('is-hidden');
      this.buttons['pause'].element.classList.remove('is-hidden');

      this.blobCanvas.canvas.classList.add('is-playing');
      this.toolbar.classList.add('is-playing');
    } else {
      this.buttons['play'].element.classList.remove('is-hidden');
      this.buttons['pause'].element.classList.add('is-hidden');

      this.shapes.forEach(shape => {
        shape.points.forEach(point => {
          point.position.x = point.anchor.x;
          point.position.y = point.anchor.y;
        });
      });

      this.blobCanvas.canvas.classList.remove('is-playing');
      this.toolbar.classList.remove('is-playing');
    }
  }

  newShapeHandler(event)
  {
    if (this.paused) {
      this.currentPoint && this.currentPoint.deselect();
      this.currentShape && this.currentShape.deselect();

      this.currentShape = new Blob();
      this.shapes.push(this.currentShape);
    }
  }

  anchorReleaseHandler(event)
  {
    if (this.paused && this.currentPoint)
    {
      this.currentPoint.anchored = !this.currentPoint.anchored;

      blobDesigner.buttons['anchor'].element.classList.toggle('is-hidden');
      blobDesigner.buttons['release'].element.classList.toggle('is-hidden');
      this.currentShape.drawPath();
    }
  }

  deleteHandler(event)
  {
    if (!this.paused) {
      return;
    }

    if (this.currentPoint) {
      let index = this.currentShape.points.indexOf(this.currentPoint);
      this.currentShape.points.splice(index, 1);
      this.currentPoint.delete();
      this.currentPoint.deselect();

      index -= 1;

      if (index < 0) {
        index = 0;
      }

      if (this.currentShape.points.length > 0) {
        this.currentShape.drawPath();
        this.currentShape.points[index].select();
      }
    }

    if (this.currentShape && !this.currentPoint) {
      this.currentShape.points.forEach(point => {
        point.delete();
      });
      this.currentShape.points = [];
      this.currentShape.remove();
      this.currentShape.select();
    }
  }

  importHandler(event)
  {
    this.buttons['export'].element.classList.remove('is-hidden');
    this.buttons['export_close'].element.classList.add('is-hidden');
    this.exportModal.classList.add('is-hidden');

    this.toggleModalImport();
    if (this.modalOverlayImport) {
      this.toolbar.classList.add('is-overlayed');
      this.importModalContent.value = '';
      this.importModalContent.focus();
    } else {
      this.toolbar.classList.remove('is-overlayed');

      const importData = JSON.parse(this.importModalContent.value);

      importData.forEach(shape => {
        this.currentShape = new Blob(shape.anchor);

        shape.points.forEach(point => {
          this.currentShape.createPoint(point.anchor);
        });

        this.shapes.push(this.currentShape);
        this.currentShape.drawPath();
        this.currentShape.appendPath();
      });

      this.resizeHandler();
    }

    this.buttons['import'].element.classList.toggle('is-hidden');
    this.buttons['import_close'].element.classList.toggle('is-hidden');
  }

  exportHandler(event)
  {
    this.buttons['import'].element.classList.remove('is-hidden');
    this.buttons['import_close'].element.classList.add('is-hidden');
    this.importModal.classList.add('is-hidden');

    this.toggleModalExport();
    if (this.modalOverlayExport) {
      this.toolbar.classList.add('is-overlayed');
      const exportContent = JSON.parse(JSON.stringify(this.shapes, true));

      exportContent.forEach(shape => {
        delete shape.shapePath;
        delete shape.shapeGroup;
        delete shape.position;

        shape.points.forEach(point => {
          delete point.velocity;
          delete point.randomSeeds;
          delete point.hidden;
          delete point.body;
          delete point.x;
          delete point.y;
          delete point.position;
          !point.anchored && delete point.anchored;
        });
      });

      this.exportModalContent.value = JSON.stringify(exportContent, true);
      this.exportModalContent.focus();
    } else {
      this.toolbar.classList.remove('is-overlayed');
    }

    this.buttons['export'].element.classList.toggle('is-hidden');
    this.buttons['export_close'].element.classList.toggle('is-hidden');
  }

  toggleModalImport()
  {
    this.modalOverlayImport = !this.modalOverlayImport;
    this.importModal.classList.toggle('is-hidden');
  }

  toggleModalExport()
  {
    this.modalOverlayExport = !this.modalOverlayExport;
    this.exportModal.classList.toggle('is-hidden');
  }
}

const svgNamespace = 'http://www.w3.org/2000/svg';
const utils = new BlobUtils();
const blobDesigner = new BlobDesigner();
blobDesigner.initFirstShape();
