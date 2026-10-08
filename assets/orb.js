/**
 * ElevenLabs Conversational AI orb — vendored, unmodified apart from the
 * noise-texture URL and module export.
 *
 * Copyright (c) 2025 ElevenLabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: @elevenlabs/convai-widget-core@0.19.0
 *         https://github.com/elevenlabs/packages
 *         packages/convai-widget-core/dist/index.js (the `Orb` class)
 *
 * Local changes: noise texture URL -> /assets/orb-noise.png ; added `export`.
 * Licensed MIT. Not affiliated with or endorsed by ElevenLabs.
 */

var fK = "#version 300 es\nprecision highp float;\n\nuniform float uTime;\nuniform float uOffsets[7];\nuniform vec3 uColor1;\nuniform vec3 uColor2;\nuniform sampler2D uPerlinTexture;\n\nin vec2 vUv;\n\nout vec4 outColor;\n\nconst float PI = 3.14159265358979323846;\n\n// Draw a single oval with soft edges and calculate its gradient color\nbool drawOval(vec2 polarUv, vec2 polarCenter, float a, float b, bool reverseGradient, float softness, out vec4 color) {\n    vec2 p = polarUv - polarCenter;\n    float oval = (p.x * p.x) / (a * a) + (p.y * p.y) / (b * b);\n    \n    float edge = smoothstep(1.0, 1.0 - softness, oval);\n    \n    if (edge > 0.0) {\n        float gradient = reverseGradient ? (1.0 - (p.x / a + 1.0) / 2.0) : ((p.x / a + 1.0) / 2.0);\n        color = vec4(vec3(gradient), 0.8 * edge);\n        return true;\n    }\n    return false;\n}\n\n// Map grayscale value to a 4-color ramp (color1, color2, color3, color4)\nvec3 colorRamp(float grayscale, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {\n    if (grayscale < 0.33) {\n        return mix(color1, color2, grayscale * 3.0);\n    } else if (grayscale < 0.66) {\n        return mix(color2, color3, (grayscale - 0.33) * 3.0);\n    } else {\n        return mix(color3, color4, (grayscale - 0.66) * 3.0);\n    }\n}\n\nvec2 hash2(vec2 p) {\n    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);\n}\n\n// 2D noise for the ring\nfloat noise2D(vec2 p) {\n    vec2 i = floor(p);\n    vec2 f = fract(p);\n    \n    vec2 u = f * f * (3.0 - 2.0 * f);\n    float n = mix(\n        mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),\n            dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),\n        mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),\n            dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),\n        u.y\n    );\n\n    return 0.5 + 0.5 * n;\n}\n\nfloat sharpRing(vec2 uv, float theta, float time) {\n    float ringStart = 1.0;\n    float ringWidth = 0.5;\n    float noiseScale = 5.0;\n    \n    vec2 noiseCoord = vec2(theta / (2.0 * PI), time * 0.1);\n    noiseCoord *= noiseScale;\n    \n    float noise = noise2D(noiseCoord);\n    noise = (noise - 0.5) * 4.0;\n    \n    return ringStart + noise * ringWidth * 1.5;\n}\n\nfloat smoothRing(vec2 uv, float time) {\n    float angle = atan(uv.y, uv.x);\n    if (angle < 0.0) angle += 2.0 * PI;\n    \n    vec2 noiseCoord = vec2(angle / (2.0 * PI), time * 0.1);\n    noiseCoord *= 6.0;\n    \n    float noise = noise2D(noiseCoord);\n    noise = (noise - 0.5) * 8.0;\n    \n    float ringStart = 0.9;\n    float ringWidth = 0.3;\n    \n    return ringStart + noise * ringWidth;\n}\n\nvoid main() {\n    // Normalize vUv to be centered around (0.0, 0.0)\n    vec2 uv = vUv * 2.0 - 1.0;\n\n    // Convert uv to polar coordinates\n    float radius = length(uv);\n    float theta = atan(uv.y, uv.x);\n    if (theta < 0.0) theta += 2.0 * PI; // Normalize theta to [0, 2*PI]\n\n    // Initialize the base color to white\n    vec4 color = vec4(1.0, 1.0, 1.0, 1.0);\n\n    // Original parameters for the ovals in polar coordinates\n    float originalCenters[7] = float[7](0.0, 0.5 * PI, 1.0 * PI, 1.5 * PI, 2.0 * PI, 2.5 * PI, 3.0 * PI);\n\n    // Parameters for the animated centers in polar coordinates\n    float centers[7];\n    for (int i = 0; i < 7; i++) {\n        centers[i] = originalCenters[i] + 0.5 * sin(uTime / 20.0 + uOffsets[i]);\n    }\n\n    float a, b;\n    vec4 ovalColor;\n\n    // Check if the pixel is inside any of the ovals\n    for (int i = 0; i < 7; i++) {\n        float noise = texture(uPerlinTexture, vec2(mod(centers[i] + uTime * 0.05, 1.0), 0.5)).r;\n        a = noise * 1.5; // Increased variance: goes from 0.0 to 1.0\n        b = noise * 4.5; // Tall semi-minor axis\n        bool reverseGradient = (i % 2 == 1); // Reverse gradient for every second oval\n\n        // Calculate the distance in polar coordinates\n        float distTheta = abs(theta - centers[i]);\n        if (distTheta > PI) distTheta = 2.0 * PI - distTheta; // Shortest distance on circle\n        float distRadius = radius;\n\n        float softness = 0.4; // Controls edge softness (e.g. how much blur is applied to the ovals)\n\n        // Check if the pixel is inside the oval in polar coordinates\n        if (drawOval(vec2(distTheta, distRadius), vec2(0.0, 0.0), a, b, reverseGradient, softness, ovalColor)) {\n            // Blend the oval color with the existing color\n            color.rgb = mix(color.rgb, ovalColor.rgb, ovalColor.a);\n            color.a = max(color.a, ovalColor.a); // Max alpha\n        }\n    }\n    \n    // Calculate both noisy rings\n    float ringRadius1 = sharpRing(uv, theta, uTime);\n    float ringRadius2 = smoothRing(uv, uTime);\n    \n    // Blend both rings\n    float ringAlpha1 = (radius >= ringRadius1) ? 0.3 : 0.0;\n    float ringAlpha2 = smoothstep(ringRadius2 - 0.05, ringRadius2 + 0.05, radius) * 0.25;\n    \n    float totalRingAlpha = max(ringAlpha1, ringAlpha2);\n    \n    // Apply screen blend mode for combined rings\n    vec3 ringColor = vec3(1.0); // White ring color\n    color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - ringColor * totalRingAlpha);\n\n    // Define colours to ramp against greyscale (could increase the amount of colours in the ramp)\n    vec3 color1 = vec3(0.0, 0.0, 0.0); // Black\n    vec3 color2 = uColor1; // Darker Color\n    vec3 color3 = uColor2; // Lighter Color\n    vec3 color4 = vec3(1.0, 1.0, 1.0); // White\n\n    // Convert grayscale color to the color ramp\n    float luminance = color.r; \n    color.rgb = colorRamp(luminance, color1, color2, color3, color4); // Apply the color ramp\n\n    outColor = color;\n}\n", pK = "#version 300 es\nprecision highp float;\n\nin vec2 position;\n\nout vec2 vUv;\n\nvoid main() {\n  vUv = position * 0.5 + 0.5;\n  gl_Position = vec4(position, 0, 1);\n}\n", mK = 0, hK = new Float32Array([
	-1,
	1,
	-1,
	-1,
	1,
	1,
	1,
	-1
]), gK = "/assets/orb-noise.png", Orb = class e {
	static noiseImage;
	gl;
	program;
	startTime;
	targetSpeed = 0;
	speed = .5;
	rafId = null;
	resizeObserver;
	colorA = [
		0,
		0,
		0
	];
	colorB = [
		0,
		0,
		0
	];
	offsets = new Float32Array(7).map(() => Math.random() * Math.PI * 2);
	constructor(t) {
		let n = t.getContext("webgl2", {
			depth: !1,
			stencil: !1,
			preserveDrawingBuffer: !0
		});
		this.gl = n, this.program = this.setupProgram(fK, pK);
		let r = n.createTexture();
		n.bindTexture(n.TEXTURE_2D, r), n.texImage2D(n.TEXTURE_2D, 0, n.RGBA, 1, 1, 0, n.RGBA, n.UNSIGNED_BYTE, new Uint8Array([
			128,
			128,
			128,
			255
		])), e.noiseImage || (e.noiseImage = new Image(), e.noiseImage.crossOrigin = "anonymous", e.noiseImage.src = gK), e.noiseImage.complete ? this.copyNoiseImage() : e.noiseImage.addEventListener("load", this.copyNoiseImage);
		let i = n.createBuffer();
		n.bindBuffer(n.ARRAY_BUFFER, i), n.bufferData(n.ARRAY_BUFFER, hK, n.STATIC_DRAW), n.vertexAttribPointer(mK, 2, n.FLOAT, !1, 0, 0), n.enableVertexAttribArray(mK), this.updateColors("#2792DC", "#9CE6E6"), this.resizeObserver = new ResizeObserver((e) => {
			let n = e[0], r = n.devicePixelContentBoxSize ? n.devicePixelContentBoxSize[0] : n.contentBoxSize[0];
			t.width = Math.min(512, r.inlineSize), t.height = Math.min(512, r.blockSize), this.updateViewport();
		});
		let a = t.parentElement;
		if (a) try {
			this.resizeObserver.observe(a, { box: "device-pixel-content-box" });
		} catch {
			this.resizeObserver.observe(a);
		}
		this.startTime = performance.now(), this.rafId = requestAnimationFrame(this.render);
	}
	dispose() {
		this.rafId !== null && cancelAnimationFrame(this.rafId), this.resizeObserver?.disconnect(), this.gl = null, this.program = null;
	}
	updateViewport() {
		this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
	}
	updateColors(e, t) {
		this.gl && (this.colorA = this.updateColor("uColor1", e) ?? this.colorA, this.colorB = this.updateColor("uColor2", t) ?? this.colorB);
	}
	updateVolume(e, t) {
		this.targetSpeed = .2 + (1 - (t - 1) ** 2) * 1.8, this.targetSpeed > this.speed && (this.speed = this.targetSpeed), this.gl.uniform1f(this.gl.getUniformLocation(this.program, "uInputVolume"), e), this.gl.uniform1f(this.gl.getUniformLocation(this.program, "uOutputVolume"), t);
	}
	updateColor(e, t) {
		try {
			let n = parseInt(t.slice(1, 3), 16) / 255, r = parseInt(t.slice(3, 5), 16) / 255, i = parseInt(t.slice(5, 7), 16) / 255, a = [
				n ** 2.2,
				r ** 2.2,
				i ** 2.2
			];
			return this.gl.uniform3fv(this.gl.getUniformLocation(this.program, e), a), a;
		} catch (e) {
			console.error(`[ConversationalAI] Failed to parse ${t} as color:`, e);
		}
	}
	setupProgram(e, t) {
		let n = this.getShader(this.gl.FRAGMENT_SHADER, e), r = this.getShader(this.gl.VERTEX_SHADER, t);
		if (!n || !r) throw Error("Failed to compile shaders");
		if (this.program = this.gl.createProgram(), this.gl.attachShader(this.program, n), this.gl.attachShader(this.program, r), this.gl.linkProgram(this.program), !this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) throw Error("Failed to link program");
		return this.gl.useProgram(this.program), this.gl.uniform1i(this.gl.getUniformLocation(this.program, "uPerlinTexture"), 0), this.gl.uniform1fv(this.gl.getUniformLocation(this.program, "uOffsets"), this.offsets), this.gl.uniform3fv(this.gl.getUniformLocation(this.program, "uColor1"), this.colorA), this.gl.uniform3fv(this.gl.getUniformLocation(this.program, "uColor2"), this.colorB), this.program;
	}
	getShader(e, t) {
		let n = this.gl.createShader(e);
		return this.gl.shaderSource(n, t), this.gl.compileShader(n), this.gl.getShaderParameter(n, this.gl.COMPILE_STATUS) ? n : (this.gl.deleteShader(n), null);
	}
	copyNoiseImage = () => {
		this.gl && (this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, e.noiseImage), this.gl.generateMipmap(this.gl.TEXTURE_2D));
	};
	toDataURL = () => this.gl.canvas.toDataURL("image/png");
	render = () => {
		if (!this.gl) {
			this.rafId = null;
			return;
		}
		let e = (performance.now() - this.startTime) / 1e3;
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, "uTime"), e), this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4), this.rafId = requestAnimationFrame(this.render);
	};
};

export { Orb };
