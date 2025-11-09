import React, { useRef, useState, useEffect } from "react";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs-backend-webgl";

export default function Baldifier() {
  const fileRef = useRef();
  const imgRef = useRef();
  const canvasRef = useRef();
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingModel(true);
      try {
        const m = await bodyPix.load({
          architecture: "MobileNetV1",
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        });
        if (mounted) setModel(m);
      } catch (e) {
        console.error("Model load error:", e);
      } finally {
        if (mounted) setLoadingModel(false);
      }
    }
    load();
    return () => (mounted = false);
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = imgRef.current;
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  async function makeBald() {
    if (!model) return alert("Model not ready yet.");
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img.src) return alert("Please upload an image first.");

    setProcessing(true);
    // set canvas size
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    try {
      // estimate segmentation
      const segmentation = await model.segmentPersonParts(img, {
        flipHorizontal: false,
        internalResolution: "medium",
        segmentationThreshold: 0.7
      });

      // BodyPix partIds: hair corresponds to partId 0? (Part IDs vary; we will use mask for hair by checking part labels)
      // Simpler and robust approach: create person mask for all person, then detect hair by color of part map (BodyPix part map uses part ids)
      // We'll treat part 0..10 hair-like indices: 0=leftFace,1=rightFace,2=leftUpperLeg... but these vary across versions.
      // So instead we will use "segmentPerson" to get mask and then refine using edge-detection near top of head.
      // For a simple, effective baldify: we use "segmentPerson" + face bounding box heuristics to remove top region.

      const personSeg = await model.segmentPerson(img, {
        internalResolution: "medium",
        segmentationThreshold: 0.7
      });

      // draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // create imageData
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // estimate face box: compute center of person mask per row to find topmost mask area -> approximate head top
      let minY = canvas.height, maxY = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = y * canvas.width + x;
          if (personSeg.data[idx] === 1) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // heuristics: head region likely in upper quarter of person mask
      const headTop = Math.max(0, minY);
      const headBottom = Math.min(canvas.height, minY + Math.floor((maxY - minY) * 0.6) + 60);

      // For every pixel in the head region that belongs to person mask, replace color by smoothed skin-tone (sample face area)
      // Sample a skin color from lower center of head area (chin) to use as fill
      const sampleY = Math.min(canvas.height - 1, headBottom - 5);
      const sampleX = Math.floor(canvas.width / 2);
      let sampleIdx = (sampleY * canvas.width + sampleX) * 4;
      const skinR = data[sampleIdx];
      const skinG = data[sampleIdx + 1];
      const skinB = data[sampleIdx + 2];

      // apply replacement: compute blurred skin fill for head-top region
      // We'll replace pixels in headTop..headBottom where personSeg===1 and with simple smoothing
      const radius = Math.max(8, Math.floor(canvas.width / 150));
      // helper to set pixel
      function setPixel(i, r, g, b, a = 255) {
        data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a;
      }

      // create a copy of original for sampling neighborhood blur
      const orig = new Uint8ClampedArray(data);

      for (let y = headTop; y < headBottom; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = y * canvas.width + x;
          if (personSeg.data[idx] === 1) {
            // replace with skin tone + slight blur of neighborhood
            let rSum = 0, gSum = 0, bSum = 0, c = 0;
            for (let yy = Math.max(0, y - radius); yy <= Math.min(canvas.height-1, y + radius); yy++) {
              for (let xx = Math.max(0, x - radius); xx <= Math.min(canvas.width-1, x + radius); xx++) {
                const ii = (yy * canvas.width + xx) * 4;
                rSum += orig[ii];
                gSum += orig[ii+1];
                bSum += orig[ii+2];
                c++;
              }
            }
            const rAvg = Math.round(rSum / c);
            const gAvg = Math.round(gSum / c);
            const bAvg = Math.round(bSum / c);
            // mix sampled skin color and neighborhood average to get natural look
            const mix = 0.6;
            const rFinal = Math.round(skinR * (1 - mix) + rAvg * mix);
            const gFinal = Math.round(skinG * (1 - mix) + gAvg * mix);
            const bFinal = Math.round(skinB * (1 - mix) + bAvg * mix);
            setPixel(idx*4, rFinal, gFinal, bFinal, 255);
          }
        }
      }

      // put imageData back
      ctx.putImageData(imgData, 0, 0);

      setProcessing(false);
    } catch (err) {
      console.error("Processing error", err);
      alert("Processing failed: " + err.message);
      setProcessing(false);
    }
  }

  const downloadResult = () => {
    const link = document.createElement("a");
    link.download = "baldified.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h2>Baldify — Browser-side</h2>
      <p>{loadingModel ? "Loading model..." : "Model loaded. Upload a face photo and click Baldify."}</p>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
      <div style={{ marginTop: 12 }}>
        <button onClick={makeBald} disabled={loadingModel || processing || !model}> {processing ? "Processing..." : "Baldify"} </button>
        <button onClick={downloadResult} style={{ marginLeft: 8 }}>Download</button>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
        <div>
          <p>Original</p>
          <img ref={imgRef} alt="upload preview" style={{ maxWidth: 320, maxHeight: 320, objectFit: "contain", border: "1px solid #ddd" }} />
        </div>
        <div>
          <p>Result</p>
          <canvas ref={canvasRef} style={{ maxWidth: 320, border: "1px solid #ddd" }} />
        </div>
      </div>

      <p style={{ marginTop: 12, color: "#666" }}>
        Tip: use clear frontal photos for best results. This is a heuristic approach using person segmentation; results vary by photo.
      </p>
    </div>
  );
}
