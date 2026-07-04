import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from '@angular/core';

/* ------------------------------------------------------------------ */
/* Vertex shader — full-screen quad, passes normalised UV to fragment  */
/* ------------------------------------------------------------------ */
const VERT = /* glsl */ `
  attribute vec2 a_pos;
  varying   vec2 v_uv;

  void main() {
    v_uv        = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Fragment shader                                                      */
/*                                                                     */
/* Algorithm                                                           */
/*   • Sierpiński right-triangle via iterative IFS:                   */
/*       p = fract(p * 2)  →  remove if p.x + p.y > 1               */
/*     This produces the classic 7-level deep pixel-art fractal.      */
/*   • Seamless infinite zoom toward the self-similar corner (0,0):   */
/*       zoom = 2^fract(t)  →  1→2 then resets, pattern identical    */
/*       at both ends so the loop is imperceptible.                   */
/*   • Drop shadow: sample fractal at (p − 3px offset); if that is   */
/*     solid and the real pixel is not, render the shadow colour.     */
/* ------------------------------------------------------------------ */
const FRAG = /* glsl */ `
  precision mediump float;

  varying vec2  v_uv;
  uniform float u_time;  uniform vec2  u_res;
  /* ── Palette ───────────────────────────────────────────────── */
  const vec3 BG     = vec3(0.498, 0.753, 0.871);  /* #7FC0DE  */
  const vec3 TRI    = vec3(0.447, 0.067, 0.075);  /* #721113  */
  const vec3 SHADOW = vec3(0.220, 0.028, 0.032);  /* dark red */

  /* ── Sierpiński IFS (7 levels → 128-px grid resolution) ────── */
  bool sierpinski(vec2 p) {
    for (int i = 0; i < 7; i++) {
      p = fract(p * 2.0);
      if (p.x + p.y > 1.0) return false;
    }
    return true;
  }

  void main() {
    /* Seamless infinite zoom — period ≈ 25 s */
    float zoom = pow(2.0, fract(u_time * 0.04));

    /* Aspect-correct so pixels stay square regardless of the header    */
    /* shape; the fract() IFS tiles the pattern across the wide banner.  */
    float aspect = u_res.x / max(u_res.y, 1.0);

    /* Flip Y: triangle base faces the card body below */
    vec2 uv = vec2(v_uv.x * aspect, 1.0 - v_uv.y);

    /* Zoom into (0,0) — the self-similar corner */
    vec2 p = uv / zoom;

    /* Shadow offset: 3 "fractal pixels" toward bottom-right        */
    /* Fixed in fractal-space so it scales with zoom (looks natural) */
    const float PX = 1.0 / 128.0;
    vec2 sp = p - vec2(3.0 * PX, 3.0 * PX);

    bool isTri    = sierpinski(p);
    bool isShadow = sierpinski(sp);

    vec3 col = BG;
    if (isShadow) col = SHADOW;  /* shadow drawn first (behind) */
    if (isTri)    col = TRI;     /* triangle drawn on top       */

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * Dumb presentational component.
 * Renders a pixel-art (128 × 128 internal resolution) Sierpiński
 * triangle via WebGL with an infinite-zoom animation and a drop shadow.
 *
 * Usage:
 *   <nw-triangle-canvas />
 *
 * Sizing: the <canvas> is display:block; width/height: 100%; so the
 * parent determines the visual size. CSS `image-rendering: pixelated`
 * keeps the chunky pixel-art look on upscaling.
 */
@Component({
  selector: 'nw-triangle-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      class="block h-full w-full"
      style="image-rendering: pixelated; image-rendering: crisp-edges;"
      aria-hidden="true"
    ></canvas>
  `,
})
export class TriangleCanvasComponent implements OnDestroy {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private gl:    WebGLRenderingContext | null = null;
  private uTime: WebGLUniformLocation  | null = null;
  private uRes:  WebGLUniformLocation  | null = null;
  private rafId  = 0;
  private t0     = 0;
  private resizeObserver: ResizeObserver | null = null;

  /** Fixed vertical resolution keeps the chunky pixel-art look. */
  private static readonly BASE_HEIGHT = 110;

  constructor() {
    afterNextRender(() => this.boot());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /* ---------------------------------------------------------------- */
  /* Initialisation                                                    */
  /* ---------------------------------------------------------------- */

  private boot(): void {
    const canvas = this.canvasRef().nativeElement;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) {
      console.warn('nw-triangle-canvas: WebGL not supported');
      return;
    }
    this.gl = gl;

    const prog = this.buildProgram(gl);
    if (!prog) return;

    /* Full-screen triangle-strip quad: two triangles → whole viewport */
    const quad = new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]);
    const buf  = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(prog, 'u_time');
    this.uRes  = gl.getUniformLocation(prog, 'u_res');
    this.t0    = performance.now();

    /* Match the drawing buffer to the header aspect ratio so the        */
    /* square fractal is never non-uniformly squashed into noise.        */
    this.resize(canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas);

    this.tick();
  }

  private resize(canvas: HTMLCanvasElement): void {
    const gl = this.gl;
    if (!gl) return;

    const height = TriangleCanvasComponent.BASE_HEIGHT;
    const aspect =
      canvas.clientWidth > 0 && canvas.clientHeight > 0
        ? canvas.clientWidth / canvas.clientHeight
        : 1;
    const width = Math.max(1, Math.round(height * aspect));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  private buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
    const vs = this.compileShader(gl, gl.VERTEX_SHADER,   VERT);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('nw-triangle-canvas link error:', gl.getProgramInfoLog(prog));
      return null;
    }

    gl.useProgram(prog);
    return prog;
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: GLenum,
    src: string,
  ): WebGLShader | null {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('nw-triangle-canvas shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /* ---------------------------------------------------------------- */
  /* Render loop                                                       */
  /* ---------------------------------------------------------------- */

  private tick = (): void => {
    const gl = this.gl;
    if (!gl) return;

    gl.uniform1f(this.uTime, (performance.now() - this.t0) * 0.001);
    gl.uniform2f(this.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
