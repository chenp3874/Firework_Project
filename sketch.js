// 全局变量
let video;
let handpose;
let hands = [];
let fireworks = [];
let particles = [];
let distanceThreshold = 40;
let particleCount = 180;
let previousDistance = 0;
let isReady = false;
let cameraReady = false;
let debugMode = false;
let facingMode = "user";
let lastGestureTime = 0;
let gestureTimeout = 500; // 防止过于频繁触发
let frameRates = [];
let canvas;
let showCameraPreview = true; // 新增：控制摄像头预览显示状态

// 设置函数
function setup() {
  // 创建画布并放入容器中
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  colorMode(HSB, 255);
  
  // 初始化摄像头
  initCamera();
  
  // 设置UI控件事件监听
  setupUIControls();
  
  // 创建离屏缓冲区用于优化渲染
  offscreenBuffer = createGraphics(width, height);
  offscreenBuffer.colorMode(HSB, 255);
}

// 初始化摄像头
function initCamera() {
  // 设置视频
  video = createCapture({
    video: {
      width: 640,
      height: 480,
      facingMode: facingMode
    },
    audio: false
  }, function(stream) {
    console.log('摄像头已成功初始化');
    cameraReady = true;
    updateStatusUI('摄像头已就绪，正在加载模型...');
  });
  video.size(640, 480);
  video.hide();
  
  // 添加摄像头错误处理
  video.elt.addEventListener('error', function() {
    console.error('摄像头初始化失败');
    updateStatusUI('摄像头初始化失败', false);
  });
  
  // 等待视频加载后再初始化handpose模型
  video.elt.onloadeddata = function() {
    console.log('视频数据已加载');
    try {
      // 初始化handpose模型
      handpose = ml5.handpose(video, modelReady);
      
      // 设置事件监听器
      handpose.on('predict', results => {
        hands = results;
        checkHandGesture();
      });
    } catch (error) {
      console.error('模型初始化失败:', error);
      updateStatusUI('手势识别模型加载失败', false);
    }
  };
}

// 设置UI控件事件监听
function setupUIControls() {
  // 阈值滑块
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValue = document.getElementById('threshold-value');
  
  thresholdSlider.addEventListener('input', function() {
    distanceThreshold = parseInt(this.value);
    thresholdValue.textContent = distanceThreshold;
  });
  
  // 粒子数量滑块
  const particleSlider = document.getElementById('particle-slider');
  const particleValue = document.getElementById('particle-value');
  
  particleSlider.addEventListener('input', function() {
    particleCount = parseInt(this.value);
    particleValue.textContent = particleCount;
  });
  
  // 切换摄像头按钮
  const toggleCameraBtn = document.getElementById('toggle-camera');
  toggleCameraBtn.addEventListener('click', function() {
    facingMode = facingMode === "user" ? "environment" : "user";
    // 重新初始化摄像头
    video.remove();
    cameraReady = false;
    isReady = false;
    updateStatusUI('正在切换摄像头...', false);
    initCamera();
  });
  
  // 调试模式按钮
  const toggleDebugBtn = document.getElementById('toggle-debug');
  const debugPanel = document.getElementById('debug-panel');
  
  toggleDebugBtn.addEventListener('click', function() {
    debugMode = !debugMode;
    debugPanel.classList.toggle('hidden', !debugMode);
    this.textContent = debugMode ? '关闭调试' : '调试模式';
  });
  
  // 新增：摄像头预览开关按钮
  const togglePreviewBtn = document.getElementById('toggle-preview');
  const previewElement = document.getElementById('camera-preview');
  
  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', function() {
      showCameraPreview = !showCameraPreview;
      previewElement.classList.toggle('hidden', !showCameraPreview);
      this.textContent = showCameraPreview ? '隐藏预览' : '显示预览';
    });
  }
}

// 更新状态UI
function updateStatusUI(message, isSuccess = true) {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  
  statusText.textContent = message;
  statusIcon.className = 'status-icon' + (isSuccess ? ' ready' : '');
}

// 模型加载完成回调
function modelReady() {
  console.log('Handpose模型已加载');
  isReady = true;
  updateStatusUI('系统就绪，请将手掌放在摄像头前', true);
}

