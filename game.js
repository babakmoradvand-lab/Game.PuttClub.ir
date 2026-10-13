
    // Audio Synthesis Engine (AAA Sports Game Sound FX with Authentic Sweet Spot Acoustic Physics)
    const AudioEngine = {
      ctx: null,
      muted: false,
      volume: 0.85,
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      },
      playSwing(power = 1.0) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(380 * power, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.24);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35 * this.volume * power, now + 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      },
      playSweetSpotImpact(clubCat = 'wood', power = 1.0) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Layer 1: Sub-bass Ball Compression Thump (140Hz -> 50Hz)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(145, now);
        subOsc.frequency.exponentialRampToValueAtTime(48, now + 0.07);
        subGain.gain.setValueAtTime(0.85 * this.volume * power, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.10);

        // Layer 2: Explosive Titanium / Forged Steel Sweet Spot Crack (3200Hz Driver, 2400Hz Iron)
        const crackOsc = this.ctx.createOscillator();
        const crackGain = this.ctx.createGain();
        const peakFreq = (clubCat === 'wood') ? 3150 : (clubCat === 'iron' ? 2450 : 1300);
        crackOsc.type = (clubCat === 'wood') ? 'triangle' : 'sawtooth';
        crackOsc.frequency.setValueAtTime(peakFreq, now);
        crackOsc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
        crackGain.gain.setValueAtTime(0.95 * this.volume * power, now);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        crackOsc.connect(crackGain);
        crackGain.connect(this.ctx.destination);
        crackOsc.start(now);
        crackOsc.stop(now + 0.13);

        // Layer 3: Hollow Clubhead Metallic Ring / Resonance
        const ringOsc = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();
        ringOsc.type = 'sine';
        const ringFreq = (clubCat === 'wood') ? 920 : 760;
        ringOsc.frequency.setValueAtTime(ringFreq, now);
        ringGain.gain.setValueAtTime(0.50 * this.volume * power, now);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        ringOsc.connect(ringGain);
        ringGain.connect(this.ctx.destination);
        ringOsc.start(now);
        ringOsc.stop(now + 0.30);

        // Layer 4: High-frequency explosive turf & ball friction noise burst
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.035);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.005));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.95 * this.volume * power, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
      },
      playBallLand(isSand = false) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isSand ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(isSand ? 130 : 190, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
        gain.gain.setValueAtTime(0.24 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.20);
      },
      playCupDrop() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [960, 720, 1150].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const t = now + idx * 0.09;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.35 * this.volume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
        });
      }
    };

    // Environmental Wind System
    let windAngle = Math.random() * Math.PI * 2;
    let windSpeedMph = 3.5 + Math.random() * 4.0; // 3.5 to 7.5 mph gentle breeze
    function updateWindDisplay() {
      const arrow = document.getElementById('wind-dir-arrow');
      const val = document.getElementById('wind-speed-val');
      if (arrow) arrow.style.transform = `rotate(${Math.round(windAngle * 180 / Math.PI)}deg)`;
      if (val) val.textContent = `${windSpeedMph.toFixed(1)} mph`;
    }
    updateWindDisplay();

    // Audio Toggle Handler
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        AudioEngine.muted = !AudioEngine.muted;
        btnAudio.textContent = AudioEngine.muted ? '🔇' : '🔊';
        btnAudio.style.opacity = AudioEngine.muted ? '0.5' : '1.0';
      });
    }

    const terrainData = window.MIS_TERRAIN;
    const golfFeatures = window.MIS_FEATURES;
    const courseHoles = window.MIS_COURSE_18;
    const osmBuildings = window.MIS_BUILDINGS || [];
    const satelliteTexUrl = window.MIS_TEXTURE_B64;
    const proTextures = window.MIS_PRO_TEXTURES || {};
    const barkTexUrl = window.MIS_BARK_TEX;
    const leafTexUrl = window.MIS_LEAF_TEX;

    const GOLF_BAG = [
      { id: '1W', cat: 'wood', name: 'Driver (1-Wood)', loft: 12.0, v0: 69.89, total: 300, carry: 225, roll: 75, bounceRest: 0.265, tangentLoss: 0.657, rollDecel: 1.7 },
      { id: '3W', cat: 'wood', name: '3-Wood', loft: 14.5, v0: 62.3, total: 272, carry: 204, roll: 68, bounceRest: 0.249, tangentLoss: 0.665, rollDecel: 1.7 },
      { id: '5W', cat: 'wood', name: '5-Wood', loft: 17.5, v0: 55.63, total: 248, carry: 186, roll: 62, bounceRest: 0.231, tangentLoss: 0.675, rollDecel: 1.7 },
      { id: '4I', cat: 'iron', name: '4-Iron', loft: 21.0, v0: 50.0, total: 228, carry: 171, roll: 57, bounceRest: 0.209, tangentLoss: 0.684, rollDecel: 1.6 },
      { id: '5I', cat: 'iron', name: '5-Iron', loft: 24.5, v0: 45.3, total: 208, carry: 156, roll: 52, bounceRest: 0.187, tangentLoss: 0.699, rollDecel: 1.6 },
      { id: '6I', cat: 'iron', name: '6-Iron', loft: 28.0, v0: 41.22, total: 188, carry: 141, roll: 47, bounceRest: 0.165, tangentLoss: 0.713, rollDecel: 1.6 },
      { id: '7I', cat: 'iron', name: '7-Iron', loft: 31.5, v0: 37.63, total: 168, carry: 126, roll: 42, bounceRest: 0.143, tangentLoss: 0.72, rollDecel: 1.5 },
      { id: '8I', cat: 'iron', name: '8-Iron', loft: 35.5, v0: 34.78, total: 152, carry: 114, roll: 38, bounceRest: 0.14, tangentLoss: 0.732, rollDecel: 1.5 },
      { id: '9I', cat: 'iron', name: '9-Iron', loft: 39.5, v0: 32.28, total: 136, carry: 102, roll: 34, bounceRest: 0.14, tangentLoss: 0.743, rollDecel: 1.5 },
      { id: 'PW', cat: 'wedge', name: 'Pitching Wedge (PW)', loft: 44.0, v0: 30.04, total: 120, carry: 90, roll: 30, bounceRest: 0.14, tangentLoss: 0.748, rollDecel: 1.4 },
      { id: 'AW', cat: 'wedge', name: 'Approach Wedge (AW)', loft: 48.5, v0: 28.02, total: 104, carry: 78, roll: 26, bounceRest: 0.14, tangentLoss: 0.761, rollDecel: 1.4 },
      { id: 'SW', cat: 'wedge', name: 'Sand Wedge (SW)', loft: 54.0, v0: 26.3, total: 88, carry: 66, roll: 22, bounceRest: 0.14, tangentLoss: 0.779, rollDecel: 1.4 },
      { id: 'PT', cat: 'putt', name: 'Putter', loft: 2.5, v0: 12.0, total: 35, carry: 0, roll: 35, bounceRest: 0.1, tangentLoss: 0.4, rollDecel: 1.4, isPutter: true }
    ];

    let currentClubIndex = 0;
    let currentSwingMode = 'full';
    let currentHoleNumber = 1;
    let strokesCurrentHole = 0;
    let isWomenTee = false;
    const holeScores = new Array(19).fill(null);

    // Three.js Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();

    const skyColor = new THREE.Color(0x7bb0dc);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0xa7c5de, 0.00018);

    const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 40000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.25 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    function handleResize() {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.25 : 1.75));
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      // Reframe the scene above the shot dock; no terrain or physics change.
      // Positive vertical view offset moves the projected ball up, away from UI.
      camera.setViewOffset(w, h, 0, Math.round(Math.min(140, h * 0.15)), w, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));
    handleResize();

    const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.02;
    orbitControls.minDistance = 2;
    orbitControls.maxDistance = 8500;

    // Natural 2026 Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x556644, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    sunLight.position.set(720, 1100, 520);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = window.innerWidth < 768 ? 1024 : 2048;
    sunLight.shadow.mapSize.height = window.innerWidth < 768 ? 1024 : 2048;
    sunLight.shadow.camera.near = 50;
    sunLight.shadow.camera.far = 4200;
    const d = 1600;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const skyGeo = new THREE.SphereGeometry(18000, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7bb0dc, side: THREE.BackSide });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Coordinates & Elevation
    const nwLat = terrainData.nw_lat; const nwLon = terrainData.nw_lon;
    const seLat = terrainData.se_lat; const seLon = terrainData.se_lon;
    const centerLat = (nwLat + seLat) / 2;
    const centerLon = (nwLon + seLon) / 2;
    const latMeters = 110880;
    const lonMeters = 111320 * Math.cos(centerLat * Math.PI / 180);
    const worldWidth = (seLon - nwLon) * lonMeters;
    const worldLength = (nwLat - seLat) * latMeters;

    function geoToWorld(lat, lon) {
      return { x: (lon - centerLon) * lonMeters, z: -(lat - centerLat) * latMeters };
    }

    const nLat = terrainData.n_lat;
    const nLon = terrainData.n_lon;
    const gridZ = terrainData.elevation_grid;
    let verticalExaggeration = 1.5;

    function getTerrainHeight(x, z) {
      const u = (x / worldWidth) + 0.5;
      const v = (z / worldLength) + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) return (terrainData.elev_min - 290) * verticalExaggeration;

      const latFraction = (1 - v) * (nLat - 1);
      const lonFraction = u * (nLon - 1);
      const i0 = Math.floor(latFraction);
      const i1 = Math.min(i0 + 1, nLat - 1);
      const fi = latFraction - i0;
      const j0 = Math.floor(lonFraction);
      const j1 = Math.min(j0 + 1, nLon - 1);
      const fj = lonFraction - j0;

      const h0 = gridZ[i0][j0] * (1 - fj) + gridZ[i0][j1] * fj;
      const h1 = gridZ[i1][j0] * (1 - fj) + gridZ[i1][j1] * fj;
      return (h0 * (1 - fi) + h1 * fi - 265) * verticalExaggeration;
    }

    function getTerrainNormal(x, z) {
      // Sensitive gradient sampling (0.5m delta) to capture MIS hills, mounds, and ravines
      const delta = 0.5;
      const hL = getTerrainHeight(x - delta, z);
      const hR = getTerrainHeight(x + delta, z);
      const hD = getTerrainHeight(x, z + delta);
      const hU = getTerrainHeight(x, z - delta);
      const normal = new THREE.Vector3((hL - hR) / (2 * delta), 1.0, (hU - hD) / (2 * delta));
      normal.normalize();
      return normal;
    }

    // Terrain Mesh with Orthophoto
    const segX = 140; const segZ = 140;
    const terrainGeo = new THREE.PlaneGeometry(worldWidth, worldLength, segX, segZ);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
    }
    pos.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    const texLoader = new THREE.TextureLoader();
    const satTexture = texLoader.load(satelliteTexUrl);
    satTexture.generateMipmaps = true;
    satTexture.encoding = THREE.sRGBEncoding;
    satTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const satMaterial = new THREE.MeshStandardMaterial({
      map: satTexture,
      roughness: 0.88,
      metalness: 0.02,
      color: 0xffffff
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, satMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 3D Buildings
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    const wallMaterialClub = new THREE.MeshStandardMaterial({ color: 0xd9cdbe, roughness: 0.85, metalness: 0.02 });
    const roofMaterialClub = new THREE.MeshStandardMaterial({ color: 0x4a4f56, roughness: 0.88, metalness: 0.1 });

    osmBuildings.forEach(b => {
      const coords = b.coords;
      if (coords.length < 3) return;
      const pts2d = coords.map(c => geoToWorld(c[1], c[0]));
      let avgH = 0;
      pts2d.forEach(p => avgH += getTerrainHeight(p.x, p.z));
      avgH /= pts2d.length;

      const shape = new THREE.Shape();
      shape.moveTo(pts2d[0].x, -pts2d[0].z);
      for (let i = 1; i < pts2d.length; i++) shape.lineTo(pts2d[i].x, -pts2d[i].z);

      const bHeight = 4.5;
      const bGeo = new THREE.ExtrudeGeometry(shape, { depth: bHeight, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 });
      bGeo.rotateX(-Math.PI / 2);

      const bMesh = new THREE.Mesh(bGeo, wallMaterialClub);
      bMesh.position.y = avgH;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      buildingGroup.add(bMesh);

      const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelSize: 0.45, bevelThickness: 0.55 });
      roofGeo.rotateX(-Math.PI / 2);
      const roofMesh = new THREE.Mesh(roofGeo, roofMaterialClub);
      roofMesh.position.y = avgH + bHeight;
      roofMesh.castShadow = true;
      buildingGroup.add(roofMesh);
    });

    // Realistic Foliage
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    const barkTexture = texLoader.load(barkTexUrl);
    barkTexture.wrapS = THREE.RepeatWrapping; barkTexture.wrapT = THREE.RepeatWrapping;
    barkTexture.repeat.set(1, 3);
    const leafTexture = texLoader.load(leafTexUrl);

    const realisticBarkMat = new THREE.MeshStandardMaterial({ map: barkTexture, roughness: 0.95 });
    const realisticLeafMat = new THREE.MeshStandardMaterial({
      map: leafTexture,
      transparent: true,
      alphaTest: 0.25,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    const singleTrunkGeo = new THREE.CylinderGeometry(0.18, 0.55, 3.8, 8).translate(0, 1.9, 0);
    const cardAngles = [0, Math.PI / 3, (2 * Math.PI) / 3];
    const cardW = 5.2; const cardH = 5.5;
    const leafPositions = []; const leafUvs = []; const leafNormals = [];

    cardAngles.forEach(ang => {
      const cosA = Math.cos(ang); const sinA = Math.sin(ang);
      const cy = 4.2; const hw = cardW / 2;
      const p1 = [-hw * cosA, cy - cardH * 0.45, -hw * sinA];
      const p2 = [hw * cosA, cy - cardH * 0.45, hw * sinA];
      const p3 = [hw * cosA, cy + cardH * 0.55, hw * sinA];
      const p4 = [-hw * cosA, cy + cardH * 0.55, -hw * sinA];
      const norm = [-sinA, 0.2, cosA];
      leafPositions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
      leafUvs.push(0, 0,  1, 0,  1, 1,  0, 0,  1, 1,  0, 1);
      for(let i=0; i<6; i++) leafNormals.push(...norm);
    });

    const mergedLeafGeo = new THREE.BufferGeometry();
    mergedLeafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3));
    mergedLeafGeo.setAttribute('uv', new THREE.Float32BufferAttribute(leafUvs, 2));
    mergedLeafGeo.setAttribute('normal', new THREE.Float32BufferAttribute(leafNormals, 3));

    const treeCount = 240;
    const instTrunk = new THREE.InstancedMesh(singleTrunkGeo, realisticBarkMat, treeCount);
    const instFoliage = new THREE.InstancedMesh(mergedLeafGeo, realisticLeafMat, treeCount);
    instTrunk.castShadow = true; instFoliage.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.pow(Math.random(), 0.72) * (worldWidth * 0.42);
      const rx = Math.cos(angle) * rad;
      const rz = Math.sin(angle) * rad * 0.85;
      const ry = getTerrainHeight(rx, rz);
      const s = 0.9 + Math.random() * 0.65;
      const rotY = Math.random() * Math.PI * 2;
      dummy.position.set(rx, ry, rz);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      instTrunk.setMatrixAt(i, dummy.matrix);
      instFoliage.setMatrixAt(i, dummy.matrix);
    }
    instTrunk.instanceMatrix.needsUpdate = true;
    instFoliage.instanceMatrix.needsUpdate = true;
    treeGroup.add(instTrunk);
    treeGroup.add(instFoliage);

    // =========================================================================
    // 30-CM GLASS BORDER RIBBON FOR FAIRWAYS (NATURAL GROUND INTERIOR)
    // =========================================================================
    // As requested: The fairway interior preserves the natural satellite ground texture,
    // outlined by an elegant, modern 30-centimeter translucent glass ribbon boundary!
    const fairwayGroup = new THREE.Group();
    scene.add(fairwayGroup);

    // Glass Border Ribbon Material (30cm icy translucent glass with refined specular sheen)
    const glassBorderMat = new THREE.MeshStandardMaterial({
      color: 0x94d2bd,
      emissive: 0x0a9396,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.88,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Faint interior boundary tint (nearly transparent, allowing 100% terrain ground texture to show through)
    const fairwayInteriorMat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.04, // 96% transparent: natural ground color shows completely!
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const fairwayPolygons = [];
    const fairwayMeshes = [];

    golfFeatures.forEach(f => {
      if (f.type === 'Polygon') {
        const rings = f.coordinates;
        if (rings && rings.length > 0) {
          const outer = rings[0];
          const m = f.name.match(/(\d+)/);
          const holeNum = m ? parseInt(m[1]) : 1;

          const holeFairwayContainer = new THREE.Group();
          holeFairwayContainer.userData.hole = holeNum;
          holeFairwayContainer.userData.name = f.name;

          // 1. Natural Ground Interior Mesh (Subtle demarcation, preserving ground texture)
          const shape = new THREE.Shape();
          const firstPt = geoToWorld(outer[0][1], outer[0][0]);
          shape.moveTo(firstPt.x, -firstPt.z);
          for (let i = 1; i < outer.length; i++) {
            const pt = geoToWorld(outer[i][1], outer[i][0]);
            shape.lineTo(pt.x, -pt.z);
          }
          const shapeGeo = new THREE.ShapeGeometry(shape);
          shapeGeo.rotateX(-Math.PI / 2);

          const sPos = shapeGeo.attributes.position;
          for (let i = 0; i < sPos.count; i++) {
            sPos.setY(i, getTerrainHeight(sPos.getX(i), sPos.getZ(i)) + 0.05);
          }
          sPos.needsUpdate = true;
          shapeGeo.computeVertexNormals();

          const interiorMesh = new THREE.Mesh(shapeGeo, fairwayInteriorMat);
          interiorMesh.receiveShadow = true;
          holeFairwayContainer.add(interiorMesh);

          // 2. 30-Centimeter 3D Glass Boundary Ribbon along the entire perimeter
          const pts2d = outer.map(c => geoToWorld(c[1], c[0]));
          const numPts = pts2d.length;
          const ribbonWidth = 0.30; // Exactly 30 centimeters (0.3m)!
          const halfW = ribbonWidth / 2;

          const borderPositions = [];
          const borderIndices = [];

          // Generate vertices on both inner and outer edge of the 30cm boundary
          for (let i = 0; i < numPts; i++) {
            const pPrev = pts2d[(i - 1 + numPts) % numPts];
            const pCur = pts2d[i];
            const pNext = pts2d[(i + 1) % numPts];

            const tan1 = new THREE.Vector2(pCur.x - pPrev.x, pCur.z - pPrev.z).normalize();
            const tan2 = new THREE.Vector2(pNext.x - pCur.x, pNext.z - pCur.z).normalize();
            let tanAvg = new THREE.Vector2().addVectors(tan1, tan2).normalize();
            if (tanAvg.lengthSq() < 0.001) tanAvg.set(1, 0);

            // Perpendicular normal across boundary line
            const norm = new THREE.Vector2(-tanAvg.y, tanAvg.x);

            const pInner = { x: pCur.x - norm.x * halfW, z: pCur.z - norm.y * halfW };
            const pOuter = { x: pCur.x + norm.x * halfW, z: pCur.z + norm.y * halfW };

            const yInner = getTerrainHeight(pInner.x, pInner.z) + 0.12;
            const yOuter = getTerrainHeight(pOuter.x, pOuter.z) + 0.12;

            borderPositions.push(pInner.x, yInner, pInner.z);
            borderPositions.push(pOuter.x, yOuter, pOuter.z);

            const nextI = (i + 1) % numPts;
            const bCur = i * 2;
            const bNext = nextI * 2;

            borderIndices.push(bCur, bCur + 1, bNext);
            borderIndices.push(bCur + 1, bNext + 1, bNext);
          }

          const borderGeo = new THREE.BufferGeometry();
          borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
          borderGeo.setIndex(borderIndices);
          borderGeo.computeVertexNormals();

          const borderMesh = new THREE.Mesh(borderGeo, glassBorderMat);
          borderMesh.receiveShadow = true;
          holeFairwayContainer.add(borderMesh);

          fairwayGroup.add(holeFairwayContainer);
          fairwayMeshes.push(holeFairwayContainer);
          fairwayPolygons.push({ name: f.name, hole: holeNum, pts: pts2d });
        }
      }
    });

    // Holes and Pins
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    const holePins3D = {};
    const teeBoxes3D = {};
    const allCourseMarkers = [];

    function createMarker(type, name, pos, holeNum) {
      const group = new THREE.Group();
      group.position.copy(pos);
      group.userData = { hole: holeNum, isTee: (type === 'Tee'), name: name };

      if (type === 'Tee') {
        // EXACT SPECIFICATIONS:
        // 1. Square 2.0m x 2.0m
        // 2. Height: exactly 15cm (0.15m) above ground
        // 3. Color: natural slightly darker earth tone (#aba08f)
        // 4. ZERO blue balls, ZERO flags (completely clean platform)
        const teeHeight = 0.15; // 15 centimeters (0.15m)
        const teeBoxGeom = new THREE.BoxGeometry(2.0, teeHeight, 2.0);
        teeBoxGeom.translate(0, teeHeight / 2, 0);

        const teeDirtMat = new THREE.MeshStandardMaterial({
          color: 0xaba08f,
          roughness: 0.90,
          metalness: 0.02
        });
        const teePlatform = new THREE.Mesh(teeBoxGeom, teeDirtMat);
        teePlatform.castShadow = true;
        teePlatform.receiveShadow = true;
        group.add(teePlatform);

        // Clean natural bevel curb
        const teeBorderGeom = new THREE.BoxGeometry(2.03, teeHeight, 2.03);
        teeBorderGeom.translate(0, (teeHeight / 2) - 0.005, 0);
        const teeBorderMat = new THREE.MeshStandardMaterial({
          color: 0x968c7b,
          roughness: 0.92,
          metalness: 0.02
        });
        const teeBorder = new THREE.Mesh(teeBorderGeom, teeBorderMat);
        group.add(teeBorder);
      } else {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 2.8, 16).translate(0, 1.22, 0),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.85, roughness: 0.15 })
        );
        pole.castShadow = true;
        group.add(pole);

        const flag = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 0.45, 0.02).translate(0.38, 2.35, 0),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, emissive: 0xef4444, emissiveIntensity: 0.4 })
        );
        flag.castShadow = true;
        group.add(flag);

        // REALISTIC 3D REGULATION HOLE CUP (Exact match to IMG_9084.jpeg)
        const CUP_RADIUS = 0.12; // 24cm diameter cup hole (proportional to 8cm ball)
        const CUP_DEPTH = 0.18;  // 18cm deep into the ground

        // 1. Dark outer soil lip (recalls the freshly cut grass/soil rim of the hole)
        const outerSoilRim = new THREE.Mesh(
          new THREE.RingGeometry(CUP_RADIUS, CUP_RADIUS + 0.04, 32).rotateX(-Math.PI / 2).translate(0, 0.005, 0),
          new THREE.MeshStandardMaterial({
            color: 0x2d1f14, // Dark damp soil cut edge
            roughness: 0.95
          })
        );
        group.add(outerSoilRim);

        // 2. Interior Cup Liner Wall (Cylinder descending down into the ground)
        const cupWallGeo = new THREE.CylinderGeometry(CUP_RADIUS, CUP_RADIUS, CUP_DEPTH, 32, 1, true);
        cupWallGeo.translate(0, -CUP_DEPTH / 2, 0); // Drop below ground level!
        const cupWallMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc, // Regulation bright white cup cylinder liner
          roughness: 0.35,
          metalness: 0.05,
          side: THREE.BackSide // Visible from inside the hole
        });
        const cupWall = new THREE.Mesh(cupWallGeo, cupWallMat);
        group.add(cupWall);

        // 3. Dark shadowed upper bevel of the soil hole (before the white liner begins)
        const soilWallGeo = new THREE.CylinderGeometry(CUP_RADIUS + 0.005, CUP_RADIUS, 0.04, 32, 1, true);
        soilWallGeo.translate(0, -0.02, 0);
        const soilWallMat = new THREE.MeshStandardMaterial({
          color: 0x1f140a,
          roughness: 0.98,
          side: THREE.BackSide
        });
        const soilWall = new THREE.Mesh(soilWallGeo, soilWallMat);
        group.add(soilWall);

        // 4. White Cup Floor (Bottom plate of the hole)
        const cupFloorGeo = new THREE.CircleGeometry(CUP_RADIUS, 32).rotateX(-Math.PI / 2);
        cupFloorGeo.translate(0, -CUP_DEPTH, 0); // At bottom of cup
        const cupFloorMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0, // White baseplate with drainage ferrule
          roughness: 0.4
        });
        const cupFloor = new THREE.Mesh(cupFloorGeo, cupFloorMat);
        group.add(cupFloor);

        // 5. Center Flagstick Ferrule (Socket where the pole anchors at the bottom of the cup)
        const ferrule = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.04, 16).translate(0, -CUP_DEPTH + 0.02, 0),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 })
        );
        group.add(ferrule);
      }
