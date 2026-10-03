<script lang="ts">
  /**
   * All noise is generated in real time via Web Audio's AudioWorklet
   * (public/audio/noise-processor.js) — no audio files, no download, no
   * loop-point click, plays forever. "Grey" noise isn't a separate
   * generator: it's plain white noise reshaped by a BiquadFilterNode EQ
   * chain (boosted lows/highs, cut mids) approximating the perceptual
   * idea of grey noise — equal loudness across the spectrum rather than
   * equal energy. It's a practical approximation, not a scientifically
   * precise equal-loudness-contour filter.
   *
   * No progress bar by design — this isn't a track with a duration, it's
   * an endless signal you start and stop.
   */
  import { onMount } from "svelte";

  type NoiseType = "white" | "pink" | "brown" | "grey";

  const NOISE_TYPES: { id: NoiseType; label: string }[] = [
    { id: "white", label: "white" },
    { id: "pink", label: "pink" },
    { id: "brown", label: "brown" },
    { id: "grey", label: "grey" },
  ];

  const VOLUME_STEP = 0.1;

  let noiseType: NoiseType = $state("white");
  let isPlaying = $state(false);
  let volume = $state(0.5);
  let supported = $state(true);

  // Plain variables, not $state — these are imperative Web Audio objects,
  // not UI state. Re-rendering has nothing to do with them.
  let audioContext: AudioContext | null = null;
  let noiseNode: AudioWorkletNode | null = null;
  let gainNode: GainNode | null = null;
  let greyLowShelf: BiquadFilterNode | null = null;
  let greyMidCut: BiquadFilterNode | null = null;
  let greyHighShelf: BiquadFilterNode | null = null;
  let settingUp: Promise<void> | null = null;

  const volumePercent = $derived(Math.round(volume * 100));

  // The worklet only knows how to generate white/pink/brown — grey reuses
  // "white" at the source and gets shaped afterward in the graph.
  function workletNoiseType(type: NoiseType): "white" | "pink" | "brown" {
    return type === "grey" ? "white" : type;
  }

  async function setupAudioGraph() {
    if (audioContext) return;

    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) {
      supported = false;
      return;
    }

    const ctx = new AudioContextCtor();
    try {
      await ctx.audioWorklet.addModule("/audio/noise-processor.js");
    } catch {
      supported = false;
      await ctx.close();
      return;
    }

    const noise = new AudioWorkletNode(ctx, "noise-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    noise.port.postMessage({ noiseType: workletNoiseType(noiseType) });

    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 150;
    lowShelf.gain.value = 6;

    const midCut = ctx.createBiquadFilter();
    midCut.type = "peaking";
    midCut.frequency.value = 2000;
    midCut.Q.value = 0.7;
    midCut.gain.value = -8;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 6000;
    highShelf.gain.value = 6;

    lowShelf.connect(midCut);
    midCut.connect(highShelf);

    audioContext = ctx;
    noiseNode = noise;
    gainNode = gain;
    greyLowShelf = lowShelf;
    greyMidCut = midCut;
    greyHighShelf = highShelf;

    rewireGraph();
    await ctx.suspend();
  }

  function rewireGraph() {
    if (!noiseNode || !gainNode || !greyLowShelf || !greyHighShelf) return;
    noiseNode.disconnect();
    greyHighShelf.disconnect();

    if (noiseType === "grey") {
      noiseNode.connect(greyLowShelf);
      greyHighShelf.connect(gainNode);
    } else {
      noiseNode.connect(gainNode);
    }
  }

  function selectNoiseType(type: NoiseType) {
    noiseType = type;
    noiseNode?.port.postMessage({ noiseType: workletNoiseType(type) });
    rewireGraph();
  }

  async function togglePlay() {
    if (!audioContext) {
      if (!settingUp) settingUp = setupAudioGraph();
      await settingUp;
      settingUp = null;
      if (!supported) return;
    }
    if (!audioContext) return;

    if (isPlaying) {
      await audioContext.suspend();
      isPlaying = false;
    } else {
      await audioContext.resume();
      isPlaying = true;
    }
  }

  function adjustVolume(delta: number) {
    volume = Math.min(1, Math.max(0, Math.round((volume + delta) * 100) / 100));
    if (gainNode) gainNode.gain.value = volume;
  }

  // Space toggles play/pause — but only when focus isn't already on one of
  // this component's own buttons. A focused button (e.g. "pink", or "+")
  // already activates itself on Space; stepping in there too would either
  // double-fire or hijack Space away from the control the user actually
  // tabbed to.
  function handleKeydown(event: KeyboardEvent) {
    if (event.code !== "Space") return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    togglePlay();
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      audioContext?.close();
    };
  });
</script>

<div class="mx-auto max-w-xs">
  <div class="border border-ink/30 p-6">
    <div class="flex justify-center gap-2 text-sm">
      {#each NOISE_TYPES as noise (noise.id)}
        <button
          type="button"
          onclick={() => selectNoiseType(noise.id)}
          aria-pressed={noiseType === noise.id}
          class={`border px-3 py-1.5 transition-colors ${
            noiseType === noise.id
              ? "border-red text-red"
              : "border-ink/30 text-ink/60 hover:border-red hover:text-red"
          }`}
        >
          {noise.label}
        </button>
      {/each}
    </div>

    <div class="mt-8 flex justify-center">
      <button
        type="button"
        onclick={togglePlay}
        disabled={!supported}
        aria-label={isPlaying ? "pause" : "play"}
        class="flex h-16 w-16 items-center justify-center border border-ink text-2xl transition-colors hover:border-red hover:text-red disabled:pointer-events-none disabled:opacity-30"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
    </div>

    <div class="mt-8 flex items-center justify-center gap-4 text-sm">
      <button
        type="button"
        onclick={() => adjustVolume(-VOLUME_STEP)}
        aria-label="decrease volume"
        class="border border-ink/30 px-3 py-1.5 text-ink/60 transition-colors hover:border-red hover:text-red"
      >
        &minus;
      </button>
      <span class="w-10 text-center text-ink/70">{volumePercent}%</span>
      <button
        type="button"
        onclick={() => adjustVolume(VOLUME_STEP)}
        aria-label="increase volume"
        class="border border-ink/30 px-3 py-1.5 text-ink/60 transition-colors hover:border-red hover:text-red"
      >
        +
      </button>
    </div>

    {#if !supported}
      <p class="mt-6 text-center text-xs text-red">
        Noise playback isn't supported in this browser.
      </p>
    {/if}
  </div>
</div>
