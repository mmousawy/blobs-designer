class Blob {
  constructor()
  {
    this.points = [];

    this.blobPath = document.createElementNS(svgNamespace, 'path');

    this.select();
  }

  drawBody()
  {
    const pathParts = [];
    let pointIndex = 0;

    // Move to first point
    const lastPoint = this.points[this.points.length - 1].position;
    const firstPoint = this.points[0].position;

    const startPoint = {
      x: (lastPoint.x + firstPoint.x) / 2,
      y: (lastPoint.y + firstPoint.y) / 2
    };

    pathParts.push(`M${startPoint.x}, ${startPoint.y}`);

    // Create continuous bezier curve parts
    while (pointIndex < this.points.length - 1) {
      const currentPoint = this.points[pointIndex].position;
      const nextPoint = this.points[pointIndex + 1].position;

      const controlPoint = {
        x: (currentPoint.x + nextPoint.x) / 2,
        y: (currentPoint.y + nextPoint.y) / 2
      };

      pathParts.push(`Q${currentPoint.x}, ${currentPoint.y}`);
      pathParts.push(`${controlPoint.x}, ${controlPoint.y}`);

      pointIndex++;
    }

    // Add last curve
    const currentPoint = this.points[this.points.length - 1].position;

    const endPoint = {
      x: (currentPoint.x + firstPoint.x) / 2,
      y: (currentPoint.y + firstPoint.y) / 2
    };

    pathParts.push(`Q${currentPoint.x}, ${currentPoint.y}`);
    pathParts.push(`${endPoint.x}, ${endPoint.y}`);

    utils.setProperties(this.blobPath, {
      d: pathParts.join(' ')
    });
  }

  appendPath()
  {
    window.canvas.insertAdjacentElement('afterbegin', this.blobPath)
  }

  deselect()
  {
    blobDesigner.currentShape = null;
    this.blobPath.classList.remove('current-shape');
  }

  select()
  {
    blobDesigner.currentShape && blobDesigner.currentShape.deselect();
    this.blobPath.classList.add('current-shape');
    blobDesigner.currentShape = this;
    blobDesigner.currentPoint && blobDesigner.currentPoint.deselect();
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

    point.select();
  }
}

class Point {
  constructor(props)
  {
    this.position = props.position;
    this.anchor = {
      x: this.position.x,
      y: this.position.y
    };
    this.velocity = {
      x: 0,
      y: 0
    };
    this.randomSeed = Math.random() * 1000,
    this.randomSeed2 = 15 + Math.random() * 5,
    this.randomSeed3 = 15 + Math.random() * 5,
    this.randomSeed4 = Math.random() * .5 + .5,
    this.randomSeed5 = Math.random() * .5 + .5,

    this.x = props.position.x;
    this.y = props.position.y;
    this.hidden = props.hidden || false;
    this.body = document.createElementNS(svgNamespace, 'circle');

    if (!this.hidden) {
      window.canvas.appendChild(this.body);
      this.draw();
    }
  }

  deselect()
  {
    blobDesigner.currentPoint = null;
    this.body.classList.remove('current-point');

    const nextPoint = blobDesigner.blobCanvas.canvas.querySelector('.next-point');
    nextPoint && nextPoint.classList.remove('next-point');
  }

  select()
  {
    blobDesigner.currentPoint && blobDesigner.currentPoint.deselect();
    this.body.classList.add('current-point');
    blobDesigner.currentPoint = this;
    blobDesigner.currentShape.blobPath.classList.remove('current-shape');
    blobDesigner.currentShape.blobPath.classList.add('assoc-shape');

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
        cy: this.y,
        r: 3
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

      let pointIndex = blob.points.length - 1;

      blob.points.forEach(point => {
        const currentFrame = point.randomSeed + this.time;

        point.velocity.x += point.randomSeed4 * Math.cos(currentFrame / point.randomSeed2) * .2;
        point.velocity.y -= point.randomSeed5 * Math.sin(currentFrame / point.randomSeed3) * .2;

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

        point.draw();

        pointIndex--;
      });

      blob.drawBody();
    }

    this.time++;
  }
}

class BlobUtils
{
  setProperties(element, obj)
  {
    for (let prop in obj) {
      element.setAttribute(prop, obj[prop])
    }
  }
}

