let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function master(c: AudioContext, vol = 0.4): GainNode {
  const g = c.createGain()
  g.gain.value = vol
  g.connect(c.destination)
  return g
}

// ── Narrator: pencil scribble ──────────────────────────────────────────────
export function playScribble() {
  const c = getCtx()
  const dur = 0.12
  const sampleRate = c.sampleRate
  const buf = c.createBuffer(1, sampleRate * dur, sampleRate)
  const data = buf.getChannelData(0)

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate
    // Rapid flutter: modulate noise amplitude at ~55 Hz
    const flutter = Math.abs(Math.sin(t * Math.PI * 55))
    data[i] = (Math.random() * 2 - 1) * flutter
  }

  const src = c.createBufferSource()
  src.buffer = buf

  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3000

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 5500
  bp.Q.value = 0.8

  const env = c.createGain()
  env.gain.setValueAtTime(0.6, c.currentTime)
  env.gain.linearRampToValueAtTime(0, c.currentTime + dur)

  src.connect(hp)
  hp.connect(bp)
  bp.connect(env)
  env.connect(master(c, 0.35))
  src.start()
}

// ── Attribute chimes ───────────────────────────────────────────────────────

// FLESH — low, dull thud (130 Hz)
function playFleshChime() {
  const c = getCtx()
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(130, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.25)

  const dist = c.createWaveShaper()
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1
    curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x))
  }
  dist.curve = curve

  const env = c.createGain()
  env.gain.setValueAtTime(0.001, c.currentTime)
  env.gain.linearRampToValueAtTime(1, c.currentTime + 0.01)
  env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3)

  osc.connect(dist)
  dist.connect(env)
  env.connect(master(c, 0.5))
  osc.start()
  osc.stop(c.currentTime + 0.32)
}

// WIT — crisp high bell (1320 Hz)
function playWitChime() {
  const c = getCtx()
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 1320

  // Harmonics for a bell-like timbre
  const osc2 = c.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = 2640

  const env = c.createGain()
  env.gain.setValueAtTime(0.001, c.currentTime)
  env.gain.linearRampToValueAtTime(1, c.currentTime + 0.005)
  env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45)

  const env2 = c.createGain()
  env2.gain.setValueAtTime(0.001, c.currentTime)
  env2.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.005)
  env2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)

  const m = master(c, 0.3)
  osc.connect(env);  env.connect(m)
  osc2.connect(env2); env2.connect(m)
  osc.start();  osc.stop(c.currentTime + 0.5)
  osc2.start(); osc2.stop(c.currentTime + 0.25)
}

// STATION — warm mid-range with vibrato (440 Hz)
function playStationChime() {
  const c = getCtx()
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = 440

  const lfo = c.createOscillator()
  lfo.frequency.value = 6
  const lfoGain = c.createGain()
  lfoGain.gain.value = 6
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)

  const env = c.createGain()
  env.gain.setValueAtTime(0.001, c.currentTime)
  env.gain.linearRampToValueAtTime(1, c.currentTime + 0.015)
  env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.38)

  osc.connect(env)
  env.connect(master(c, 0.32))
  lfo.start(); osc.start()
  lfo.stop(c.currentTime + 0.4); osc.stop(c.currentTime + 0.4)
}

// INSTINCT — deep resonant drone (80 Hz + overtones)
function playInstinctChime() {
  const c = getCtx()
  const freqs = [80, 160, 240]
  const vols  = [1,  0.5, 0.25]

  const m = master(c, 0.38)

  freqs.forEach((freq, i) => {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const env = c.createGain()
    env.gain.setValueAtTime(0.001, c.currentTime)
    env.gain.linearRampToValueAtTime(vols[i], c.currentTime + 0.04)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55)

    osc.connect(env)
    env.connect(m)
    osc.start()
    osc.stop(c.currentTime + 0.6)
  })
}

const ATTRIBUTE_CHIMES: Record<string, () => void> = {
  FLESH:    playFleshChime,
  WIT:      playWitChime,
  STATION:  playStationChime,
  INSTINCT: playInstinctChime,
}

const SPEAKER_ATTRIBUTE: Record<string, string> = {
  ENDURANCE:      'FLESH',
  SCARRING:       'FLESH',
  HUNGER:         'FLESH',
  'DUNGEON LORE': 'WIT',
  APPRAISAL:      'WIT',
  WAYFINDING:     'WIT',
  SCAVENGING:     'WIT',
  REPUTATION:     'STATION',
  DECEPTION:      'STATION',
  SPITE:          'STATION',
  'DANGER SENSE': 'INSTINCT',
  SUPERSTITION:   'INSTINCT',
  'THE DEEP':     'INSTINCT',
}

export function playSkillChime(speaker: string) {
  const attr = SPEAKER_ATTRIBUTE[speaker]
  if (attr) ATTRIBUTE_CHIMES[attr]?.()
}

// ── Check outcomes ─────────────────────────────────────────────────────────

// Pass — clean ascending two-note figure
export function playCheckPass() {
  const c = getCtx()
  const notes = [523, 659] // C5 → E5
  const m = master(c, 0.35)

  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.1
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const env = c.createGain()
    env.gain.setValueAtTime(0.001, t)
    env.gain.linearRampToValueAtTime(1, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.28)

    osc.connect(env)
    env.connect(m)
    osc.start(t)
    osc.stop(t + 0.3)
  })
}

// Fail — low dull thud with noise burst
export function playCheckFail() {
  const c = getCtx()

  // Tonal thud
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25)

  const env = c.createGain()
  env.gain.setValueAtTime(0.001, c.currentTime)
  env.gain.linearRampToValueAtTime(1, c.currentTime + 0.008)
  env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3)

  // Noise layer
  const bufSize = c.sampleRate * 0.15
  const noiseBuf = c.createBuffer(1, bufSize, c.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1

  const noiseSrc = c.createBufferSource()
  noiseSrc.buffer = noiseBuf

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 300

  const noiseEnv = c.createGain()
  noiseEnv.gain.setValueAtTime(0.5, c.currentTime)
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)

  const m = master(c, 0.55)
  osc.connect(env);        env.connect(m)
  noiseSrc.connect(lp);    lp.connect(noiseEnv);   noiseEnv.connect(m)

  osc.start(); osc.stop(c.currentTime + 0.32)
  noiseSrc.start()
}

// Stress — dissonant buzz (440 Hz + 466 Hz tritone-adjacent clash)
export function playCheckStress() {
  const c = getCtx()
  const freqs = [440, 466]
  const m = master(c, 0.3)

  freqs.forEach((freq) => {
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const env = c.createGain()
    env.gain.setValueAtTime(0.001, c.currentTime)
    env.gain.linearRampToValueAtTime(1, c.currentTime + 0.01)
    env.gain.setValueAtTime(1, c.currentTime + 0.08)
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22)

    osc.connect(env)
    env.connect(m)
    osc.start()
    osc.stop(c.currentTime + 0.25)
  })
}
