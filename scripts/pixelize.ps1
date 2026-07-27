# Brain Gym sprite pipeline: generated PNG -> native pixel-art sprite with hard alpha.
#
# Magnific returns an opaque ~1024px "pixel-art look" image on a flat magenta key.
# This turns it into a real native-grid sprite: chroma-key the backdrop, auto-crop to
# the object, box-average downsample onto the native grid, hard alpha threshold, then
# snap every kept pixel to the approved palette. The result is a genuine limited-colour
# sprite instead of a shrunken illustration.
#
#   powershell -File scripts/pixelize.ps1 -In raw.png -Out apple.png -Size 64 `
#              -Palette "#3B3159,#F2685C,#D8453E,#9E2C33,#3E9E63,#FFF5DC"
#
# -Frames n treats the source as a horizontal strip. The crop window is the union of
# every frame's bounding box, so the registration point stays fixed across frames.
#
# The pixel work lives in an Add-Type C# helper: the same loops written in PowerShell
# take minutes on a 1024x1024 source.

param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [Parameter(Mandatory=$true)][int]$Size,
  [Parameter(Mandatory=$true)][string]$Palette,
  [int]$Frames = 1,
  [int]$Pad = 2,                 # native px of transparent padding per side
  [string]$Key = "#FF00FF",
  [int]$KeyTolerance = 130,
  [double]$AlphaCut = 0.45,
  [int]$InsetX = 0,           # ignore this many source px at each frame's left/right edge
  [int]$InsetY = 0,           # ...and at the top/bottom. Removes generated cell dividers.
  [switch]$NoCrop,
  [switch]$NoDespeckle,
  [switch]$AlignFrames
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Pixelize {
  public static string Run(string inPath, string outPath, int size, int[] pal, int frames,
                           int pad, int keyR, int keyG, int keyB, int keyTol,
                           double alphaCut, bool noCrop, bool despeckle, bool align, int insetX, int insetY) {
    byte[] buf; int w, h, stride;
    using (Bitmap src = (Bitmap)Image.FromFile(inPath)) {
      w = src.Width; h = src.Height;
      BitmapData d = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      stride = d.Stride;
      buf = new byte[stride * h];
      Marshal.Copy(d.Scan0, buf, 0, buf.Length);
      src.UnlockBits(d);
    }

    // A generated strip often arrives with thin divider lines drawn on the cell edges.
    // Insetting the usable area of every frame drops them before anything is measured.
    int fw = w / frames;
    int ux0 = insetX, ux1 = fw - insetX;
    int uy0 = insetY, uy1 = h - insetY;
    int keyT2 = keyTol * keyTol;

    int cx0 = fw, cx1 = -1, cy0 = h, cy1 = -1;
    if (noCrop) { cx0 = ux0; cx1 = ux1 - 1; cy0 = uy0; cy1 = uy1 - 1; }
    else {
      for (int y = uy0; y < uy1; y++) {
        int row = y * stride;
        for (int f = 0; f < frames; f++) {
          int baseX = f * fw;
          for (int x = ux0; x < ux1; x++) {
            int i = row + (baseX + x) * 4;
            int dr = buf[i + 2] - keyR, dg = buf[i + 1] - keyG, db = buf[i] - keyB;
            if (dr * dr + dg * dg + db * db < keyT2) continue;
            if (x < cx0) cx0 = x;
            if (x > cx1) cx1 = x;
            if (y < cy0) cy0 = y;
            if (y > cy1) cy1 = y;
          }
        }
      }
      if (cx1 < 0) throw new Exception("everything was keyed out - check Key/KeyTolerance");
    }

    int bw = cx1 - cx0 + 1, bh = cy1 - cy0 + 1;
    double side = Math.Max(bw, bh) * ((double)size / (size - 2 * pad));
    double cell = side / size;

    // One window per frame. Centred by default; -AlignFrames instead pins each frame's
    // own top-left bbox corner, which cancels the drift diffusion models introduce
    // across strip frames and keeps the registration point fixed.
    double[] wx = new double[frames], wy = new double[frames];
    for (int f = 0; f < frames; f++) {
      wx[f] = (cx0 + cx1) / 2.0 - side / 2.0;
      wy[f] = (cy0 + cy1) / 2.0 - side / 2.0;
    }
    if (align && !noCrop) {
      for (int f = 0; f < frames; f++) {
        int fx0 = fw, fy0 = h;
        int baseX = f * fw;
        for (int y = uy0; y < uy1; y++) {
          int row = y * stride;
          for (int x = ux0; x < ux1; x++) {
            int i = row + (baseX + x) * 4;
            int dr = buf[i + 2] - keyR, dg = buf[i + 1] - keyG, db = buf[i] - keyB;
            if (dr * dr + dg * dg + db * db < keyT2) continue;
            if (x < fx0) fx0 = x;
            if (y < fy0) fy0 = y;
          }
        }
        wx[f] = fx0 - pad * cell;
        wy[f] = fy0 - pad * cell;
      }
    }

    int outW = size * frames;
    int kept = 0;
    bool[] usedPal = new bool[pal.Length / 3];

    using (Bitmap dst = new Bitmap(outW, size, PixelFormat.Format32bppArgb)) {
      BitmapData od = dst.LockBits(new Rectangle(0, 0, outW, size), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      int ostride = od.Stride;
      byte[] obuf = new byte[ostride * size];

      for (int f = 0; f < frames; f++) {
        int frameX0 = f * fw;
        for (int gy = 0; gy < size; gy++) {
          int y0 = (int)Math.Floor(wy[f] + gy * cell), y1 = (int)Math.Floor(wy[f] + (gy + 1) * cell);
          if (y1 <= y0) y1 = y0 + 1;
          if (y0 < uy0) y0 = uy0;
          if (y1 > uy1) y1 = uy1;
          for (int gx = 0; gx < size; gx++) {
            int x0 = (int)Math.Floor(wx[f] + gx * cell), x1 = (int)Math.Floor(wx[f] + (gx + 1) * cell);
            if (x1 <= x0) x1 = x0 + 1;
            if (x0 < ux0) x0 = ux0;
            if (x1 > ux1) x1 = ux1;

            double r = 0, g = 0, b = 0;
            int n = 0, total = 0;
            for (int y = y0; y < y1; y++) {
              int row = y * stride;
              for (int x = x0; x < x1; x++) {
                int i = row + (frameX0 + x) * 4;
                total++;
                int dr = buf[i + 2] - keyR, dg = buf[i + 1] - keyG, db = buf[i] - keyB;
                if (dr * dr + dg * dg + db * db < keyT2) continue;
                r += buf[i + 2]; g += buf[i + 1]; b += buf[i]; n++;
              }
            }

            int oi = gy * ostride + (f * size + gx) * 4;
            if (total == 0 || (double)n / total < alphaCut) continue;   // leaves 0,0,0,0

            r /= n; g /= n; b /= n;
            int best = 0; double bestD = double.MaxValue;
            for (int p = 0; p < pal.Length; p += 3) {
              double dr = r - pal[p], dg = g - pal[p + 1], db = b - pal[p + 2];
              // luma-weighted distance keeps the dark-plum outline from collapsing into ink
              double dd = 0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
              if (dd < bestD) { bestD = dd; best = p; }
            }
            obuf[oi] = (byte)pal[best + 2];
            obuf[oi + 1] = (byte)pal[best + 1];
            obuf[oi + 2] = (byte)pal[best];
            obuf[oi + 3] = 255;
            usedPal[best / 3] = true;
            kept++;
          }
        }
      }

      // Despeckle: a lone opaque pixel matching none of its 4 neighbours is downsample
      // noise, not craft. Adopt the majority neighbour so clusters stay clean.
      if (despeckle) {
        byte[] snap = (byte[])obuf.Clone();
        for (int y = 1; y < size - 1; y++) {
          for (int x = 1; x < outW - 1; x++) {
            int i = y * ostride + x * 4;
            if (snap[i + 3] == 0) continue;
            int[] nb = { i - 4, i + 4, i - ostride, i + ostride };
            int same = 0, bestI = -1, bestCount = 0;
            foreach (int j in nb) {
              if (snap[j + 3] == 0) continue;
              if (snap[j] == snap[i] && snap[j + 1] == snap[i + 1] && snap[j + 2] == snap[i + 2]) { same++; continue; }
              int c = 0;
              foreach (int k in nb)
                if (snap[k + 3] != 0 && snap[k] == snap[j] && snap[k + 1] == snap[j + 1] && snap[k + 2] == snap[j + 2]) c++;
              if (c > bestCount) { bestCount = c; bestI = j; }
            }
            if (same == 0 && bestCount >= 3 && bestI >= 0) {
              obuf[i] = snap[bestI]; obuf[i + 1] = snap[bestI + 1]; obuf[i + 2] = snap[bestI + 2];
            }
          }
        }
      }

      Marshal.Copy(obuf, 0, od.Scan0, obuf.Length);
      dst.UnlockBits(od);
      dst.Save(outPath, ImageFormat.Png);
    }

    int colours = 0;
    foreach (bool u in usedPal) if (u) colours++;
    return string.Format("{0}x{1}  opaque={2}/{3}  colours={4}  crop={5}x{6}@{7},{8}",
                         outW, size, kept, outW * size, colours, bw, bh, cx0, cy0);
  }
}
'@

function ConvertFrom-Hex([string]$hex) {
  $h = $hex.Trim().TrimStart('#')
  return @([Convert]::ToInt32($h.Substring(0,2),16),
           [Convert]::ToInt32($h.Substring(2,2),16),
           [Convert]::ToInt32($h.Substring(4,2),16))
}

$flat = New-Object System.Collections.Generic.List[int]
foreach ($c in $Palette.Split(',')) { (ConvertFrom-Hex $c) | ForEach-Object { $flat.Add($_) } }
$k = ConvertFrom-Hex $Key

$outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out }
           else { [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Out)) }
$dir = [System.IO.Path]::GetDirectoryName($outPath)
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

$info = [Pixelize]::Run((Resolve-Path $In).Path, $outPath, $Size, $flat.ToArray(), $Frames,
                        $Pad, $k[0], $k[1], $k[2], $KeyTolerance, $AlphaCut, [bool]$NoCrop, -not $NoDespeckle, [bool]$AlignFrames, $InsetX, $InsetY)
"$Out  $info"

