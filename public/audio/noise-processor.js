/**
 * Runs on the audio render thread — generates white, pink, or brown noise
 * one sample at a time. "Grey" isn't generated here: it's plain white
 * noise shaped afterward by BiquadFilterNodes in the main graph (see
 * NoisePlayer.svelte), since that shaping is just an EQ curve, not a
 * different noise algorithm.
 *
 * Pink and brown use well-known public-domain DSP formulas (Paul Kellet's
 * refined pink-noise filter; brown as a leaky-integrated random walk) —
 * not something to reinvent.
 */
class NoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.noiseType = "white";
    this.b0 = this.b1 = this.b2 = this.b3 = this.b4 = this.b5 = this.b6 = 0;
    this.lastBrown = 0;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.noiseType === "string") {
        this.noiseType = event.data.noiseType;
      }
    };
  }

  nextWhite() {
    return Math.random() * 2 - 1;
  }

  nextPink() {
    const white = this.nextWhite();
    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
    this.b2 = 0.969 * this.b2 + white * 0.153852;
    this.b3 = 0.8665 * this.b3 + white * 0.3104856;
    this.b4 = 0.55 * this.b4 + white * 0.5329522;
    this.b5 = -0.7616 * this.b5 - white * 0.016898;
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
    this.b6 = white * 0.115926;
    return out * 0.11;
  }

  nextBrown() {
    const white = this.nextWhite();
    this.lastBrown = (this.lastBrown + 0.02 * white) / 1.02;
    return this.lastBrown * 3.5;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;

    for (let i = 0; i < frames; i++) {
      let sample;
      if (this.noiseType === "pink") sample = this.nextPink();
      else if (this.noiseType === "brown") sample = this.nextBrown();
      else sample = this.nextWhite();

      // Same sample to every channel — plain mono noise, not
      // independently generated per channel.
      for (let channel = 0; channel < output.length; channel++) {
        output[channel][i] = sample;
      }
    }

    return true;
  }
}

registerProcessor("noise-processor", NoiseProcessor);
