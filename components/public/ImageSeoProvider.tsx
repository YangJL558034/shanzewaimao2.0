"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ImageSeoMetadata = { src: string; width: number; height: number; alt?: string; title?: string };
export type ImageSeoMap = Record<string, ImageSeoMetadata>;

const ImageSeoContext = createContext<ImageSeoMap>({});

export function ImageSeoProvider({ images, children }: { images: ImageSeoMap; children: ReactNode }) {
  return <ImageSeoContext.Provider value={images}>{children}</ImageSeoContext.Provider>;
}

export function useImageSeo() {
  return useContext(ImageSeoContext);
}
