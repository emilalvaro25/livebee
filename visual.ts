/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

@customElement('gdm-live-audio-visuals')
export class GdmLiveAudioVisuals extends LitElement {
  private inputAnalyser: Analyser;
  private outputAnalyser: Analyser;

  private _outputNode: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;

  static styles = css`
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background-color: #100c14;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this.handleResize);
    this.visualize();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.resizeCanvas();
  };

  private resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  private visualize() {
    if (this.canvasCtx && this.inputAnalyser && this.outputAnalyser) {
      this.inputAnalyser.update();
      this.outputAnalyser.update();

      const canvas = this.canvas;
      const canvasCtx = this.canvasCtx;

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;
      const baseRadius = Math.min(WIDTH, HEIGHT) * 0.2;

      this.drawCircularVisualizer(
        canvasCtx,
        this.inputAnalyser.data,
        centerX,
        centerY,
        baseRadius * 1.5,
        '#D16BA5',
        '#FB5F5F',
        3,
      );

      canvasCtx.globalCompositeOperation = 'lighter';

      this.drawCircularVisualizer(
        canvasCtx,
        this.outputAnalyser.data,
        centerX,
        centerY,
        baseRadius,
        '#3b82f6',
        '#10b981',
        5,
      );

      canvasCtx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(() => this.visualize());
  }

  private drawCircularVisualizer(
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    centerX: number,
    centerY: number,
    radius: number,
    color1: string,
    color2: string,
    lineWidth: number,
  ) {
    const barCount = data.length;
    const sliceAngle = (Math.PI * 2) / barCount;
    const maxBarHeight = radius * 0.75;

    const gradient = ctx.createLinearGradient(
      centerX,
      centerY - radius - maxBarHeight,
      centerX,
      centerY + radius + maxBarHeight,
    );
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    for (let i = 0; i < barCount; i++) {
      const barHeight = (data[i] / 255) * maxBarHeight;
      const angle = i * sliceAngle - Math.PI / 2;

      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;
      const endX = centerX + Math.cos(angle) * (radius + barHeight);
      const endY = centerY + Math.sin(angle) * (radius + barHeight);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas');
    this.canvasCtx = this.canvas.getContext('2d');
    this.resizeCanvas();
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals': GdmLiveAudioVisuals;
  }
}