// 检查手势并触发烟花
function checkHandGesture() {
  if (hands.length > 0) {
    const hand = hands[0];
    const landmarks = hand.landmarks;
    
    // 获取拇指尖和中指尖的位置
    const thumbTip = landmarks[4];
    const middleFingerTip = landmarks[12];
    
    // 计算两点之间的距离
    const distance = dist(thumbTip[0], thumbTip[1], thumbTip[2], 
                          middleFingerTip[0], middleFingerTip[1], middleFingerTip[2]);
    
    // 当前时间
    const currentTime = millis();
    
    // 检测手势变化：从捏合到分开，并且与上次触发间隔足够长
    if (previousDistance <= distanceThreshold && distance > distanceThreshold && 
        currentTime - lastGestureTime > gestureTimeout) {
      
      // 计算手势中心位置（两指中点）
      const midX = (thumbTip[0] + middleFingerTip[0]) / 2;
      const midY = (thumbTip[1] + middleFingerTip[1]) / 2;
      
      // 将坐标从视频空间映射到画布空间
      const mappedX = map(midX, 0, video.width, 0, width);
      const mappedY = map(midY, 0, video.height, 0, height);
      
      // 在手势位置创建主烟花
      const mainParticleCount = floor(particleCount * 1.2); // 主烟花粒子数量更多
      fireworks.push(new Firework(mappedX, mappedY, mainParticleCount));
      
      // 在主烟花周围添加1-2个小型烟花
      const smallFireworkCount = floor(random(1, 3));
      
      for (let i = 0; i < smallFireworkCount; i++) {
        // 在主烟花周围随机位置，但不要太远
        const offsetX = random(-width * 0.15, width * 0.15);
        const offsetY = random(-height * 0.15, height * 0.15);
        const smallX = constrain(mappedX + offsetX, width * 0.1, width * 0.9);
        const smallY = constrain(mappedY + offsetY, height * 0.1, height * 0.8);
        
        // 小型烟花粒子数量较少
        const smallParticleCount = floor(particleCount * random(0.5, 0.8));
        
        // 添加延迟，使小烟花不会同时出现
        setTimeout(() => {
          fireworks.push(new Firework(smallX, smallY, smallParticleCount));
        }, random(100, 300));
      }
      
      // 更新上次触发时间
      lastGestureTime = currentTime;
    }
    
    // 更新上一帧的距离
    previousDistance = distance;
    
    // 更新调试信息
    if (debugMode) {
      updateDebugInfo(distance);
    }
  }
}

// 更新调试信息
function updateDebugInfo(distance) {
  const debugInfo = document.getElementById('debug-info');
  const fps = frameRate();
  
  // 保存最近30帧的帧率
  frameRates.push(fps);
  if (frameRates.length > 30) {
    frameRates.shift();
  }
  
  // 计算平均帧率
  const avgFps = frameRates.reduce((sum, rate) => sum + rate, 0) / frameRates.length;
  
  // 更新调试面板
  debugInfo.innerHTML = `
    <div>帧率: ${avgFps.toFixed(1)} FPS</div>
    <div>手指距离: ${distance.toFixed(1)}</div>
    <div>阈值: ${distanceThreshold}</div>
    <div>粒子数量: ${particleCount}</div>
    <div>烟花数量: ${fireworks.length}</div>
    <div>总粒子数: ${fireworks.reduce((sum, fw) => sum + fw.particles.length, 0)}</div>
  `;
}

// 绘制函数
function draw() {
  // 使用离屏缓冲区绘制半透明背景，形成拖尾效果
  offscreenBuffer.background(0, 0, 0, 25);
  
  // 更新和显示所有烟花
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].display(offscreenBuffer);
    
    // 移除已完成的烟花
    if (fireworks[i].done()) {
      fireworks.splice(i, 1);
    }
  }
  
  // 将离屏缓冲区内容复制到主画布
  image(offscreenBuffer, 0, 0, width, height);
  
  // 在中央位置显示手势轮廓
  if (cameraReady && isReady && hands.length > 0) {
    drawCentralHandOutline();
  }
  
  // 根据预览开关状态决定是否显示摄像头预览
  if (cameraReady && showCameraPreview) {
    const previewElement = document.getElementById('camera-preview');
    const previewRect = previewElement.getBoundingClientRect();
    
    push();
    // 在预览区域绘制视频
    translate(previewRect.left + previewRect.width / 2, previewRect.top + previewRect.height / 2 + 15);
    scale(-previewRect.width / video.width, previewRect.height / video.height);
    image(video, -video.width / 2, -video.height / 2);
    
    // 绘制手部关键点
    if (isReady && hands.length > 0) {
      drawKeypoints();
    }
    pop();
  }
}

