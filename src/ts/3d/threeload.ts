// @ts-nocheck
// TODO: MMDLoader and MMDAnimationHelper were removed in three.js 0.161+
// This file is kept for potential future use but is currently non-functional
const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight } = await import('three');
const { MMDLoader } = await import('three/examples/jsm/loaders/MMDLoader')
const { MMDAnimationHelper } = await import('three/examples/jsm/animation/MMDAnimationHelper');

export {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MMDLoader,
  MMDAnimationHelper,
};