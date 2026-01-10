let sharedAudioContext: AudioContext | null = null;
let resumePromise: Promise<AudioContext> | null = null;

function getAudioContext(): AudioContext {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    return sharedAudioContext;
  }

  if (!window.AudioContext) {
    throw new Error("Web Audio API not supported");
  }

  sharedAudioContext = new window.AudioContext({ latencyHint: "balanced" });
  return sharedAudioContext;
}

export async function getPlayableAudioContext(): Promise<AudioContext> {
  const audioContext = getAudioContext();

  if (audioContext.state === "running") return audioContext;
  if (resumePromise != null) return resumePromise;

  resumePromise = audioContext.resume()
    .then(() => audioContext)
    .finally(() => { resumePromise = null; });

  return resumePromise;
}
