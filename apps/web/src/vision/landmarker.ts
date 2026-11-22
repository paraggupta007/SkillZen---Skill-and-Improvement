// Lazy-loaded MediaPipe adapter; model assets are fetched only after camera consent.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import simdLoader from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdBinary from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import fallbackLoader from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import fallbackBinary from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import type { Point } from "./analyzers";
/** Browser-only face landmark detector. */
export interface IFaceLandmarker {
  detect(video: HTMLVideoElement, timestamp: number): readonly Point[];
  close(): void;
}
/** Load MediaPipe and its official face model after the user opts in. */
export async function createFaceLandmarker(): Promise<IFaceLandmarker> {
  const simd = await FilesetResolver.isSimdSupported();
  const instance = await FaceLandmarker.createFromOptions(
    {
      wasmLoaderPath: simd ? simdLoader : fallbackLoader,
      wasmBinaryPath: simd ? simdBinary : fallbackBinary,
    },
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    },
  );
  return {
    detect: (video, timestamp) =>
      instance.detectForVideo(video, timestamp).faceLandmarks[0] ?? [],
    close: () => instance.close(),
  };
}
