'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION = 11.5; // seconds of show before fade-out
const FADE = 0.9;

const STAGES = [
  'Warming up the pitch',
  'Connecting to peers',
  'Tuning the streams',
  'Polishing the pixels',
  'Kickoff',
];

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// Raymarched fly-through: twisting tunnel of glowing rings, orbiting beads and a
// morphing core. Palette is gold / coral / teal / lime (no purples).
const FRAG = `
precision highp float;
uniform vec2 r; uniform float t;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec3 pal(float x){
  vec3 a=vec3(1.00,0.72,0.08);
  vec3 b=vec3(1.00,0.30,0.22);
  vec3 c=vec3(0.00,0.88,0.80);
  vec3 d=vec3(0.55,0.95,0.15);
  x = fract(x)*4.0;
  if (x<1.0) return mix(a,b,smoothstep(0.0,1.0,x));
  if (x<2.0) return mix(b,c,smoothstep(1.0,2.0,x));
  if (x<3.0) return mix(c,d,smoothstep(2.0,3.0,x));
  return mix(d,a,smoothstep(3.0,4.0,x));
}

float sdTorus(vec3 p, float R, float w){ return length(vec2(length(p.xy)-R, p.z)) - w; }

// returns distance; writes ring id via global
float gid = 0.0;
float map(vec3 p, float cz){
  // twist the tunnel with depth
  p.xy *= rot(p.z*0.11 + sin(p.z*0.05 + t*0.3)*0.6);

  // repeating rings
  float cell = 5.0;
  float id = floor(p.z/cell + 0.5);
  vec3 q = p; q.z = mod(p.z + cell*0.5, cell) - cell*0.5;
  float pulse = 0.12 + 0.05*sin(t*3.0 + id*1.7);
  float d = sdTorus(q, 2.6 + 0.25*sin(id*0.9 + t), pulse);
  gid = id;

  // orbiting beads between rings
  float ang = atan(p.y, p.x);
  float sector = 6.2831853/10.0;
  float a2 = mod(ang + t*0.6*sign(sin(id)) + sector*0.5, sector) - sector*0.5;
  float rad = length(p.xy);
  vec3 b = vec3(rad*cos(a2) - 3.4, rad*sin(a2), q.z);
  float bead = length(b) - 0.16;
  if (bead < d){ d = bead; gid = id + 0.5; }

  // morphing core ahead of the camera
  vec3 c = p - vec3(0.0, 0.0, cz + 9.0);
  c.xy *= rot(t*0.8); c.yz *= rot(t*0.6);
  float core = length(c) - (1.1 + 0.18*sin(c.x*4.0 + t*2.0)*sin(c.y*4.0 - t*1.7)*sin(c.z*4.0 + t*2.3));
  if (core < d){ d = core; gid = floor(t*0.8); }
  return d;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*r) / r.y;
  float speed = 3.2 + 9.0*smoothstep(7.5, 10.5, t); // warp near the end
  float cz = t*speed*0.55 + 0.5*t*t*0.0;
  vec3 ro = vec3(0.35*sin(t*0.7), 0.3*cos(t*0.5), cz);
  vec3 rd = normalize(vec3(uv, 1.0 - 0.3*length(uv)));
  rd.xy *= rot(sin(t*0.35)*0.5 + 0.12*t);

  vec3 col = vec3(0.0);
  float dist = 0.0;
  for (int i=0; i<72; i++){
    vec3 pos = ro + rd*dist;
    float d = map(pos, cz);
    vec3 glow = pal(gid*0.137 + t*0.05 + dist*0.012);
    col += glow * (0.010 / (0.02 + abs(d)*abs(d)*9.0 + abs(d)*0.9));
    if (d < 0.002 || dist > 60.0) break;
    dist += d*0.62;
  }

  // depth fog -> deep warm-black, not purple
  col *= exp(-dist*0.028);
  col += vec3(0.02,0.03,0.04) * (1.0 - length(uv));

  // fade in at start, flash at the end
  col *= smoothstep(0.0, 1.8, t);
  float flash = smoothstep(10.4, 11.3, t) * (1.0 - smoothstep(11.3, 11.6, t));
  col += vec3(1.0,0.9,0.7) * flash * 1.2;

  // vignette + tone map
  col *= 1.0 - 0.55*dot(uv,uv);
  col = 1.0 - exp(-col*1.25);
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function Intro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; } catch {}
    if (!seen) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = 'hidden';
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
    let raf = 0;
    let prog: WebGLProgram | null = null;
    const start = performance.now();

    const finish = () => {
      setLeaving(true);
      try { sessionStorage.setItem('intro-seen', '1'); } catch {}
      setTimeout(() => {
        document.body.style.overflow = '';
        setShow(false);
      }, FADE * 1000);
    };

    if (gl) {
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uR = gl.getUniformLocation(prog, 'r');
      const uT = gl.getUniformLocation(prog, 't');

      const resize = () => {
        // render at reduced res for smooth fps on weak GPUs
        const scale = Math.min(window.devicePixelRatio || 1, 1.25) * 0.75;
        canvas.width = Math.floor(window.innerWidth * scale);
        canvas.height = Math.floor(window.innerHeight * scale);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener('resize', resize);

      const frame = (now: number) => {
        const t = (now - start) / 1000;
        gl.uniform2f(uR, canvas.width, canvas.height);
        gl.uniform1f(uT, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        setProgress(Math.min(t / DURATION, 1));
        setStage(Math.min(Math.floor((t / DURATION) * STAGES.length), STAGES.length - 1));
        if (t < DURATION) raf = requestAnimationFrame(frame);
        else finish();
      };
      raf = requestAnimationFrame(frame);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        document.body.style.overflow = '';
      };
    }

    // No WebGL: still honour the timed intro with a CSS background
    const iv = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      setProgress(Math.min(t / DURATION, 1));
      setStage(Math.min(Math.floor((t / DURATION) * STAGES.length), STAGES.length - 1));
      if (t >= DURATION) { clearInterval(iv); finish(); }
    }, 50);
    return () => { clearInterval(iv); document.body.style.overflow = ''; };
  }, [show]);

  if (!show) return null;

  return (
    <div className={`intro ${leaving ? 'intro-out' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-center">
        <h1 className="intro-logo">
          {'HAHA'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.2 + i * 0.16}s` }}>{ch}</span>
          ))}
        </h1>
        <p className="intro-sub">Football en direct</p>
      </div>
      <div className="intro-bottom">
        <div className="intro-stage" key={stage}>{STAGES[stage]}…</div>
        <div className="intro-bar"><div style={{ width: `${progress * 100}%` }} /></div>
      </div>
    </div>
  );
}