// 新增：在中央位置绘制手势轮廓
function drawCentralHandOutline() {
  if (hands.length > 0) {
    const hand = hands[0];
    const landmarks = hand.landmarks;
    
    push();
    // 将坐标从视频空间映射到画布空间，并放置在中央位置
    translate(width * 0.5, height * 0.5); // 将手部轮廓放在中央
    scale(width * 0.2 / video.width, height * 0.2 / video.height); // 缩小到屏幕的20%大小，原来是30%
    
    // 绘制半透明背景，使轮廓更加清晰
    fill(0, 0, 0, 30); // 降低背景不透明度
    noStroke();
    rectMode(CENTER);
    rect(0, 0, video.width, video.height, 20);
    
    // 绘制手部轮廓连线 - 使用更细的线条和更优雅的颜色
    strokeWeight(1.5); // 减小线条粗细
    noFill();
    
    // 绘制手指连线 - 使用渐变色彩
    // 拇指 (0-4)
    stroke(0, 200, 255, 100); // 降低不透明度
    beginShape();
    for (let i = 0; i <= 4; i++) {
      vertex(landmarks[i][0] - video.width/2, landmarks[i][1] - video.height/2);
    }
    endShape();
    
    // 食指 (5-8)
    stroke(40, 200, 255, 100);
    beginShape();
    for (let i = 5; i <= 8; i++) {
      vertex(landmarks[i][0] - video.width/2, landmarks[i][1] - video.height/2);
    }
    endShape();
    
    // 中指 (9-12)
    stroke(80, 200, 255, 100);
    beginShape();
    for (let i = 9; i <= 12; i++) {
      vertex(landmarks[i][0] - video.width/2, landmarks[i][1] - video.height/2);
    }
    endShape();
    
    // 无名指 (13-16)
    stroke(120, 200, 255, 100);
    beginShape();
    for (let i = 13; i <= 16; i++) {
      vertex(landmarks[i][0] - video.width/2, landmarks[i][1] - video.height/2);
    }
    endShape();
    
    // 小指 (17-20)
    stroke(160, 200, 255, 100);
    beginShape();
    for (let i = 17; i <= 20; i++) {
      vertex(landmarks[i][0] - video.width/2, landmarks[i][1] - video.height/2);
    }
    endShape();
    
    // 手掌底部连线 - 使用更优雅的曲线
    stroke(200, 200, 255, 100);
    beginShape();
    curveVertex(landmarks[0][0] - video.width/2, landmarks[0][1] - video.height/2);
    curveVertex(landmarks[0][0] - video.width/2, landmarks[0][1] - video.height/2);
    curveVertex(landmarks[5][0] - video.width/2, landmarks[5][1] - video.height/2);
    curveVertex(landmarks[9][0] - video.width/2, landmarks[9][1] - video.height/2);
    curveVertex(landmarks[13][0] - video.width/2, landmarks[13][1] - video.height/2);
    curveVertex(landmarks[17][0] - video.width/2, landmarks[17][1] - video.height/2);
    curveVertex(landmarks[0][0] - video.width/2, landmarks[0][1] - video.height/2);
    curveVertex(landmarks[0][0] - video.width/2, landmarks[0][1] - video.height/2);
    endShape();
    
    // 绘制拇指和中指之间的特殊连线（用于触发烟花的关键点）
    if (landmarks.length >= 13) {
      const thumbTip = landmarks[4];
      const middleFingerTip = landmarks[12];
      
      // 计算两点之间的距离
      const distance = dist(thumbTip[0], thumbTip[1], thumbTip[2], 
                           middleFingerTip[0], middleFingerTip[1], middleFingerTip[2]);
      
      // 根据距离变化颜色
      let lineColor;
      if (distance <= distanceThreshold) {
        // 捏合状态 - 蓝色
        lineColor = color(180, 255, 255, 150);
        strokeWeight(2);
      } else {
        // 分开状态 - 绿色
        lineColor = color(100, 255, 255, 150);
        strokeWeight(1.5);
      }
      
      stroke(lineColor);
      line(thumbTip[0] - video.width/2, thumbTip[1] - video.height/2, 
           middleFingerTip[0] - video.width/2, middleFingerTip[1] - video.height/2);
      
      // 在两指中点显示距离值 - 使用更小的字体
      fill(255, 255, 255, 150);
      noStroke();
      textSize(12); // 减小字体大小
      textAlign(CENTER, CENTER);
      text(int(distance), 
           (thumbTip[0] + middleFingerTip[0])/2 - video.width/2, 
           (thumbTip[1] + middleFingerTip[1])/2 - video.height/2);
      
      // 添加状态指示 - 简化文本
      textSize(10); // 减小字体大小
      fill(255, 200);
      if (distance <= distanceThreshold) {
        text("准备", 0, video.height/2 - 20); // 缩短文本，减小距离
      } else {
        text("就绪", 0, video.height/2 - 20); // 缩短文本，减小距离
      }
    }
    
    // 添加关键点小圆点 - 更加精致且更小
    for (let i = 0; i < landmarks.length; i++) {
      const [x, y] = landmarks[i];
      // 为不同的关键点使用不同的颜色
      let pointHue = map(i, 0, landmarks.length, 0, 255);
      fill(pointHue, 200, 255, 120);
      noStroke();
      ellipse(x - video.width/2, y - video.height/2, 3, 3); // 减小圆点大小
    }
    
    pop();
  }
}

