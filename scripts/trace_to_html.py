#!/usr/bin/env python3
import sys
import os
import subprocess
import json
import re
import struct
import argparse
import tempfile
import shutil

# --- Configuration ---
# Paths to tools (adjust as needed or rely on PATH)
APITRACE_PATH = "/home/ratchet/Software/apitrace"
APITRACE_BIN = f"{APITRACE_PATH}/build/apitrace"  # or just "apitrace"
D3DRETRACE_BIN = f"{APITRACE_PATH}/build-mingw/d3dretrace.exe" # requires wine

def find_tool(path):
    if os.path.exists(path):
        return path
    if os.path.exists(os.path.basename(path)):
        return os.path.basename(path)
    # Check PATH
    which = shutil.which(os.path.basename(path))
    if which: return which
    return path # Return original and hope

APITRACE_CMD = find_tool(APITRACE_BIN)
D3DRETRACE_CMD = find_tool(D3DRETRACE_BIN)

class TraceProcessor:
    def __init__(self, trace_path, call_no, output_path):
        self.trace_path = trace_path
        self.call_no = int(call_no)
        self.output_path = output_path
        self.tmp_dir = tempfile.mkdtemp(prefix="l2_trace_")
        self.vertex_data = []
        self.uv_data = []
        self.texture_b64 = None
        self.matrices = {}
        self.primitive_type = "D3DPT_TRIANGLEFAN"
        self.indices = []

    def cleanup(self):
        shutil.rmtree(self.tmp_dir)

    def run_shell(self, cmd, outfile=None):
        # print(f"DEBUG: Running {' '.join(cmd)}")
        if outfile:
            with open(outfile, 'w') as f:
                return subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
        return subprocess.run(cmd, capture_output=True, text=True)

    def extract_draw_details(self):
        print(f"[-] Analyzing call {self.call_no}...")
        cmd = [APITRACE_CMD, "dump", f"--calls={self.call_no}", self.trace_path]
        res = self.run_shell(cmd)
        
        # Parse DrawPrimitive args
        # Example: IDirect3DDevice9::DrawPrimitive(..., PrimitiveType = D3DPT_TRIANGLEFAN, StartVertex = 1392, PrimitiveCount = 2)
        content = res.stdout
        
        prim_type_m = re.search(r"PrimitiveType\s*=\s*(\w+)", content)
        start_v_m = re.search(r"StartVertex\s*=\s*(\d+)", content)
        count_m = re.search(r"PrimitiveCount\s*=\s*(\d+)", content)
        
        if not (prim_type_m and start_v_m and count_m):
            print("Error: Could not parse DrawPrimitive call details.")
            return False

        self.prim_type = prim_type_m.group(1)
        self.start_vertex = int(start_v_m.group(1))
        self.prim_count = int(count_m.group(1))
        
        # Calculate vertex count
        if self.prim_type == "D3DPT_TRIANGLEFAN":
            self.vertex_count = self.prim_count + 2
            # Indices for Fan: 0, 1, 2; 0, 2, 3; ...
            for i in range(self.prim_count):
                self.indices.extend([0, i+1, i+2])
        elif self.prim_type == "D3DPT_TRIANGLESTRIP":
            self.vertex_count = self.prim_count + 2
             # Indices: 0,1,2; 1,2,3 (swap order for odd)
            for i in range(self.prim_count):
                if i % 2 == 0:
                    self.indices.extend([i, i+1, i+2])
                else:
                    self.indices.extend([i+1, i, i+2])
        elif self.prim_type == "D3DPT_TRIANGLELIST":
            self.vertex_count = self.prim_count * 3
            self.indices = list(range(self.vertex_count))
        else:
            print(f"Warning: Unsupported primitive type {self.prim_type}, defaulting to points")
            self.vertex_count = self.prim_count
            self.indices = []

        print(f"    Type: {self.prim_type}, Start: {self.start_vertex}, Count: {self.vertex_count}")
        return True

    def extract_vertex_blob(self):
        # 1. Find the Vertex Buffer Stream 0 state BEFORE the call
        # We search a range of calls backwards
        search_start = max(0, self.call_no - 5000)
        cmd = [APITRACE_CMD, "dump", f"--calls={search_start}-{self.call_no}", self.trace_path]
        res = self.run_shell(cmd)
        lines = res.stdout.splitlines()

        vb_addr = None
        stride = 24 # Default guess
        
        # Scan forward to find the LAST SetStreamSource(0, ...)
        for line in lines:
            if "SetStreamSource" in line and "StreamNumber = 0" in line:
                # pStreamData = 0xADDR
                addr_m = re.search(r"pStreamData\s*=\s*(0x[0-9a-fA-F]+)", line)
                stride_m = re.search(r"Stride\s*=\s*(\d+)", line)
                if addr_m: vb_addr = addr_m.group(1)
                if stride_m: stride = int(stride_m.group(1))

        if not vb_addr:
            print("Error: Could not find active Vertex Buffer (SetStreamSource).")
            return False

        print(f"    VB Address: {vb_addr}, Stride: {stride}")

        # 2. Find the Lock call corresponding to the StartVertex
        # We need a Lock on vb_addr where range covers (StartVertex * Stride)
        needed_offset = self.start_vertex * stride
        target_lock_call = None
        blob_offset = 0

        # Scan backwards from call_no looking for Locks on vb_addr
        # Parse lines like: CALL_NO IDirect3DVertexBuffer9::Lock(this = ADDR, OffsetToLock = OFF, SizeToLock = SZ, ...)
        
        for line in reversed(lines):
            if "::Lock" in line and vb_addr in line:
                # Extract Call No
                parts = line.split()
                try:
                    c_no = int(parts[0])
                except:
                    continue
                
                off_m = re.search(r"OffsetToLock\s*=\s*(\d+)", line)
                sz_m = re.search(r"SizeToLock\s*=\s*(\d+)", line)
                
                if off_m and sz_m:
                    lock_off = int(off_m.group(1))
                    lock_sz = int(sz_m.group(1))
                    
                    if lock_off <= needed_offset and (lock_off + lock_sz) >= (needed_offset + self.vertex_count * stride):
                        target_lock_call = c_no
                        blob_offset = needed_offset - lock_off
                        print(f"    Found Data Source: Call {c_no} (Offset {lock_off}, Size {lock_sz})")
                        break
        
        if target_lock_call is None:
            print("Error: Could not find Vertex Buffer Lock covering the draw range.")
            return False

        # 3. Dump the blob for that call
        blob_file = os.path.join(self.tmp_dir, "vertices.bin")
        # APITrace dumps blobs to filenames like "blob_callNUMBER.bin" in CWD.
        # We need to run it inside tmp_dir or move it.
        
        cwd = os.getcwd()
        os.chdir(self.tmp_dir)
        try:
            # Dump Lock call AND the one after it (usually memcpy)
            cmd = [os.path.join(cwd, APITRACE_CMD), "dump", f"--calls={target_lock_call}-{target_lock_call+1}", "--blobs", os.path.join(cwd, self.trace_path)]
            subprocess.run(cmd, capture_output=True)
            
            # Find the generated .bin file
            generated_blob = None
            files = os.listdir(".")
            for f in files:
                # Look for blob matching either call number
                if f.endswith(".bin") and (str(target_lock_call) in f or str(target_lock_call+1) in f):
                    generated_blob = f
                    break
            
            if not generated_blob:
                print(f"Error: Blob file not generated in {self.tmp_dir}")
                print(f"Files found: {files}")
                return False
                
            # Parse Blob
            with open(generated_blob, "rb") as f:
                data = f.read()
                
            # Extract vertices
            # Assuming Format: Float3 Pos, 4B Color, Float2 UV (Stride 24)
            # If stride is different, this needs logic.
            
            for i in range(self.vertex_count):
                local_off = blob_offset + (i * stride)
                if local_off + 24 > len(data):
                    print("Error: Blob too small for vertex data.")
                    break
                
                # Unpack
                # Pos (12 bytes), Color (4 bytes), UV (8 bytes) = 24
                # struct "fffIff"
                try:
                    v = struct.unpack_from("fffIff", data, local_off)
                    self.vertex_data.extend([v[0], v[1], v[2]])
                    self.uv_data.extend([v[4], v[5]])
                except struct.error:
                    print("Error parsing vertex structure.")
                    return False
                    
        finally:
            os.chdir(cwd)
            
        return True

    def extract_state(self):
        print(f"[-] Extracting State & Textures...")
        json_path = os.path.join(self.tmp_dir, "state.json")
        
        # d3dretrace needs to run via wine usually
        cmd = ["wine", D3DRETRACE_CMD, "-D", str(self.call_no), "--dump-format=json", self.trace_path]
        
        # Capture stdout to file (it can be large)
        try:
            with open(json_path, "w") as f:
                subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE)
        except Exception as e:
            print(f"Error running d3dretrace: {e}")
            return False

        # Parse JSON
        try:
            with open(json_path, "r", encoding="utf-8", errors="ignore") as f:
                state = json.load(f, strict=False)
        except Exception as e:
            print(f"Error parsing JSON state: {e}")
            return False

        # Helper to find key in nested dicts
        def find_key(data, target):
            if isinstance(data, dict):
                if target in data:
                    return data[target]
                for k, v in data.items():
                    res = find_key(v, target)
                    if res is not None:
                        return res
            return None

        # Matrices
        def get_matrix(name):
            vals = find_key(state, name)
            if not vals: return None
            # Flatten if it's a list of lists (rows)
            flat = []
            if isinstance(vals, list):
                for item in vals:
                    if isinstance(item, list):
                        flat.extend(item)
                    else:
                        flat.append(item)
            
            if len(flat) != 16: return None
            
            # D3D Row-Major memory matches GL Column-Major memory for standard transforms
            # (Row 1 D3D = Right Vector = Col 1 GL)
            # So we pass it 1:1.
            return flat

        self.matrices['VIEW'] = get_matrix("D3DTS_VIEW")
        self.matrices['PROJ'] = get_matrix("D3DTS_PROJECTION")
        
        if not self.matrices['VIEW']: print("Warning: View Matrix not found")
        if not self.matrices['PROJ']: print("Warning: Proj Matrix not found")

        # Texture
        # Recursive search for texture image
        self.texture_b64 = None
        
        def find_texture_data(obj):
            if isinstance(obj, dict):
                # Check if this object is a texture level 0
                # Often keys are "PS_RESOURCE_0_LEVEL_0"
                # But since we use find_key logic, we might just look for the object that has __data__ inside PS_RESOURCE_0_LEVEL_0
                pass 
            # It's easier to just find the key "PS_RESOURCE_0_LEVEL_0"
            pass

        t0 = find_key(state, "PS_RESOURCE_0_LEVEL_0")
        if t0 and isinstance(t0, dict) and "__data__" in t0:
             # Clean the base64 string
             self.texture_b64 = t0["__data__"].replace('\n', '').replace('\r', '').replace(' ', '')
             print(f"    Found Texture ({len(self.texture_b64)} bytes)")
        
        if not self.texture_b64:
            print("Warning: Texture not found.")
            # Placeholder pink texture
            self.texture_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

        return True

    def generate_html(self):
        print(f"[-] Generating HTML: {self.output_path}")
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Trace Viewer {self.call_no}</title>
    <style>
        body {{ margin: 0; background: #222; overflow: hidden; color: #fff; font-family: sans-serif; }}
        #info {{ position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); padding: 10px; pointer-events: none; }}
        canvas {{ position: absolute; left: 50%; transform: translateX(-50%); }}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.7/dat.gui.min.js"></script>
</head>
<body>
    <div id="info">
        Call {self.call_no}<br>
        Prim: {self.prim_type} ({self.prim_count})<br>
        Verts: {self.vertex_count}
    </div>
    <script>
        const vertices = {self.vertex_data};
        const uvs = {self.uv_data};
        const indices = {self.indices};
        
        const viewMat = {self.matrices.get('VIEW', [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])};
        const projMat = {self.matrices.get('PROJ', [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])};
        const texData = `data:image/png;base64,{self.texture_b64}`;

        const scene = new THREE.Scene();
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        if (uvs.length > 0) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        if (indices.length > 0) geometry.setIndex(indices);
        
        const loader = new THREE.TextureLoader();
        const texture = loader.load(texData);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        
        // Handle DXT/D3D vs GL flip if necessary (usually D3D V is flipped relative to GL)
        // texture.flipY = false; 

        const material = new THREE.MeshBasicMaterial({{ 
            map: texture, 
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        }});
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);

        // Camera Setup
        const camera = new THREE.Camera();
        const vM = new THREE.Matrix4().fromArray(viewMat);
        const pM = new THREE.Matrix4().fromArray(projMat);
        
        camera.projectionMatrix.copy(pM);
        camera.matrixWorldInverse.copy(vM);
        camera.matrixWorld.copy(vM).invert();
        
        camera.matrixAutoUpdate = false;
        camera.matrixWorldNeedsUpdate = false;

        const renderer = new THREE.WebGLRenderer({{ antialias: true }});
        renderer.setSize(1355, 793);
        document.body.appendChild(renderer.domElement);
        
        // Orbit Controlsish (Manual for raw matrices)
        // Since we override matrices, standard controls won't work well without hacks.
        // We'll just render static frame.

        function animate() {{
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }}
        animate();
    </script>
</body>
</html>"""
        
        with open(self.output_path, "w") as f:
            f.write(html)


def main():
    parser = argparse.ArgumentParser(description="Generate HTML viewer from D3D9 Trace Call")
    parser.add_argument("trace", help="Path to .trace file")
    parser.add_argument("call", help="Call number")
    parser.add_argument("-o", "--output", default="viewer.html", help="Output HTML file")
    args = parser.parse_args()

    processor = TraceProcessor(args.trace, args.call, args.output)
    
    try:
        if not processor.extract_draw_details(): return
        if not processor.extract_vertex_blob(): return
        if not processor.extract_state(): return
        processor.generate_html()
        print(f"[+] Done! Saved to {args.output}")
    finally:
        processor.cleanup()

if __name__ == "__main__":
    main()
