/**
 * iNDRIASTIGPSMAP — GPS Map & Timestamp Camera INDRI ASTI
 * Production Engine: Capacitor Native Bridge + Live Viewfinder + Adaptive 200KB Compression
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. APPLICATION STATE
  // ==========================================================================
  const state = {
    // Camera
    stream: null,
    videoTrack: null,
    facingMode: 'environment', // 'environment' (belakang) | 'user' (depan)
    hasTorch: false,
    isTorchOn: false,
    isCapturing: false,

    // Telemetry & GPS
    gpsLocked: false,
    gpsSearching: true,
    gpsDisabled: false,
    coords: {
      latitude: null,
      longitude: null,
      altitude: null,
      accuracy: null,
      speed: null,
      heading: null
    },
    compassHeading: 0,
    compassDirection: 'U',

    // Offline / Online Status
    isOnline: navigator.onLine,

    // Settings & Watermark Options
    targetSizeKB: parseInt(localStorage.getItem('indriasti_target_kb')) || 200, // Target default: 200 KB
    customNote: localStorage.getItem('indriasti_note') || 'Dokumentasi Survei Lapangan',
    mapMode: localStorage.getItem('indriasti_map_mode') || 'radar', // 'radar' | 'osm' | 'none'
    wmBrand: localStorage.getItem('indriasti_wm_brand') !== 'false',
    wmCoords: localStorage.getItem('indriasti_wm_coords') !== 'false',
    wmMetrics: localStorage.getItem('indriasti_wm_metrics') !== 'false',
    wmTime: localStorage.getItem('indriasti_wm_time') !== 'false',
    wmMap: localStorage.getItem('indriasti_wm_map') !== 'false',

    // Current pending captured photo
    pendingPhoto: {
      dataUrl: null,
      blob: null,
      fileName: '',
      sizeKB: 0,
      width: 0,
      height: 0,
      targetMet: true
    },

    // Gallery Cache
    savedPhotos: []
  };

  // ==========================================================================
  // 2. DOM REFERENCES
  // ==========================================================================
  const dom = {
    // Header & Status
    gpsStatusBadge: document.getElementById('gps-status-badge'),
    gpsStatusDot: document.getElementById('gps-status-dot'),
    gpsStatusText: document.getElementById('gps-status-text'),
    gpsAlertBanner: document.getElementById('gps-alert-banner'),
    btnOpenSettingsLoc: document.getElementById('btn-open-settings'),

    // Viewfinder
    video: document.getElementById('camera-video'),
    captureCanvas: document.getElementById('capture-canvas'),
    radarCanvas: document.getElementById('radar-canvas'),
    liveRadarCanvas: document.getElementById('live-radar-canvas'),
    viewfinderFlash: document.getElementById('viewfinder-flash'),
    pillAccText: document.getElementById('pill-acc-text'),
    btnTorch: document.getElementById('btn-torch'),
    btnSwitchCamera: document.getElementById('btn-switch-camera'),
    btnNativeCamera: document.getElementById('btn-native-camera'),

    // Live Watermark
    liveCompassText: document.getElementById('live-compass-text'),
    liveTimeVal: document.getElementById('live-time-val'),
    liveCoordsVal: document.getElementById('live-coords-val'),
    liveMetricsVal: document.getElementById('live-metrics-val'),
    liveNoteRow: document.getElementById('live-note-row'),
    liveNoteVal: document.getElementById('live-note-val'),

    // Controls
    btnShutter: document.getElementById('btn-shutter'),
    btnOpenGallery: document.getElementById('btn-open-gallery'),
    galleryThumbPreview: document.getElementById('gallery-thumb-preview'),
    galleryCount: document.getElementById('gallery-count'),
    btnOpenSettingsModal: document.getElementById('btn-open-settings-modal'),

    // Preview Modal
    previewModal: document.getElementById('preview-modal'),
    previewFilename: document.getElementById('preview-filename'),
    previewImg: document.getElementById('preview-img'),
    previewFilesize: document.getElementById('preview-filesize'),
    previewTargetSize: document.getElementById('preview-target-size'),
    previewStatusBadge: document.getElementById('preview-status-badge'),
    previewDimensions: document.getElementById('preview-dimensions'),
    btnClosePreview: document.getElementById('btn-close-preview'),
    btnRetake: document.getElementById('btn-retake'),
    btnSharePhoto: document.getElementById('btn-share-photo'),
    btnSaveGallery: document.getElementById('btn-save-gallery'),

    // Gallery Modal
    galleryModal: document.getElementById('gallery-modal'),
    galleryGrid: document.getElementById('gallery-grid'),
    galleryEmpty: document.getElementById('gallery-empty'),
    btnCloseGallery: document.getElementById('btn-close-gallery'),
    btnGalleryDone: document.getElementById('btn-gallery-done'),

    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    inputCustomNote: document.getElementById('input-custom-note'),
    selectMapMode: document.getElementById('select-map-mode'),
    toggleWmBrand: document.getElementById('toggle-wm-brand'),
    toggleWmCoords: document.getElementById('toggle-wm-coords'),
    toggleWmMetrics: document.getElementById('toggle-wm-metrics'),
    toggleWmTime: document.getElementById('toggle-wm-time'),
    toggleWmMap: document.getElementById('toggle-wm-map'),

    // Toast
    toast: document.getElementById('toast-message')
  };

  // ==========================================================================
  // 3. CAPACITOR BRIDGE HELPERS
  // ==========================================================================
  const isCapacitor = () => {
    return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
  };

  const getNativeGallery = () => {
    if (isCapacitor() && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeGallery) {
      return window.Capacitor.Plugins.NativeGallery;
    }
    return null;
  };

  const getCapacitorCamera = () => {
    if (isCapacitor() && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
      return window.Capacitor.Plugins.Camera;
    }
    return null;
  };

  const getCapacitorGeolocation = () => {
    if (isCapacitor() && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation) {
      return window.Capacitor.Plugins.Geolocation;
    }
    return null;
  };

  // Toast Utility
  function showToast(message, duration = 3000) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, duration);
  }

  // ==========================================================================
  // 4. GPS & TELEMETRY SUBSYSTEM
  // ==========================================================================
  function initGeolocation() {
    state.gpsSearching = true;
    updateGPSUI();

    const capGeo = getCapacitorGeolocation();

    if (capGeo) {
      // Use Capacitor Geolocation
      capGeo.requestPermissions().then((perm) => {
        if (perm.location === 'granted') {
          startWatchingPosition();
        } else {
          onGPSError({ code: 1, message: 'Izin lokasi ditolak' });
        }
      }).catch(() => {
        startWatchingPosition();
      });
    } else {
      startWatchingPosition();
    }

    // Compass / Device Orientation Listener
    initCompass();
  }

  function startWatchingPosition() {
    if (!navigator.geolocation) {
      onGPSError({ code: 2, message: 'GPS tidak didukung perangkat ini' });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    };

    navigator.geolocation.watchPosition(
      (pos) => onGPSSuccess(pos.coords),
      (err) => onGPSError(err),
      options
    );
  }

  function onGPSSuccess(coords) {
    state.coords.latitude = coords.latitude;
    state.coords.longitude = coords.longitude;
    state.coords.altitude = coords.altitude !== null ? coords.altitude : null;
    state.coords.accuracy = coords.accuracy !== null ? coords.accuracy : null;
    state.coords.speed = coords.speed !== null ? coords.speed : null;
    state.coords.heading = coords.heading !== null ? coords.heading : null;

    state.gpsLocked = true;
    state.gpsSearching = false;
    state.gpsDisabled = false;

    updateGPSUI();
  }

  function onGPSError(err) {
    // If we already have locked coordinates before, keep them
    if (!state.gpsLocked) {
      state.gpsSearching = false;
      state.gpsDisabled = true;
    }
    updateGPSUI();
  }

  function updateGPSUI() {
    // Header Status
    if (state.gpsLocked && state.coords.latitude !== null) {
      dom.gpsStatusDot.className = 'status-pulse locked';
      const accStr = state.coords.accuracy ? `±${Math.round(state.coords.accuracy)}m` : 'Akurat';
      dom.gpsStatusText.textContent = `GPS Terkunci (${accStr})`;
      dom.pillAccText.textContent = `GPS: ${accStr}`;
      dom.gpsAlertBanner.style.display = 'none';

      // Live Watermark Coordinates
      const latStr = state.coords.latitude.toFixed(6);
      const lonStr = state.coords.longitude.toFixed(6);
      dom.liveCoordsVal.textContent = `Lat: ${latStr}°, Lon: ${lonStr}°`;

      // Live Watermark Metrics
      const altStr = state.coords.altitude !== null ? `${Math.round(state.coords.altitude)} m` : '-- m';
      dom.liveMetricsVal.textContent = `Akurasi: ±${Math.round(state.coords.accuracy || 0)}m • Elevasi: ${altStr}`;
    } else if (state.gpsDisabled) {
      dom.gpsStatusDot.className = 'status-pulse disabled';
      dom.gpsStatusText.textContent = 'GPS Nonaktif';
      dom.pillAccText.textContent = 'GPS Nonaktif';
      dom.gpsAlertBanner.style.display = 'flex';
      dom.liveCoordsVal.textContent = 'Mencari lokasi GPS...';
      dom.liveMetricsVal.textContent = 'Akurasi: -- • Elevasi: --';
    } else {
      dom.gpsStatusDot.className = 'status-pulse searching';
      dom.gpsStatusText.textContent = 'Mencari lokasi GPS...';
      dom.pillAccText.textContent = 'Mencari satelit...';
      dom.gpsAlertBanner.style.display = 'none';
      dom.liveCoordsVal.textContent = 'Mencari lokasi GPS...';
      dom.liveMetricsVal.textContent = 'Akurasi: Menghitung • Elevasi: --';
    }

    // Render live tactical radar
    drawRadar(dom.liveRadarCanvas, state.compassHeading);
  }

  function openLocationSettings() {
    const nativeGallery = getNativeGallery();
    if (nativeGallery && nativeGallery.openLocationSettings) {
      nativeGallery.openLocationSettings().catch((e) => console.log('Settings intent error:', e));
    } else {
      showToast('Buka Pengaturan HP -> Lokasi -> Aktifkan GPS');
    }
  }

  // Compass Heading calculation
  function initCompass() {
    const updateHeading = (deg) => {
      state.compassHeading = Math.round(deg);
      state.compassDirection = getCompassDirection(deg);
      if (dom.liveCompassText) {
        dom.liveCompassText.textContent = `${state.compassHeading}° ${state.compassDirection}`;
      }
      drawRadar(dom.liveRadarCanvas, state.compassHeading);
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', (e) => {
        if (e.alpha !== null) {
          updateHeading(360 - e.alpha);
        }
      }, false);

      window.addEventListener('deviceorientation', (e) => {
        if (e.webkitCompassHeading) {
          updateHeading(e.webkitCompassHeading);
        } else if (e.alpha !== null && !state.compassHeading) {
          updateHeading(360 - e.alpha);
        }
      }, false);
    }
  }

  function getCompassDirection(deg) {
    const directions = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
    const idx = Math.round(deg / 45) % 8;
    return directions[idx];
  }

  // Clock Update
  function updateLiveClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = now.toTimeString().split(' ')[0];
    dom.liveTimeVal.textContent = `${dateStr} ${timeStr}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // ==========================================================================
  // 5. CAMERA SUBSYSTEM (Live Viewfinder + Torch + Front/Back Switch)
  // ==========================================================================
  async function startCamera() {
    stopCameraStream();

    const constraints = {
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.stream = stream;
      dom.video.srcObject = stream;
      await dom.video.play();

      const track = stream.getVideoTracks()[0];
      state.videoTrack = track;

      // Check for torch / flash capability
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities();
        state.hasTorch = !!capabilities.torch;
        dom.btnTorch.style.display = state.hasTorch ? 'flex' : 'none';
      } else {
        dom.btnTorch.style.display = 'none';
      }
    } catch (err) {
      console.warn('getUserMedia error:', err);
      showToast('Kamera tidak dapat diakses langsung. Anda dapat gunakan tombol kamera native.');
    }
  }

  function stopCameraStream() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
      state.videoTrack = null;
    }
  }

  async function toggleTorch() {
    if (!state.videoTrack || !state.hasTorch) return;
    try {
      state.isTorchOn = !state.isTorchOn;
      await state.videoTrack.applyConstraints({
        advanced: [{ torch: state.isTorchOn }]
      });
      dom.btnTorch.style.backgroundColor = state.isTorchOn ? '#38bdf8' : '';
      dom.btnTorch.style.color = state.isTorchOn ? '#000' : '#fff';
    } catch (e) {
      console.log('Torch error:', e);
    }
  }

  function switchCamera() {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
    showToast(`Beralih ke kamera ${state.facingMode === 'environment' ? 'belakang' : 'depan'}`);
  }

  // Native Android Camera Fallback
  async function captureWithNativeCamera() {
    const capCamera = getCapacitorCamera();
    if (!capCamera) {
      showToast('Plugin kamera native hanya aktif di perangkat Android.');
      return;
    }

    try {
      const photo = await capCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'CAMERA'
      });

      if (photo && photo.dataUrl) {
        processCapturedImage(photo.dataUrl);
      }
    } catch (e) {
      console.log('Native camera cancelled or error:', e);
    }
  }

  // ==========================================================================
  // 6. PHOTO CAPTURE & WATERMARK PROCESSING
  // ==========================================================================
  async function triggerCapture() {
    if (state.isCapturing) return;
    state.isCapturing = true;

    // Viewfinder Flash Effect
    dom.viewfinderFlash.classList.add('active');
    setTimeout(() => dom.viewfinderFlash.classList.remove('active'), 150);

    // Capture frame from video or fallback
    let sourceCanvas = null;

    if (dom.video.videoWidth > 0 && dom.video.videoHeight > 0) {
      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = dom.video.videoWidth;
      sourceCanvas.height = dom.video.videoHeight;
      const ctx = sourceCanvas.getContext('2d');
      ctx.drawImage(dom.video, 0, 0, sourceCanvas.width, sourceCanvas.height);
    } else {
      // Fallback to native camera
      state.isCapturing = false;
      captureWithNativeCamera();
      return;
    }

    // Overlay Watermark on Canvas
    await overlayWatermark(sourceCanvas);

    // Adaptive JPEG Compression to target <= 200 KB
    const compressionResult = await compressToTarget(sourceCanvas, state.targetSizeKB * 1024);

    // Prepare metadata
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `GEO_${timeStamp}.jpg`;

    state.pendingPhoto = {
      dataUrl: compressionResult.dataUrl,
      blob: compressionResult.blob,
      fileName: fileName,
      sizeKB: (compressionResult.sizeBytes / 1024).toFixed(1),
      width: compressionResult.width,
      height: compressionResult.height,
      targetMet: compressionResult.targetMet
    };

    state.isCapturing = false;
    openPreviewModal();
  }

  // Process dataUrl from native camera
  async function processCapturedImage(dataUrl) {
    const img = new Image();
    img.onload = async () => {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.naturalWidth || img.width;
      sourceCanvas.height = img.naturalHeight || img.height;
      const ctx = sourceCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      await overlayWatermark(sourceCanvas);

      const compressionResult = await compressToTarget(sourceCanvas, state.targetSizeKB * 1024);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `GEO_${timeStamp}.jpg`;

      state.pendingPhoto = {
        dataUrl: compressionResult.dataUrl,
        blob: compressionResult.blob,
        fileName: fileName,
        sizeKB: (compressionResult.sizeBytes / 1024).toFixed(1),
        width: compressionResult.width,
        height: compressionResult.height,
        targetMet: compressionResult.targetMet
      };

      openPreviewModal();
    };
    img.src = dataUrl;
  }

  // ==========================================================================
  // 7. WATERMARK STAMP DRAWING ENGINE
  // ==========================================================================
  async function overlayWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Scale sizing proportional to image width
    const baseScale = Math.max(width, height) / 1080;
    const padding = Math.round(18 * baseScale);
    const boxMargin = Math.round(18 * baseScale);
    const radarSize = Math.round(84 * baseScale);

    // Height of watermark card
    const cardHeight = Math.round(135 * baseScale);
    const cardWidth = width - (boxMargin * 2);
    const cardY = height - cardHeight - boxMargin;
    const cardX = boxMargin;

    // Draw Dark Translucent Card
    ctx.save();
    ctx.fillStyle = 'rgba(11, 19, 41, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = Math.max(2, Math.round(2 * baseScale));

    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, Math.round(14 * baseScale));
    ctx.fill();
    ctx.stroke();

    // Accent Left Bar
    ctx.fillStyle = '#38bdf8';
    roundRect(ctx, cardX, cardY, Math.round(6 * baseScale), cardHeight, Math.round(3 * baseScale));
    ctx.fill();

    // 1. Draw Tactical Mini Map Radar
    let contentStartX = cardX + padding + Math.round(6 * baseScale);
    if (state.wmMap && state.mapMode !== 'none') {
      const radarCanvas = document.createElement('canvas');
      radarCanvas.width = radarSize;
      radarCanvas.height = radarSize;
      drawRadar(radarCanvas, state.compassHeading);

      const radarY = cardY + Math.round((cardHeight - radarSize) / 2);
      ctx.drawImage(radarCanvas, contentStartX, radarY, radarSize, radarSize);

      contentStartX += radarSize + padding;
    }

    // 2. Draw Text Content
    const textX = contentStartX;
    let textY = cardY + Math.round(24 * baseScale);
    const lineHeight = Math.round(22 * baseScale);

    // Typography Setup
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = Math.round(4 * baseScale);
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Line 1: Header Brand
    if (state.wmBrand) {
      ctx.font = `bold ${Math.round(15 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('iNDRIASTIGPSMAP', textX, textY);

      const brandWidth = ctx.measureText('iNDRIASTIGPSMAP').width;
      ctx.font = `bold ${Math.round(10 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('• INDRI ASTI', textX + brandWidth + Math.round(8 * baseScale), textY);
      textY += lineHeight;
    }

    // Line 2: Date & Time
    if (state.wmTime) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const timeStr = now.toTimeString().split(' ')[0];

      ctx.font = `600 ${Math.round(12 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(`🕒 ${dateStr} ${timeStr}`, textX, textY);
      textY += lineHeight;
    }

    // Line 3: Coordinates
    if (state.wmCoords) {
      ctx.font = `bold ${Math.round(12.5 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#7dd3fc';

      let coordStr = '📍 Mencari lokasi GPS...';
      if (state.coords.latitude !== null && state.coords.longitude !== null) {
        coordStr = `📍 Lat: ${state.coords.latitude.toFixed(6)}°  Lon: ${state.coords.longitude.toFixed(6)}°`;
      }
      ctx.fillText(coordStr, textX, textY);
      textY += lineHeight;
    }

    // Line 4: Metrics (Accuracy, Elevation, Heading)
    if (state.wmMetrics) {
      ctx.font = `500 ${Math.round(11 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#cbd5e1';

      const accStr = state.coords.accuracy ? `±${Math.round(state.coords.accuracy)}m` : 'Menghitung';
      const altStr = state.coords.altitude !== null ? `${Math.round(state.coords.altitude)} m` : '-- m';
      const compassStr = `${state.compassHeading}° ${state.compassDirection}`;

      ctx.fillText(`🧭 Akurasi: ${accStr} | Elevasi: ${altStr} | Arah: ${compassStr}`, textX, textY);
      textY += lineHeight;
    }

    // Line 5: Note
    if (state.customNote && state.customNote.trim()) {
      ctx.font = `600 ${Math.round(10.5 * baseScale)}px "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#fde047';
      ctx.fillText(`📝 ${state.customNote.trim()}`, textX, textY);
    }

    ctx.restore();
  }

  // Draw Tactical Compass Radar on Canvas (100% Offline)
  function drawRadar(canvas, heading = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 4;

    ctx.clearRect(0, 0, w, h);

    // Dark Radar Background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#060d1d';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Concentric Range Rings
    const rings = [0.35, 0.65, 0.95];
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ring, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Center Blip
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Compass Heading Pointer (Rotated by user heading)
    const rad = ((heading - 90) * Math.PI) / 180;
    const pointerX = cx + Math.cos(rad) * (r * 0.85);
    const pointerY = cy + Math.sin(rad) * (r * 0.85);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pointerX, pointerY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pointerX, pointerY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // North Indicator 'N'
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('U', cx, 4);

    ctx.restore();
  }

  // Rounded Rectangle Helper
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // ==========================================================================
  // 8. ADAPTIVE JPEG COMPRESSION ENGINE (Target <= 200 KB)
  // ==========================================================================
  async function compressToTarget(sourceCanvas, targetMaxBytes = 200 * 1024) {
    let workingCanvas = sourceCanvas;
    let quality = 0.85;
    let blob = await canvasToBlob(workingCanvas, 'image/jpeg', quality);

    // Step 1: Step down JPEG quality progressively
    const qualities = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30];
    for (const q of qualities) {
      if (blob.size <= targetMaxBytes) break;
      quality = q;
      blob = await canvasToBlob(workingCanvas, 'image/jpeg', quality);
    }

    // Step 2: If still > target, reduce resolution adaptively while maintaining aspect ratio
    if (blob.size > targetMaxBytes) {
      const scaleFactors = [0.85, 0.72, 0.60, 0.50, 0.40];
      for (const scale of scaleFactors) {
        if (blob.size <= targetMaxBytes) break;

        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.round(sourceCanvas.width * scale);
        scaledCanvas.height = Math.round(sourceCanvas.height * scale);

        const ctx = scaledCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        workingCanvas = scaledCanvas;

        // Test qualities on scaled canvas
        for (const q of [0.75, 0.60, 0.45, 0.35]) {
          blob = await canvasToBlob(workingCanvas, 'image/jpeg', q);
          quality = q;
          if (blob.size <= targetMaxBytes) break;
        }
      }
    }

    const dataUrl = await blobToDataURL(blob);

    return {
      blob: blob,
      dataUrl: dataUrl,
      sizeBytes: blob.size,
      width: workingCanvas.width,
      height: workingCanvas.height,
      targetMet: blob.size <= targetMaxBytes
    };
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ==========================================================================
  // 9. MODALS & USER ACTIONS (Preview, Save Gallery, Share)
  // ==========================================================================
  function openPreviewModal() {
    dom.previewFilename.textContent = state.pendingPhoto.fileName;
    dom.previewImg.src = state.pendingPhoto.dataUrl;
    dom.previewFilesize.textContent = `${state.pendingPhoto.sizeKB} KB`;
    dom.previewTargetSize.textContent = `Maks. ${state.targetSizeKB} KB`;
    dom.previewDimensions.textContent = `${state.pendingPhoto.width} × ${state.pendingPhoto.height}`;

    if (state.pendingPhoto.targetMet) {
      dom.previewStatusBadge.className = 'stat-badge success';
      dom.previewStatusBadge.textContent = '✅ Target Tercapai';
    } else {
      dom.previewStatusBadge.className = 'stat-badge warning';
      dom.previewStatusBadge.textContent = '⚠️ Kompresi Maksimal';
    }

    dom.previewModal.style.display = 'flex';
  }

  function closePreviewModal() {
    dom.previewModal.style.display = 'none';
  }

  // Save to Android Gallery / MediaStore
  async function saveToGallery() {
    if (!state.pendingPhoto.dataUrl) return;

    dom.btnSaveGallery.disabled = true;
    dom.btnSaveGallery.textContent = 'Menyimpan...';

    const nativeGallery = getNativeGallery();

    if (nativeGallery && nativeGallery.saveImageToGallery) {
      try {
        const result = await nativeGallery.saveImageToGallery({
          base64: state.pendingPhoto.dataUrl,
          fileName: state.pendingPhoto.fileName
        });

        recordSavedPhoto(state.pendingPhoto);
        showToast(`✅ Foto tersimpan di Galeri Android (Pictures/iNDRIASTIGPSMAP)!`);
        closePreviewModal();
      } catch (err) {
        console.error('Native save error:', err);
        fallbackWebDownload();
      }
    } else {
      fallbackWebDownload();
    }

    dom.btnSaveGallery.disabled = false;
    dom.btnSaveGallery.textContent = '💾 Simpan ke Galeri';
  }

  function fallbackWebDownload() {
    // Web / browser download fallback
    const link = document.createElement('a');
    link.download = state.pendingPhoto.fileName;
    link.href = state.pendingPhoto.dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordSavedPhoto(state.pendingPhoto);
    showToast(`✅ Foto berhasil diunduh (${state.pendingPhoto.fileName})`);
    closePreviewModal();
  }

  function recordSavedPhoto(photo) {
    state.savedPhotos.unshift({
      fileName: photo.fileName,
      dataUrl: photo.dataUrl,
      sizeKB: photo.sizeKB,
      timestamp: Date.now()
    });

    // Update gallery count badge & thumbnail
    dom.galleryCount.textContent = state.savedPhotos.length;
    dom.galleryThumbPreview.style.backgroundImage = `url(${photo.dataUrl})`;
    dom.galleryThumbPreview.innerHTML = '';
  }

  // Share Photo
  async function sharePhoto() {
    if (!state.pendingPhoto.blob) return;

    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([state.pendingPhoto.blob], state.pendingPhoto.fileName, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'iNDRIASTIGPSMAP',
            text: `Foto GPS: ${state.pendingPhoto.fileName}`
          });
          return;
        }
      } catch (e) {
        console.log('Share error:', e);
      }
    }
    showToast('Berbagi tidak didukung pada browser ini, silakan simpan ke galeri terlebih dahulu.');
  }

  // ==========================================================================
  // 10. GALLERY MODAL
  // ==========================================================================
  function openGalleryModal() {
    dom.galleryGrid.innerHTML = '';

    if (state.savedPhotos.length === 0) {
      dom.galleryEmpty.style.display = 'block';
    } else {
      dom.galleryEmpty.style.display = 'none';
      state.savedPhotos.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `<img src="${item.dataUrl}" alt="${item.fileName}">`;
        div.onclick = () => {
          state.pendingPhoto = {
            dataUrl: item.dataUrl,
            fileName: item.fileName,
            sizeKB: item.sizeKB,
            width: 1920,
            height: 1080,
            targetMet: true
          };
          dom.galleryModal.style.display = 'none';
          openPreviewModal();
        };
        dom.galleryGrid.appendChild(div);
      });
    }

    dom.galleryModal.style.display = 'flex';
  }

  function closeGalleryModal() {
    dom.galleryModal.style.display = 'none';
  }

  // ==========================================================================
  // 11. SETTINGS MODAL
  // ==========================================================================
  function openSettingsModal() {
    dom.inputCustomNote.value = state.customNote;
    dom.selectMapMode.value = state.mapMode;

    const radios = document.querySelectorAll('input[name="targetSize"]');
    radios.forEach((r) => {
      r.checked = parseInt(r.value) === state.targetSizeKB;
    });

    dom.toggleWmBrand.checked = state.wmBrand;
    dom.toggleWmCoords.checked = state.wmCoords;
    dom.toggleWmMetrics.checked = state.wmMetrics;
    dom.toggleWmTime.checked = state.wmTime;
    dom.toggleWmMap.checked = state.wmMap;

    dom.settingsModal.style.display = 'flex';
  }

  function saveSettings() {
    state.customNote = dom.inputCustomNote.value;
    state.mapMode = dom.selectMapMode.value;

    const selectedRadio = document.querySelector('input[name="targetSize"]:checked');
    if (selectedRadio) {
      state.targetSizeKB = parseInt(selectedRadio.value);
    }

    state.wmBrand = dom.toggleWmBrand.checked;
    state.wmCoords = dom.toggleWmCoords.checked;
    state.wmMetrics = dom.toggleWmMetrics.checked;
    state.wmTime = dom.toggleWmTime.checked;
    state.wmMap = dom.toggleWmMap.checked;

    localStorage.setItem('indriasti_note', state.customNote);
    localStorage.setItem('indriasti_map_mode', state.mapMode);
    localStorage.setItem('indriasti_target_kb', String(state.targetSizeKB));
    localStorage.setItem('indriasti_wm_brand', String(state.wmBrand));
    localStorage.setItem('indriasti_wm_coords', String(state.wmCoords));
    localStorage.setItem('indriasti_wm_metrics', String(state.wmMetrics));
    localStorage.setItem('indriasti_wm_time', String(state.wmTime));
    localStorage.setItem('indriasti_wm_map', String(state.wmMap));

    // Update live note display
    dom.liveNoteVal.textContent = state.customNote || '';
    dom.liveNoteRow.style.display = state.customNote ? 'flex' : 'none';

    dom.settingsModal.style.display = 'none';
    showToast('Pengaturan berhasil disimpan!');
  }

  function closeSettingsModal() {
    dom.settingsModal.style.display = 'none';
  }

  // ==========================================================================
  // 12. EVENT LISTENERS ATTACHMENT
  // ==========================================================================
  function attachEvents() {
    // Shutter & Controls
    dom.btnShutter.addEventListener('click', triggerCapture);
    dom.btnTorch.addEventListener('click', toggleTorch);
    dom.btnSwitchCamera.addEventListener('click', switchCamera);
    dom.btnNativeCamera.addEventListener('click', captureWithNativeCamera);
    dom.btnOpenSettingsLoc.addEventListener('click', openLocationSettings);

    // Preview Modal
    dom.btnClosePreview.addEventListener('click', closePreviewModal);
    dom.btnRetake.addEventListener('click', closePreviewModal);
    dom.btnSaveGallery.addEventListener('click', saveToGallery);
    dom.btnSharePhoto.addEventListener('click', sharePhoto);

    // Gallery Modal
    dom.btnOpenGallery.addEventListener('click', openGalleryModal);
    dom.btnCloseGallery.addEventListener('click', closeGalleryModal);
    dom.btnGalleryDone.addEventListener('click', closeGalleryModal);

    // Settings Modal
    dom.btnOpenSettingsModal.addEventListener('click', openSettingsModal);
    dom.btnCloseSettings.addEventListener('click', closeSettingsModal);
    dom.btnSaveSettings.addEventListener('click', saveSettings);

    // Online / Offline Listeners
    window.addEventListener('online', () => {
      state.isOnline = true;
      updateGPSUI();
    });
    window.addEventListener('offline', () => {
      state.isOnline = false;
      updateGPSUI();
    });
  }

  // ==========================================================================
  // 13. INITIALIZATION
  // ==========================================================================
  function init() {
    attachEvents();
    initGeolocation();
    startCamera();

    // Set initial note
    if (state.customNote) {
      dom.liveNoteVal.textContent = state.customNote;
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
