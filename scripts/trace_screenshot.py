#!/usr/bin/env python3
import sys
import os
import subprocess
import argparse
import shutil
import re
import time

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

def find_frame_end(trace_path, start_call):
    """
    Scans forward from start_call to find the next frame presentation.
    Returns the call number of the frame end.
    """
    # Scan reasonable range forward to find Present/SwapBuffers
    cmd = [APITRACE_CMD, "dump", f"--calls={start_call}-", trace_path]
    
    # Start process
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    end_call = None
    
    try:
        for line in proc.stdout:
            # Line format: "1234 IDirect3DDevice9::Present(...)"
            match = re.match(r"^(\d+)\s+([a-zA-Z0-9_:]+)", line)
            if match:
                call_no = int(match.group(1))
                func_name = match.group(2)
                
                if "Present" in func_name or "SwapBuffers" in func_name:
                    end_call = call_no
                    break
            
            # Safety break if we go too far (e.g. 20000 calls without a frame end?)
            # But frames can be huge. Let's rely on finding Present.
    except Exception as e:
        print(f"Error reading trace: {e}")
    finally:
        proc.kill()
    
    return end_call

def main():
    parser = argparse.ArgumentParser(description="Take screenshots of a specific call and its full frame from a trace.")
    parser.add_argument("trace", help="Path to .trace file")
    parser.add_argument("call", type=int, help="Call number")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.trace):
        print(f"Error: Trace file '{args.trace}' not found.")
        sys.exit(1)

    print(f"[-] Analyzing trace '{args.trace}' for Call {args.call}...")
    
    frame_end_call = find_frame_end(args.trace, args.call)
    
    snapshots = [str(args.call)]
    if frame_end_call and frame_end_call != args.call:
        print(f"    Found Frame End at Call {frame_end_call}")
        snapshots.append(str(frame_end_call))
    else:
        print("    Could not find distinct Frame End (or end of trace reached).")
    
    snapshot_arg = ",".join(snapshots)
    print(f"[-] Taking snapshots at calls: {snapshot_arg}")
    
    # Construct d3dretrace command
    cmd = []
    if D3DRETRACE_CMD.endswith(".exe"):
        cmd = ["wine", D3DRETRACE_CMD]
    else:
        cmd = [D3DRETRACE_CMD]
        
    # --headless avoids opening a window
    # --snapshot=CALLS takes snapshots
    cmd.extend(["--headless", f"--snapshot={snapshot_arg}", args.trace])
    
    print(f"    Running: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running retrace: {e}")
        sys.exit(1)
        
    print("[-] Done.")
    
    # List generated files
    trace_base = os.path.basename(args.trace)
    cwd_files = os.listdir(".")
    generated = []
    
    # d3dretrace typically names them "{trace_filename}.{call}.png"
    # Note: retrace might handle filenames differently depending on version.
    # Often it is just {call}.png or {trace}.{call}.png
    
    for f in cwd_files:
        if f.endswith(".png"):
            for s in snapshots:
                # Check for call number in filename (surrounded by dots or at start/end)
                if f".{s}." in f or f.endswith(f".{s}.png") or f == f"{s}.png":
                    generated.append(f)
    
    if generated:
        print("    Generated images:")
        for g in sorted(set(generated)):
            print(f"     - {g}")
    else:
        print("    Warning: No PNG files detected matching the call numbers. Check current directory.")

if __name__ == "__main__":
    main()
