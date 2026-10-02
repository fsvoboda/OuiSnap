// Son d'obturateur synthétisé (deux claquements brefs), sans fichier audio à charger.
// À appeler depuis un appui de l'utilisateur : les navigateurs bloquent le son sinon.
let context: AudioContext | null = null;

function click(audio: AudioContext, at: number, duration: number, volume: number) {
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Bruit blanc qui s'éteint très vite : le claquement mécanique.
    samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.8;
  const gain = audio.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(at);
}

export function playShutter() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    click(context, now, 0.05, 0.9);
    click(context, now + 0.08, 0.07, 0.6);
  } catch {
    // Pas de son disponible : la photo est prise quand même.
  }
}
