declare module 'onnxruntime-node' {
  export class Tensor {
    constructor(type: string, data: Float32Array | Int32Array | Uint8Array, dims: number[]);
  }
  export class InferenceSession {
    static create(path: string | ArrayBuffer): Promise<InferenceSession>;
    run(feeds: Record<string, Tensor>): Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  }
}
