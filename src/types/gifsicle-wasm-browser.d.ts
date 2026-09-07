declare module "gifsicle-wasm-browser" {
  const gifsicle: {
    run(opts: {
      input: { file: Blob | File | ArrayBuffer | string; name: string }[];
      command: string[];
    }): Promise<File[]>;
  };
  export default gifsicle;
}
