import sys
import os
import subprocess
import json
import argparse
import json
import argparse
import math
import base64
import struct

APITRACE_PATH = "/home/ratchet/Software/apitrace"

def find_d3dretrace():
    # Look for d3dretrace.exe in likely build directories
    candidates = [
        f"{APITRACE_PATH}/{x}"
        for x in ("d3dretrace.exe",
        "build-mingw/d3dretrace.exe",
        "build-mingw/retrace/d3dretrace.exe",
        "build/d3dretrace.exe",)
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_colored_matrix(name, matrix_data):
    print(f"{Colors.BOLD}{Colors.GREEN}{name}{Colors.ENDC}")
    print(f"{Colors.YELLOW}[{Colors.ENDC}")
    for i, row in enumerate(matrix_data):
        print(f"  {Colors.YELLOW}[{Colors.ENDC}", end="")
        for j, val in enumerate(row):
            # Format with 12 chars width, 5 decimal places for nice alignment
            val_str = f"{val:12.5f}"
            print(f"{Colors.CYAN}{val_str}{Colors.ENDC}", end="")
            if j < len(row) - 1:
                print(f"{Colors.YELLOW},{Colors.ENDC}", end="")
        print(f"{Colors.YELLOW}]{Colors.ENDC}", end="")
        if i < len(matrix_data) - 1:
            print(f"{Colors.YELLOW},{Colors.ENDC}")
        else:
            print("")
    print(f"{Colors.YELLOW}]{Colors.ENDC}\n")

def find_apitrace_bin():
    candidates = [
        f"{APITRACE_PATH}/build/apitrace",
        f"{APITRACE_PATH}/build32/apitrace",
        "apitrace"
    ]
    for c in candidates:
        if os.path.exists(c):
            # Check if it's executable
            if os.access(c, os.X_OK) or c == "apitrace":
                return c
    return "apitrace"

def get_call_details(trace_path, call_no):
    # Run apitrace dump --calls=N
    apitrace_bin = find_apitrace_bin()
        
    cmd = [apitrace_bin, "dump", f"--calls={call_no}", trace_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        output = result.stdout
        # Example line: 8189596 IDirect3DDevice9::DrawPrimitive(this = 0x4a17ad8, PrimitiveType = D3DPT_TRIANGLEFAN, StartVertex = 1392, PrimitiveCount = 2) = D3D_OK
        import re
        start_v = re.search(r"StartVertex\s*=\s*(\d+)", output)
        prim_count = re.search(r"PrimitiveCount\s*=\s*(\d+)", output)
        prim_type = re.search(r"PrimitiveType\s*=\s*(\w+)", output)
        
        details = {
            "StartVertex": int(start_v.group(1)) if start_v else 0,
            "PrimitiveCount": int(prim_count.group(1)) if prim_count else 0,
            "PrimitiveType": prim_type.group(1) if prim_type else "UNKNOWN"
        }
        
        # Calculate vertex count based on primitive type
        v_count = 0
        if details["PrimitiveType"] == "D3DPT_TRIANGLEFAN":
            v_count = details["PrimitiveCount"] + 2
        elif details["PrimitiveType"] == "D3DPT_TRIANGLELIST":
            v_count = details["PrimitiveCount"] * 3
        elif details["PrimitiveType"] == "D3DPT_TRIANGLESTRIP":
            v_count = details["PrimitiveCount"] + 2
        else:
            v_count = details["PrimitiveCount"] * 2 # fallback
            
        details["VertexCount"] = v_count
        return details
    except Exception as e:
        print(f"Warning: Could not get call details: {e}")
        return None

def mat_mul_vec(mat, vec):
    # D3D uses row vectors: result = vec * mat
    res = [0, 0, 0, 0]
    for c in range(4):
        sum_val = 0
        for r in range(4):
            sum_val += vec[r] * mat[r][c]
        res[c] = sum_val
    return res

def extract_matrices(trace_path, call_no, d3dretrace_path):
    details = get_call_details(trace_path, call_no)
    
    cmd = ["wine", d3dretrace_path, "-D", str(call_no), "--dump-format=json", trace_path]
    
    print(f"{Colors.HEADER}Running: {" ".join(cmd)}{Colors.ENDC}")
    
    try:
        # Capture stdout and stderr
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"{Colors.RED}Error running d3dretrace:{Colors.ENDC}")
            print(result.stderr)
            return

        try:
            state = json.loads(result.stdout, strict=False)
        except json.JSONDecodeError as e:
            print(f"{Colors.RED}Failed to parse JSON output:{Colors.ENDC}")
            print(e)
            return

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

        # Extract matrices
        proj = find_key(state, "D3DTS_PROJECTION")
        view = find_key(state, "D3DTS_VIEW")
        world = find_key(state, "D3DTS_WORLD")
        
        if proj: print_colored_matrix("PROJECTION", proj)
        if view: print_colored_matrix("VIEW", view)
        if world: print_colored_matrix("WORLD", world)

        if world: print_colored_matrix("WORLD", world)

        if world: print_colored_matrix("WORLD", world)

        # Helper to parse PNG dimensions
        def get_png_dimensions(data):
            # Check signature
            if data[:8] != b'\x89PNG\r\n\x1a\n':
                return None, None
            # IHDR should be the first chunk
            # Offset 8: Length (4), Type (4), Data
            try:
                # We expect IHDR at offset 8
                chunk_len = struct.unpack(">I", data[8:12])[0]
                chunk_type = data[12:16]
                if chunk_type != b'IHDR':
                    return None, None
                
                width, height = struct.unpack(">II", data[16:24])
                return width, height
            except:
                return None, None

        # Texture Info
        tex0 = None
        tex_w = None
        tex_h = None
        
        # 1. Try standard Textures dictionary
        textures = find_key(state, "Textures")
        if textures and isinstance(textures, dict) and "0" in textures:
             tex0 = textures["0"]
        
        # 2. Try PS_RESOURCE_0_LEVEL_0 (Shader Bound)
        if not tex0:
            tex0 = find_key(state, "PS_RESOURCE_0_LEVEL_0")
            
        if tex0:
             w = tex0.get("Width")
             h = tex0.get("Height")
             fmt = tex0.get("Format") or "Unknown"
             
             # Fallback recursive search if not top-level
             if w is None: w = find_key(tex0, "Width")
             if h is None: h = find_key(tex0, "Height")
             if fmt == "Unknown": fmt = find_key(tex0, "Format") or "Unknown"
             
             # Fallback: Extract from __data__ blob if available (usually PNG)
             if (w is None or h is None) and "__data__" in tex0:
                 try:
                     b64 = tex0["__data__"].replace('\n', '').replace('\r', '').replace(' ', '')
                     bin_data = base64.b64decode(b64)
                     # Assuming PNG as apitrace usually dumps textures as PNG in JSON
                     pw, ph = get_png_dimensions(bin_data)
                     if pw:
                         w, h = pw, ph
                         fmt = "PNG (Extracted)"
                 except Exception as e:
                     pass
             
             if w is not None and h is not None:
                 print(f"{Colors.BOLD}{Colors.GREEN}Texture 0:{Colors.ENDC} {w}x{h} ({fmt})\n")
                 tex_w = w
                 tex_h = h
             else:
                 print(f"{Colors.YELLOW}Texture found but dimensions missing.{Colors.ENDC}\n")
        else:
             print(f"{Colors.YELLOW}No Texture found in state.{Colors.ENDC}\n")

        # Vertices
        vertices_obj = find_key(state, "Vertices")
        if vertices_obj and "data" in vertices_obj:
            v_data = vertices_obj["data"]
            print(f"{Colors.BOLD}{Colors.GREEN}Vertices for call {call_no}{Colors.ENDC}")
            if details:
                print(f"Type: {details['PrimitiveType']}, StartVertex: {details['StartVertex']}, Count: {details['VertexCount']}")
                start = details["StartVertex"]
                count = details["VertexCount"]
            else:
                start = 0
                count = 10
            
            # Combine matrices: Projection * View * World
            # We'll just do it manually if we want transformed.
            
            print(f"{Colors.YELLOW}{'Idx':>5} | {'Raw X':>10} {'Raw Y':>10} {'Raw Z':>10} | {'Proj X':>10} {'Proj Y':>10} {'Proj Z':>10}{Colors.ENDC}")
            print("-" * 80)
            
            raw_vertices = []
            
            for i in range(start, min(start + count, len(v_data))):
                v = v_data[i]
                raw_vertices.append(v)
                # Transform
                vt = [v[0], v[1], v[2], 1.0]
                if world: vt = mat_mul_vec(world, vt)
                if view: vt = mat_mul_vec(view, vt)
                if proj: vt = mat_mul_vec(proj, vt)
                
                # W-divide
                if vt[3] != 0:
                    v_final = [vt[0]/vt[3], vt[1]/vt[3], vt[2]/vt[3]]
                else:
                    v_final = [0,0,0]

                print(f"{i:>5} | {v[0]:10.3f} {v[1]:10.3f} {v[2]:10.3f} | {v_final[0]:10.3f} {v_final[1]:10.3f} {v_final[2]:10.3f}")

            if raw_vertices:
                print(f"\n{Colors.BOLD}{Colors.CYAN}--- Sprite Analysis ---{Colors.ENDC}")
                
                # Origin (Centroid)
                avg_x = sum(v[0] for v in raw_vertices) / len(raw_vertices)
                avg_y = sum(v[1] for v in raw_vertices) / len(raw_vertices)
                avg_z = sum(v[2] for v in raw_vertices) / len(raw_vertices)
                print(f"{Colors.GREEN}Origin (Centroid):{Colors.ENDC} {avg_x:.5f}, {avg_y:.5f}, {avg_z:.5f}")
                
                # Vectors from v0
                if len(raw_vertices) > 1:
                    v0 = raw_vertices[0]
                    print(f"{Colors.GREEN}Vectors from v0:{Colors.ENDC}")
                    
                    vectors = []
                    for k in range(1, len(raw_vertices)):
                        vk = raw_vertices[k]
                        vec = [vk[0]-v0[0], vk[1]-v0[1], vk[2]-v0[2]]
                        length = math.sqrt(sum(c*c for c in vec))
                        vectors.append({"idx": k, "vec": vec, "len": length})
                        print(f"  v0->v{k}: ({vec[0]:.5f}, {vec[1]:.5f}, {vec[2]:.5f}) Length: {length:.5f}")

                    # Attempt to extract basis/scale
                    # For a quad v0, v1, v2, v3, usually v1 and v3 are adjacent to v0
                    # and v2 is the opposite diagonal.
                    if len(raw_vertices) == 4:
                        # Vectors corresponding to edges
                        vec_x = vectors[0]["vec"] # v0->v1
                        vec_y = vectors[-1]["vec"] # v0->v3
                        
                        len_x = vectors[0]["len"]
                        len_y = vectors[-1]["len"]
                        
                        # Uniform Scale (average of Width and Height)
                        uniform_scale = (len_x + len_y) / 2.0
                        
                        # Normalize vectors to get rotation basis
                        def normalize(v):
                            l = math.sqrt(sum(c*c for c in v))
                            return [c/l for c in v] if l > 0 else [0,0,0]
                            
                        norm_x = normalize(vec_x)
                        norm_y = normalize(vec_y)
                        
                        # Calculate Z via cross product (Right-handed: X x Y)
                        # D3D is Left-Handed usually, but let's just do std cross
                        cx = norm_x[1]*norm_y[2] - norm_x[2]*norm_y[1]
                        cy = norm_x[2]*norm_y[0] - norm_x[0]*norm_y[2]
                        cz = norm_x[0]*norm_y[1] - norm_x[1]*norm_y[0]
                        norm_z = [cx, cy, cz]
                        
                        print(f"\n{Colors.BOLD}Reconstructed Transform (Uniform Scale):{Colors.ENDC}")
                        print(f"  {Colors.GREEN}Geometry Scale:{Colors.ENDC} {uniform_scale:.5f}")
                        
                        if tex_w:
                             draw_scale = uniform_scale / tex_w
                             print(f"  {Colors.GREEN}Estimated DrawScale:{Colors.ENDC} {draw_scale:.5f} (Geometry / TextureWidth {tex_w})")
                        
                        print(f"  {Colors.GREEN}Basis X (Right):{Colors.ENDC}   ({norm_x[0]:.5f}, {norm_x[1]:.5f}, {norm_x[2]:.5f})")
                        print(f"  {Colors.GREEN}Basis Y (Up):{Colors.ENDC}      ({norm_y[0]:.5f}, {norm_y[1]:.5f}, {norm_y[2]:.5f})")
                        print(f"  {Colors.GREEN}Basis Z (Forward):{Colors.ENDC} ({norm_z[0]:.5f}, {norm_z[1]:.5f}, {norm_z[2]:.5f})")
                        
                        # Verification check
                        dot = sum(norm_x[i]*norm_y[i] for i in range(3))
                        is_orthogonal = abs(dot) < 0.01
                        print(f"  Orthogonal Check (X.Y): {dot:.5f} [{'PASS' if is_orthogonal else 'FAIL'}]")


        elif not vertices_obj:
            print(f"\n{Colors.RED}No vertices found in state dump.{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.RED}An error occurred: {e}{Colors.ENDC}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract matrices from apitrace D3D9 trace.")
    parser.add_argument("trace_path", help="Path to the .trace file")
    parser.add_argument("call_no", type=int, help="Call number to dump state at")
    parser.add_argument("--d3dretrace", help="Path to d3dretrace.exe", default=None)

    args = parser.parse_args()

    retrace_bin = args.d3dretrace
    if not retrace_bin:
        retrace_bin = find_d3dretrace()
    
    if not retrace_bin:
        print("Could not find d3dretrace.exe. Please build it or specify path with --d3dretrace")
        sys.exit(1)

    extract_matrices(args.trace_path, args.call_no, retrace_bin)
