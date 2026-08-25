const canvas = document.getElementById('overlay-canvas');
const ctx = canvas.getContext('2d');
const badge = document.getElementById('dimension-badge');

let isDrawing = false;
let isMoving = false;
let isResizing = false;
let resizeHandle = null;

let startX = 0;
let startY = 0;

let rect = {
  x: 0,
  y: 0,
  w: 0,
  h: 0
};

let screenBounds = {
  width: window.innerWidth,
  height: window.innerHeight
};

let scaleFactor = 1;

// Resize canvas to window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

if (window.electronAPI && window.electronAPI.onInitRegionBounds) {
  window.electronAPI.onInitRegionBounds((data) => {
    if (data && data.bounds) {
      screenBounds = data.bounds;
      scaleFactor = data.scaleFactor || 1;
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (rect.w > 0 && rect.h > 0) {
    // Clear the selected rectangle area
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);

    // Stroke border
    ctx.strokeStyle = '#ff5240';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);

    // Draw corner handles
    const handleSize = 8;
    ctx.fillStyle = '#ff5240';
    
    // 4 corners
    ctx.fillRect(rect.x - handleSize/2, rect.y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(rect.x + rect.w - handleSize/2, rect.y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(rect.x - handleSize/2, rect.y + rect.h - handleSize/2, handleSize, handleSize);
    ctx.fillRect(rect.x + rect.w - handleSize/2, rect.y + rect.h - handleSize/2, handleSize, handleSize);

    // Update dimension badge
    const actualW = Math.round(rect.w * scaleFactor);
    const actualH = Math.round(rect.h * scaleFactor);
    badge.textContent = `${actualW} × ${actualH} px`;
    badge.style.display = 'block';
    badge.style.left = `${Math.max(10, rect.x + 8)}px`;
    badge.style.top = `${Math.max(70, rect.y - 30)}px`;
  } else {
    badge.style.display = 'none';
  }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // Left click only

  isDrawing = true;
  startX = e.clientX;
  startY = e.clientY;

  rect.x = startX;
  rect.y = startY;
  rect.w = 0;
  rect.h = 0;
  draw();
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  rect.x = Math.min(startX, currentX);
  rect.y = Math.min(startY, currentY);
  rect.w = Math.abs(currentX - startX);
  rect.h = Math.abs(currentY - startY);

  draw();
});

canvas.addEventListener('mouseup', () => {
  if (isDrawing) {
    isDrawing = false;
  }
});

// HUD Preset buttons
document.getElementById('btn-full').addEventListener('click', () => {
  rect.x = 0;
  rect.y = 0;
  rect.w = canvas.width;
  rect.h = canvas.height;
  draw();
});

document.getElementById('btn-1080p').addEventListener('click', () => {
  const targetW = Math.min(1920 / scaleFactor, canvas.width - 40);
  const targetH = Math.min(1080 / scaleFactor, canvas.height - 40);
  rect.w = targetW;
  rect.h = targetH;
  rect.x = (canvas.width - targetW) / 2;
  rect.y = (canvas.height - targetH) / 2;
  draw();
});

document.getElementById('btn-720p').addEventListener('click', () => {
  const targetW = Math.min(1280 / scaleFactor, canvas.width - 40);
  const targetH = Math.min(720 / scaleFactor, canvas.height - 40);
  rect.w = targetW;
  rect.h = targetH;
  rect.x = (canvas.width - targetW) / 2;
  rect.y = (canvas.height - targetH) / 2;
  draw();
});

function confirmSelection() {
  if (rect.w <= 10 || rect.h <= 10) {
    // Default to full window if selection is too small
    rect.x = 0;
    rect.y = 0;
    rect.w = canvas.width;
    rect.h = canvas.height;
  }

  const regionData = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    width: Math.round(rect.w * scaleFactor),
    height: Math.round(rect.h * scaleFactor),
    screenWidth: Math.round(canvas.width * scaleFactor),
    screenHeight: Math.round(canvas.height * scaleFactor)
  };

  if (window.electronAPI) {
    window.electronAPI.sendRegionSelected(regionData);
  }
}

function cancelSelection() {
  if (window.electronAPI) {
    window.electronAPI.closeRegionSelector();
  }
}

document.getElementById('btn-confirm').addEventListener('click', confirmSelection);
document.getElementById('btn-cancel').addEventListener('click', cancelSelection);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cancelSelection();
  } else if (e.key === 'Enter') {
    confirmSelection();
  }
});
