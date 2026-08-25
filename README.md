Screen Recorder Pro (Windows Desktop Application)
A desktop screen recorder application for Windows built with Electron, Web APIs, and FFmpeg.

Features
Full Screen Recording: Record your primary or secondary display in smooth 60/30 FPS.

Part of the Screen (Custom Region): Interactive transparent overlay to draw and select any rectangle or region on your screen. Includes one-click presets (1080p, 720p, Full Screen).

App Window Recording: Target specific application windows.

Pause & Resume: Seamlessly pause and resume recordings on the fly with synchronized timestamps.

Audio Capture & Live VU Meter: Record your microphone with a real-time audio volume visualizer.

System Sound Recording: Capture desktop and in-app sounds.

Universal MP4 Export: High-quality H.264/AAC MP4 output compatible with all media players and video editors.

Global Hotkeys:

Ctrl + Shift + R: Start / Stop Recording

Ctrl + Shift + P: Pause / Resume Recording

How to Run the App from Codebase
1. Prerequisites
Ensure you have Node.js installed on your system.

2. Install Dependencies (If not already installed)
In PowerShell or Command Prompt, run:

PowerShell
npm install
(On Windows PowerShell, if script execution is restricted, you can also use npm.cmd install)

3. Launch the Application
To start and run the application in development mode:

PowerShell
npm start
(Or npm.cmd start)

The Screen Recorder Pro desktop window will launch immediately!

How to Build the Standalone .exe
To package and compile the application into a standalone Windows .exe executable:

PowerShell
npm run dist
(Or npm.cmd run dist)

Once the build finishes, your executable file will be generated in the dist/ folder:

dist/ScreenRecorderPro-1.0.0-portable.exe (Single-file portable executable, no installation required)

dist/ScreenRecorderPro Setup 1.0.0.exe (Windows NSIS Installer)

You can share or double-click the .exe to run it on any Windows PC without requiring Node.js.

How to Use
Select Capture Mode:

Click Full Screen to capture your entire monitor.

Click Custom Region to draw an area on your screen. Click Draw / Select Area anytime to adjust.

Click App Window to capture an individual application.

Configure Audio:

Toggle Microphone ON/OFF and select your microphone device.

Toggle System Audio ON/OFF to record desktop sound.

Start Recording:

Click the red Start Recording button (or press Ctrl+Shift+R).

Pause / Resume:

Click Pause (or press Ctrl+Shift+P) to pause anytime. Click Resume when ready.

Stop & Save MP4:

Click Stop & Save.

Review your recording in the preview player.

Click Save MP4 Video to choose a location on your PC.

Click Show in Explorer to open your saved file.

Project Structure
Plaintext
screenrecorder/
├── .gitignore                # Ignores node_modules and dist binaries
├── package.json              # App metadata, dependencies and build scripts
├── README.md                 # Usage and build instructions
└── src/
    ├── main/
    │   ├── main.js           # Electron main process & FFmpeg conversion handler
    │   └── preload.js        # Secure IPC bridge
    └── renderer/
        ├── index.html        # Main studio UI
        ├── region.html       # Transparent screen region selector overlay
        ├── css/
        │   └── style.css     # Dark cyberpunk & glassmorphism theme
        └── js/
            ├── recorder.js   # MediaRecorder & Canvas dynamic cropping engine
            ├── region-overlay.js # Region drag-to-select overlay logic
            └── ui.js         # UI controller & event listeners
