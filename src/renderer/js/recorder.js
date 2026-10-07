/**
 * ScreenRecorderEngine
 * Manages MediaRecorder, Canvas Cropping for Regions, Audio Mixing, and Pause/Resume
 */
class ScreenRecorderEngine {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.state = 'idle'; // 'idle' | 'recording' | 'paused'
    
    // Streams
    this.rawScreenStream = null;
    this.micStream = null;
    this.combinedStream = null;
    
    // Region cropping
    this.isRegionMode = false;
    this.regionBounds = null; // { x, y, width, height, screenWidth, screenHeight }
    this.cropCanvas = null;
    this.cropCtx = null;
    this.cropVideo = null;
    this.animFrameId = null;

    // Audio context for mixing
    this.audioContext = null;
    this.audioDestination = null;
    this.analyser = null;

    // Options
    this.fps = 60;
    this.videoBitrate = 8000000;
    this.includeMic = true;
    this.includeSystemAudio = true;
    this.micDeviceId = 'default';

    // Timer callbacks
    this.onTick = null;
    this.onStateChange = null;
    this.onAudioLevel = null;

    this.timerInterval = null;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.pausedAt = 0;
    this.totalPausedDuration = 0;
  }

  setOptions({ fps, videoBitrate, includeMic, includeSystemAudio, micDeviceId }) {
    if (fps) this.fps = parseInt(fps, 10);
    if (videoBitrate) this.videoBitrate = parseInt(videoBitrate, 10);
    if (includeMic !== undefined) this.includeMic = includeMic;
    if (includeSystemAudio !== undefined) this.includeSystemAudio = includeSystemAudio;
    if (micDeviceId) this.micDeviceId = micDeviceId;
  }

  setRegion(bounds) {
    this.regionBounds = bounds;
    this.isRegionMode = !!bounds;
  }

  clearRegion() {
    this.regionBounds = null;
    this.isRegionMode = false;
  }

  async getDisplayStream(sourceId) {
    const videoConstraints = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        minFrameRate: this.fps,
        maxFrameRate: this.fps
      }
    };

    const audioConstraints = this.includeSystemAudio
      ? {
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        }
      : false;

    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioConstraints
    });
  }

  async getMicrophoneStream() {
    if (!this.includeMic) return null;
    try {
      const constraints = {
        audio: this.micDeviceId === 'default'
          ? { echoCancellation: true, noiseSuppression: true }
          : { deviceId: { exact: this.micDeviceId }, echoCancellation: true, noiseSuppression: true },
        video: false
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Microphone access warning:', err);
      return null;
    }
  }

  setupAudioMixing(desktopStream, micStream) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.audioDestination = this.audioContext.createMediaStreamDestination();

    // Setup VU Analyser for microphone
    if (micStream && micStream.getAudioTracks().length > 0) {
      const micSource = this.audioContext.createMediaStreamSource(micStream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      micSource.connect(this.analyser);
      micSource.connect(this.audioDestination);
      this.startAudioMeter();
    }

    if (desktopStream && desktopStream.getAudioTracks().length > 0) {
      const desktopSource = this.audioContext.createMediaStreamSource(desktopStream);
      desktopSource.connect(this.audioDestination);
    }
  }

  startAudioMeter() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateMeter = () => {
      if (this.state === 'idle' || !this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const level = Math.min(100, Math.round((avg / 128) * 100));

      if (this.onAudioLevel) {
        this.onAudioLevel(level);
      }

      requestAnimationFrame(updateMeter);
    };

    updateMeter();
  }

  startRegionCropping(rawStream, bounds) {
    // Ensure even dimensions for codec compatibility (many codecs fail on odd dimensions)
    const width = bounds.width % 2 === 0 ? bounds.width : bounds.width - 1;
    const height = bounds.height % 2 === 0 ? bounds.height : bounds.height - 1;

    this.cropCanvas = document.createElement('canvas');
    this.cropCanvas.width = width;
    this.cropCanvas.height = height;
    this.cropCtx = this.cropCanvas.getContext('2d', { alpha: false });

    this.cropVideo = document.createElement('video');
    this.cropVideo.srcObject = rawStream;
    this.cropVideo.muted = true;
    this.cropVideo.play();

    const drawFrame = () => {
      if (!this.cropVideo) return;

      if (this.cropVideo.readyState >= 2) {
        // Calculate scaling from video original size to screen width
        const videoW = this.cropVideo.videoWidth || bounds.screenWidth;
        const videoH = this.cropVideo.videoHeight || bounds.screenHeight;
        const scaleX = videoW / bounds.screenWidth;
        const scaleY = videoH / bounds.screenHeight;

        const srcX = bounds.x * scaleX;
        const srcY = bounds.y * scaleY;
        const srcW = bounds.width * scaleX;
        const srcH = bounds.height * scaleY;

        this.cropCtx.drawImage(
          this.cropVideo,
          srcX, srcY, srcW, srcH,
          0, 0, width, height
        );
      }

      this.animFrameId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Capture stream from canvas at requested fps
    return this.cropCanvas.captureStream(this.fps);
  }

  async start(sourceId) {
    if (this.state !== 'idle') return;

    this.recordedChunks = [];
    this.rawScreenStream = await this.getDisplayStream(sourceId);
    this.micStream = await this.getMicrophoneStream();

    let finalVideoStream = this.rawScreenStream;

    // Apply region cropping if selected
    if (this.isRegionMode && this.regionBounds) {
      finalVideoStream = this.startRegionCropping(this.rawScreenStream, this.regionBounds);
    }

    // Audio mixing
    this.setupAudioMixing(this.rawScreenStream, this.micStream);

    // Combine video tracks + mixed audio tracks
    const mixedTracks = [
      ...finalVideoStream.getVideoTracks(),
      ...this.audioDestination.stream.getAudioTracks()
    ];

    this.combinedStream = new MediaStream(mixedTracks);

    // Find supported mime type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
      mimeType = 'video/webm;codecs=h264,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      mimeType = 'video/webm;codecs=vp8,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    this.mediaRecorder = new MediaRecorder(this.combinedStream, {
      mimeType,
      videoBitsPerSecond: this.videoBitrate
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // 1-second chunks

    this.state = 'recording';
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.totalPausedDuration = 0;
    this.startTimer();

    if (this.onStateChange) this.onStateChange(this.state);
  }

  pause() {
    if (this.state !== 'recording' || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
    this.state = 'paused';
    this.pausedAt = Date.now();
    this.stopTimer();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  resume() {
    if (this.state !== 'paused' || !this.mediaRecorder) return;
    this.mediaRecorder.resume();
    this.state = 'recording';
    this.totalPausedDuration += (Date.now() - this.pausedAt);
    this.startTimer();
    if (this.onStateChange) this.onStateChange(this.state);
  }

  async stop() {
    if (this.state === 'idle' || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this.stopTimer();
        this.cleanup();

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();

        const result = {
          blob,
          buffer: arrayBuffer,
          duration: this.elapsedTime,
          resolution: this.isRegionMode && this.regionBounds
            ? `${this.regionBounds.width} × ${this.regionBounds.height}`
            : 'Full Screen'
        };

        this.state = 'idle';
        if (this.onStateChange) this.onStateChange(this.state);
        resolve(result);
      };

      this.mediaRecorder.stop();
    });
  }

  cleanup() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.rawScreenStream) {
      this.rawScreenStream.getTracks().forEach(t => t.stop());
      this.rawScreenStream = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(t => t.stop());
      this.combinedStream = null;
    }
    if (this.cropVideo) {
      this.cropVideo.srcObject = null;
      this.cropVideo = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state === 'recording') {
        this.elapsedTime = Date.now() - this.startTime - this.totalPausedDuration;
        if (this.onTick) this.onTick(this.elapsedTime);
      }
    }, 200);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