// 绘制手部关键点
function drawKeypoints() {
  if (hands.length > 0) {
    const hand = hands[0];
    const landmarks = hand.landmarks;
    
    // 绘制所有关键点
    for (let i = 0; i < landmarks.length; i++) {
      const [x, y] = landmarks[i];
      fill(0, 255, 255);
      noStroke();
      ellipse(x, y, 8, 8);
    }
    
    // 特别标记拇指尖和中指尖
    if (landmarks.length >= 13) {
      const thumbTip = landmarks[4];
      const middleFingerTip = landmarks[12];
      
      fill(100, 255, 255);
      ellipse(thumbTip[0], thumbTip[1], 12, 12);
      
      fill(160, 255, 255);
      ellipse(middleFingerTip[0], middleFingerTip[1], 12, 12);
      
      // 绘制两点之间的连线
      stroke(200, 255, 255);
      strokeWeight(2);
      line(thumbTip[0], thumbTip[1], middleFingerTip[0], middleFingerTip[1]);
      
      // 显示距离
      const distance = dist(thumbTip[0], thumbTip[1], thumbTip[2], 
                           middleFingerTip[0], middleFingerTip[1], middleFingerTip[2]);
      fill(255);
      noStroke();
      textSize(12);
      text(int(distance), (thumbTip[0] + middleFingerTip[0]) / 2, (thumbTip[1] + middleFingerTip[1]) / 2);
    }
  }
}

// 窗口大小调整时重设画布
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  offscreenBuffer = createGraphics(width, height);
  offscreenBuffer.colorMode(HSB, 255);
}

// 烟花类
class Firework {
  constructor(x, y, particleCount) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.hue = random(255);
    this.lifespan = 255;
    this.particleCount = particleCount;
    
    // 创建烟花粒子
    this.createParticles();
    