class BlobDesigner
{
  constructor()
  {
    this.paused = true;
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

    this.initMouseEvents();
    this.initKeyboardEvents();

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
        callback: this.handleButtonAnchor
      },
      release: {
        element: document.querySelector('.button__release'),
        callback: this.handleButtonRelease
      },
      new_shape: {
        element: document.querySelector('.button__new_shape'),
        callback: this.newShapeHandler
      },
      export: {
        element: document.querySelector('.button__export'),
        callback: this.handleButtonExport
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
    window.addEventListener('keydown', (event) => {
      this.keyDownHandler(event);
    });
  }

  mouseDownHandler(event)
  {
    if (this.paused) {
      if (event.ctrlKey && this.currentShape) {
        this.currentShape.createPoint(
          {
            x: event.clientX,
            y: event.clientY
          },
          this.currentShape.points.indexOf(this.currentPoint)
        );

        if (this.currentShape.points.length == 2) {
          this.currentShape.appendPath();
        }

        if (this.currentShape.points.length > 2) {
          this.currentShape.drawBody();
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

        return;
      }

      // Select shape
      if (event.target.nodeName === 'path') {

        this.shapes.forEach(shape => {
          if (!foundShape) {
            if (shape.blobPath === event.target) {
              foundShape = shape;
            }
          }
        });

        foundPoint && foundPoint.select();
        foundShape && foundShape.select();

        this.currentlyHolding = foundShape;

        return;
      }

      if (event.shiftKey) {
        return;
      }
    }
  }

  mouseUpHandler(event)
  {
    this.currentlyHolding = null;
  }

  mouseMoveHandler(event)
  {
    if (this.mousePosition.x) {
      this.mouseVelocity.x = event.clientX - this.mousePosition.x;
      this.mouseVelocity.y = event.clientY - this.mousePosition.y;
    }

    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;

    if (event.buttons === 1 && this.currentlyHolding) {
      if (this.currentlyHolding.constructor === Blob) {
        this.currentlyHolding.points.forEach(point => {
          point.x = point.position.x = point.anchor.x += this.mouseVelocity.x;
          point.y = point.position.y = point.anchor.y += this.mouseVelocity.y;
          point.draw();
        });
      } else {
        this.currentlyHolding.x = this.currentlyHolding.position.x = this.currentlyHolding.anchor.x += this.mouseVelocity.x;
        this.currentlyHolding.y = this.currentlyHolding.position.y = this.currentlyHolding.anchor.y += this.mouseVelocity.y;
        this.currentPoint.draw();
      }

      this.currentShape.drawBody();
    }
  }

  keyDownHandler(event)
  {
    // Space
    if (event.keyCode === 32) {
      this.playPauseHandler();
      event.preventDefault();
    }

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

    // E
    if (event.keyCode === 69) {
      this.exportHandler();
      event.preventDefault();
    }

    // Delete
    if (event.keyCode === 46) {
      this.deleteHandler();
      event.preventDefault();
    }
  }

  playPauseHandler(event)
  {
    this.paused = !this.paused;

    if (!this.paused) {
      this.blobCanvas.blobs = this.shapes;
      this.blobCanvas.startAnimation();

      this.buttons['play'].element.classList.add('is-hidden');
      this.buttons['pause'].element.classList.remove('is-hidden');

      this.blobCanvas.canvas.classList.add('is-playing');
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
    }
  }

  newShapeHandler(event)
  {
    if (this.currentShape.points.length > 2) {
      this.currentPoint && this.currentPoint.deselect();
      this.currentShape && this.currentShape.deselect();

      this.currentShape = new Blob();
      this.shapes.push(this.currentShape);
    }
  }

  deleteHandler(event)
  {
    if (this.currentPoint) {
      let index = this.currentShape.points.indexOf(this.currentPoint);
      this.currentShape.points.splice(index, 1);
      this.currentPoint.delete();

      index -= 1;

      if (index < 0) {
        index = 0;
      }

      if (this.currentShape.points.length > 0) {
        this.currentShape.drawBody();
        this.currentShape.points[index].select();
      }
    }
  }
}

const svgNamespace = 'http://www.w3.org/2000/svg';
const utils = new BlobUtils();
const blobDesigner = new BlobDesigner();
blobDesigner.initFirstShape();
