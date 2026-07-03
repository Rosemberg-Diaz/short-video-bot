export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  outputPath: string;
  seed?: number;
}

export interface ImageGenerationProvider {
  readonly name: string;
  healthCheck(): Promise<void>;
  generate(request: ImageGenerationRequest): Promise<string>;
}
