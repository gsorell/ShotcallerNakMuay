"""Build a ShotCaller highlight reel from hand-picked strike timestamps.

Usage: python scripts/reel_reference.py <source_full.mp4> <output.mp4> [variety]

Offline reference renderer for side-by-side checks of the app's reel (hand-picked
times for the 2026-11-19 session; edit CLIPS/VARIETY for another recording).
Edit CLIPS to change the cut list (start, end in source seconds).
"""
import subprocess, sys, os, tempfile

SRC, OUT = sys.argv[1], sys.argv[2]

CLIPS = [  # (start, end, note)
    (0.0, 1.9, "app title card"),
    # in round order (R1 -> R5); finale kept last
    (31.9, 33.9, "R1 roundhouse"),
    (56.8, 59.4, "R1 knee -> roundhouse"),
    (85.4, 88.6, "R1 knee, punches, kick"),
    (127.9, 129.9, "R1 kick"),
    (134.9, 137.9, "R1 kick -> knee"),
    (149.0, 151.4, "R1 kick -> knee"),
    (209.8, 211.6, "R2 knee"),
    (241.8, 244.4, "R2 roundhouse + knee"),
    (340.0, 341.9, "R3 knee -> kick"),
    (395.0, 396.6, "R3 roundhouse"),
    (408.6, 410.9, "R3 knees"),
    (415.0, 416.8, "R3 kick"),
    (430.2, 432.8, "R3 knee -> high kick"),
    (473.8, 475.4, "R3 kick"),
    (666.4, 668.0, "R4 kick"),
    (793.6, 795.4, "R5 knee"),
    (786.4, 789.2, "R5 cross, knee, kick (finale)"),
]
# One clip per technique family, round order, finale last.
VARIETY = [
    (0.0, 1.9, "app title card"),
    (9.4, 10.9, "R1 jab -> knee"),
    (26.1, 27.9, "R1 roundhouse -> teep"),
    (43.2, 44.6, "R1 roundhouse (single)"),
    (76.5, 77.9, "R1 cross -> teep"),
    (85.6, 87.1, "R1 skip knee"),
    (107.9, 109.5, "R1 cross, knee, cross, knee"),
    (196.4, 198.0, "R2 low kick -> double knee"),
    (241.8, 244.4, "R2 roundhouse -> knee"),
    (431.4, 433.3, "R3 triple roundhouse"),
    (666.4, 668.0, "R4 roundhouse (open side)"),
    (786.4, 789.2, "R5 cross, knee, kick (finale)"),
]
if len(sys.argv) > 3 and sys.argv[3] == "variety":
    CLIPS = VARIETY
SLOMO = (788.2, 789.1)  # finale kick replayed at half speed

LOOK = ("fps=30,scale=1080:1920:flags=lanczos,"
        "eq=contrast=1.08:saturation=1.18:brightness=0.01,unsharp=5:5:0.6")
ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]

tmp = tempfile.mkdtemp(prefix="reel_")
parts = []

def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, check=True)

for i, (s, e, _) in enumerate(CLIPS):
    d = e - s
    p = os.path.join(tmp, f"c{i:02d}.mp4")
    run(["-ss", f"{s}", "-t", f"{d}", "-i", SRC,
         "-vf", LOOK,
         "-af", f"afade=t=in:d=0.03,afade=t=out:st={d-0.05:.3f}:d=0.05",
         *ENC, p])
    parts.append(p)

# slow-motion replay: motion-interpolated half speed, quieter audio, fade to black
s, e = SLOMO; d = e - s
p = os.path.join(tmp, "slomo.mp4")
run(["-ss", f"{s}", "-t", f"{d}", "-i", SRC,
     "-vf", "setpts=2.0*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1,"
            + LOOK + f",fade=t=out:st={2*d-0.5:.2f}:d=0.5",
     "-af", f"atempo=0.5,volume=0.6,afade=t=out:st={2*d-0.5:.2f}:d=0.5",
     *ENC, p])
parts.append(p)

lst = os.path.join(tmp, "list.txt")
with open(lst, "w") as f:
    f.writelines(f"file '{x}'\n".replace("\\", "/") for x in parts)
joined = os.path.join(tmp, "joined.mp4")
run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined])
# final: loudness normalise for social (-14 LUFS), web-friendly mp4
run(["-i", joined, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", OUT])
print("wrote", OUT)