    // 添加爆炸效果
    this.createExplosionEffect();
  }
  
  createParticles() {
    // 计算每层的粒子数量
    const layer1Count = floor(this.particleCount * 0.5); // 中心爆炸
    const layer2Count = floor(this.particleCount * 0.3); // 外围环状
    const layer3Count = floor(this.particleCount * 0.2); // 随机星星
    
    // 第一层：中心爆炸
    for (let i = 0; i < layer1Count; i++) {
      this.particles.push(new Particle(
        this.x, 
        this.y, 
        this.hue, 
        random(2, 5), 
        random(TWO_PI), 
        random(1, 5)
      ));
    }
    
    // 第二层：外围环状
    for (let i = 0; i < layer2Count; i++) {
      const angle = map(i, 0, layer2Count, 0, TWO_PI);
      this.particles.push(new Particle(
        this.x, 
        this.y, 
        (this.hue + 30) % 255, 
        random(5, 8), 
        angle, 
        random(3, 7)
      ));
    }
    
    // 第三层：随机星星
    for (let i = 0; i < layer3Count; i++) {
      this.particles.push(new Particle(
        this.x, 
        this.y, 
        (this.hue + 60) % 255, 
        random(8, 12), 
        random(TWO_PI), 
        random(5, 10),
        true
      ));
    }
  }
  
  createExplosionEffect() {
    // 创建爆炸光环效果
    for (let i = 0; i < 1; i++) {
      this.particles.push(new ExplosionRing(this.x, this.y, this.hue));
    }
  }
  
  update() {
    // 更新所有粒子
    for (let particle of this.particles) {
      particle.update();
    }
    
    // 烟花生命周期
    this.lifespan -= 2;
  }
  
  display(buffer) {
    // 显示所有粒子
    for (let particle of this.particles) {
      particle.display(buffer, this.lifespan);
    }
  }
  
  done() {
    return this.lifespan <= 0;
  }
}

// 爆炸光环类
class ExplosionRing {
  constructor(x, y, hue) {
    this.position = createVector(x, y);
    this.radius = 5;
    this.maxRadius = random(100, 200);
    this.growSpeed = random(5, 10);
    this.hue = hue;
    this.alpha = 200;
    this.thickness = 3;
  }
  
  update() {
    // 光环扩大
    this.radius += this.growSpeed;
    // 透明度降低
    this.alpha = map(this.radius, 0, this.maxRadius, 200, 0);
    // 厚度减小
    this.thickness = map(this.radius, 0, this.maxRadius, 3, 0.5);
  }
  
  display(buffer, fireworkLifespan) {
    const alpha = min(this.alpha, fireworkLifespan);
    if (alpha <= 0) return;
    
    buffer.push();
    buffer.noFill();
    buffer.stroke(this.hue, 255, 255, alpha);
    buffer.strokeWeight(this.thickness);
    buffer.ellipse(this.position.x, this.position.y, this.radius * 2);
    buffer.pop();
  }
}

// 粒子类
class Particle {
  constructor(x, y, hue, radius, angle, speed, isStar = false) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.fromAngle(angle);
    this.velocity.mult(speed);
    this.acceleration = createVector(0, 0.05);
    this.radius = radius;
    this.hue = hue;
    this.alpha = 255;
    this.decay = random(0.95, 0.98);
    this.isStar = isStar;
    this.twinkle = random(0.7, 1);
  }
  
  update() {
    // 添加重力
    this.velocity.add(this.acceleration);
    
    // 更新位置
    this.position.add(this.velocity);
    
    // 减缓速度
    this.velocity.mult(this.decay);
    
    // 闪烁效果（仅适用于星星）
    if (this.isStar) {
      this.twinkle = constrain(this.twinkle + random(-0.1, 0.1), 0.5, 1);
    }
  }
  
  display(buffer, fireworkLifespan) {
    // 计算不透明度
    const alpha = min(this.alpha, fireworkLifespan);
    if (alpha <= 0) return;
    
    buffer.push();
    buffer.noStroke();
    
    if (this.isStar) {
      // 星星效果
      buffer.fill(this.hue, 255, 255 * this.twinkle, alpha);
      this.drawStar(buffer, this.position.x, this.position.y, this.radius * 0.5, this.radius, 5);
    } else {
      // 普通粒子
      buffer.fill(this.hue, 255, 255, alpha);
      buffer.ellipse(this.position.x, this.position.y, this.radius, this.radius);
    }
    
    buffer.pop();
  }
  
  // 绘制星形
  drawStar(buffer, x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    
    buffer.beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = x + cos(a) * radius2;
      let sy = y + sin(a) * radius2;
      buffer.vertex(sx, sy);
      sx = x + cos(a + halfAngle) * radius1;
      sy = y + sin(a + halfAngle) * radius1;
      buffer.vertex(sx, sy);
    }
    buffer.endShape(CLOSE);
  }
}