group.name = name;
      return group;
    }

    golfFeatures.forEach(f => {
      if (f.type === 'Point') {
        const pt = geoToWorld(f.coordinates[1], f.coordinates[0]);
        const y = getTerrainHeight(pt.x, pt.z);
        const pos = new THREE.Vector3(pt.x, y, pt.z);

        const isTee = f.name.toLowerCase().startsWith('t.') || f.name.toLowerCase().startsWith('tee');
        const matchTee = f.name.match(/T\.?\s*(\d+)/i);
        const matchHole = f.name.match(/Hole\s*(\d+)/i);
        const holeNum = matchTee ? parseInt(matchTee[1]) : (matchHole ? parseInt(matchHole[1]) : 1);

        const marker = createMarker(isTee ? 'Tee' : 'Hole', f.name, pos, holeNum);
        pinGroup.add(marker);
        allCourseMarkers.push(marker);

        if (isTee) {
          if (matchTee) teeBoxes3D[parseInt(matchTee[1])] = pos;
        } else {
          if (matchHole) holePins3D[parseInt(matchHole[1])] = pos;
        }
      }
    });

        // =========================================================================
    // AUTHENTIC MIS GOLF "BROWNS" (OFF-CENTER CIRCULAR OILED SAND GREENS)
    // =========================================================================
    // In historical Masjed Soleyman, each green is a distinct circle of very fine
    // reddish-brown sand saturated with crude oil ("Browns").
    // Crucially: THE HOLE/CUP IS OFF-CENTER inside the circular green!
    const brownsGroup = new THREE.Group();
    scene.add(brownsGroup);

    const brownTex = texLoader.load(window.MIS_OILED_SAND_TEX);
    brownTex.wrapS = THREE.RepeatWrapping;
    brownTex.wrapT = THREE.RepeatWrapping;
    brownTex.repeat.set(4, 4); // Repeated for ultra-fine sand grain detail

    const brownMat = new THREE.MeshStandardMaterial({
      map: brownTex,
      color: 0x8a4430, // Authentic reddish-brown oiled sand disc
      roughness: 0.88,
      metalness: 0.05,
      side: THREE.DoubleSide, // 100% visible from all camera angles & hills
      polygonOffset: true,
      polygonOffsetFactor: -3.0,
      polygonOffsetUnits: -3.0,
      depthTest: true,
      depthWrite: true
    });


    const brownMeshes = {};
    const brownCenters3D = {};

    // Generate authentic circular reddish-brown oiled sand disc with OFF-CENTER cup for every hole
    for (let hNum = 1; hNum <= 18; hNum++) {
      const pinPos = holePins3D[hNum];
      const teePos = teeBoxes3D[hNum];

      if (pinPos) {
        // Approach direction vector from tee to pin
        let approachDir = new THREE.Vector3(0, 0, 1);
        if (teePos) {
          approachDir.subVectors(pinPos, teePos).normalize();
        }

        // Perpendicular vector across fairway
        const sideDir = new THREE.Vector3(-approachDir.z, 0, approachDir.x).normalize();

        // Authentic Off-Center placement:
        // The green is a 22m diameter circle (radius 11m), and the pin is offset
        // by 3.5m to 4.5m from the green center in different quadrants per hole!
        const offsetAngle = (hNum * 1.35); // Varies realistically per hole
        const offsetDist = 3.6; // 3.6 meters away from the center of the green
        const offX = Math.cos(offsetAngle) * offsetDist;
        const offZ = Math.sin(offsetAngle) * offsetDist;

        // The center of the circular green:
        const greenCenterX = pinPos.x - offX;
        const greenCenterZ = pinPos.z - offZ;
        brownCenters3D[hNum] = new THREE.Vector3(greenCenterX, getTerrainHeight(greenCenterX, greenCenterZ), greenCenterZ);

        const greenRadius = 11.0; // 22-meter full circular diameter
        const segments = 64;
        const rings = 16;

        const discGeo = new THREE.BufferGeometry();
        const positions = [];
        const uvs = [];
        const indices = [];

        // Center vertex (Elevated cleanly above the underlying terrain mesh)
        const GREEN_ELEVATION = 0.28; // Elevated 28cm cleanly above ground to eliminate terrain cutting
        const centerY = getTerrainHeight(greenCenterX, greenCenterZ) + GREEN_ELEVATION;
        positions.push(greenCenterX, centerY, greenCenterZ);
        uvs.push(0.5, 0.5);

        // Concentric vertex rings conforming cleanly to terrain
        for (let r = 1; r <= rings; r++) {
          const curR = (r / rings) * greenRadius;
          for (let s = 0; s < segments; s++) {
            const theta = (s / segments) * Math.PI * 2;
            const vx = greenCenterX + Math.cos(theta) * curR;
            const vz = greenCenterZ + Math.sin(theta) * curR;
            const vy = getTerrainHeight(vx, vz) + GREEN_ELEVATION;

            positions.push(vx, vy, vz);
            uvs.push(0.5 + 0.5 * Math.cos(theta) * (r / rings), 0.5 + 0.5 * Math.sin(theta) * (r / rings));
          }
        }

        // Triangles for first ring
        for (let s = 0; s < segments; s++) {
          const nextS = (s + 1) % segments;
          indices.push(0, 1 + s, 1 + nextS);
        }

        // Triangles for outer rings
        for (let r = 1; r < rings; r++) {
          const baseCur = 1 + (r - 1) * segments;
          const baseNext = 1 + r * segments;
          for (let s = 0; s < segments; s++) {
            const nextS = (s + 1) % segments;
            const c0 = baseCur + s;
            const c1 = baseCur + nextS;
            const n0 = baseNext + s;
            const n1 = baseNext + nextS;

            indices.push(c0, n0, c1);
            indices.push(c1, n0, n1);
          }
        }

        discGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        discGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        discGeo.setIndex(indices);
        discGeo.computeVertexNormals();

        // Single, clean, continuous circular brown disc (Zero overlapping layers!)
        const discMesh = new THREE.Mesh(discGeo, brownMat);
        discMesh.receiveShadow = true;
        discMesh.castShadow = false;
        discMesh.renderOrder = 200;
        discMesh.userData.hole = hNum;

        brownsGroup.add(discMesh);
        brownMeshes[hNum] = discMesh;
      }
    }

    // =========================================================================
    // REALISTIC WIDE ASPHALT ROADS & HIGHWAYS (ACCORDING TO TODAY'S SATELLITE IMAGERY)
    // =========================================================================
    const roadsGroup = new THREE.Group();
    scene.add(roadsGroup);

    const asphaltTex = texLoader.load(window.MIS_ASPHALT_TEX);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0x3f4247, // True modern weathered asphalt tarmac
      roughness: 0.92,
      metalness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const realRoadsData = window.MIS_ROADS || [];
    realRoadsData.forEach(road => {
      const coords = road.coords;
      const roadWidth = road.width || 13.0; // Wide 13m - 14m road
      if (!coords || coords.length < 2) return;

      const pts = coords.map(c => geoToWorld(c[1], c[0]));
      const roadPositions = [];
      const roadUvs = [];
      const roadIndices = [];

      let runningDist = 0;
      for (let i = 0; i < pts.length; i++) {
        let tan = new THREE.Vector2(1, 0);
        if (i < pts.length - 1) {
          tan.set(pts[i+1].x - pts[i].x, pts[i+1].z - pts[i].z);
        } else {
          tan.set(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
        }
        tan.normalize();

        const norm = new THREE.Vector2(-tan.y, tan.x); // Perpendicular across road
        const pL = { x: pts[i].x - norm.x * (roadWidth / 2), z: pts[i].z - norm.y * (roadWidth / 2) };
        const pR = { x: pts[i].x + norm.x * (roadWidth / 2), z: pts[i].z + norm.y * (roadWidth / 2) };

        const yL = getTerrainHeight(pL.x, pL.z) + 0.15;
        const yR = getTerrainHeight(pR.x, pR.z) + 0.15;

        roadPositions.push(pL.x, yL, pL.z);
        roadPositions.push(pR.x, yR, pR.z);

        if (i > 0) {
          const segDist = Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
          runningDist += segDist;
        }

        roadUvs.push(0, runningDist / 12.0);
        roadUvs.push(1, runningDist / 12.0);

        if (i < pts.length - 1) {
          const base = i * 2;
          roadIndices.push(base, base + 1, base + 2);
          roadIndices.push(base + 1, base + 3, base + 2);
        }
      }

      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
      roadGeo.setIndex(roadIndices);
      roadGeo.computeVertexNormals();

      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.receiveShadow = true;
      roadsGroup.add(roadMesh);
    });


    // =========================================================================
    // MAJESTIC 3D SKY TARGET ARROW (HOLOGRAPHIC FLOATING HOLE INDICATOR)
    // =========================================================================
    const skyBeaconGroup = new THREE.Group();
    scene.add(skyBeaconGroup);

    // Floating Arrow Container (Rotates and bobs gently above the cup)
    const skyArrowBobber = new THREE.Group();
    skyBeaconGroup.add(skyArrowBobber);

    // Arrow Head: Downward-pointing faceted cone
    const arrowConeGeo = new THREE.ConeGeometry(1.7, 3.4, 4); // Faceted diamond prism cone
    arrowConeGeo.rotateX(Math.PI); // Point downwards towards cup
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
      roughness: 0.15,
      metalness: 0.85
    });
    const arrowHeadMesh = new THREE.Mesh(arrowConeGeo, arrowMat);
    arrowHeadMesh.position.y = 14.5;
    arrowHeadMesh.castShadow = true;
    skyArrowBobber.add(arrowHeadMesh);

    // Arrow Shaft
    const arrowShaftGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.8, 16);
    arrowShaftGeo.translate(0, 1.4, 0);
    const arrowShaftMesh = new THREE.Mesh(arrowShaftGeo, arrowMat);
    arrowShaftMesh.position.y = 16.0;
    skyArrowBobber.add(arrowShaftMesh);

    // Golden Target Chevrons / Pulsing Halos around the arrow
    const chevronGeo = new THREE.TorusGeometry(2.6, 0.18, 12, 32).rotateX(Math.PI / 2);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const beaconHalo = new THREE.Mesh(chevronGeo, chevronMat);
    beaconHalo.position.y = 16.2;
    skyArrowBobber.add(beaconHalo);

    const outerRingGeo = new THREE.TorusGeometry(3.6, 0.12, 12, 32).rotateX(Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const beaconOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    beaconOuterRing.position.y = 16.2;
    skyArrowBobber.add(beaconOuterRing);

    // Fine Ethereal Ground Guideline (Soft, subtle laser connecting arrow tip to the pin)
    const pinLaserGeo = new THREE.CylinderGeometry(0.04, 0.04, 14.0, 8).translate(0, 7.0, 0);
    const pinLaserMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const pinLaser = new THREE.Mesh(pinLaserGeo, pinLaserMat);
    skyBeaconGroup.add(pinLaser);

    function updateHoleVisualIsolation(hNum) {
      fairwayMeshes.forEach(fm => {
        fm.visible = (fm.userData.hole === hNum);
      });
      allCourseMarkers.forEach(m => {
        m.visible = (m.userData.hole === hNum);
      });
      if (typeof brownMeshes !== 'undefined') {
        Object.keys(brownMeshes).forEach(h => {
          brownMeshes[h].visible = (parseInt(h) === hNum);
        });
      }
      const pinPos = holePins3D[hNum];
      if (pinPos) {
        skyBeaconGroup.position.set(pinPos.x, pinPos.y, pinPos.z);
        skyBeaconGroup.visible = true;
      }
    }

    // Ball 3D Model with Realistic Dimple Texture Simulation
    // Regulation Realistic Pro Golf Ball (Realistic scale relative to 2m tee box)
    const BALL_RADIUS = 0.08;
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.05,
        emissive: 0x111111
      })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // Plastic Tee Peg (فقط روی تی‌باکس و زیر توپ قرار می‌گیرد)
    const teePegGroup = new THREE.Group();
    const teeStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.006, 0.08, 16).translate(0, 0.04, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 })
    );
    const teeCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.012, 0.015, 16).translate(0, 0.08, 0),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, metalness: 0.2 })
    );
    teePegGroup.add(teeStem);
    teePegGroup.add(teeCup);
    teePegGroup.castShadow = true;
    scene.add(teePegGroup);

    // Aim Line
    const aimLineGeo = new THREE.BufferGeometry();
    const aimLinePositions = new Float32Array(60 * 3);
    aimLineGeo.setAttribute('position', new THREE.BufferAttribute(aimLinePositions, 3));
    const aimLineMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 2, gapSize: 1, linewidth: 2 });
    const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
    aimLine.visible = false; // Hidden in favor of majestic 3D Sky Target Arrow!
    scene.add(aimLine);

    // Landing Ring
    const landingRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.2, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    landingRing.visible = false;
    scene.add(landingRing);

            // =========================================================================
    // NATIVE 3D PGA TOUR TOPTRACER ARC (FEATHERED EDGES + SWEET SPOT GLOW)
    // =========================================================================
    const maxRibbonPts = 1200;
    
    // Each sample point i has 5 vertices:
    // v0: Center glowing spine
    // v1: Left horizontal feathered wing (alpha 0)
    // v2: Right horizontal feathered wing (alpha 0)
    // v3: Bottom vertical feathered wing (alpha 0)
    // v4: Top vertical feathered wing (alpha 0)
    const tracerPositions = new Float32Array(maxRibbonPts * 5 * 3);
    const tracerColors = new Float32Array(maxRibbonPts * 5 * 4);
    const tracerIndices = [];

    for (let i = 0; i < maxRibbonPts - 1; i++) {
      const p = i * 5;
      const pNext = (i + 1) * 5;
      // 4 wings connecting v0-v1, v0-v2, v0-v3, v0-v4
      // Left Wing
      tracerIndices.push(p, p + 1, pNext);
      tracerIndices.push(p + 1, pNext + 1, pNext);
      // Right Wing
      tracerIndices.push(p, p + 2, pNext);
      tracerIndices.push(p + 2, pNext + 2, pNext);
      // Bottom Wing
      tracerIndices.push(p, p + 3, pNext);
      tracerIndices.push(p + 3, pNext + 3, pNext);
      // Top Wing
      tracerIndices.push(p, p + 4, pNext);
      tracerIndices.push(p + 4, pNext + 4, pNext);
    }

    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPositions, 3));
    tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerColors, 4));
    tracerGeo.setIndex(tracerIndices);
    tracerGeo.setDrawRange(0, 0);

    const tracerMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    // Keep this flight overlay's original pre-redesign color output.
    // The rest of the course continues to use the new sRGB rendering pipeline.
    function legacyTracerColorOutput(shader) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <encodings_fragment>', '');
    }
    tracerMat.onBeforeCompile = legacyTracerColorOutput;
    const toptracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
    toptracerMesh.renderOrder = 9998;
    toptracerMesh.frustumCulled = false;
    scene.add(toptracerMesh);

    // Ground Shadow Ribbon (3 vertices per point: left wing alpha 0, center alpha 0.65, right wing alpha 0)
    const shadowPositions = new Float32Array(maxRibbonPts * 3 * 3);
    const shadowColors = new Float32Array(maxRibbonPts * 3 * 4);
    const shadowIndices = [];
    for (let i = 0; i < maxRibbonPts - 1; i++) {
      const p = i * 3;
      const pNext = (i + 1) * 3;
      // Left half
      shadowIndices.push(p, p + 1, pNext);
      shadowIndices.push(p + 1, pNext + 1, pNext);
      // Right half
      shadowIndices.push(p + 1, p + 2, pNext + 1);
      shadowIndices.push(p + 2, pNext + 2, pNext + 1);
    }

    const shadowGeo = new THREE.BufferGeometry();
    shadowGeo.setAttribute('position', new THREE.BufferAttribute(shadowPositions, 3));
    shadowGeo.setAttribute('color', new THREE.BufferAttribute(shadowColors, 4));
    shadowGeo.setIndex(shadowIndices);
    shadowGeo.setDrawRange(0, 0);

    const shadowMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    shadowMat.onBeforeCompile = legacyTracerColorOutput;
    const shadowRibbon = new THREE.Mesh(shadowGeo, shadowMat);
    shadowRibbon.renderOrder = 9995;
    shadowRibbon.frustumCulled = false;
    scene.add(shadowRibbon);

    let ribbonHistory = [];

    function resetToptracer() {
      ribbonHistory = [];
      tracerGeo.setDrawRange(0, 0);
      shadowGeo.setDrawRange(0, 0);
      const tag = document.getElementById('toptracer-yardage-tag');
      if (tag) tag.style.display = 'none';
    }

    function updateToptracerRibbon(currentPt) {
      if (!currentPt) return;
      
      if (ribbonHistory.length > 0) {
        const lastPt = ribbonHistory[ribbonHistory.length - 1];
        if (lastPt.distanceTo(currentPt) < 0.12) return;
      }
      
      if (ribbonHistory.length >= maxRibbonPts) return;
      ribbonHistory.push(currentPt.clone());
      const n = ribbonHistory.length;
      if (n < 2) return;

      const posAttr = tracerGeo.attributes.position;
      const colAttr = tracerGeo.attributes.color;
      const shadowPosAttr = shadowGeo.attributes.position;
      const shadowColAttr = shadowGeo.attributes.color;

      const baseR = 0.54;
      const baseShadowW = 0.62;
      const up = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i < n; i++) {
        const pt = ribbonHistory[i];
        let tan = new THREE.Vector3(1, 0, 0);
        if (i < n - 1) tan.subVectors(ribbonHistory[i + 1], pt);
        else tan.subVectors(pt, ribbonHistory[i - 1]);
        if (tan.lengthSq() < 0.0001) tan.set(0, 0, 1);
        else tan.normalize();

        const tProgress = i / Math.max(1, n - 1);
        const radius = baseR * (1.15 - 0.45 * tProgress);
        const shadowW = baseShadowW * (1.1 - 0.4 * tProgress);

        let side1 = new THREE.Vector3().crossVectors(tan, up).normalize();
        if (side1.lengthSq() < 0.001) side1.set(1, 0, 0);

        let side2 = new THREE.Vector3().crossVectors(tan, side1).normalize();

        const vIdx = i * 5;

        // v0: Center glowing spine
        posAttr.setXYZ(vIdx, pt.x, pt.y, pt.z);
        // v1: Left horizontal feathered wing
        posAttr.setXYZ(vIdx + 1, pt.x - side1.x * radius, pt.y - side1.y * radius, pt.z - side1.z * radius);
        // v2: Right horizontal feathered wing
        posAttr.setXYZ(vIdx + 2, pt.x + side1.x * radius, pt.y + side1.y * radius, pt.z + side1.z * radius);
        // v3: Bottom vertical feathered wing (visible from behind)
        posAttr.setXYZ(vIdx + 3, pt.x - side2.x * radius, pt.y - side2.y * radius, pt.z - side2.z * radius);
        // v4: Top vertical feathered wing (visible from behind)
        posAttr.setXYZ(vIdx + 4, pt.x + side2.x * radius, pt.y + side2.y * radius, pt.z + side2.z * radius);

        // Alpha fade-in near launch tee
        const teeAlpha = Math.min(1.0, (i + 1) / 5.0);

        // Center spine: Solid vivid red with glowing white core
        colAttr.setXYZW(vIdx, 1.0, 0.28, 0.38, 0.98 * teeAlpha);
        // Feathered wings: Soft fade to 0 alpha at outer edges
        colAttr.setXYZW(vIdx + 1, 0.94, 0.12, 0.22, 0.0);
        colAttr.setXYZW(vIdx + 2, 0.94, 0.12, 0.22, 0.0);
        colAttr.setXYZW(vIdx + 3, 0.94, 0.12, 0.22, 0.0);
        colAttr.setXYZW(vIdx + 4, 0.94, 0.12, 0.22, 0.0);

        // Ground-Projected Shadow (Soft feathered shadow)
        const gH = getTerrainHeight(pt.x, pt.z) + 0.38;
        const sIdx = i * 3;
        // s0: Left shadow edge (alpha 0)
        shadowPosAttr.setXYZ(sIdx, pt.x - side1.x * shadowW, gH, pt.z - side1.z * shadowW);
        shadowColAttr.setXYZW(sIdx, 0.05, 0.08, 0.12, 0.0);
        // s1: Center shadow spine (alpha 0.68)
        shadowPosAttr.setXYZ(sIdx + 1, pt.x, gH, pt.z);
        shadowColAttr.setXYZW(sIdx + 1, 0.05, 0.08, 0.12, 0.68 * teeAlpha);
        // s2: Right shadow edge (alpha 0)
        shadowPosAttr.setXYZ(sIdx + 2, pt.x + side1.x * shadowW, gH, pt.z + side1.z * shadowW);
        shadowColAttr.setXYZW(sIdx + 2, 0.05, 0.08, 0.12, 0.0);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      shadowPosAttr.needsUpdate = true;
      shadowColAttr.needsUpdate = true;

      const tracerIndexCount = (n - 1) * 24;
      tracerGeo.setDrawRange(0, tracerIndexCount);

      const shadowIndexCount = (n - 1) * 12;
      shadowGeo.setDrawRange(0, shadowIndexCount);

      updateToptracerYardageTag(currentPt);
    }

    function updateToptracerYardageTag(currentPt) {
      const tag = document.getElementById('toptracer-yardage-tag');
      if (!tag) return;

      const distM = new THREE.Vector2(currentPt.x - shotStartPos.x, currentPt.z - shotStartPos.z).length();
      const yards = Math.round(distM * 1.09361);

      // Project the tip with the current camera matrices, not the last frame.
      camera.updateMatrixWorld(true);
      const screenPos = currentPt.clone().project(camera);
      if (screenPos.z > -1 && screenPos.z < 1) {
        const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
        tag.style.left = `${sx}px`;
        tag.style.top = `${sy}px`;
        tag.innerHTML = `<span class="tracer-label">YDS</span><span class="tracer-val">${yards}</span>`;
        tag.style.display = 'flex';
      } else {
        tag.style.display = 'none';
      }
    }

    // Ballistics tracking & Dynamic Broadcast Camera
    let isBallFlying = false;
    let ballPos = new THREE.Vector3();
    let ballVel = new THREE.Vector3();
    let shotStartPos = new THREE.Vector3();
    let firstImpactPos = new THREE.Vector3();
    let hasImpacted = false;
    let isBallGrounded = false;
    let flightElapsedTime = 0;
    let ballRestTimer = 0;
    let isBallSettled = false;
    let isCameraTransitioning = false;
    
    // ========================================================
    // HYPER-REALISTIC PARTICLE & SENSORY FX ENGINE
    // ========================================================
    const impactParticleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(impactParticleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < impactParticleCount; i++) {
      particlePositions[i * 3 + 0] = 0;
      particlePositions[i * 3 + 1] = -1000;
      particlePositions[i * 3 + 2] = 0;
      particleVelocities.push(new THREE.Vector3());
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xc4a482,
      size: 0.18,
      transparent: true,
      opacity: 0.85
    });

    const impactParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(impactParticles);

    function spawnImpactParticles(pos, isGrass) {
      particleMat.color.setHex(isGrass ? 0x65a30d : 0xc4a482);
      const pAttr = particleGeo.attributes.position;
      for (let i = 0; i < impactParticleCount; i++) {
        pAttr.setXYZ(i, pos.x, pos.y + 0.05, pos.z);
        const theta = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 2.5;
        particleVelocities[i].set(
          Math.cos(theta) * speed,
          1.2 + Math.random() * 2.2,
          Math.sin(theta) * speed
        );
      }
      pAttr.needsUpdate = true;
    }

    function updateImpactParticles(dt) {
      const pAttr = particleGeo.attributes.position;
      let hasAlive = false;
      for (let i = 0; i < impactParticleCount; i++) {
        const py = pAttr.getY(i);
        if (py > -500) {
          hasAlive = true;
          particleVelocities[i].y -= 9.81 * dt * 0.8;
          const px = pAttr.getX(i) + particleVelocities[i].x * dt;
          const ny = py + particleVelocities[i].y * dt;
          const pz = pAttr.getZ(i) + particleVelocities[i].z * dt;

          const ground = getTerrainHeight(px, pz);
          if (ny <= ground) {
            pAttr.setXYZ(i, 0, -1000, 0);
          } else {
            pAttr.setXYZ(i, px, ny, pz);
          }
        }
      }
      if (hasAlive) pAttr.needsUpdate = true;
    }

    let screenShakeTimer = 0;
    function triggerScreenShake(intensity) {
      screenShakeTimer = intensity || 0.12;
    }

    // ========================================================
    // 3D ANIMATED PRO GOLFER (AUTHENTIC TOURNAMENT CHARACTER & SWING RIG)
    // ========================================================
    const golferGroup = new THREE.Group();
    golferGroup.castShadow = true;
    scene.add(golferGroup);

    // ========================================================
    // GENUINE 3D PRO GOLFER MESH & KINEMATICS SYSTEM (.GLB)
    // ========================================================
    const proGolferContainer = new THREE.Group();
    golferGroup.add(proGolferContainer);

    let proGolferModel = null;
    let proGolferTorso = null;
    let proGolferClub = null;
    let proGolferCap = null;
    let proGolferLoaded = false;

    // Load authentic 3D GLTF (.glb) model
    if (typeof THREE.GLTFLoader === 'function') {
      const gltfLoader = new THREE.GLTFLoader();
      gltfLoader.load('pro_golfer_character.glb', (gltf) => {
        if (gltf && gltf.scene) {
          proGolferModel = gltf.scene;
          console.log('✅ Genuine 3D Pro Golfer GLB Model loaded successfully!');
          
          proGolferModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.45;
                child.material.needsUpdate = true;
              }
            }
          });

          // Scale & orient to true tournament proportions
          proGolferModel.scale.set(1.0, 1.0, 1.0);
          proGolferContainer.add(proGolferModel);
          proGolferLoaded = true;
          if (golferSwingPhase === 'idle') positionGolferAtBall();

          // Hide fallback procedural mannequin once authentic GLB is loaded
          golferHips.visible = false;
        }
      }, undefined, (err) => {
        console.warn('Note on loading pro_golfer_character.glb:', err);
        // Fallback procedural rig visible if glb fails
        golferHips.visible = true;
      });
    } else {
      console.warn('THREE.GLTFLoader not available, using procedural 3D athlete rig');
      golferHips.visible = true;
    }

    // Dynamic Swing State Machine
    let golferSwingPhase = 'idle'; // 'idle', 'address', 'backswing', 'downswing', 'followthrough', 'fade'
    let golferSwingProgress = 0.0;
    let golferImpactCallback = null;
    let activeSwingStyle = 'full'; // 'full', 'three-quarter', 'half', 'chip', 'putt'
    let activeSwingConfig = null;

    // Distinct kinematic swing profiles for each shot type:
    // Full, 3/4 Swing, Half Swing, Chip, and Putt
    const SWING_PROFILES = {
      'full': {
        name: 'Full Swing',
        backSpeed: 2.3,
        downSpeed: 7.8,
        followSpeed: 3.2,
        backTorsoY: -0.92,
        backTorsoX: 0.12,
        backArmsZ: -1.55,
        backArmsX: 0.42,
        backClubZ: -1.05,
        impactTorsoY: 0.12,
        impactArmsZ: 0.08,
        impactClubZ: 0.04,
        followTorsoY: 1.15,
        followTorsoX: -0.15,
        followArmsZ: 1.62,
        followArmsX: -0.35,
        followClubZ: 1.15,
        weightShiftLead: 0.08
      },
      'three-quarter': {
        name: '3/4 Swing',
        backSpeed: 2.6,
        downSpeed: 8.2,
        followSpeed: 3.6,
        backTorsoY: -0.70,
        backTorsoX: 0.09,
        backArmsZ: -1.22,
        backArmsX: 0.32,
        backClubZ: -0.80,
        impactTorsoY: 0.10,
        impactArmsZ: 0.06,
        impactClubZ: 0.03,
        followTorsoY: 0.88,
        followTorsoX: -0.10,
        followArmsZ: 1.25,
        followArmsX: -0.25,
        followClubZ: 0.85,
        weightShiftLead: 0.05
      },
      'half': {
        name: 'Half Swing',
        backSpeed: 3.0,
        downSpeed: 8.5,
        followSpeed: 4.0,
        backTorsoY: -0.48,
        backTorsoX: 0.06,
        backArmsZ: -0.82,
        backArmsX: 0.22,
        backClubZ: -0.52,
        impactTorsoY: 0.08,
        impactArmsZ: 0.04,
        impactClubZ: 0.02,
        followTorsoY: 0.58,
        followTorsoX: -0.06,
        followArmsZ: 0.85,
        followArmsX: -0.16,
        followClubZ: 0.55,
        weightShiftLead: 0.03
      },
      'chip': {
        name: 'Chip Shot',
        backSpeed: 3.6,
        downSpeed: 8.8,
        followSpeed: 4.8,
        backTorsoY: -0.22,
        backTorsoX: 0.03,
        backArmsZ: -0.42,
        backArmsX: 0.12,
        backClubZ: -0.28,
        impactTorsoY: 0.05,
        impactArmsZ: 0.02,
        impactClubZ: 0.01,
        followTorsoY: 0.28,
        followTorsoX: -0.04,
        followArmsZ: 0.44,
        followArmsX: -0.10,
        followClubZ: 0.30,
        weightShiftLead: 0.02
      },
      'punch': {
        name: 'Punch Shot',
        backSpeed: 2.8,
        downSpeed: 8.6,
        followSpeed: 4.2,
        backTorsoY: -0.62,
        backTorsoX: 0.08,
        backArmsZ: -1.05,
        backArmsX: 0.28,
        backClubZ: -0.70,
        impactTorsoY: 0.12,
        impactArmsZ: 0.08,
        impactClubZ: 0.04,
        followTorsoY: 0.55,
        followTorsoX: -0.08,
        followArmsZ: 0.80,
        followArmsX: -0.18,
        followClubZ: 0.50,
        weightShiftLead: 0.05
      },
      'putt': {
        name: 'Putting Stroke',
        backSpeed: 2.2,
        downSpeed: 4.8,
        followSpeed: 3.2,
        backTorsoY: -0.04,
        backTorsoX: 0.01,
        backArmsZ: -0.24,
        backArmsX: 0.02,
        backClubZ: -0.18,
        impactTorsoY: 0.00,
        impactArmsZ: 0.00,
        impactClubZ: 0.00,
        followTorsoY: 0.04,
        followTorsoX: -0.01,
        followArmsZ: 0.24,
        followArmsX: -0.02,
        followClubZ: 0.18,
        weightShiftLead: 0.00
      }
    };

    // Hierarchical Anatomical Rig Structure
    const golferHips = new THREE.Group();
    golferGroup.add(golferHips);

    const golferTorsoGroup = new THREE.Group();
    golferTorsoGroup.position.set(0, 0.88, 0);
    golferHips.add(golferTorsoGroup);

    const golferShoulderPivot = new THREE.Group();
    golferShoulderPivot.position.set(0, 0.44, 0);
    golferTorsoGroup.add(golferShoulderPivot);

    const clubRig = new THREE.Group();
    clubRig.position.set(0, -0.46, 0.16);
    golferShoulderPivot.add(clubRig);

    // High fidelity materials matching pro reference IMG_9091
    const matNavyPolo = new THREE.MeshStandardMaterial({ color: 0x1a2b48, roughness: 0.55, metalness: 0.05 });
    const matGreySlacks = new THREE.MeshStandardMaterial({ color: 0xdddfec, roughness: 0.60, metalness: 0.02 });
    const matPureWhite = new THREE.MeshStandardMaterial({ color: 0xfcfcfc, roughness: 0.35, metalness: 0.05 });
    const matLeatherBlack = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.35, metalness: 0.15 });
    const matSkinToned = new THREE.MeshStandardMaterial({ color: 0xf1c6a7, roughness: 0.65, metalness: 0.02 });
    const matClubTitanium = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.25, metalness: 0.85 });
    const matClubGraphite = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.20, metalness: 0.70 });

    // Procedural mannequin rig hidden - active photorealistic pro character displayed
    golferHips.visible = false;

    // Lower Body
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.065, 0.86, 16).translate(-0.16, 0.43, 0), matGreySlacks);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.065, 0.86, 16).translate(0.16, 0.43, 0), matGreySlacks);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.24).translate(-0.16, 0.04, 0.06), matLeatherBlack);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.24).translate(0.16, 0.04, 0.06), matLeatherBlack);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.17, 0.06, 18).translate(0, 0.85, 0), matLeatherBlack);
    golferHips.add(legL); golferHips.add(legR); golferHips.add(shoeL); golferHips.add(shoeR); golferHips.add(belt);

    // Torso, Polo & Collar
    const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.165, 0.52, 18).translate(0, 0.26, 0), matNavyPolo);
    const collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 12, 24).translate(0, 0.51, 0), matNavyPolo);
    collarMesh.rotation.x = Math.PI / 2;
    golferTorsoGroup.add(torsoMesh);
    golferTorsoGroup.add(collarMesh);

    // Head, Tour Cap & Bill
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 24).translate(0, 0.62, 0.01), matSkinToned);
    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 16).translate(0, 0.655, 0.00), matPureWhite);
    capCrown.scale.set(1.02, 0.62, 1.08);
    const capVisor = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.008, 24).translate(0, 0.640, 0.11), matPureWhite);
    capVisor.scale.set(1.05, 1.0, 0.55);
    capVisor.rotation.x = -0.22;
    golferTorsoGroup.add(headMesh);
    golferTorsoGroup.add(capCrown);
    golferTorsoGroup.add(capVisor);

    // Arms & Hands (Right hand bare skin, Left hand white tour glove)
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.040, 0.46, 14).translate(-0.13, -0.23, 0.08), matNavyPolo);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.040, 0.46, 14).translate(0.13, -0.23, 0.08), matNavyPolo);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 14).translate(-0.02, -0.45, 0.15), matPureWhite); // White glove
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.040, 14, 14).translate(0.02, -0.47, 0.15), matSkinToned); // Bare skin
    armL.rotation.x = 0.38; armR.rotation.x = 0.38;
    golferShoulderPivot.add(armL); golferShoulderPivot.add(armR);
    golferShoulderPivot.add(handL); golferShoulderPivot.add(handR);

    // Golf Club Rig (Shaft, Grip & Aerodynamic Head)
    const clubGripMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.24, 12).translate(0, -0.12, 0), matLeatherBlack);
    const clubShaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.007, 0.72, 12).translate(0, -0.58, 0), matClubGraphite);
    const clubHeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.075).translate(0, -0.93, 0.02), matClubTitanium);
    clubRig.add(clubGripMesh); clubRig.add(clubShaftMesh); clubRig.add(clubHeadMesh);

    function positionGolferAtBall() {
      if (!ballPos) return;
      const pinPos = holePins3D[currentHoleNumber] || new THREE.Vector3(ballPos.x + 100, 0, ballPos.z - 100);
      const dirToPin = new THREE.Vector3(pinPos.x - ballPos.x, 0, pinPos.z - ballPos.z);
      if (dirToPin.lengthSq() < 1e-8) dirToPin.set(0, 0, 1);
      dirToPin.normalize();

      // Golfer stands to the left/side of the ball relative to target line
      const sideVec = new THREE.Vector3(-dirToPin.z, 0, dirToPin.x).normalize();
      
      // Club-specific stance distance: Driver = 0.65m, Irons = 0.56m, Putter = 0.46m
      const club = GOLF_BAG[currentClubIndex] || {};
      let standOffset = 0.58;
      if (club.isPutter) standOffset = 0.46;
      else if (currentClubIndex === 0) standOffset = 0.65;
      else if (currentSwingMode === 'chip') standOffset = 0.50;

      const groundAtStance = getTerrainHeight(ballPos.x + sideVec.x * standOffset, ballPos.z + sideVec.z * standOffset);
      
      golferGroup.position.set(
        ballPos.x + sideVec.x * standOffset,
        groundAtStance,
        ballPos.z + sideVec.z * standOffset
      );

      const angle = Math.atan2(dirToPin.x, dirToPin.z);
      // Asset front is local +Z (verified from cap visor / club-head nodes).
      // The body must face the BALL, not the target or the stance offset.
      // With this yaw, local +Z equals -sideVec and local -X is the lead side.
      golferGroup.rotation.y = angle + Math.PI / 2;
      
      // Reset address posture
      resetGolferPosture();
      golferGroup.visible = true;
      golferSwingPhase = 'idle';
      golferSwingProgress = 0;
    }

    function resetGolferPosture() {
      golferHips.position.set(0, 0, 0);
      golferHips.rotation.set(0, 0, 0);
      if (proGolferLoaded && proGolferModel) {
        proGolferContainer.position.set(0, 0, 0);
        proGolferContainer.rotation.set(0, 0, 0);
        proGolferContainer.scale.set(1, 1, 1);
      }
      
      const club = GOLF_BAG[currentClubIndex] || {};
      if (club.isPutter || currentSwingMode === 'putt') {
        // Upright, square putting address stance
        golferTorsoGroup.rotation.set(0.32, 0, 0);
        golferShoulderPivot.rotation.set(-0.35, 0, 0);
        clubRig.rotation.set(0, 0, 0);
      } else if (currentSwingMode === 'chip') {
        // Open stance with hands forward
        golferTorsoGroup.rotation.set(0.24, 0.05, 0);
        golferShoulderPivot.rotation.set(-0.28, 0, 0.05);
        clubRig.rotation.set(0, 0, -0.05);
      } else {
        // Dynamic athletic full/iron address stance
        golferTorsoGroup.rotation.set(0.20, 0, 0);
        golferShoulderPivot.rotation.set(-0.24, 0, 0);
        clubRig.rotation.set(0, 0, 0);
      }
    }

    function triggerGolferSwing(specs, onImpactCallback) {
      // Determine active swing profile based on specs or selected mode
      const club = GOLF_BAG[currentClubIndex] || {};
      if (club.isPutter || specs.isPutt) {
        activeSwingStyle = 'putt';
      } else {
        activeSwingStyle = currentSwingMode || 'full';
        if (!SWING_PROFILES[activeSwingStyle]) activeSwingStyle = 'full';
      }

      // Re-evaluate address after changing club/mode, before the stroke starts.
      positionGolferAtBall();
      activeSwingConfig = SWING_PROFILES[activeSwingStyle];
      golferSwingPhase = 'backswing';
      golferSwingProgress = 0.0;
      golferImpactCallback = onImpactCallback;
    }

    function updateGolferAnimation(dt) {
      if (!golferGroup.visible) return;

      const cfg = activeSwingConfig || SWING_PROFILES['full'];

      if (golferSwingPhase === 'idle') {
        const time = clock.getElapsedTime();
        // Subtle natural breathing and club waggle before shot
        if (currentSwingMode === 'putt' || (GOLF_BAG[currentClubIndex] && GOLF_BAG[currentClubIndex].isPutter)) {
          golferTorsoGroup.rotation.y = Math.sin(time * 1.5) * 0.015;
          clubRig.rotation.z = Math.sin(time * 2.0) * 0.012;
        } else {
          golferTorsoGroup.rotation.y = Math.sin(time * 2.0) * 0.035;
          clubRig.rotation.z = Math.sin(time * 3.2) * 0.028;
        }
      }
      else if (golferSwingPhase === 'backswing') {
        golferSwingProgress += dt * cfg.backSpeed;
        const p = Math.min(1.0, golferSwingProgress);
        // Smooth easing out at the top of the swing
        const ease = Math.sin((p * Math.PI) / 2);

        golferHips.position.x = -p * (cfg.weightShiftLead * 0.5); // Weight loads onto trail foot
        golferTorsoGroup.rotation.y = ease * cfg.backTorsoY;
        golferTorsoGroup.rotation.x = 0.20 + ease * cfg.backTorsoX;
        golferShoulderPivot.rotation.z = ease * cfg.backArmsZ;
        golferShoulderPivot.rotation.x = -0.24 + ease * cfg.backArmsX;
        clubRig.rotation.z = ease * cfg.backClubZ;

        if (proGolferLoaded && proGolferModel) {
          proGolferContainer.rotation.y = ease * (cfg.backTorsoY * 0.85);
          proGolferContainer.rotation.z = -ease * 0.08;
          proGolferContainer.position.x = -p * (cfg.weightShiftLead * 0.5);
        }

        if (golferSwingProgress >= 1.0) {
          golferSwingPhase = 'downswing';
          golferSwingProgress = 0.0;
        }
      }
      else if (golferSwingPhase === 'downswing') {
        golferSwingProgress += dt * cfg.downSpeed;
        const p = Math.min(1.0, golferSwingProgress);
        // Explosive power curve accelerating through impact
        const power = p * p;

        golferHips.position.x = -cfg.weightShiftLead * 0.5 + p * (cfg.weightShiftLead * 1.5); // Dynamic weight transfer to front side
        golferTorsoGroup.rotation.y = cfg.backTorsoY + power * (cfg.impactTorsoY - cfg.backTorsoY);
        golferTorsoGroup.rotation.x = (0.20 + cfg.backTorsoX) - power * cfg.backTorsoX;
        golferShoulderPivot.rotation.z = cfg.backArmsZ + power * (cfg.impactArmsZ - cfg.backArmsZ);
        golferShoulderPivot.rotation.x = (-0.24 + cfg.backArmsX) - power * cfg.backArmsX;
        clubRig.rotation.z = cfg.backClubZ + power * (cfg.impactClubZ - cfg.backClubZ);

        if (proGolferLoaded && proGolferModel) {
          proGolferContainer.rotation.y = (cfg.backTorsoY * 0.85) + power * (cfg.impactTorsoY - (cfg.backTorsoY * 0.85));
          proGolferContainer.rotation.z = -0.08 + power * 0.12;
          proGolferContainer.position.x = -cfg.weightShiftLead * 0.5 + p * (cfg.weightShiftLead * 1.5);
        }

        if (golferSwingProgress >= 1.0) {
          // IMPACT MOMENT! Ball launched at this millisecond!
          golferSwingPhase = 'followthrough';
          golferSwingProgress = 0.0;
          if (golferImpactCallback) {
            golferImpactCallback();
            golferImpactCallback = null;
          }
        }
      }
      else if (golferSwingPhase === 'followthrough') {
        golferSwingProgress += dt * cfg.followSpeed;
        const p = Math.min(1.0, golferSwingProgress);
        // Deceleration ease into final balanced pose
        const ease = 1 - Math.pow(1 - p, 2);

        golferHips.position.x = cfg.weightShiftLead; // Fully posted up on lead leg
        golferTorsoGroup.rotation.y = cfg.impactTorsoY + ease * (cfg.followTorsoY - cfg.impactTorsoY);
        golferTorsoGroup.rotation.x = 0.20 + ease * cfg.followTorsoX;
        golferShoulderPivot.rotation.z = cfg.impactArmsZ + ease * (cfg.followArmsZ - cfg.impactArmsZ);
        golferShoulderPivot.rotation.x = -0.24 + ease * cfg.followArmsX;
        clubRig.rotation.z = cfg.impactClubZ + ease * (cfg.followClubZ - cfg.impactClubZ);

        if (proGolferLoaded && proGolferModel) {
          proGolferContainer.rotation.y = cfg.impactTorsoY + ease * (cfg.followTorsoY * 0.85 - cfg.impactTorsoY);
          proGolferContainer.rotation.z = 0.04 + ease * 0.06;
          proGolferContainer.position.x = cfg.weightShiftLead;
        }

        if (golferSwingProgress >= 1.0) {
          golferSwingPhase = 'fade';
          golferSwingProgress = 0.0;
        }
      }
      else if (golferSwingPhase === 'fade') {
        golferSwingProgress += dt * 1.8;
        if (golferSwingProgress >= 1.0) {
          golferGroup.visible = false;
        }
      }
    }

    let cameraFollowLook = new THREE.Vector3();
    let targetCameraPos = new THREE.Vector3();
    let targetOrbitTarget = new THREE.Vector3();

    // Lie detection
    function isInsidePolygon(pt, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, zi = poly[i].z;
        const xj = poly[j].x, zj = poly[j].z;
        const intersect = ((zi > pt.z) !== (zj > pt.z)) && (pt.x < (xj - xi) * (pt.z - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function detectLie(pos) {
      const teePos = teeBoxes3D[currentHoleNumber];
      if (teePos) {
        const distToTee = new THREE.Vector2(pos.x - teePos.x, pos.z - teePos.z).length();
        if (distToTee < 18.0) {
          return { type: 'Tee', name: 'جایگاه تی (Tee Box 100%)', penalty: 1.0, badge: 'lie-fairway' };
        }
      }
      const greenCenter = (typeof brownCenters3D !== 'undefined' && brownCenters3D[currentHoleNumber]) || holePins3D[currentHoleNumber];
      if (greenCenter) {
        const distToCenter = new THREE.Vector2(pos.x - greenCenter.x, pos.z - greenCenter.z).length();
        if (distToCenter <= 11.2) {
          return { type: 'Green', name: 'روی براون نفت و شن (Oiled Sand Brown 100%)', penalty: 1.0, badge: 'lie-green' };
        }
      }
      for (let fp of fairwayPolygons) {
        if (isInsidePolygon(pos, fp.pts)) {
          return { type: 'Fairway', name: 'فیروی چمن (Fairway 100%)', penalty: 1.0, badge: 'lie-fairway' };
        }
      }
      return { type: 'Rough', name: 'راف و خاک (Rough 90%)', penalty: 0.90, badge: 'lie-rough' };
    }

    // Minimap Radar 2D Canvas Renderer
    const minimapCanvas = document.getElementById('minimap-canvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    function drawMinimap() {
      const w = minimapCanvas.width;
      const h = minimapCanvas.height;
      minimapCtx.clearRect(0, 0, w, h);

      // Transparent gelatin blue tint background so the 3D game shines through!
      minimapCtx.fillStyle = '#1c2921';
      minimapCtx.fillRect(0, 0, w, h);

      const targetPin = holePins3D[currentHoleNumber];
      if (!targetPin) return;

      const midX = (ballPos.x + targetPin.x) / 2;
      const midZ = (ballPos.z + targetPin.z) / 2;
      const span = Math.max(140, new THREE.Vector2(ballPos.x - targetPin.x, ballPos.z - targetPin.z).length() * 1.5);
      const scale = (w * 0.75) / span;

      function mapToMinimap(wx, wz) {
        const mx = (w / 2) + (wx - midX) * scale;
        const my = (h / 2) + (wz - midZ) * scale;
        return { mx, my };
      }

      // Draw Fairway
      fairwayPolygons.forEach(fp => {
        if (fp.hole === currentHoleNumber && fp.pts && fp.pts.length > 2) {
          minimapCtx.beginPath();
          const p0 = mapToMinimap(fp.pts[0].x, fp.pts[0].z);
          minimapCtx.moveTo(p0.mx, p0.my);
          for (let i = 1; i < fp.pts.length; i++) {
            const pi = mapToMinimap(fp.pts[i].x, fp.pts[i].z);
            minimapCtx.lineTo(pi.mx, pi.my);
          }
          minimapCtx.closePath();
          minimapCtx.fillStyle = 'rgba(120, 168, 139, 0.45)';
          minimapCtx.fill();
          minimapCtx.strokeStyle = '#d4bd88';
          minimapCtx.lineWidth = 1;
          minimapCtx.stroke();
        }
      });

      // Aim Line
      const bM = mapToMinimap(ballPos.x, ballPos.z);
      const pM = mapToMinimap(targetPin.x, targetPin.z);

      minimapCtx.beginPath();
      minimapCtx.setLineDash([3, 3]);
      minimapCtx.moveTo(bM.mx, bM.my);
      minimapCtx.lineTo(pM.mx, pM.my);
      minimapCtx.strokeStyle = '#d4bd88';
      minimapCtx.lineWidth = 1.5;
      minimapCtx.stroke();
      minimapCtx.setLineDash([]);

      // Hole Pin
      minimapCtx.beginPath();
      minimapCtx.arc(pM.mx, pM.my, 4.5, 0, Math.PI * 2);
      minimapCtx.fillStyle = '#eda699';
      minimapCtx.fill();
      minimapCtx.strokeStyle = '#f1eee5';
      minimapCtx.lineWidth = 1.5;
      minimapCtx.stroke();

      // Ball
      minimapCtx.beginPath();
      minimapCtx.arc(bM.mx, bM.my, 4, 0, Math.PI * 2);
      minimapCtx.fillStyle = '#f1eee5';
      minimapCtx.fill();
      minimapCtx.strokeStyle = '#d4bd88';
      minimapCtx.lineWidth = 1.5;
      minimapCtx.stroke();
    }

    document.getElementById('minimap-container').addEventListener('click', () => {
      const pinPos = holePins3D[currentHoleNumber];
      if (pinPos) {
        const dir = new THREE.Vector3().subVectors(pinPos, ballPos).normalize();
        camera.position.set(ballPos.x - dir.x * 20, ballPos.y + 10, ballPos.z - dir.z * 20);
        orbitControls.target.set(ballPos.x + dir.x * 25, ballPos.y + 2.0, ballPos.z + dir.z * 25);
        orbitControls.update();
      }
    });

    // Carry & Roll TrackMan Calculator
    window.recalibrateBagForHandicap = recalibrateBagForHandicap;
    function recalibrateBagForHandicap(lvl) {
      if (typeof buildClubButtons === 'function') buildClubButtons();
      if (typeof updateSelectedClubUI === 'function') updateSelectedClubUI();
    }

    function calculateShotSpecs(clubIndex, swingMode) {
      const club = GOLF_BAG[clubIndex];
      const hLevel = window.currentHandicap || 'scratch';
      const hMult = (window.handicapMultipliers && window.handicapMultipliers[hLevel]) || 1.0;

      let carryMultiplier = 1.0;
      let rollMultiplier = 1.0;

      switch(swingMode) {
        case 'chip':
          carryMultiplier = 0.25;
          rollMultiplier = 1.20;
          break;
        case 'half':
          carryMultiplier = 0.50;
          rollMultiplier = 0.60;
          break;
        case 'three-quarter':
          carryMultiplier = 0.75;
          rollMultiplier = 0.80;
          break;
        case 'full':
        default:
          carryMultiplier = 1.0;
          rollMultiplier = 1.0;
          break;
      }

      const effHMult = club.isPutter ? 1.0 : hMult;
      const carryYards = Math.round(club.carry * carryMultiplier * effHMult);
      const rollYards = Math.max(1, Math.round(club.roll * rollMultiplier * effHMult));
      const totalYards = carryYards + rollYards;
      return { carryYards, rollYards, totalYards, carryMultiplier: carryMultiplier * effHMult, rollMultiplier: rollMultiplier * effHMult };
    }

    // 13 Clubs UI Generator
    const clubModal = document.getElementById('club-picker-modal');
    const clubTriggerCard = document.getElementById('club-trigger-card');
    const btnCloseClub = document.getElementById('btn-close-club-picker');

        window.switchActiveCourse = switchActiveCourse;
    function switchActiveCourse(courseId) {
      window.activeCourseId = courseId;
      console.log('Switching course to:', courseId);

      if (courseId === 'tehran') {
        // Load Tehran Texture
        if (window.TEHRAN_TEXTURE_B64 && satMaterial) {
          const tLoader = new THREE.TextureLoader();
          const tTex = tLoader.load(window.TEHRAN_TEXTURE_B64);
          tTex.generateMipmaps = true;
          tTex.encoding = THREE.sRGBEncoding;
          tTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          satMaterial.map = tTex;
          satMaterial.needsUpdate = true;
        }
        // Hide historical sand browns on modern grass Enghelab course!
        if (brownsGroup) brownsGroup.visible = false;

        // Update top hud course title label if present
        const titleBadge = document.querySelector('.splash-tag');
        if (titleBadge) titleBadge.textContent = 'TEHRAN ENGHELAB GOLF CLUB';
      } else {
        // Restore MIS Oiled Sand Browns and Desert Terrain
        if (satTexture && satMaterial) {
          satMaterial.map = satTexture;
          satMaterial.needsUpdate = true;
        }
        if (brownsGroup) brownsGroup.visible = true;
        const titleBadge = document.querySelector('.splash-tag');
        if (titleBadge) titleBadge.textContent = 'MIS HISTORICAL GOLF CLUB';
      }

      if (window.PuttUI) window.PuttUI.renderHoles();
      setupHole(1);
    }

    function buildClubButtons() {
      const grids = {
        wood: document.getElementById('woods-grid'),
        iron: document.getElementById('irons-grid'),
        wedge: document.getElementById('wedges-grid'),
        putt: document.getElementById('putters-grid')
      };
      Object.values(grids).forEach(g => g.innerHTML = '');

      GOLF_BAG.forEach((club, idx) => {
        const btn = document.createElement('button');
        btn.className = `club-btn ${idx === currentClubIndex ? 'selected' : ''}`;
        btn.type = 'button';
        btn.dataset.clubIndex = idx;
        btn.setAttribute('aria-pressed', String(idx === currentClubIndex));
        const specs = calculateShotSpecs(idx, 'full');
        btn.innerHTML = `
          <span class="club-mark">${club.id}</span>
          <span class="club-copy"><strong>${club.name}</strong><small>Carry ${specs.carryYards} · Roll ${specs.rollYards}</small></span>
          <span class="club-distance">${specs.totalYards}<small> YD</small></span>
          <span class="selection-tick" aria-hidden="true">✓</span>
        `;
        btn.addEventListener('click', () => {
          currentClubIndex = idx;
          updateSelectedClubUI();
          if (window.PuttUI) window.PuttUI.closePanel();
          else clubModal.classList.remove('open');
        });
        if (grids[club.cat]) grids[club.cat].appendChild(btn);
      });
    }

    function updateSelectedClubUI() {
      const club = GOLF_BAG[currentClubIndex];
      const isPutter = club.isPutter === true;

      document.getElementById('selected-club-label').textContent = club.name;
      const clubBadge = document.getElementById('club-trigger-badge');
      if (clubBadge) {
        // Short gaming code (e.g., '1W', '3W', '5I', 'PW', 'Putt')
        const code = club.id;
        clubBadge.textContent = code;
      }
      const specs = calculateShotSpecs(currentClubIndex, currentSwingMode);
      const cSub = document.getElementById('selected-club-sub'); if (cSub) cSub.textContent = `${specs.totalYards} یارد ▾`;

      document.getElementById('swing-mode-panel').style.display = isPutter ? 'none' : 'flex';
      document.getElementById('putter-meter-panel').style.display = isPutter ? 'flex' : 'none';

      document.getElementById('est-carry').textContent = `${specs.carryYards} Y`;
      document.getElementById('est-roll').textContent = `+${specs.rollYards} Y`;
      document.getElementById('est-total').textContent = `${specs.totalYards} Y`;

      document.querySelectorAll('.club-btn').forEach((b, i) => {
        b.classList.toggle('selected', i === currentClubIndex);
        b.setAttribute('aria-pressed', String(i === currentClubIndex));
      });

      updateAimTracer();
      if (!isBallFlying && golferSwingPhase === 'idle') positionGolferAtBall();
      drawMinimap();
      if (window.PuttUI) window.PuttUI.sync();
    }
    buildClubButtons();

    const swingModal = document.getElementById('swing-picker-modal');
    const swingTriggerCard = document.getElementById('swing-trigger-card');
    const btnCloseSwing = document.getElementById('btn-close-swing-picker');
    document.getElementById('btn-launch-shot').addEventListener('click', () => {
      if (isBallFlying || golferSwingPhase !== 'idle') return;
      const specs = calculateShotSpecs(currentClubIndex, currentSwingMode);
      triggerGolferSwing(specs, () => executeGolfShot(specs));
    });

    const putterSlider = document.getElementById('putter-backswing-slider');
    const putterValLabel = document.getElementById('putter-yards-val');

    putterSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const yards = Math.max(1, Math.round(val * 0.3));
      putterValLabel.textContent = `${yards} یارد غلتش (بک‌سوئینگ: ${val}%)`;
      updateAimTracer();
      drawMinimap();
    });

    document.getElementById('btn-putt-action').addEventListener('click', () => {
      if (isBallFlying || golferSwingPhase !== 'idle') return;
      const backswingFraction = parseInt(putterSlider.value) / 100;
      const specs = { carryMultiplier: 0, rollMultiplier: backswingFraction, isPutt: true };
      triggerGolferSwing(specs, () => {
        executeGolfShot(specs);
      });
    });

    function updateAimTracer() {
      const pinPos = holePins3D[currentHoleNumber];
      if (!pinPos) return;

      const club = GOLF_BAG[currentClubIndex];
      const dir = new THREE.Vector3().subVectors(pinPos, ballPos).normalize();
      const loftRad = club.loft * Math.PI / 180;
      const specs = calculateShotSpecs(currentClubIndex, currentSwingMode);
      const isPutter = club.isPutter === true;

      const pts = [ballPos.clone()];

      if (isPutter) {
        const puttRollDist = (parseInt(putterSlider.value) * 0.3) * 0.9144;
        for (let i = 1; i <= 20; i++) {
          const d = (i / 20) * puttRollDist;
          const px = ballPos.x + dir.x * d;
          const pz = ballPos.z + dir.z * d;
          pts.push(new THREE.Vector3(px, getTerrainHeight(px, pz) + 0.4, pz));
        }
        landingRing.position.copy(pts[pts.length - 1]);
        landingRing.visible = true;
      } else {
        let speed = (club.v0 * Math.sqrt(specs.carryMultiplier));
        let vHoriz = speed * Math.cos(loftRad);
        let vVert = speed * Math.sin(loftRad);
        let simPos = ballPos.clone();
        const simDt = 0.04;
        const kDragSim = 0.0020;
        const kLiftSim = 0.00078;
        const grav = 9.81;

        for (let step = 0; step < 180; step++) {
          const curSpeed = Math.hypot(vHoriz, vVert);
          const uH = vHoriz / Math.max(1e-5, curSpeed);
          const uV = vVert / Math.max(1e-5, curSpeed);
          const liftForce = kLiftSim * curSpeed * curSpeed;

          const aH = -kDragSim * curSpeed * vHoriz - liftForce * uV;
          const aV = -grav - kDragSim * curSpeed * vVert + liftForce * uH;

          vHoriz += aH * simDt;
          vVert += aV * simDt;

          simPos.x += dir.x * vHoriz * simDt;
          simPos.z += dir.z * vHoriz * simDt;
          simPos.y += vVert * simDt;

          pts.push(simPos.clone());

          const gH = getTerrainHeight(simPos.x, simPos.z) + 0.38;
          if (simPos.y <= gH && step > 5) {
            simPos.y = gH;
            pts[pts.length - 1].y = gH;
            break;
          }
        }

        const landingPt = pts[pts.length - 1];
        landingRing.position.set(landingPt.x, getTerrainHeight(landingPt.x, landingPt.z) + 0.35, landingPt.z);
        landingRing.visible = true;
      }

      aimLine.geometry.setFromPoints(pts);
      aimLine.computeLineDistances();
    }

    function autoSuggestClub() {
      const pinPos = holePins3D[currentHoleNumber];
      if (!pinPos) return;

      const distYards = new THREE.Vector2(ballPos.x - pinPos.x, ballPos.z - pinPos.z).length() * 1.09361;
      const teePos = teeBoxes3D[currentHoleNumber];
      const isAtTee = teePos && (new THREE.Vector2(ballPos.x - teePos.x, ballPos.z - teePos.z).length() < 18.0);

      const holeData = courseHoles[currentHoleNumber] || {};
      const par = (holeData.tees && holeData.tees[0] && holeData.tees[0].par) || 4;

      if (isAtTee && par >= 4) {
        currentClubIndex = 0; // 1W Driver
      } else if (distYards < 25) {
        currentClubIndex = 12; // Putter
      } else if (distYards < 85) {
        currentClubIndex = 11; // SW
      } else if (distYards < 105) {
        currentClubIndex = 10; // AW
      } else if (distYards < 125) {
        currentClubIndex = 9;  // PW
      } else if (distYards < 142) {
        currentClubIndex = 8;  // 9-Iron
      } else if (distYards < 158) {
        currentClubIndex = 7;  // 8-Iron
      } else if (distYards < 174) {
        currentClubIndex = 6;  // 7-Iron
      } else if (distYards < 192) {
        currentClubIndex = 5;  // 6-Iron
      } else if (distYards < 210) {
        currentClubIndex = 4;  // 5-Iron
      } else if (distYards < 235) {
        currentClubIndex = 3;  // 4-Iron
      } else if (distYards < 265) {
        currentClubIndex = 1;  // 3-Wood
      } else {
        currentClubIndex = 0;  // Driver
      }

      updateSelectedClubUI();
    }

    function executeGolfShot(specs) {
      if (isBallFlying) return;
      const pinPos = holePins3D[currentHoleNumber] || new THREE.Vector3(ballPos.x + 100, 0, ballPos.z - 100);
      const club = GOLF_BAG[currentClubIndex];
      const lie = detectLie(ballPos);

      strokesCurrentHole++;

      shotStartPos.copy(ballPos);
      firstImpactPos.set(0, 0, 0);
      hasImpacted = false;
      flightElapsedTime = 0;
      ballRestTimer = 0;
      isBallSettled = false;
      resetToptracer();
      if (teePegGroup) teePegGroup.visible = false;

      let dir = new THREE.Vector3().subVectors(pinPos, ballPos).normalize();
      const loftRad = club.loft * Math.PI / 180;

      // Realistic audio trigger
      AudioEngine.playSwing(specs.carryMultiplier || 1.0);
      setTimeout(() => AudioEngine.playSweetSpotImpact(club.cat, specs.carryMultiplier || 1.0), 100);

      if (club.isPutter) {
        const putterPower = (parseInt(putterSlider.value) / 100);
        let speed = (club.v0 * putterPower) * lie.penalty;
        ballVel.x = dir.x * speed;
        ballVel.z = dir.z * speed;
        ballVel.y = 0;
        isBallGrounded = true;
        hasImpacted = true;
        firstImpactPos.copy(ballPos);
      } else {
        const hLevel = window.currentHandicap || 'scratch';
        const hMult = (window.handicapMultipliers && window.handicapMultipliers[hLevel]) || 1.0;
        let speed = (club.v0 * Math.sqrt(specs.carryMultiplier)) * (club.isPutter ? 1.0 : hMult) * lie.penalty;
        ballVel.x = dir.x * speed * Math.cos(loftRad);
        ballVel.z = dir.z * speed * Math.cos(loftRad);
        ballVel.y = speed * Math.sin(loftRad);
        isBallGrounded = false;
        ballPos.y += 0.05;
      }

      isBallFlying = true;
      aimLine.visible = false;
      landingRing.visible = false;
      orbitControls.enabled = false; // Disable orbit control during flight to prevent fight/jerk!
    }

    const gravity = 9.81;
    const kDrag = 0.0020;
    const kLift = 0.00078;

    function stepPhysics(dt) {
      if (!isBallFlying) return;

      const subSteps = 6;
      const sdt = dt / subSteps;
      const club = GOLF_BAG[currentClubIndex];

      for (let s = 0; s < subSteps; s++) {
        const speed = ballVel.length();
        const groundH = getTerrainHeight(ballPos.x, ballPos.z) + BALL_RADIUS;

        if (!isBallGrounded) {
          if (speed > 0.01) {
            const ux = ballVel.x / speed;
            const uy = ballVel.y / speed;
            const uz = ballVel.z / speed;

            const dragAccel = kDrag * speed * speed;
            ballVel.x -= dragAccel * ux * sdt;
            ballVel.y -= dragAccel * uy * sdt;
            ballVel.z -= dragAccel * uz * sdt;

            // Environmental wind drag
            const windVx = Math.cos(windAngle) * (windSpeedMph * 0.447);
            const windVz = Math.sin(windAngle) * (windSpeedMph * 0.447);
            ballVel.x += (windVx - ballVel.x) * (kDrag * 0.5) * sdt;
            ballVel.z += (windVz - ballVel.z) * (kDrag * 0.5) * sdt;

            if (!hasImpacted && !club.isPutter) {
              const horizSpeed = Math.hypot(ballVel.x, ballVel.z);
              if (horizSpeed > 1e-4) {
                const uHoriz = horizSpeed / speed;
                const liftAccel = kLift * speed * speed;
                ballVel.y += liftAccel * uHoriz * sdt;
                const horizFactor = (liftAccel * (ballVel.y / speed)) * sdt;
                ballVel.x -= horizFactor * (ballVel.x / horizSpeed);
                ballVel.z -= horizFactor * (ballVel.z / horizSpeed);
              }
            }
          }
          ballVel.y -= gravity * sdt;
          ballPos.addScaledVector(ballVel, sdt);

          // Rotate ball in air based on forward motion
          const airDist = speed * sdt;
          ballMesh.rotation.x += airDist * 2.5;

          if (ballPos.y <= groundH) {
            ballPos.y = groundH;

            if (!hasImpacted) {
              hasImpacted = true;
              firstImpactPos.copy(ballPos);
              AudioEngine.playBallLand(false);
            }

            // Real 3D Terrain Normal & Slope Collision Deflection
            const normal = getTerrainNormal(ballPos.x, ballPos.z);
            const vDotN = ballVel.dot(normal);

            const restitution = club.bounceRest !== undefined ? club.bounceRest : 0.22;
            const tangentLoss = club.tangentLoss !== undefined ? club.tangentLoss : 0.65;

            // If incoming velocity is directed into the slope surface:
            if (vDotN < -0.28) {
              const vNorm = normal.clone().multiplyScalar(vDotN);
              const vTan = ballVel.clone().sub(vNorm);
              
              // Normal component reflects with coefficient of restitution
              vNorm.multiplyScalar(-restitution);
              // Tangential component preserves momentum minus ground friction
              vTan.multiplyScalar(tangentLoss);

              // 3D slope deflected bounce velocity
              ballVel.copy(vNorm).add(vTan);

              // Secondary hops: if vertical bounce speed is low or slope is steep:
              if (ballVel.y < 0.40 && normal.y > 0.85) {
                ballVel.y = 0;
                isBallGrounded = true;
              }
            } else {
              ballVel.y = 0;
              isBallGrounded = true;
            }
          }
        } else {
          // ===================================================================
          // REAL 3D GROUND ROLLING & SLOPE DYNAMICS (MASJED SOLEYMAN TERRAIN)
          // ===================================================================
          ballPos.y = groundH;

          const normal = getTerrainNormal(ballPos.x, ballPos.z);
          const lie = detectLie(ballPos);

          // Friction deceleration based on terrain surface:
          // Firm dirt fairway = 1.6 m/s^2 (rolls freely and fast!)
          // Rough = 3.2 m/s^2, Oiled Sand Brown = 2.4 m/s^2
          let rollDecel = (club.rollDecel !== undefined ? club.rollDecel : 1.6);
          if (lie.type === 'Rough') rollDecel *= 1.85;
          else if (lie.type === 'Green') rollDecel = 2.4; // Oiled sand brown has smooth controlled roll
          if (currentSwingMode === 'chip') rollDecel *= 1.25;

          // 1. True Gravitational Slope Acceleration (Pulling Downhill):
          // Along slope gradient: a_slope = normal_horizontal * (gravity * 1.35)
          const slopeAccelX = normal.x * gravity * 1.35;
          const slopeAccelZ = normal.z * gravity * 1.35;

          ballVel.x += slopeAccelX * sdt;
          ballVel.z += slopeAccelZ * sdt;
          ballVel.y = 0;

          // 2. Rolling Friction Opposing Velocity:
          const curSpeed = Math.hypot(ballVel.x, ballVel.z);
          if (curSpeed > 1e-4) {
            const frictionLoss = rollDecel * sdt;
            if (curSpeed > frictionLoss) {
              const factor = (curSpeed - frictionLoss) / curSpeed;
              ballVel.x *= factor;
              ballVel.z *= factor;
            } else {
              // If speed is very low and slope is negligible, come to rest
              const slopeMagnitude = Math.hypot(slopeAccelX, slopeAccelZ);
              if (slopeMagnitude < rollDecel * 0.85) {
                ballVel.x = 0;
                ballVel.z = 0;
              }
            }
          }

          // Advance ball position along terrain slope
          ballPos.x += ballVel.x * sdt;
          ballPos.z += ballVel.z * sdt;
          ballPos.y = getTerrainHeight(ballPos.x, ballPos.z) + 0.58;

          // 3D Visual Ball Rolling Rotation (v / r)
          const rollDist = curSpeed * sdt;
          const ballRadius = 0.38;
          if (curSpeed > 1e-4) {
            const rotAngle = rollDist / ballRadius;
            const dirX = ballVel.x / curSpeed;
            const dirZ = ballVel.z / curSpeed;
            ballMesh.rotation.z -= dirX * rotAngle;
            ballMesh.rotation.x += dirZ * rotAngle;
          }

          // Cup Capture Detection
          const pinPos = holePins3D[currentHoleNumber];
          if (pinPos) {
            const dToHole = new THREE.Vector2(ballPos.x - pinPos.x, ballPos.z - pinPos.z).length();
            if (dToHole < 1.15 && ballVel.length() < 2.2) {
              ballVel.set(0, 0, 0);
              isBallFlying = false;
              handleHoleCompleted();
              return;
            }
          }

          // Stop Threshold: if ball has practically stopped and isn't on a runaway cliff slope
          if (ballVel.length() < 0.05) {
            const slopeMagnitude = Math.hypot(slopeAccelX, slopeAccelZ);
            if (slopeMagnitude < rollDecel * 0.9) {
              ballVel.set(0, 0, 0);
              isBallSettled = true;
              break;
            }
          }
        }
      }

      ballMesh.position.copy(ballPos);
      updateToptracerRibbon(ballPos);

      // Graceful post-roll camera linger before resetting to aiming mode
      if (isBallSettled) {
        ballRestTimer += dt;
        if (ballRestTimer > 1.2) {
          isBallFlying = false;
          isBallSettled = false;
          handleBallCameToRest();
        }
      }
    }

    function handleBallCameToRest() {
      aimLine.visible = false;

      const carryMeters = new THREE.Vector2(firstImpactPos.x - shotStartPos.x, firstImpactPos.z - shotStartPos.z).length();
      const totalMeters = new THREE.Vector2(ballPos.x - shotStartPos.x, ballPos.z - shotStartPos.z).length();
      const rollMeters = Math.max(0, totalMeters - carryMeters);

      const actualCarryYards = Math.round(carryMeters * 1.09361);
      const actualRollYards = Math.round(rollMeters * 1.09361);
      const actualTotalYards = Math.round(totalMeters * 1.09361);

      const teleHUD = document.getElementById('shot-telemetry-hud');
      document.getElementById('tele-carry').textContent = `${actualCarryYards} YDS`;
      document.getElementById('tele-roll').textContent = `+${actualRollYards} YDS`;
      document.getElementById('tele-total').textContent = `${actualTotalYards} YDS`;
      teleHUD.style.display = 'flex';

      const pinPos = holePins3D[currentHoleNumber];
      if (pinPos) {
        const dir = new THREE.Vector3().subVectors(pinPos, ballPos).normalize();
        targetCameraPos.set(ballPos.x - dir.x * 18, ballPos.y + 7.0, ballPos.z - dir.z * 18);
        targetOrbitTarget.set(ballPos.x + dir.x * 25, ballPos.y + 2.0, ballPos.z + dir.z * 25);
        orbitControls.enabled = false;
      } else {
        targetCameraPos.set(ballPos.x - 18, ballPos.y + 7.0, ballPos.z - 18);
        targetOrbitTarget.copy(ballPos);
      }
      isCameraTransitioning = true;

      autoSuggestClub();
      updateHoleUI();
      positionGolferAtBall();
      drawMinimap();
    }

    function handleHoleCompleted() {
      holeScores[currentHoleNumber] = strokesCurrentHole;
      const holeData = courseHoles[currentHoleNumber] || {};
      const par = (holeData.tees && holeData.tees[0] && holeData.tees[0].par) || 4;

      AudioEngine.playCupDrop();

      let scoreName = 'Par';
      let icon = '⭐';
      const diff = strokesCurrentHole - par;
      if (strokesCurrentHole === 1) { scoreName = 'HOLE IN ONE!'; icon = '🏆'; }
      else if (diff === -2) { scoreName = 'EAGLE!'; icon = '🦅'; }
      else if (diff === -1) { scoreName = 'BIRDIE!'; icon = '🐦'; }
      else if (diff === 0) { scoreName = 'PAR!'; icon = '⭐'; }
      else if (diff === 1) { scoreName = 'BOGEY (+1)'; icon = '⛳'; }
      else { scoreName = diff > 0 ? `+${diff}` : String(diff); icon = '⛳'; }

      const overlay = document.getElementById('celebration-overlay');
      document.getElementById('celeb-icon').innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-flag"></use></svg>';
      document.getElementById('celeb-title').textContent = scoreName;
      document.getElementById('celeb-sub').textContent = `حفره ${currentHoleNumber} با موفقیت به پایان رسید`;
      document.getElementById('celeb-strokes').textContent = strokesCurrentHole;
      document.getElementById('celeb-par').textContent = par;
      overlay.style.display = 'flex';
      if (window.PuttUI) window.PuttUI.showCelebration();

      const btnNext = document.getElementById('btn-celeb-next');
      if (gameMode === 'single_hole') {
        // In single hole mode: show hole report and option to replay or return
        document.getElementById('celeb-sub').textContent = `گزارش میدان ${currentHoleNumber}: ضربات ${strokesCurrentHole} (پار ${par})`;
        btnNext.textContent = 'Replay hole';
        btnNext.onclick = () => {
          overlay.style.display = 'none';
          setupHole(currentHoleNumber);
        };
      } else {
        // In 18-hole mode: advance to next hole
        document.getElementById('celeb-sub').textContent = `میدان ${currentHoleNumber} با موفقیت به پایان رسید`;
        btnNext.textContent = currentHoleNumber < 18 ? 'Next hole' : 'View scorecard';
        btnNext.onclick = () => {
          overlay.style.display = 'none';
          if (currentHoleNumber < 18) {
            setupHole(currentHoleNumber + 1);
          } else {
            if (window.PuttUI) window.PuttUI.toast('Round complete. Your session scorecard is ready.');
            renderScorecardTable();
            if (window.PuttUI) window.PuttUI.openPanel('menu-modal');
          }
        };
      }
    }

    function renderScorecardTable() {
      const tbody = document.getElementById('scorecard-body');
      tbody.innerHTML = '';
      for (let i = 1; i <= 18; i++) {
        const info = courseHoles[i]?.tees?.[0] || {};
        const score = holeScores[i];
        const completed = Number.isFinite(score);
        const diff = completed && Number.isFinite(info.par) ? score - info.par : null;
        const result = diff === null ? '—' : score === 1 ? 'Hole-in-one' : diff === -2 ? 'Eagle' : diff === -1 ? 'Birdie' : diff === 0 ? 'Par' : diff > 0 ? '+' + diff : String(diff);
        const tr = document.createElement('tr');
        if (i === currentHoleNumber) { tr.classList.add('active-hole'); tr.setAttribute('aria-current','true'); }
        tr.innerHTML = `<td><span class="hole-number">${String(i).padStart(2,'0')}</span></td><td>${info.yard ?? '—'}<small> yd</small></td><td>${info.par ?? '—'}</td><td>${completed ? score : '—'}</td><td><span class="score-result ${diff === null ? '' : diff < 0 ? 'under-par' : diff > 0 ? 'over-par' : 'even-par'}">${result}</span></td>`;
        tbody.appendChild(tr);
      }
      if (window.PuttUI) window.PuttUI.updateScoreSummary();
    }

    function updateHoleUI() {
      const holeData = courseHoles[currentHoleNumber] || {};
      const teeInfo = (holeData.tees && holeData.tees[0]) || { yard: 200, par: 4 };

      document.getElementById('hud-hole-num').textContent = `HOLE ${currentHoleNumber}`;
      document.getElementById('hud-par').textContent = teeInfo.par || 4;
      document.getElementById('hud-strokes').textContent = strokesCurrentHole + 1;
      document.getElementById('hud-tee-type').textContent = isWomenTee ? 'Women' : 'Men';

      const pinPos = holePins3D[currentHoleNumber];
      if (pinPos) {
        const distM = new THREE.Vector2(ballPos.x - pinPos.x, ballPos.z - pinPos.z).length();
        const distYards = Math.round(distM * 1.09361);
        document.getElementById('hud-dist-flag').textContent = `${distYards} YDS`;
      }

      const lie = detectLie(ballPos);
      const lieElem = document.getElementById('hud-lie');
      lieElem.className = `lie-badge ${lie.badge}`;
      lieElem.textContent = lie.name;

      updateAimTracer();
      renderScorecardTable();
    }

    window.setupHole = setupHole;
    function setupHole(hNum) {
      updateHoleVisualIsolation(hNum);
      currentHoleNumber = hNum;
      strokesCurrentHole = 0;
      isBallFlying = false;
      isBallSettled = false;
      isBallGrounded = false;
      ballRestTimer = 0;
      // A new hole must not inherit the previous shot's camera transition.
      isCameraTransitioning = false;
      screenShakeTimer = 0;
      resetToptracer();

      let startTeePos = teeBoxes3D[hNum] || new THREE.Vector3(0, getTerrainHeight(0,0), 0);
      if (isWomenTee) {
        const pinPos = holePins3D[hNum] || new THREE.Vector3(100, 0, 100);
        startTeePos = startTeePos.clone().lerp(pinPos, 0.18);
        startTeePos.y = getTerrainHeight(startTeePos.x, startTeePos.z);
      }

      ballPos.copy(startTeePos);
      const groundAtTee = getTerrainHeight(ballPos.x, ballPos.z);
      // Tee box platform surface is exactly 15cm (0.15m) above ground
      const platformSurfaceY = groundAtTee + 0.15;
      // Ball sits elevated on the plastic tee peg (8cm tee peg + ball radius)
      ballPos.y = platformSurfaceY + 0.08 + BALL_RADIUS;
      ballMesh.position.copy(ballPos);

      // Place plastic tee peg standing on top of the 15cm platform right under the ball
      if (teePegGroup) {
        teePegGroup.position.set(ballPos.x, platformSurfaceY, ballPos.z);
        teePegGroup.visible = true;
      }

      const pinPos = holePins3D[hNum] || new THREE.Vector3(startTeePos.x + 100, 0, startTeePos.z - 100);
      const dirToPin = new THREE.Vector3().subVectors(pinPos, ballPos).normalize();

      // Broadcast Behind-the-Ball Camera View (closer and nicely framed for the realistic ball and 2m tee box)
      camera.position.set(ballPos.x - dirToPin.x * 4.2, ballPos.y + 1.35, ballPos.z - dirToPin.z * 4.2);
      orbitControls.target.set(ballPos.x + dirToPin.x * 15, ballPos.y + 0.9, ballPos.z + dirToPin.z * 15);
      orbitControls.update();
      cameraFollowLook.copy(orbitControls.target);
      targetCameraPos.copy(camera.position);
      targetOrbitTarget.copy(orbitControls.target);

      autoSuggestClub();
      updateHoleUI();
      positionGolferAtBall();
      document.getElementById('shot-telemetry-hud').style.display = 'none';
      if (window.PuttUI) window.PuttUI.sync();
      drawMinimap();
    }

    
    let gameMode = '18holes';
    let selectedSingleHole = 1;
    setupHole(1);

    let clock = new THREE.Clock();
    const sceneMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      // Animate 3D Floating Sky Arrow
      if (skyBeaconGroup && skyBeaconGroup.visible && !sceneMotionPreference.matches && document.body.dataset.reducedMotion !== 'true') {
        const time = clock.getElapsedTime();
        // Gentle bobbing motion in the sky
        skyArrowBobber.position.y = Math.sin(time * 2.8) * 0.85;
        // Smooth rotation
        arrowHeadMesh.rotation.y = time * 1.6;
        arrowShaftMesh.rotation.y = time * 1.6;
        beaconHalo.rotation.z = -time * 2.0;
        beaconOuterRing.rotation.z = time * 1.4;
        // Subtle pulse
        const pulse = 1.0 + Math.sin(time * 3.2) * 0.15;
        beaconHalo.scale.set(pulse, pulse, 1.0);
      }

      // Physics & Dynamic Broadcast Camera
      if (isBallFlying) {
        stepPhysics(dt);
        flightElapsedTime += dt;

        // Dynamic Broadcast Director: 100% Smooth Continuous Interpolation (Zero Jump at Impact)
        if (!hasImpacted) {
          if (flightElapsedTime < 1.4) {
            // Phase 1: Behind Tee Broadcast Camera admiring the rising Toptracer laser ribbon
            cameraFollowLook.lerp(ballPos, dt * 8.0);
            camera.lookAt(cameraFollowLook.x, cameraFollowLook.y + 1.2, cameraFollowLook.z);
          } else {
            // Phase 2: HIGH OVERHEAD BLIMP CAMERA (65m+ Altitude - Wide majestic broadcast view!)
            const targetOverheadX = ballPos.x - ballVel.x * 0.18;
            const targetOverheadZ = ballPos.z - ballVel.z * 0.18;
            const targetOverheadY = ballPos.y + 68.0; // Higher overhead view as requested!

            camera.position.lerp(new THREE.Vector3(targetOverheadX, targetOverheadY, targetOverheadZ), dt * 2.2);
            cameraFollowLook.lerp(ballPos, dt * 6.0);
            camera.lookAt(cameraFollowLook.x, cameraFollowLook.y, cameraFollowLook.z);
          }
        } else {
          // Phase 3: Seamless Ground Landing & Roll Tracking
          // The camera smoothly descends from overhead (68m) towards the rolling ball (8m) without ANY sudden snap!
          const horizSpeed = Math.hypot(ballVel.x, ballVel.z);
          const fwdDir = horizSpeed > 0.05 
            ? new THREE.Vector2(ballVel.x / horizSpeed, ballVel.z / horizSpeed)
            : new THREE.Vector2(ballPos.x - shotStartPos.x, ballPos.z - shotStartPos.z).normalize();

          const followDist = 14.0;
          const targetRollX = ballPos.x - fwdDir.x * followDist;
          const targetRollZ = ballPos.z - fwdDir.y * followDist;
          const targetRollY = ballPos.y + 7.5;

          // Smooth exponential descent into the roll tracking view
          camera.position.lerp(new THREE.Vector3(targetRollX, targetRollY, targetRollZ), dt * 2.6);
          cameraFollowLook.lerp(ballPos, dt * 6.0);
          camera.lookAt(cameraFollowLook.x, cameraFollowLook.y + 0.4, cameraFollowLook.z);
        }
      } else {
        if (isCameraTransitioning) {
          camera.position.lerp(targetCameraPos, dt * 2.6);
          cameraFollowLook.lerp(targetOrbitTarget, dt * 3.0);
          camera.lookAt(cameraFollowLook.x, cameraFollowLook.y, cameraFollowLook.z);

          if (camera.position.distanceTo(targetCameraPos) < 0.35) {
            isCameraTransitioning = false;
            orbitControls.target.copy(targetOrbitTarget);
            orbitControls.enabled = true; // Re-enable user manual orbit controls once settled!
          }
        } else {
          orbitControls.update();
        }
      }

      // Keep Toptracer live floating yardage badge pinned to ball tip during camera movement
      if (isBallFlying && ballPos) {
        updateToptracerYardageTag(ballPos);
      }

      updateGolferAnimation(dt);
      updateImpactParticles(dt);

      // Micro-screen shake effect
      if (screenShakeTimer > 0 && !sceneMotionPreference.matches && document.body.dataset.reducedMotion !== 'true') {
        screenShakeTimer -= dt;
        camera.position.x += (Math.random() - 0.5) * 0.12;
        camera.position.y += (Math.random() - 0.5) * 0.08;
      }

      // Title/setup completely cover the canvas; do not spend GPU time behind them.
      if (document.body.dataset.view === 'game') renderer.render(scene, camera);
      if (window.PuttUI) window.PuttUI.updateShotState();
    }
    animate();
  