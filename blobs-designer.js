class Blob {
  constructor()
  {
    this.points = [];

    this.blobPath = document.createElementNS(svgNamespace, 'path');
    const previousShape = document.querySelector('.current-shape');
    previousShape && previousShape.classList.remove('current-shape');
    const previousPoint = document.querySelector('.current-point');
    previousPoint && previousPoint.classList.remove('current-point');
    this.blobPath.classList.add('current-shape');
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
    window.canvas.appendChild(this.blobPath);
  }

  createPoint(position)
  {
    this.points.push({
      position: position,
      anchor: {
        x: position.x,
        y: position.y
      },
      velocity: {
        x: 0,
        y: 0
      },
      randomSeed: Math.random() * 1000,
      randomSeed2: 15 + Math.random() * 5,
      randomSeed3: 15 + Math.random() * 5,
      randomSeed4: Math.random() * .5 + .5,
      randomSeed5: Math.random() * .5 + .5,
      object: new Point({
        position,
        hidden: false
      })
    });
  }
}

class Point {
  constructor(props)
  {
    this.x = props.position.x;
    this.y = props.position.y;
    this.hidden = props.hidden || false;
    this.body = document.createElementNS(svgNamespace, 'circle');
    const previousPoint = document.querySelector('.current-point');
    previousPoint && previousPoint.classList.remove('current-point');
    this.body.classList.add('current-point');

    if (!this.hidden) {
      window.canvas.appendChild(this.body);
      this.draw();
    }
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
  constructor(mouseRadius = 1000)
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

    // Start mousemove listener
    window.addEventListener('mousemove', this.mouseHandler.bind(this));
  }

  mouseHandler(event)
  {
    if (this.mousePosition.x) {
      this.mouseVelocity.x = event.clientX - this.mousePosition.x;
      this.mouseVelocity.y = event.clientY - this.mousePosition.y;
    }

    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  createBlobs(blobComplexity, blobSize)
  {
    const blob = new Blob(blobComplexity, blobSize);
    this.blobs.push(blob);
  }

  startAnimation()
  {
    this.animationFrameBound();
  }

  animationFrame()
  {
    !blobDesigner.paused && window.requestAnimationFrame(this.animationFrameBound);

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

      while (pointIndex > -1) {
        const point = blob.points[pointIndex];
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

        point.object.x = point.position.x;
        point.object.y = point.position.y;

        point.object.draw();

        pointIndex--;
      }

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

    this.blobCanvas = new BlobCanvas();

    this.currentShape = new Blob();

    this.shapes.push(this.currentShape);

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

  initMouseEvents()
  {
    this.blobCanvas.canvas.addEventListener('mousedown', (event) => {
      this.mouseDownHandler(event);
    });

    this.blobCanvas.canvas.addEventListener('mouseup', (event) => {
      this.mouseUpHandler(event);
    });
  }

  initKeyboardEvents()
  {
    window.addEventListener('keydown', (event) => {
      this.keyDownHandler(event);
    });
  }

  mouseDownHandler(event)
  {
    if (event.target !== this.blobCanvas.canvas) {
      return;
    }

    if (this.paused) {
      this.currentShape.createPoint({
        x: event.clientX,
        y: event.clientY
      });

      if (this.currentShape.points.length == 2) {
        this.currentShape.appendPath();
      }

      if (this.currentShape.points.length > 2) {
        this.currentShape.drawBody();
      }
    }
  }

  mouseUpHandler(event)
  {
    console.log(event);
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
  }

  playPauseHandler(event)
  {
    this.paused = !this.paused;

    if (!this.paused) {
      this.blobCanvas.blobs = this.shapes;
      this.blobCanvas.startAnimation();

      this.buttons['play'].element.classList.add('is-hidden');
      this.buttons['pause'].element.classList.remove('is-hidden');
    } else {
      this.buttons['play'].element.classList.remove('is-hidden');
      this.buttons['pause'].element.classList.add('is-hidden');

      this.shapes.forEach(shape => {
        shape.points.forEach(point => {
          point.position.x = point.anchor.x;
          point.position.y = point.anchor.y;
        });
      });
    }
  }

  newShapeHandler(event)
  {
    if (this.currentShape.points.length > 2) {
      this.currentShape = new Blob();
      this.shapes.push(this.currentShape);
    }
  }
}

const svgNamespace = 'http://www.w3.org/2000/svg';
const utils = new BlobUtils();
const blobDesigner = new BlobDesigner();
